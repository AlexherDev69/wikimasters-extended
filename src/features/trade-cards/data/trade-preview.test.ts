import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CardImage } from '../../missing-image/domain/card-image';
import { commonsThumbnailUrl } from '../../missing-image/domain/commons-url';
import { CARD_BUTTON_SELECTOR } from '../../letterboxd/data/card-button-selectors';
import { WIKIPEDIA_BUTTON_SELECTOR } from '../../wikipedia-link/data/wikipedia-button-selectors';
import { scanTradeChips, type ObservedTradeCard } from './scan-trade-chips';
import {
  applyTradePreview,
  removeStaleTradePreviews,
  removeTradePreviews,
  type TradeCardMarks,
} from './trade-preview';
import {
  TRADE_KIND_ATTRIBUTE,
  TRADE_PREVIEW_SELECTOR,
  TRADE_RARITY_ATTRIBUTE,
} from './trade-selectors';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** Two real offers of the exchange page, one card against one and one against four. */
const TRADES_HTML = readFileSync(join(FIXTURES_DIR, 'trades-list.html'), 'utf-8');

const IMAGE: CardImage = {
  fileName: 'Severance titlecard.jpg',
  kind: 'picture',
  thumbnailUrl: null,
};

const RESOLVED_IMAGE: CardImage = {
  fileName: 'Severance titlecard.jpg',
  kind: 'picture',
  thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/S.jpg/500px-S.jpg',
};

const EMBLEM: CardImage = { fileName: 'Opella logo.svg', kind: 'emblem', thumbnailUrl: null };

/** The cards of the fixture, with the chip of each one. */
function showTrades(): ObservedTradeCard[] {
  document.body.innerHTML = TRADES_HTML;
  const found = scanTradeChips(document.body);
  if (found.length < 2) {
    throw new Error('The fixture names no card');
  }
  return found;
}

function requireCard(found: readonly ObservedTradeCard[], index: number): ObservedTradeCard {
  const observed = found[index];
  if (observed === undefined) {
    throw new Error('The fixture names no card at that place');
  }
  return observed;
}

/**
 * The card with neither of the two marks of the extension, which is what
 * every test written before them is about. The marks have tests of their own,
 * at the foot of this file.
 */
const NO_MARKS: TradeCardMarks = { article: false, letterboxdUrl: null };

function applyPreview(
  observed: ObservedTradeCard,
  image: CardImage | null,
  marks: TradeCardMarks = NO_MARKS,
): Element | null {
  return applyTradePreview(observed, image, marks);
}

function previews(): NodeListOf<Element> {
  return document.body.querySelectorAll(TRADE_PREVIEW_SELECTOR);
}

function observeBody(): MutationObserver {
  const observer = new MutationObserver(() => undefined);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  });
  return observer;
}

describe('applyTradePreview', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should draw the card right before the chip that names it', () => {
    const first = requireCard(showTrades(), 0);

    const preview = applyPreview(first, null);

    expect(previews()).toHaveLength(1);
    expect(first.chip.previousElementSibling).toBe(preview);
  });

  it('should show the whole title when the chip of the site shows a cut one', () => {
    const severance = requireCard(showTrades(), 1);

    const preview = applyPreview(severance, null);

    expect(preview?.textContent).toContain('Saison 1 de Severance');
    expect(preview?.textContent).not.toContain('…');
  });

  it('should carry the rarity of the card, which the style sheet turns into its colour', () => {
    const first = requireCard(showTrades(), 0);

    const preview = applyPreview(first, null);

    expect(preview?.getAttribute(TRADE_RARITY_ATTRIBUTE)).toBe('sr');
    expect(preview?.textContent).toContain('SR');
  });

  it('should show the picture at the address built from the name when none was resolved', () => {
    const first = requireCard(showTrades(), 0);

    const preview = applyPreview(first, IMAGE);

    expect(preview?.querySelector('img')?.getAttribute('src')).toBe(
      commonsThumbnailUrl(IMAGE.fileName),
    );
  });

  it('should show the picture at the resolved address when the service worker gave one', () => {
    const first = requireCard(showTrades(), 0);

    const preview = applyPreview(first, RESOLVED_IMAGE);

    expect(preview?.querySelector('img')?.getAttribute('src')).toBe(RESOLVED_IMAGE.thumbnailUrl);
  });

  it('should ask for no picture at all when Wikidata knows none', () => {
    const first = requireCard(showTrades(), 0);

    const preview = applyPreview(first, null);

    expect(preview?.querySelector('img')).toBeNull();
  });

  it('should ask for no picture when the file name could never reach an address', () => {
    const first = requireCard(showTrades(), 0);

    const preview = applyPreview(first, {
      fileName: 'not a file at all',
      kind: 'picture',
      thumbnailUrl: null,
    });

    expect(preview?.querySelector('img')).toBeNull();
  });

  it('should tell an emblem from a photograph, which are not framed the same way', () => {
    const found = showTrades();

    const picture = applyPreview(requireCard(found, 0), IMAGE);
    const emblem = applyPreview(requireCard(found, 1), EMBLEM);

    expect(picture?.getAttribute(TRADE_KIND_ATTRIBUTE)).toBe('picture');
    expect(emblem?.getAttribute(TRADE_KIND_ATTRIBUTE)).toBe('emblem');
  });

  it('should write nothing on a second call with the same card and the same picture', () => {
    const first = requireCard(showTrades(), 0);
    applyPreview(first, IMAGE);
    const observer = observeBody();

    applyPreview(first, IMAGE);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a second call while the card has no picture', () => {
    const first = requireCard(showTrades(), 0);
    applyPreview(first, null);
    const observer = observeBody();

    applyPreview(first, null);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should draw the card again rather than patch it when its picture arrives', () => {
    const first = requireCard(showTrades(), 0);
    const before = applyPreview(first, null);

    const after = applyPreview(first, IMAGE);

    expect(previews()).toHaveLength(1);
    expect(after).not.toBe(before);
    expect(after?.querySelector('img')).not.toBeNull();
  });

  it('should leave the chip of the site exactly as it was', () => {
    const first = requireCard(showTrades(), 0);
    const chipHtml = first.chip.outerHTML;

    applyPreview(first, IMAGE);

    expect(first.chip.outerHTML).toBe(chipHtml);
  });

  it('should draw nothing for a chip the site has already taken off the page', () => {
    const first = requireCard(showTrades(), 0);
    first.chip.remove();

    expect(applyPreview(first, IMAGE)).toBeNull();
    expect(previews()).toHaveLength(0);
  });
});

describe('removeStaleTradePreviews', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should keep the previews it is given and take back the others', () => {
    const found = showTrades();
    const kept = applyPreview(requireCard(found, 0), null);
    applyPreview(requireCard(found, 1), null);

    removeStaleTradePreviews(document.body, new Set(kept === null ? [] : [kept]));

    expect([...previews()]).toEqual([kept]);
  });

  it('should take back a preview whose chip the site removed with its offer', () => {
    const first = requireCard(showTrades(), 0);
    applyPreview(first, null);
    first.chip.remove();

    removeStaleTradePreviews(document.body, new Set());

    expect(previews()).toHaveLength(0);
  });
});

describe('removeTradePreviews', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should take back every preview and leave the page as the site built it', () => {
    document.body.innerHTML = TRADES_HTML;
    const siteHtml = document.body.innerHTML;
    for (const observed of scanTradeChips(document.body)) {
      applyPreview(observed, IMAGE);
    }

    removeTradePreviews(document.body);

    expect(previews()).toHaveLength(0);
    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should do nothing when no preview was drawn', () => {
    document.body.innerHTML = TRADES_HTML;
    const observer = observeBody();

    removeTradePreviews(document.body);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});

describe('the two marks of the extension on a card of a trade offer', () => {
  /** The first card the fixture names, and the address of its article. */
  const FIRST_CARD_ARTICLE = 'https://fr.wikipedia.org/wiki/Itouroup';
  const FILM_URL = 'https://letterboxd.com/film/severance/';
  const BOTH_MARKS: TradeCardMarks = { article: true, letterboxdUrl: FILM_URL };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function articleButton(): HTMLAnchorElement | null {
    return document.body.querySelector<HTMLAnchorElement>(WIKIPEDIA_BUTTON_SELECTOR);
  }

  function letterboxdButton(): HTMLAnchorElement | null {
    return document.body.querySelector<HTMLAnchorElement>(CARD_BUTTON_SELECTOR);
  }

  /** The button of the site our card stands inside: the whole offer is one. */
  function offerButton(observed: ObservedTradeCard): HTMLElement {
    const button = observed.chip.closest('button');
    if (button === null) {
      throw new Error('The fixture holds no offer button');
    }
    return button;
  }

  it('should carry the button of the article, built from the title the chip names', () => {
    const first = requireCard(showTrades(), 0);

    applyPreview(first, null, { article: true, letterboxdUrl: null });

    expect(articleButton()?.getAttribute('href')).toBe(FIRST_CARD_ARTICLE);
    expect(letterboxdButton()).toBeNull();
  });

  it('should carry the Letterboxd button when the card has an address', () => {
    const first = requireCard(showTrades(), 0);

    applyPreview(first, null, { article: false, letterboxdUrl: FILM_URL });

    expect(letterboxdButton()?.getAttribute('href')).toBe(FILM_URL);
    expect(articleButton()).toBeNull();
  });

  it('should carry neither mark while both are switched off', () => {
    const first = requireCard(showTrades(), 0);

    applyPreview(first, null);

    expect(articleButton()).toBeNull();
    expect(letterboxdButton()).toBeNull();
  });

  it('should keep both marks silent and out of the tab order', () => {
    // The card of the extension stands inside a button of the site, which
    // takes its name from the text it holds: a labelled link of ours would be
    // read out in the middle of it, and would add a focus stop of its own.
    const first = requireCard(showTrades(), 0);

    applyPreview(first, null, BOTH_MARKS);

    for (const mark of [articleButton(), letterboxdButton()]) {
      expect(mark?.getAttribute('aria-hidden')).toBe('true');
      expect(mark?.getAttribute('aria-label')).toBeNull();
      expect(mark?.tabIndex).toBe(-1);
    }
  });

  it('should keep its own click, so the detail of the offer does not open behind it', () => {
    const first = requireCard(showTrades(), 0);
    applyPreview(first, null, BOTH_MARKS);
    const onOfferClick = vi.fn();
    offerButton(first).addEventListener('click', onOfferClick);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'isTrusted', { value: true });
    articleButton()?.dispatchEvent(event);

    expect(onOfferClick).not.toHaveBeenCalled();
    // Never `preventDefault`: the anchor keeps its own navigation.
    expect(event.defaultPrevented).toBe(false);
  });

  it('should write nothing on a second call carrying the same marks', () => {
    const first = requireCard(showTrades(), 0);
    applyPreview(first, IMAGE, BOTH_MARKS);
    const observer = observeBody();

    applyPreview(first, IMAGE, BOTH_MARKS);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should draw the card again when the Letterboxd address comes back', () => {
    // The address arrives with the batch that brings the picture, one sync
    // after the card was first drawn.
    const first = requireCard(showTrades(), 0);
    applyPreview(first, IMAGE, { article: true, letterboxdUrl: null });

    applyPreview(first, IMAGE, BOTH_MARKS);

    expect(previews()).toHaveLength(1);
    expect(letterboxdButton()?.getAttribute('href')).toBe(FILM_URL);
  });

  it('should take a mark back when its switch goes off', () => {
    const first = requireCard(showTrades(), 0);
    applyPreview(first, IMAGE, BOTH_MARKS);

    applyPreview(first, IMAGE, { article: false, letterboxdUrl: FILM_URL });

    expect(previews()).toHaveLength(1);
    expect(articleButton()).toBeNull();
    expect(letterboxdButton()).not.toBeNull();
  });

  it('should leave the page exactly as the site built it once the card is taken back', () => {
    document.body.innerHTML = TRADES_HTML;
    const siteHtml = document.body.innerHTML;
    for (const observed of scanTradeChips(document.body)) {
      applyPreview(observed, IMAGE, BOTH_MARKS);
    }

    removeTradePreviews(document.body);

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});
