/**
 * The composition root of the overlay, mounted the way the content script
 * mounts it, shared by the four files that split `overlay.test.ts` apart.
 *
 * Only what two or more of those files need lives here: a helper a single
 * file uses stays in that file, where its reader can see it.
 */

import { expect, vi, type Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from '../../src/core/logger/logger';
import type { CardImage } from '../../src/core/mediawiki/card-image';
import { BRAND_MARK_SELECTOR } from '../../src/features/brand-mark/data/brand-selectors';
import { scanCards } from '../../src/features/card-detection/data/scan-cards';
import type { CardCategory } from '../../src/features/categorization/domain/category';
import type { CardToCategorize } from '../../src/features/categorization/domain/categorize-cards';
import {
  COMPACT_STYLE_SELECTOR,
  TOGGLE_SELECTOR as COMPACT_TOGGLE_SELECTOR,
} from '../../src/features/compact-view/data/compact-selectors';
import { HIDE_STATS_STYLE_SELECTOR } from '../../src/features/hide-card-stats/data/hide-stats-selectors';
import { CARD_BUTTON_SELECTOR } from '../../src/features/letterboxd/data/card-button-selectors';
import type { ChimePlayer } from '../../src/features/notification-sound/data/chime';
import { PULL_STATS_SELECTOR } from '../../src/features/pull-stats/data/pull-stats-panel';
import { emptyTally } from '../../src/features/pull-stats/domain/pull-tally';
import { DEFAULT_SETTINGS, type Settings } from '../../src/features/settings/domain/settings';
import {
  createOverlay,
  type Overlay,
  type OverlayDeps,
} from '../../src/features/settings/presentation/overlay';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');

/** The path of the collection, where the compact view offers its button. */
export const COMPACT_PATH = '/collection';

/** The rarity filters of the collection: where the compact button is added. */
export const COLLECTION_FILTERS_HTML = readFileSync(
  join(FIXTURES_DIR, 'collection-filters.html'),
  'utf-8',
);

/** The navigation of the site, with its own name at the top of it. */
export const HEADER_HTML = readFileSync(join(FIXTURES_DIR, 'site-header.html'), 'utf-8');

/** The same navigation, with the badge of the notifications waiting. */
export const UNREAD_HEADER_HTML = readFileSync(join(FIXTURES_DIR, 'site-header-unread.html'), 'utf-8');

/** The page of the collection while the site is still fetching its cards. */
export const LOADING_HTML = readFileSync(join(FIXTURES_DIR, 'loading-spinner.html'), 'utf-8');

export const GRID_HTML = readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8');
export const LARGE_HTML = readFileSync(join(FIXTURES_DIR, 'card-large-with-description.html'), 'utf-8');
export const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

export const PLACEHOLDER_HTML = readFileSync(join(FIXTURES_DIR, 'placeholder-cards.html'), 'utf-8');
/** Two offers of the exchange page, seven chips naming six distinct cards. */
export const TRADES_HTML = readFileSync(join(FIXTURES_DIR, 'trades-list.html'), 'utf-8');
/** The page of the packs between two of them, where the pull panel is drawn. */
export const PULL_IDLE_HTML = readFileSync(join(FIXTURES_DIR, 'pull-idle.html'), 'utf-8');
/** The first card of a pack being revealed, a common one, under its counter. */
export const PULL_REVEAL_HTML = readFileSync(join(FIXTURES_DIR, 'pull-reveal.html'), 'utf-8');

const GRID_CARD_TITLE = "Jeu d'horreur";
const LARGE_CARD_TITLE = 'Foza';
const MODAL_CARD_TITLE = 'Dvorichté';

/** A card of the catalogue export the site shows its own logo for. */
const PLACEHOLDER_CARD_TITLE = 'Adan Canto';

/** Named by both offers of the trade fixture, so two chips carry it. */
export const TRADE_CARD_TITLE = 'Saison 1 de Severance';

const CARD_IMAGE: CardImage = {
  fileName: 'Adan Canto 2015.jpg',
  kind: 'picture',
  thumbnailUrl: null,
};

const FILM_URL = 'https://letterboxd.com/film/lost-river/';

export const ALL_OFF: Settings = {
  letterboxdLink: false,
  wikipediaLink: false,
  missingImages: false,
  tradeCards: false,
  hideCardStats: false,
  pullStats: false,
  compactView: false,
  fullscreenCard: false,
  copyCard: false,
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

export type CategorizeMock = Mock<(cards: readonly CardToCategorize[]) => Promise<CardCategory[]>>;

/** Answers with the results known for the titles asked, as the worker does. */
export function makeCategorize(): CategorizeMock {
  return vi.fn((cards: readonly CardToCategorize[]): Promise<CardCategory[]> => {
    const wanted = new Set(cards.map((card) => card.title));
    return Promise.resolve(RESULTS.filter((result) => wanted.has(result.title)));
  });
}

export interface Harness {
  overlay: Overlay;
  categorize: CategorizeMock;
  /** The journal of the overlay, to read what a failing part said of itself. */
  logger: Logger;
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

export function mount(
  settings: Settings = DEFAULT_SETTINGS,
  categorize: CategorizeMock = makeCategorize(),
  isPongForced?: () => boolean,
  // Injected so a test can make ONE part of a scan throw: the compact view is
  // the only part whose failure a test can provoke from the outside.
  readPath: () => string = () => COMPACT_PATH,
): Harness {
  const retries: (() => void)[] = [];
  const frames: ((timeMs: number) => void)[] = [];
  const chime: ChimePlayer = { play: vi.fn(), close: vi.fn() };
  const logger = makeLogger();
  const deps: OverlayDeps = {
    root: document.body,
    settings,
    logger,
    categorize,
    scheduleRetry: (callback) => {
      retries.push(callback);
    },
    pullTallyStore: { read: () => Promise.resolve(emptyTally()), write: () => Promise.resolve() },
    pullTally: emptyTally(),
    compactStore: { read: () => Promise.resolve(false), write: () => Promise.resolve() },
    isCompact: false,
    readPath,
    requestFrame: (callback) => {
      frames.push(callback);
    },
    chime,
    isPongForced,
  };

  return { overlay: createOverlay(deps), categorize, retries, frames, chime, logger };
}

/** What the content script does on every scan. */
export function scan(overlay: Overlay): void {
  overlay.onScan(scanCards(document.body));
}

/** Two scans: the first asks, the second draws what the answer brought back. */
export async function scanUntilDrawn(overlay: Overlay): Promise<void> {
  scan(overlay);
  await vi.waitFor(() => {
    expect(document.body.querySelector(CARD_BUTTON_SELECTOR)).not.toBeNull();
  });
}

export function cardButtons(): NodeListOf<Element> {
  return document.body.querySelectorAll(CARD_BUTTON_SELECTOR);
}

export function hideStatsStyle(): Element | null {
  return document.head.querySelector(HIDE_STATS_STYLE_SELECTOR);
}

export function brandMarks(): NodeListOf<Element> {
  return document.body.querySelectorAll(BRAND_MARK_SELECTOR);
}

export function compactToggle(): Element | null {
  return document.body.querySelector(COMPACT_TOGGLE_SELECTOR);
}

export function compactStyle(): Element | null {
  return document.head.querySelector(COMPACT_STYLE_SELECTOR);
}

export function pullStatsPanel(): Element | null {
  return document.body.querySelector(PULL_STATS_SELECTOR);
}

export function observeBody(): MutationObserver {
  const observer = new MutationObserver(() => undefined);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  });
  return observer;
}
