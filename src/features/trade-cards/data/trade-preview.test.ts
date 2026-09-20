import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CardImage } from '../../missing-image/domain/card-image';
import { commonsThumbnailUrl } from '../../missing-image/domain/commons-url';
import { scanTradeChips, type ObservedTradeCard } from './scan-trade-chips';
import { applyTradePreview, removeStaleTradePreviews, removeTradePreviews } from './trade-preview';
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

    const preview = applyTradePreview(first, null);

    expect(previews()).toHaveLength(1);
    expect(first.chip.previousElementSibling).toBe(preview);
  });

  it('should show the whole title when the chip of the site shows a cut one', () => {
    const severance = requireCard(showTrades(), 1);

    const preview = applyTradePreview(severance, null);

    expect(preview?.textContent).toContain('Saison 1 de Severance');
    expect(preview?.textContent).not.toContain('…');
  });

  it('should carry the rarity of the card, which the style sheet turns into its colour', () => {
    const first = requireCard(showTrades(), 0);

    const preview = applyTradePreview(first, null);

    expect(preview?.getAttribute(TRADE_RARITY_ATTRIBUTE)).toBe('sr');
    expect(preview?.textContent).toContain('SR');
  });

  it('should show the picture at the address built from the name when none was resolved', () => {
    const first = requireCard(showTrades(), 0);

    const preview = applyTradePreview(first, IMAGE);

    expect(preview?.querySelector('img')?.getAttribute('src')).toBe(
      commonsThumbnailUrl(IMAGE.fileName),
    );
  });

  it('should show the picture at the resolved address when the service worker gave one', () => {
    const first = requireCard(showTrades(), 0);

    const preview = applyTradePreview(first, RESOLVED_IMAGE);

    expect(preview?.querySelector('img')?.getAttribute('src')).toBe(RESOLVED_IMAGE.thumbnailUrl);
  });

  it('should ask for no picture at all when Wikidata knows none', () => {
    const first = requireCard(showTrades(), 0);

    const preview = applyTradePreview(first, null);

    expect(preview?.querySelector('img')).toBeNull();
  });

  it('should ask for no picture when the file name could never reach an address', () => {
    const first = requireCard(showTrades(), 0);

    const preview = applyTradePreview(first, {
      fileName: 'not a file at all',
      kind: 'picture',
      thumbnailUrl: null,
    });

    expect(preview?.querySelector('img')).toBeNull();
  });

  it('should tell an emblem from a photograph, which are not framed the same way', () => {
    const found = showTrades();

    const picture = applyTradePreview(requireCard(found, 0), IMAGE);
    const emblem = applyTradePreview(requireCard(found, 1), EMBLEM);

    expect(picture?.getAttribute(TRADE_KIND_ATTRIBUTE)).toBe('picture');
    expect(emblem?.getAttribute(TRADE_KIND_ATTRIBUTE)).toBe('emblem');
  });

  it('should write nothing on a second call with the same card and the same picture', () => {
    const first = requireCard(showTrades(), 0);
    applyTradePreview(first, IMAGE);
    const observer = observeBody();

    applyTradePreview(first, IMAGE);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a second call while the card has no picture', () => {
    const first = requireCard(showTrades(), 0);
    applyTradePreview(first, null);
    const observer = observeBody();

    applyTradePreview(first, null);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should draw the card again rather than patch it when its picture arrives', () => {
    const first = requireCard(showTrades(), 0);
    const before = applyTradePreview(first, null);

    const after = applyTradePreview(first, IMAGE);

    expect(previews()).toHaveLength(1);
    expect(after).not.toBe(before);
    expect(after?.querySelector('img')).not.toBeNull();
  });

  it('should leave the chip of the site exactly as it was', () => {
    const first = requireCard(showTrades(), 0);
    const chipHtml = first.chip.outerHTML;

    applyTradePreview(first, IMAGE);

    expect(first.chip.outerHTML).toBe(chipHtml);
  });

  it('should draw nothing for a chip the site has already taken off the page', () => {
    const first = requireCard(showTrades(), 0);
    first.chip.remove();

    expect(applyTradePreview(first, IMAGE)).toBeNull();
    expect(previews()).toHaveLength(0);
  });
});

describe('removeStaleTradePreviews', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should keep the previews it is given and take back the others', () => {
    const found = showTrades();
    const kept = applyTradePreview(requireCard(found, 0), null);
    applyTradePreview(requireCard(found, 1), null);

    removeStaleTradePreviews(document.body, new Set(kept === null ? [] : [kept]));

    expect([...previews()]).toEqual([kept]);
  });

  it('should take back a preview whose chip the site removed with its offer', () => {
    const first = requireCard(showTrades(), 0);
    applyTradePreview(first, null);
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
      applyTradePreview(observed, IMAGE);
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
