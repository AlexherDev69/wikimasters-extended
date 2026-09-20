import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from '../../../core/logger/logger';
import { scanCards } from '../../card-detection/data/scan-cards';
import type { CardCategory } from '../../categorization/domain/category';
import type { CardToCategorize } from '../../categorization/domain/categorize-cards';
import { BADGE_SELECTOR, CATEGORY_LINE_SELECTOR } from '../../category-badge/data/badge-selectors';
import { CARD_BUTTON_SELECTOR } from '../../letterboxd/data/card-button-selectors';
import { LETTERBOXD_LINK_SELECTOR } from '../../letterboxd/data/modal-selectors';
import {
  CARD_ATTACK_VALUE_SELECTOR,
  HIDE_STATS_STYLE_SELECTOR,
  MODAL_ATTACK_PANELS_SELECTOR,
} from '../../hide-card-stats/data/hide-stats-selectors';
import { CARD_IMAGE_SELECTOR, IMAGE_CREDIT_SELECTOR } from '../../missing-image/data/image-selectors';
import type { CardImage } from '../../missing-image/domain/card-image';
import { TRADE_PREVIEW_SELECTOR } from '../../trade-cards/data/trade-selectors';

import {
  TAG_INPUT_SELECTOR,
  TAG_PROPOSAL_BUTTON_SELECTOR,
  TAG_PROPOSALS_SELECTOR,
} from '../../tag-suggestions/data/tag-selectors';
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import { createOverlay, type Overlay, type OverlayDeps } from './overlay';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const GRID_HTML = readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8');
const LARGE_HTML = readFileSync(join(FIXTURES_DIR, 'card-large-with-description.html'), 'utf-8');
const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

const PLACEHOLDER_HTML = readFileSync(join(FIXTURES_DIR, 'placeholder-cards.html'), 'utf-8');
/** Two offers of the exchange page, seven chips naming six distinct cards. */
const TRADES_HTML = readFileSync(join(FIXTURES_DIR, 'trades-list.html'), 'utf-8');

const GRID_CARD_TITLE = "Jeu d'horreur";
const LARGE_CARD_TITLE = 'Foza';
const MODAL_CARD_TITLE = 'Dvorichté';
/** A card of the catalogue export the site shows its own logo for. */
const PLACEHOLDER_CARD_TITLE = 'Adan Canto';
/** Named by both offers of the trade fixture, so two chips carry it. */
const TRADE_CARD_TITLE = 'Saison 1 de Severance';

const CARD_IMAGE: CardImage = {
  fileName: 'Adan Canto 2015.jpg',
  kind: 'picture',
  thumbnailUrl: null,
};

const FILM_URL = 'https://letterboxd.com/film/lost-river/';

const ALL_OFF: Settings = {
  categoryBadges: false,
  letterboxdLink: false,
  missingImages: false,
  tradeCards: false,
  hideCardStats: false,
  tagSuggestions: false,
  tagAutoFill: false,
};

function makeCategory(title: string, overrides: Partial<CardCategory> = {}): CardCategory {
  return {
    title,
    status: 'categorized',
    qid: 'Q1',
    categoryId: 'place',
    primarySubtype: null,
    personSubtypes: [],
    letterboxdUrl: null,
    image: null,
    suggestedTags: [],
    ...overrides,
  };
}

/** Every card of the fixtures, so any page shows a categorized card. */
const RESULTS: CardCategory[] = [
  makeCategory(GRID_CARD_TITLE, { categoryId: 'science_concept' }),
  makeCategory(LARGE_CARD_TITLE),
  makeCategory(MODAL_CARD_TITLE, {
    categoryId: 'film_tv',
    letterboxdUrl: FILM_URL,
    suggestedTags: ['Cinéma et TV'],
  }),
  makeCategory(PLACEHOLDER_CARD_TITLE, { categoryId: 'person', image: CARD_IMAGE }),
  makeCategory(TRADE_CARD_TITLE, { categoryId: 'film_tv', image: CARD_IMAGE }),
];

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

type CategorizeMock = Mock<(cards: readonly CardToCategorize[]) => Promise<CardCategory[]>>;

/** Answers with the results known for the titles asked, as the worker does. */
function makeCategorize(): CategorizeMock {
  return vi.fn((cards: readonly CardToCategorize[]): Promise<CardCategory[]> => {
    const wanted = new Set(cards.map((card) => card.title));
    return Promise.resolve(RESULTS.filter((result) => wanted.has(result.title)));
  });
}

interface Harness {
  overlay: Overlay;
  categorize: CategorizeMock;
  /**
   * The retries the content script would arm on a timer, held rather than
   * run: each one releases the titles of a failed batch AND scans the page
   * again, so running them as they are scheduled would ask, fail and
   * reschedule without ever giving the test back its turn.
   */
  retries: (() => void)[];
}

function mount(
  settings: Settings = DEFAULT_SETTINGS,
  categorize: CategorizeMock = makeCategorize(),
): Harness {
  const retries: (() => void)[] = [];
  const deps: OverlayDeps = {
    root: document.body,
    settings,
    logger: makeLogger(),
    categorize,
    scheduleRetry: (callback) => {
      retries.push(callback);
    },
  };

  return { overlay: createOverlay(deps), categorize, retries };
}

/** What the content script does on every scan. */
function scan(overlay: Overlay): void {
  overlay.onScan(scanCards(document.body));
}

/** Two scans: the first asks, the second draws what the answer brought back. */
async function scanUntilDrawn(overlay: Overlay): Promise<void> {
  scan(overlay);
  await vi.waitFor(() => {
    expect(document.body.querySelector(BADGE_SELECTOR)).not.toBeNull();
  });
}

function badges(): NodeListOf<Element> {
  return document.body.querySelectorAll(BADGE_SELECTOR);
}

function cardImages(): NodeListOf<Element> {
  return document.body.querySelectorAll(CARD_IMAGE_SELECTOR);
}

function hideStatsStyle(): Element | null {
  return document.head.querySelector(HIDE_STATS_STYLE_SELECTOR);
}

/** The picture of a trade card, which only a card with a known file has. */
const TRADE_PREVIEW_IMAGE_SELECTOR = TRADE_PREVIEW_SELECTOR + ' img';

function tradePreviews(): NodeListOf<Element> {
  return document.body.querySelectorAll(TRADE_PREVIEW_SELECTOR);
}

function tagProposals(): Element | null {
  return document.body.querySelector(TAG_PROPOSALS_SELECTOR);
}

/**
 * The page showing a card the site has no picture for, in the grid and in the
 * open detail modal: the card of the modal export is replaced by a card of the
 * catalogue export, which is what the site renders when such a card is opened.
 */
function showPlaceholderCardAndModal(): void {
  document.body.innerHTML = MODAL_HTML + PLACEHOLDER_HTML;
  const [modalCard, placeholderCard] = document.body.querySelectorAll('div[class*="glow-"]');
  if (modalCard === undefined || placeholderCard === undefined) {
    throw new Error('The fixtures hold no card');
  }
  modalCard.replaceWith(placeholderCard);
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

describe('createOverlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should show every part of the overlay when the settings are on', async () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount();

    await scanUntilDrawn(overlay);

    expect(badges().length).toBeGreaterThan(0);
    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)).not.toBeNull();
    expect(document.body.querySelector(CATEGORY_LINE_SELECTOR)).not.toBeNull();
  });

  it('should add no badge and no category line when the badges are off at load', async () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, categoryBadges: false });

    scan(overlay);
    await vi.waitFor(() => {
      expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)).not.toBeNull();
    });

    expect(badges()).toHaveLength(0);
    expect(document.body.querySelector(CATEGORY_LINE_SELECTOR)).toBeNull();
  });

  it('should take back the badges and the category line at once when they are turned off', async () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);

    overlay.applySettings({ ...DEFAULT_SETTINGS, categoryBadges: false });

    expect(badges()).toHaveLength(0);
    expect(document.body.querySelector(CATEGORY_LINE_SELECTOR)).toBeNull();
    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)).not.toBeNull();
  });

  it('should bring the badges back at once when they are turned on again', async () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    const drawn = badges().length;
    overlay.applySettings({ ...DEFAULT_SETTINGS, categoryBadges: false });

    overlay.applySettings(DEFAULT_SETTINGS);

    expect(badges()).toHaveLength(drawn);
  });

  it('should show the image of a card the site left without one once the results arrive', async () => {
    showPlaceholderCardAndModal();
    const { overlay } = mount();

    await scanUntilDrawn(overlay);

    expect(cardImages().length).toBeGreaterThan(0);
    expect(document.body.querySelector(IMAGE_CREDIT_SELECTOR)).not.toBeNull();
  });

  it('should add no image and no credit line when the images are off at load', async () => {
    showPlaceholderCardAndModal();
    const { overlay } = mount({ ...DEFAULT_SETTINGS, missingImages: false });

    await scanUntilDrawn(overlay);

    expect(cardImages()).toHaveLength(0);
    expect(document.body.querySelector(IMAGE_CREDIT_SELECTOR)).toBeNull();
  });

  it('should take back the images and the credit line at once when they are turned off', async () => {
    showPlaceholderCardAndModal();
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    expect(cardImages().length).toBeGreaterThan(0);

    overlay.applySettings({ ...DEFAULT_SETTINGS, missingImages: false });

    expect(cardImages()).toHaveLength(0);
    expect(document.body.querySelector(IMAGE_CREDIT_SELECTOR)).toBeNull();
    expect(badges().length).toBeGreaterThan(0);
  });

  it('should bring the images back at once when they are turned on again', async () => {
    showPlaceholderCardAndModal();
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    const drawn = cardImages().length;
    overlay.applySettings({ ...DEFAULT_SETTINGS, missingImages: false });

    overlay.applySettings(DEFAULT_SETTINGS);

    expect(cardImages()).toHaveLength(drawn);
    expect(document.body.querySelector(IMAGE_CREDIT_SELECTOR)).not.toBeNull();
  });

  it('should add the hide-stats style at once when the setting is on at load, asking for no categorization', () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay, categorize } = mount({ ...ALL_OFF, hideCardStats: true });

    scan(overlay);

    expect(hideStatsStyle()).not.toBeNull();
    expect(categorize).not.toHaveBeenCalled();
  });

  it('should hide the ATK/DEF value block and the modal panels once the style is applied', () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...ALL_OFF, hideCardStats: true });

    scan(overlay);

    const valueBlock = document.body.querySelector(CARD_ATTACK_VALUE_SELECTOR);
    const modalPanels = document.body.querySelector(MODAL_ATTACK_PANELS_SELECTOR);
    expect(valueBlock).not.toBeNull();
    expect(modalPanels).not.toBeNull();
    expect(getComputedStyle(valueBlock as Element).visibility).toBe('hidden');
    expect(getComputedStyle(modalPanels as Element).display).toBe('none');
  });

  it('should take back the hide-stats style at once when the setting is turned off', () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, hideCardStats: true });
    scan(overlay);
    expect(hideStatsStyle()).not.toBeNull();

    overlay.applySettings({ ...DEFAULT_SETTINGS, hideCardStats: false });

    expect(hideStatsStyle()).toBeNull();
  });

  it('should bring the hide-stats style back at once when it is turned on again', () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, hideCardStats: true });
    scan(overlay);
    overlay.applySettings({ ...DEFAULT_SETTINGS, hideCardStats: false });
    expect(hideStatsStyle()).toBeNull();

    overlay.applySettings({ ...DEFAULT_SETTINGS, hideCardStats: true });

    expect(hideStatsStyle()).not.toBeNull();
  });

  it('should write nothing on a second scan while the hide-stats style is already applied', () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...ALL_OFF, hideCardStats: true });
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    // The style element lives in document.head, so even the write that first
    // adds it is outside what this observer, scoped to document.body exactly
    // as the content script scopes its own, could ever see.
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should keep the category badge visible while the stats row next to it is hidden', async () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, hideCardStats: true });

    await scanUntilDrawn(overlay);

    const badge = document.body.querySelector(BADGE_SELECTOR);
    const valueBlock = document.body.querySelector(CARD_ATTACK_VALUE_SELECTOR);
    expect(badge).not.toBeNull();
    expect(valueBlock).not.toBeNull();
    expect(getComputedStyle(badge as Element).visibility).not.toBe('hidden');
    expect(getComputedStyle(valueBlock as Element).visibility).toBe('hidden');
  });

  it('should keep the Letterboxd button visible while the stats row it sits on is hidden', async () => {
    // The riskiest node of ours: it is absolutely positioned over the empty
    // middle of that very row, and `visibility: hidden` inherits, so a rule
    // aimed one level too high would take it with the numbers.
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, hideCardStats: true });

    await scanUntilDrawn(overlay);

    const button = document.body.querySelector(CARD_BUTTON_SELECTOR);
    const valueBlock = document.body.querySelector(CARD_ATTACK_VALUE_SELECTOR);
    expect(button).not.toBeNull();
    expect(valueBlock).not.toBeNull();
    expect(getComputedStyle(button as Element).visibility).not.toBe('hidden');
    expect(getComputedStyle(valueBlock as Element).visibility).toBe('hidden');
  });

  it('should write nothing on a second scan while an image and its credit are shown', async () => {
    showPlaceholderCardAndModal();
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    expect(cardImages().length).toBeGreaterThan(0);
    expect(document.body.querySelector(IMAGE_CREDIT_SELECTOR)).not.toBeNull();
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a second scan while only the images are left on', async () => {
    showPlaceholderCardAndModal();
    const { overlay } = mount({ ...ALL_OFF, missingImages: true });
    scan(overlay);
    await vi.waitFor(() => {
      expect(cardImages().length).toBeGreaterThan(0);
    });
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should take back the Letterboxd link at once when it is turned off', async () => {
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)).not.toBeNull();

    overlay.applySettings({ ...DEFAULT_SETTINGS, letterboxdLink: false });

    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)).toBeNull();
    expect(document.body.querySelector(CATEGORY_LINE_SELECTOR)).not.toBeNull();
  });

  it('should take back the Letterboxd buttons at once when the link is turned off', async () => {
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    expect(document.body.querySelector(CARD_BUTTON_SELECTOR)).not.toBeNull();

    overlay.applySettings({ ...DEFAULT_SETTINGS, letterboxdLink: false });

    expect(document.body.querySelector(CARD_BUTTON_SELECTOR)).toBeNull();
  });

  it('should bring the Letterboxd buttons back at once when the link is turned on again', async () => {
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    const drawn = document.body.querySelectorAll(CARD_BUTTON_SELECTOR).length;
    overlay.applySettings({ ...DEFAULT_SETTINGS, letterboxdLink: false });

    overlay.applySettings(DEFAULT_SETTINGS);

    expect(drawn).toBeGreaterThan(0);
    expect(document.body.querySelectorAll(CARD_BUTTON_SELECTOR)).toHaveLength(drawn);
  });

  it('should draw the cards a trade offer names, with the picture of the ones it knows', async () => {
    document.body.innerHTML = TRADES_HTML;
    const { overlay, categorize } = mount();

    scan(overlay);

    await vi.waitFor(() => {
      expect(document.body.querySelectorAll(TRADE_PREVIEW_IMAGE_SELECTOR)).toHaveLength(2);
    });
    // Seven chips, six distinct cards, and the one named twice is drawn twice.
    expect(tradePreviews()).toHaveLength(7);
    const asked = categorize.mock.calls[0]?.[0] ?? [];
    expect(asked.map((card) => card.title)).toContain(TRADE_CARD_TITLE);
    expect(asked).toHaveLength(6);
  });

  it('should draw no trade card and ask for nothing while every setting is off', () => {
    document.body.innerHTML = TRADES_HTML;
    const { overlay, categorize } = mount(ALL_OFF);

    scan(overlay);

    expect(tradePreviews()).toHaveLength(0);
    expect(categorize).not.toHaveBeenCalled();
  });

  it('should take the cards of the trade offers back when the setting is turned off', async () => {
    document.body.innerHTML = TRADES_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount({ ...ALL_OFF, tradeCards: true });
    scan(overlay);
    await vi.waitFor(() => {
      expect(tradePreviews().length).toBeGreaterThan(0);
    });

    overlay.applySettings({ ...ALL_OFF, tradeCards: false });

    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should resolve the addresses of the pictures while only the trade cards need them', async () => {
    document.body.innerHTML = TRADES_HTML;
    const { overlay, categorize } = mount({ ...ALL_OFF, tradeCards: true });

    scan(overlay);

    await vi.waitFor(() => {
      expect(categorize).toHaveBeenCalledOnce();
    });
    // The images of the cards of the site are off, but a trade card shows
    // nothing at all without a picture, so the batch asks for the addresses.
    expect(categorize).toHaveBeenNthCalledWith(1, expect.anything(), {
      resolveImageUrls: true,
    });
  });

  it('should ask for no categorization at all when every setting is off', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const { overlay, categorize } = mount(ALL_OFF);

    scan(overlay);

    expect(categorize).not.toHaveBeenCalled();
  });

  it('should ask for the categories again when a feature is turned back on', async () => {
    document.body.innerHTML = GRID_HTML;
    const { overlay, categorize } = mount(ALL_OFF);
    scan(overlay);

    // No scan after it: nothing would make the page mutate, so `applySettings`
    // is the only thing that can ask for the title seen while everything was
    // off, and asking for it twice would be a waste.
    overlay.applySettings(DEFAULT_SETTINGS);

    await vi.waitFor(() => {
      expect(categorize).toHaveBeenCalledOnce();
    });
  });

  it('should scan the page again when the retry of a failed batch comes due', async () => {
    document.body.innerHTML = GRID_HTML;
    const categorize = makeCategorize().mockRejectedValueOnce(new Error('Wikidata is unreachable'));
    const { overlay, retries } = mount(DEFAULT_SETTINGS, categorize);

    scan(overlay);

    await vi.waitFor(() => {
      expect(retries).toHaveLength(1);
    });
    // Nothing mutates the page in between, so no other scan can ever come:
    // without the one the retry itself raises, the card stays as it is.
    expect(badges()).toHaveLength(0);

    retries[0]?.();

    await vi.waitFor(() => {
      expect(badges()).toHaveLength(1);
    });
    expect(categorize).toHaveBeenCalledTimes(2);
  });

  it('should ask for the addresses of the pictures only while the images are on', async () => {
    document.body.innerHTML = GRID_HTML;
    // The trade cards are off as well: they are the other feature that draws
    // a picture of Wikimedia, and one of them being on is enough to ask.
    const { overlay, categorize } = mount({
      ...DEFAULT_SETTINGS,
      missingImages: false,
      tradeCards: false,
    });

    scan(overlay);

    await vi.waitFor(() => {
      expect(categorize).toHaveBeenCalledOnce();
    });
    // The badges are on, so the batch leaves anyway: what a switched off
    // feature must cost is its own traffic, here one request to Wikipedia per
    // batch and the entries it would have stored.
    expect(categorize).toHaveBeenNthCalledWith(1, expect.anything(), {
      resolveImageUrls: false,
    });

    // Switched back on between two batches: the setting is read when a batch
    // leaves, not when the overlay was built, so the next one resolves again.
    overlay.applySettings(DEFAULT_SETTINGS);
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    scan(overlay);

    await vi.waitFor(() => {
      expect(categorize).toHaveBeenCalledTimes(2);
    });
    expect(categorize).toHaveBeenNthCalledWith(2, expect.anything(), {
      resolveImageUrls: true,
    });
  });

  it('should draw the nodes of a feature turned back on without waiting for a scan', async () => {
    document.body.innerHTML = GRID_HTML;
    const { overlay, categorize } = mount(ALL_OFF);
    scan(overlay);
    expect(categorize).not.toHaveBeenCalled();

    overlay.applySettings({ ...ALL_OFF, categoryBadges: true });

    expect(categorize).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(badges().length).toBeGreaterThan(0);
    });
  });

  it('should write nothing when the settings are applied again unchanged', async () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML + MODAL_HTML;
    const { overlay, categorize } = mount();
    await scanUntilDrawn(overlay);
    scan(overlay);
    const observer = observeBody();

    overlay.applySettings(DEFAULT_SETTINGS);

    expect(observer.takeRecords()).toHaveLength(0);
    expect(categorize).toHaveBeenCalledOnce();
    observer.disconnect();
  });

  it('should write nothing on a second scan when every feature is on', async () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML + MODAL_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a scan while every feature is off', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML + MODAL_HTML;
    const { overlay } = mount(ALL_OFF);
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should leave no node of ours behind when every feature is off', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML + MODAL_HTML + TRADES_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount(ALL_OFF);

    scan(overlay);

    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should write nothing on a second scan while only the badges are off', async () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, categoryBadges: false });
    scan(overlay);
    await vi.waitFor(() => {
      expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)).not.toBeNull();
    });
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a second scan while the link is off and a modal is open', async () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, letterboxdLink: false });
    await scanUntilDrawn(overlay);
    scan(overlay);
    const observer = observeBody();

    // The modal is still looked up on every scan, for the category line.
    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should take back every node it added when the context is invalidated', async () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML + MODAL_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);

    overlay.destroy();

    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should take back the hide-stats style when the context is invalidated', async () => {
    // Its own case, and not the comparison above: the style sheet lives in
    // document.head, where comparing the body cannot see it. Without this,
    // an extension reloaded while a tab is open would leave the numbers of
    // the site hidden with nothing left on the page able to bring them back.
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, hideCardStats: true });
    await scanUntilDrawn(overlay);
    expect(hideStatsStyle()).not.toBeNull();

    overlay.destroy();

    expect(hideStatsStyle()).toBeNull();
  });

  it('should show the tag proposals of the card shown in the modal when the setting is on', async () => {
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount();

    await scanUntilDrawn(overlay);

    expect(tagProposals()).not.toBeNull();
  });

  it('should stop filling the field from the very next click when the auto-fill is turned off', async () => {
    // The button already drawn keeps its handler and is NOT rebuilt, since
    // neither the card nor the proposals changed: what must stop it is the
    // setting being read again at click time, here through the wiring of the
    // overlay itself and not through a stub of the unit test.
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, tagAutoFill: true });
    await scanUntilDrawn(overlay);
    const proposal = document.body.querySelector<HTMLButtonElement>(TAG_PROPOSAL_BUTTON_SELECTOR);
    const input = document.body.querySelector<HTMLInputElement>(TAG_INPUT_SELECTOR);
    expect(proposal).not.toBeNull();
    expect(input).not.toBeNull();

    overlay.applySettings({ ...DEFAULT_SETTINGS, tagAutoFill: false });
    const click = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(click, 'isTrusted', { value: true });
    proposal?.dispatchEvent(click);

    // Still on the page, and still writing nothing.
    expect(document.body.querySelector(TAG_PROPOSAL_BUTTON_SELECTOR)).toBe(proposal);
    expect(input?.value).toBe('');
  });

  it('should add no tag proposal when the tag suggestions are off at load', async () => {
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, tagSuggestions: false });

    scan(overlay);
    await vi.waitFor(() => {
      expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)).not.toBeNull();
    });

    expect(tagProposals()).toBeNull();
  });

  it('should take back the tag proposals at once when they are turned off', async () => {
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    expect(tagProposals()).not.toBeNull();

    overlay.applySettings({ ...DEFAULT_SETTINGS, tagSuggestions: false });

    expect(tagProposals()).toBeNull();
    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)).not.toBeNull();
  });

  it('should bring the tag proposals back at once when they are turned on again', async () => {
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    expect(tagProposals()).not.toBeNull();
    overlay.applySettings({ ...DEFAULT_SETTINGS, tagSuggestions: false });

    overlay.applySettings(DEFAULT_SETTINGS);

    expect(tagProposals()).not.toBeNull();
  });

  it('should ask for the categorization when the tag suggestions are the only setting left on', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const { overlay, categorize } = mount({ ...ALL_OFF, tagSuggestions: true });

    scan(overlay);

    expect(categorize).toHaveBeenCalledOnce();
  });

  it('should write nothing on a second scan while only the tag suggestions are left on', async () => {
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount({ ...ALL_OFF, tagSuggestions: true });
    scan(overlay);
    await vi.waitFor(() => {
      expect(tagProposals()).not.toBeNull();
    });
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should take back the tag proposals when the context is invalidated', async () => {
    document.body.innerHTML = MODAL_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    expect(tagProposals()).not.toBeNull();

    overlay.destroy();

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});
