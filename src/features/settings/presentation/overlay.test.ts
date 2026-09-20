import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from '../../../core/logger/logger';
import { scanCards } from '../../card-detection/data/scan-cards';
import type { ScheduleRetry } from '../../card-detection/presentation/handle-scan';
import type { CardCategory } from '../../categorization/domain/category';
import type { CardToCategorize } from '../../categorization/domain/categorize-cards';
import { BADGE_SELECTOR, CATEGORY_LINE_SELECTOR } from '../../category-badge/data/badge-selectors';
import { DIM_SELECTOR, PANEL_SELECTOR } from '../../category-highlight/data/highlight-selectors';
import { LETTERBOXD_LINK_SELECTOR } from '../../letterboxd/data/modal-selectors';
import { CARD_IMAGE_SELECTOR, IMAGE_CREDIT_SELECTOR } from '../../missing-image/data/image-selectors';
import type { CardImage } from '../../missing-image/domain/card-image';
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import { createOverlay, type Overlay, type OverlayDeps } from './overlay';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const GRID_HTML = readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8');
const LARGE_HTML = readFileSync(join(FIXTURES_DIR, 'card-large-with-description.html'), 'utf-8');
const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

const PLACEHOLDER_HTML = readFileSync(join(FIXTURES_DIR, 'placeholder-cards.html'), 'utf-8');

const GRID_CARD_TITLE = "Jeu d'horreur";
const LARGE_CARD_TITLE = 'Foza';
const MODAL_CARD_TITLE = 'Dvorichté';
/** A card of the catalogue export the site shows its own logo for. */
const PLACEHOLDER_CARD_TITLE = 'Adan Canto';

const CARD_IMAGE: CardImage = { fileName: 'Adan Canto 2015.jpg', kind: 'picture' };

const FILM_URL = 'https://letterboxd.com/film/lost-river/';

const ALL_OFF: Settings = {
  categoryBadges: false,
  categoryHighlight: false,
  letterboxdLink: false,
  missingImages: false,
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
    ...overrides,
  };
}

/** Every card of the fixtures, so any page shows a categorized card. */
const RESULTS: CardCategory[] = [
  makeCategory(GRID_CARD_TITLE, { categoryId: 'science_concept' }),
  makeCategory(LARGE_CARD_TITLE),
  makeCategory(MODAL_CARD_TITLE, { categoryId: 'film_tv', letterboxdUrl: FILM_URL }),
  makeCategory(PLACEHOLDER_CARD_TITLE, { categoryId: 'person', image: CARD_IMAGE }),
];

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

interface Harness {
  overlay: Overlay;
  categorize: ReturnType<typeof vi.fn>;
}

/** Runs the retry timers at once, as the content script context would later. */
const runRetryNow: ScheduleRetry = (callback) => {
  callback();
};

function mount(settings: Settings = DEFAULT_SETTINGS): Harness {
  const categorize = vi.fn((cards: readonly CardToCategorize[]): Promise<CardCategory[]> => {
    const wanted = new Set(cards.map((card) => card.title));
    return Promise.resolve(RESULTS.filter((result) => wanted.has(result.title)));
  });
  const deps: OverlayDeps = {
    root: document.body,
    settings,
    logger: makeLogger(),
    categorize,
    scheduleRetry: runRetryNow,
  };

  return { overlay: createOverlay(deps), categorize };
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

  it('should show every part of the overlay when the four settings are on', async () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount();

    await scanUntilDrawn(overlay);

    expect(badges().length).toBeGreaterThan(0);
    expect(document.body.querySelector(PANEL_SELECTOR)).not.toBeNull();
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

  it('should take back the panel and every veil when the highlight is turned off', async () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    document.body.querySelector<HTMLElement>('.wme-panel-toggle')?.click();
    document.body.querySelector<HTMLElement>('.wme-panel-item')?.click();
    expect(document.body.querySelectorAll(DIM_SELECTOR).length).toBeGreaterThan(0);

    overlay.applySettings({ ...DEFAULT_SETTINGS, categoryHighlight: false });

    expect(document.body.querySelector(PANEL_SELECTOR)).toBeNull();
    expect(document.body.querySelectorAll(DIM_SELECTOR)).toHaveLength(0);
  });

  it('should forget the chosen filter when the highlight is turned off and on again', async () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    document.body.querySelector<HTMLElement>('.wme-panel-toggle')?.click();
    document.body.querySelector<HTMLElement>('.wme-panel-item')?.click();

    overlay.applySettings({ ...DEFAULT_SETTINGS, categoryHighlight: false });
    overlay.applySettings(DEFAULT_SETTINGS);

    expect(document.body.querySelectorAll(DIM_SELECTOR)).toHaveLength(0);
    expect(document.body.querySelector('.wme-panel-clear')).toBeNull();
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

  it('should ask for no categorization at all when the four settings are off', () => {
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
    document.body.innerHTML = GRID_HTML + LARGE_HTML + MODAL_HTML;
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

  it('should write nothing on a second scan while only the highlight is left on', async () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const { overlay } = mount({ ...ALL_OFF, categoryHighlight: true });
    scan(overlay);
    await vi.waitFor(() => {
      expect(document.body.querySelector(PANEL_SELECTOR)).not.toBeNull();
    });
    scan(overlay);
    const observer = observeBody();

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
});
