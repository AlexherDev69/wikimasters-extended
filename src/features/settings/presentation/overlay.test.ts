import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from '../../../core/logger/logger';
import { BRAND_MARK_SELECTOR } from '../../brand-mark/data/brand-selectors';
import { scanCards } from '../../card-detection/data/scan-cards';
import type { CardCategory } from '../../categorization/domain/category';
import type { CardToCategorize } from '../../categorization/domain/categorize-cards';
import { CARD_BUTTON_SELECTOR } from '../../letterboxd/data/card-button-selectors';
import { LETTERBOXD_LINK_SELECTOR } from '../../letterboxd/data/modal-selectors';
import {
  CARD_ATTACK_VALUE_SELECTOR,
  HIDE_STATS_STYLE_SELECTOR,
  MODAL_ATTACK_PANELS_SELECTOR,
} from '../../hide-card-stats/data/hide-stats-selectors';
import { CARD_IMAGE_SELECTOR, IMAGE_CREDIT_SELECTOR } from '../../missing-image/data/image-selectors';
import type { CardImage } from '../../missing-image/domain/card-image';
import type { ChimePlayer } from '../../notification-sound/data/chime';
import {
  COMPACT_STYLE_SELECTOR,
  TOGGLE_SELECTOR as COMPACT_TOGGLE_SELECTOR,
} from '../../compact-view/data/compact-selectors';
import { stubCanvasContext, type CanvasStub } from '../../../../tests/helpers/canvas-context';
import { PONG_SELECTOR } from '../../loading-pong/data/pong-panel';
import { PULL_STATS_SELECTOR } from '../../pull-stats/data/pull-stats-panel';
import { emptyTally } from '../../pull-stats/domain/pull-tally';
import { TRADE_PREVIEW_SELECTOR } from '../../trade-cards/data/trade-selectors';
import {
  WIKIPEDIA_BUTTON_SELECTOR,
  WIKIPEDIA_BUTTON_ATTRIBUTE,
} from '../../wikipedia-link/data/wikipedia-button-selectors';

import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import { createOverlay, type Overlay, type OverlayDeps } from './overlay';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** The path of the collection, where the compact view offers its button. */
const COMPACT_PATH = '/collection';

/** The rarity filters of the collection: where the compact button is added. */
const COLLECTION_FILTERS_HTML = readFileSync(
  join(FIXTURES_DIR, 'collection-filters.html'),
  'utf-8',
);

/** The navigation of the site, with its own name at the top of it. */
const HEADER_HTML = readFileSync(join(FIXTURES_DIR, 'site-header.html'), 'utf-8');

/** The same navigation, with the badge of the notifications waiting. */
const UNREAD_HEADER_HTML = readFileSync(join(FIXTURES_DIR, 'site-header-unread.html'), 'utf-8');

/** The page of the collection while the site is still fetching its cards. */
const LOADING_HTML = readFileSync(join(FIXTURES_DIR, 'loading-spinner.html'), 'utf-8');

const GRID_HTML = readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8');
const LARGE_HTML = readFileSync(join(FIXTURES_DIR, 'card-large-with-description.html'), 'utf-8');
const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

const PLACEHOLDER_HTML = readFileSync(join(FIXTURES_DIR, 'placeholder-cards.html'), 'utf-8');
/** Two offers of the exchange page, seven chips naming six distinct cards. */
const TRADES_HTML = readFileSync(join(FIXTURES_DIR, 'trades-list.html'), 'utf-8');
/** The page of the packs between two of them, where the pull panel is drawn. */
const PULL_IDLE_HTML = readFileSync(join(FIXTURES_DIR, 'pull-idle.html'), 'utf-8');
/** The first card of a pack being revealed, a common one, under its counter. */
const PULL_REVEAL_HTML = readFileSync(join(FIXTURES_DIR, 'pull-reveal.html'), 'utf-8');

const GRID_CARD_TITLE = "Jeu d'horreur";
const LARGE_CARD_TITLE = 'Foza';
const MODAL_CARD_TITLE = 'Dvorichté';
/** The link of the site in the modal, which our own nodes are inserted after. */
const MODAL_ARTICLE_URL = 'https://fr.wikipedia.org/wiki/Dvoricht%C3%A9';
/** A card of the catalogue export the site shows its own logo for. */
const PLACEHOLDER_CARD_TITLE = 'Adan Canto';
/** One more than the five notifications the unread header fixture shows. */
const SIX_WAITING = 6;

/** Named by both offers of the trade fixture, so two chips carry it. */
const TRADE_CARD_TITLE = 'Saison 1 de Severance';

const CARD_IMAGE: CardImage = {
  fileName: 'Adan Canto 2015.jpg',
  kind: 'picture',
  thumbnailUrl: null,
};

const FILM_URL = 'https://letterboxd.com/film/lost-river/';

const ALL_OFF: Settings = {
  letterboxdLink: false,
  wikipediaLink: false,
  missingImages: false,
  tradeCards: false,
  hideCardStats: false,
  pullStats: false,
  compactView: false,
  loadingPong: false,
  notificationSound: false,
};

function makeCategory(title: string, overrides: Partial<CardCategory> = {}): CardCategory {
  return {
    title,
    status: 'categorized',
    qid: 'Q1',
    letterboxdUrl: null,
    image: null,
    ...overrides,
  };
}

/** Every card of the fixtures, so any page shows a categorized card. */
const RESULTS: CardCategory[] = [
  makeCategory(GRID_CARD_TITLE, { letterboxdUrl: FILM_URL }),
  makeCategory(LARGE_CARD_TITLE, { letterboxdUrl: FILM_URL }),
  makeCategory(MODAL_CARD_TITLE, { letterboxdUrl: FILM_URL }),
  makeCategory(PLACEHOLDER_CARD_TITLE, { letterboxdUrl: FILM_URL, image: CARD_IMAGE }),
  makeCategory(TRADE_CARD_TITLE, { image: CARD_IMAGE }),
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
  /**
   * The frames the game of the loading screen would ask the browser for, held
   * rather than run: a loop that asks for the next frame from inside the one
   * being run would never give the test its turn back.
   */
  frames: ((timeMs: number) => void)[];
  /** The sound of an arriving notification, counted rather than played. */
  chime: ChimePlayer;
}

function mount(
  settings: Settings = DEFAULT_SETTINGS,
  categorize: CategorizeMock = makeCategorize(),
  isPongForced?: () => boolean,
): Harness {
  const retries: (() => void)[] = [];
  const frames: ((timeMs: number) => void)[] = [];
  const chime: ChimePlayer = { play: vi.fn(), close: vi.fn() };
  const deps: OverlayDeps = {
    root: document.body,
    settings,
    logger: makeLogger(),
    categorize,
    scheduleRetry: (callback) => {
      retries.push(callback);
    },
    pullTallyStore: { read: () => Promise.resolve(emptyTally()), write: () => Promise.resolve() },
    pullTally: emptyTally(),
    compactStore: { read: () => Promise.resolve(false), write: () => Promise.resolve() },
    isCompact: false,
    readPath: () => COMPACT_PATH,
    requestFrame: (callback) => {
      frames.push(callback);
    },
    chime,
    isPongForced,
  };

  return { overlay: createOverlay(deps), categorize, retries, frames, chime };
}

/** What the content script does on every scan. */
function scan(overlay: Overlay): void {
  overlay.onScan(scanCards(document.body));
}

/** Two scans: the first asks, the second draws what the answer brought back. */
async function scanUntilDrawn(overlay: Overlay): Promise<void> {
  scan(overlay);
  await vi.waitFor(() => {
    expect(document.body.querySelector(CARD_BUTTON_SELECTOR)).not.toBeNull();
  });
}

function cardButtons(): NodeListOf<Element> {
  return document.body.querySelectorAll(CARD_BUTTON_SELECTOR);
}

function wikipediaButtons(): NodeListOf<Element> {
  return document.body.querySelectorAll(WIKIPEDIA_BUTTON_SELECTOR);
}

function cardImages(): NodeListOf<Element> {
  return document.body.querySelectorAll(CARD_IMAGE_SELECTOR);
}

function hideStatsStyle(): Element | null {
  return document.head.querySelector(HIDE_STATS_STYLE_SELECTOR);
}

function brandMarks(): NodeListOf<Element> {
  return document.body.querySelectorAll(BRAND_MARK_SELECTOR);
}

/** The picture of a trade card, which only a card with a known file has. */
const TRADE_PREVIEW_IMAGE_SELECTOR = TRADE_PREVIEW_SELECTOR + ' img';

function tradePreviews(): NodeListOf<Element> {
  return document.body.querySelectorAll(TRADE_PREVIEW_SELECTOR);
}

function compactToggle(): Element | null {
  return document.body.querySelector(COMPACT_TOGGLE_SELECTOR);
}

function compactStyle(): Element | null {
  return document.head.querySelector(COMPACT_STYLE_SELECTOR);
}

function pongPanel(): Element | null {
  return document.body.querySelector(PONG_SELECTOR);
}

function pullStatsPanel(): Element | null {
  return document.body.querySelector(PULL_STATS_SELECTOR);
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

/** The bell of the site, whose badge the sound of the notifications reads. */
const BELL_BADGE_SELECTOR = 'button[aria-label="Notifications"] > span';

/** Writes in the badge of the bell, as the site does when the count moves. */
function setBellCount(count: number): void {
  const badge = document.body.querySelector(BELL_BADGE_SELECTOR);
  if (badge === null) {
    throw new Error('The unread header fixture has lost its badge');
  }
  badge.textContent = String(count);
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
  /**
   * happy-dom answers null to `getContext`, so the game of the loading screen
   * could never be built at all. The stub records what is painted instead of
   * painting it, and touches nothing but the canvases of this file.
   */
  let canvas: CanvasStub;

  beforeEach(() => {
    document.body.innerHTML = '';
    canvas = stubCanvasContext();
  });

  afterEach(() => {
    canvas.restore();
  });

  it('should show every part of the overlay when the settings are on', async () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount();

    await scanUntilDrawn(overlay);

    expect(cardButtons().length).toBeGreaterThan(0);
    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)).not.toBeNull();
  });

  it('should put the Letterboxd link of the modal under the link of the site', async () => {
    // The card of the modal carries our own Wikipedia button by then, and it
    // points at the very same article as the link of the site. The modal
    // renders that card before the column holding its link, so a link of ours
    // anchored on the first match would be drawn inside the card.
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);

    const link = document.body.querySelector(LETTERBOXD_LINK_SELECTOR);
    const anchor = link?.previousElementSibling ?? null;
    expect(anchor?.getAttribute('href')).toBe(MODAL_ARTICLE_URL);
    expect(anchor?.hasAttribute(WIKIPEDIA_BUTTON_ATTRIBUTE)).toBe(false);
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
    expect(cardButtons().length).toBeGreaterThan(0);
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

  it('should draw the pull panel at once when the setting is on at load, asking for no categorization', () => {
    document.body.innerHTML = PULL_IDLE_HTML;
    const { overlay, categorize } = mount({ ...ALL_OFF, pullStats: true });

    scan(overlay);

    expect(pullStatsPanel()).not.toBeNull();
    expect(categorize).not.toHaveBeenCalled();
  });

  it('should draw no pull panel when the setting is off at load', () => {
    document.body.innerHTML = PULL_IDLE_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, pullStats: false });

    scan(overlay);

    expect(pullStatsPanel()).toBeNull();
  });

  it('should write nothing on a second scan while the pull panel is already drawn', () => {
    document.body.innerHTML = PULL_IDLE_HTML;
    const { overlay } = mount({ ...ALL_OFF, pullStats: true });
    scan(overlay);
    expect(pullStatsPanel()).not.toBeNull();
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should take back the pull panel at once when the setting is turned off', () => {
    document.body.innerHTML = PULL_IDLE_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, pullStats: true });
    scan(overlay);
    expect(pullStatsPanel()).not.toBeNull();

    overlay.applySettings({ ...DEFAULT_SETTINGS, pullStats: false });

    expect(pullStatsPanel()).toBeNull();
  });

  it('should count the card a pack reveals and show it on the panel that comes back after it', () => {
    document.body.innerHTML = PULL_REVEAL_HTML;
    const { overlay } = mount({ ...ALL_OFF, pullStats: true });

    scan(overlay);
    document.body.innerHTML = PULL_IDLE_HTML;
    scan(overlay);

    expect(pullStatsPanel()?.textContent).toContain('1 carte');
  });

  it('should count nothing on the page of the packs while the setting is off', () => {
    document.body.innerHTML = PULL_REVEAL_HTML;
    const { overlay } = mount({ ...ALL_OFF, pullStats: false });

    scan(overlay);
    // Switched on once the card has left the screen: a card still shown when
    // the switch is flipped is counted, which is the card the user is
    // looking at, and that is exactly what turning the feature on asks for.
    document.body.innerHTML = PULL_IDLE_HTML;
    overlay.applySettings({ ...ALL_OFF, pullStats: true });

    expect(pullStatsPanel()?.textContent).toContain('Aucune carte comptée');
  });

  it('should offer the compact view at once when the setting is on, asking for no categorization', () => {
    document.body.innerHTML = COLLECTION_FILTERS_HTML + GRID_HTML;
    const { overlay, categorize } = mount({ ...ALL_OFF, compactView: true });

    scan(overlay);

    expect(compactToggle()).not.toBeNull();
    expect(categorize).not.toHaveBeenCalled();
  });

  it('should offer no compact view when the setting is off at load', () => {
    document.body.innerHTML = COLLECTION_FILTERS_HTML + GRID_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, compactView: false });

    scan(overlay);

    expect(compactToggle()).toBeNull();
    expect(compactStyle()).toBeNull();
  });

  it('should draw the cards small as soon as the compact button is pressed', () => {
    document.body.innerHTML = COLLECTION_FILTERS_HTML + GRID_HTML;
    const { overlay } = mount({ ...ALL_OFF, compactView: true });
    scan(overlay);
    expect(compactStyle()).toBeNull();

    (compactToggle() as HTMLElement).click();

    // The press writes no node of the page, so the scan that shows the new
    // size is the one the feature asks the overlay for.
    expect(compactStyle()).not.toBeNull();
  });

  it('should write nothing on a second scan while the compact view is on', () => {
    document.body.innerHTML = COLLECTION_FILTERS_HTML + GRID_HTML;
    const { overlay } = mount({ ...ALL_OFF, compactView: true });
    scan(overlay);
    (compactToggle() as HTMLElement).click();
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should take back the compact button and its style at once when the setting is turned off', () => {
    document.body.innerHTML = COLLECTION_FILTERS_HTML + GRID_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, compactView: true });
    scan(overlay);
    (compactToggle() as HTMLElement).click();
    expect(compactStyle()).not.toBeNull();

    overlay.applySettings({ ...DEFAULT_SETTINGS, compactView: false });

    expect(compactToggle()).toBeNull();
    expect(compactStyle()).toBeNull();
  });

  it('should play pong when the page has been loading for the whole patience', () => {
    document.body.innerHTML = LOADING_HTML;
    const { overlay, retries } = mount({ ...ALL_OFF, loadingPong: true });

    scan(overlay);
    expect(pongPanel()).toBeNull();
    // The page shows nothing, so nothing mutates: the check armed on the
    // context is what looks at it again once the patience has run out.
    retries[0]?.();

    expect(pongPanel()).not.toBeNull();
  });

  it('should play no pong while the setting is off', () => {
    document.body.innerHTML = LOADING_HTML;
    const { overlay, retries } = mount({ ...DEFAULT_SETTINGS, loadingPong: false });

    scan(overlay);
    retries[0]?.();

    expect(pongPanel()).toBeNull();
  });

  it('should take the game back when the page finally shows its cards', () => {
    document.body.innerHTML = LOADING_HTML;
    const { overlay, retries, frames } = mount({ ...ALL_OFF, loadingPong: true });
    scan(overlay);
    retries[0]?.();
    const framesWhilePlaying = frames.length;

    // Added rather than replacing the page, so the panel is taken back by the
    // overlay and not by the site overwriting its own main area.
    document.body.insertAdjacentHTML('beforeend', GRID_HTML);
    scan(overlay);

    expect(pongPanel()).toBeNull();
    // And the loop is cut: the frame already granted asks for no other.
    frames[framesWhilePlaying - 1]?.(16);
    expect(frames).toHaveLength(framesWhilePlaying);
  });

  it('should play pong on a page that loaded when the development button asks for one', () => {
    // The button of the development build answers this one question and
    // nothing else, so what follows is the machinery a stuck page goes
    // through: the patience, then the check armed on the context.
    document.body.innerHTML = GRID_HTML;
    const isForcing = true;
    const { overlay, retries } = mount(
      { ...ALL_OFF, loadingPong: true },
      makeCategorize(),
      () => isForcing,
    );

    scan(overlay);
    retries[0]?.();

    expect(pongPanel()).not.toBeNull();
  });

  it('should take the game back when the development button stops asking for one', () => {
    document.body.innerHTML = GRID_HTML;
    let isForcing = true;
    const { overlay, retries } = mount(
      { ...ALL_OFF, loadingPong: true },
      makeCategorize(),
      () => isForcing,
    );
    scan(overlay);
    retries[0]?.();
    expect(pongPanel()).not.toBeNull();

    isForcing = false;
    scan(overlay);

    expect(pongPanel()).toBeNull();
  });

  it('should play no pong on a page that loaded while nothing asks for one', () => {
    // The guard of the two tests above: without the button, a page showing
    // its cards is not a wait and never offers a game.
    document.body.innerHTML = GRID_HTML;
    const { overlay, retries } = mount({ ...ALL_OFF, loadingPong: true });

    scan(overlay);
    retries[0]?.();

    expect(pongPanel()).toBeNull();
  });

  it('should take the game back at once when the setting is turned off', () => {
    document.body.innerHTML = LOADING_HTML;
    const { overlay, retries } = mount({ ...ALL_OFF, loadingPong: true });
    scan(overlay);
    retries[0]?.();
    expect(pongPanel()).not.toBeNull();

    overlay.applySettings({ ...ALL_OFF, loadingPong: false });

    expect(pongPanel()).toBeNull();
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

  it('should draw the button of the article on the first scan, asking for no categorization', () => {
    // The title of a card IS the title of its article: the button is built
    // from what the page already shows, so no card ever waits for an answer
    // to get one, and nothing is asked of Wikidata to draw it.
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const { overlay, categorize } = mount({ ...ALL_OFF, wikipediaLink: true });

    scan(overlay);

    expect(wikipediaButtons()).toHaveLength(2);
    expect(categorize).not.toHaveBeenCalled();
  });

  it('should take the buttons of the articles back at once when they are turned off', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount({ ...ALL_OFF, wikipediaLink: true });
    scan(overlay);
    expect(wikipediaButtons().length).toBeGreaterThan(0);

    overlay.applySettings({ ...ALL_OFF, wikipediaLink: false });

    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should write nothing on a second scan while the buttons of the articles are there', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const { overlay } = mount({ ...ALL_OFF, wikipediaLink: true });
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
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

  it('should draw the button of the article on the cards it draws for a trade offer', () => {
    document.body.innerHTML = TRADES_HTML;
    const { overlay } = mount({ ...ALL_OFF, tradeCards: true, wikipediaLink: true });

    scan(overlay);

    expect(tradePreviews().length).toBeGreaterThan(0);
    expect(wikipediaButtons()).toHaveLength(tradePreviews().length);
  });

  it('should take those buttons back with the cards when the trade setting goes off', () => {
    document.body.innerHTML = TRADES_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount({ ...ALL_OFF, tradeCards: true, wikipediaLink: true });
    scan(overlay);
    expect(wikipediaButtons().length).toBeGreaterThan(0);

    overlay.applySettings({ ...ALL_OFF, tradeCards: false, wikipediaLink: true });

    expect(document.body.innerHTML).toBe(siteHtml);
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
    expect(cardButtons()).toHaveLength(0);

    retries[0]?.();

    await vi.waitFor(() => {
      expect(cardButtons()).toHaveLength(1);
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
    // The link is on, so the batch leaves anyway: what a switched off
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

    overlay.applySettings({ ...ALL_OFF, letterboxdLink: true });

    expect(categorize).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(cardButtons().length).toBeGreaterThan(0);
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

  it('should write nothing on a second scan while the link is off and a modal is open', async () => {
    showPlaceholderCardAndModal();
    const { overlay } = mount({ ...DEFAULT_SETTINGS, letterboxdLink: false });
    scan(overlay);
    await vi.waitFor(() => {
      expect(cardImages().length).toBeGreaterThan(0);
    });
    scan(overlay);
    const observer = observeBody();

    // The modal is still looked up on every scan, for the credit of the image.
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

  it('should take back the compact button and its style when the context is invalidated', () => {
    document.body.innerHTML = COLLECTION_FILTERS_HTML + GRID_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount({ ...ALL_OFF, compactView: true });
    scan(overlay);
    (compactToggle() as HTMLElement).click();
    expect(compactStyle()).not.toBeNull();

    overlay.destroy();

    expect(document.body.innerHTML).toBe(siteHtml);
    expect(compactStyle()).toBeNull();
  });

  it('should take back the pull panel when the context is invalidated', () => {
    document.body.innerHTML = PULL_IDLE_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount({ ...ALL_OFF, pullStats: true });
    scan(overlay);
    expect(pullStatsPanel()).not.toBeNull();

    overlay.destroy();

    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should write the word of the extension under the name of the site, every switch off', () => {
    // It is the signature of the extension and not one of its features: it
    // has no switch, so it is there even when every one of them is off, and
    // it costs no request either.
    document.body.innerHTML = HEADER_HTML + GRID_HTML;
    const { overlay, categorize } = mount(ALL_OFF);

    scan(overlay);

    expect(brandMarks()).toHaveLength(1);
    expect(categorize).not.toHaveBeenCalled();
  });

  it('should write nothing on a second scan while the word is already there', () => {
    document.body.innerHTML = HEADER_HTML + GRID_HTML;
    const { overlay } = mount(ALL_OFF);
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should take the word of the extension back when the context is invalidated', () => {
    document.body.innerHTML = HEADER_HTML + GRID_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount(ALL_OFF);
    scan(overlay);
    expect(brandMarks()).toHaveLength(1);

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

  it('should sound when the bell of the site goes up', () => {
    document.body.innerHTML = UNREAD_HEADER_HTML;
    const { overlay, chime } = mount({ ...ALL_OFF, notificationSound: true });
    scan(overlay);

    setBellCount(SIX_WAITING);
    scan(overlay);

    expect(chime.play).toHaveBeenCalledTimes(1);
  });

  it('should write nothing on the page when the bell goes up', () => {
    // The whole feature in one assertion: it reads a number and makes a
    // sound. A single write here would feed the observer that brought the
    // scan, and the page would loop for as long as it stayed open.
    document.body.innerHTML = UNREAD_HEADER_HTML;
    const { overlay, chime } = mount({ ...ALL_OFF, notificationSound: true });
    scan(overlay);
    const observer = observeBody();
    setBellCount(SIX_WAITING);
    // The line above is a write of the test, standing in for the site: it is
    // drained so that what is left is what the scan itself wrote.
    observer.takeRecords();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    expect(chime.play).toHaveBeenCalledTimes(1);
    observer.disconnect();
  });

  it('should stay silent when the sound is switched off', () => {
    document.body.innerHTML = UNREAD_HEADER_HTML;
    const { overlay, chime } = mount(ALL_OFF);
    scan(overlay);

    setBellCount(SIX_WAITING);
    scan(overlay);

    expect(chime.play).not.toHaveBeenCalled();
  });

  it('should give the audio of the page back when the context is invalidated', () => {
    // The one thing this feature is given and the one thing it gives back: a
    // browser hands out a limited number of audio contexts per page.
    document.body.innerHTML = UNREAD_HEADER_HTML;
    const { overlay, chime } = mount({ ...ALL_OFF, notificationSound: true });
    scan(overlay);

    overlay.destroy();

    expect(chime.close).toHaveBeenCalledTimes(1);
  });

  it('should listen again from the count of the moment when the sound is switched back on', () => {
    // Switching it off and back on must not sound for everything that arrived
    // in between: the sound says a notification is arriving, not that some
    // are waiting.
    document.body.innerHTML = UNREAD_HEADER_HTML;
    const { overlay, chime } = mount({ ...ALL_OFF, notificationSound: true });
    scan(overlay);
    overlay.applySettings(ALL_OFF);

    setBellCount(SIX_WAITING);
    overlay.applySettings({ ...ALL_OFF, notificationSound: true });

    expect(chime.play).not.toHaveBeenCalled();
  });
});
