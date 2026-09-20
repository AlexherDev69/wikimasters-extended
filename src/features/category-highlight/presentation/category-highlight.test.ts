import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from '../../card-detection/data/scan-cards';
import type { CardCategory } from '../../categorization/domain/category';
import { DIM_SELECTOR, PANEL_SELECTOR } from '../data/highlight-selectors';
import { createCategoryHighlight, type CategoryHighlight } from './category-highlight';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const GRID_HTML = readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8');
const LARGE_HTML = readFileSync(join(FIXTURES_DIR, 'card-large-with-description.html'), 'utf-8');
const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

const GRID_CARD_TITLE = "Jeu d'horreur";
const LARGE_CARD_TITLE = 'Foza';
const MODAL_CARD_TITLE = 'Dvorichté';

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

function makeCategories(...results: CardCategory[]): Map<string, CardCategory> {
  return new Map(results.map((result) => [result.title, result]));
}

/** One card of each of two categories, as a page of the site would show them. */
const TWO_CARDS = makeCategories(
  makeCategory(GRID_CARD_TITLE, { categoryId: 'science_concept' }),
  makeCategory(LARGE_CARD_TITLE, { categoryId: 'place' }),
);

/** What the content script does on every scan and every batch of results. */
function sync(highlight: CategoryHighlight, categories: ReadonlyMap<string, CardCategory>): void {
  highlight.sync(scanCards(document.body), categories);
}

function panel(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(PANEL_SELECTOR);
}

function toggle(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('.wme-panel-toggle');
}

function items(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>('.wme-panel-item')];
}

function clearButton(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('.wme-panel-clear');
}

/** The titles of the cards currently covered by our veil. */
function dimmedTitles(): string[] {
  return scanCards(document.body)
    .filter((observed) => observed.element.querySelector(DIM_SELECTOR) !== null)
    .map((observed) => observed.card.title);
}

function expand(): void {
  toggle()?.click();
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

describe('createCategoryHighlight', () => {
  let highlight: CategoryHighlight;

  beforeEach(() => {
    document.body.innerHTML = '';
    highlight = createCategoryHighlight(document.body);
  });

  it('should show the panel collapsed when the page loads', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;

    sync(highlight, TWO_CARDS);

    expect(toggle()?.textContent).toBe('Catégories (2)');
    expect(items()).toHaveLength(0);
  });

  it('should list the categories of the page once expanded', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, TWO_CARDS);

    expand();

    expect(items().map((item) => item.textContent)).toEqual(['Lieu1', 'Science1']);
  });

  it('should show no panel when the page shows no card', () => {
    document.body.innerHTML = '<div class="p-4">Aucune carte</div>';

    sync(highlight, TWO_CARDS);

    expect(panel()).toBeNull();
  });

  it('should show no panel while no card of the page is categorized', () => {
    document.body.innerHTML = GRID_HTML;

    sync(highlight, new Map());

    expect(panel()).toBeNull();
  });

  it('should count the same card once when the modal shows it over the grid', () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML + MODAL_HTML;
    sync(highlight, makeCategories(makeCategory(MODAL_CARD_TITLE, { categoryId: 'place' })));

    expand();

    expect(items().map((item) => item.textContent)).toEqual(['Lieu1']);
  });

  it('should dim the cards of the other categories when one is chosen', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, TWO_CARDS);
    expand();

    items()[0]?.click();

    expect(dimmedTitles()).toEqual([GRID_CARD_TITLE]);
  });

  it('should dim a card whose category is not known yet', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, makeCategories(makeCategory(LARGE_CARD_TITLE, { categoryId: 'place' })));
    expand();

    items()[0]?.click();

    expect(dimmedTitles()).toEqual([GRID_CARD_TITLE]);
  });

  it('should dim nothing again when the same category is clicked twice', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, TWO_CARDS);
    expand();
    items()[0]?.click();

    items()[0]?.click();

    expect(dimmedTitles()).toEqual([]);
    expect(clearButton()).toBeNull();
  });

  it('should dim nothing again when the way out is clicked', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, TWO_CARDS);
    expand();
    items()[0]?.click();

    clearButton()?.click();

    expect(dimmedTitles()).toEqual([]);
  });

  it('should move the filter to the category that was clicked next', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, TWO_CARDS);
    expand();
    items()[0]?.click();

    items()[1]?.click();

    expect(dimmedTitles()).toEqual([LARGE_CARD_TITLE]);
  });

  it('should dim the cards a later scan brought in', () => {
    document.body.innerHTML = LARGE_HTML;
    sync(highlight, TWO_CARDS);
    expand();
    items()[0]?.click();

    // The site added the next page of the collection to the DOM.
    document.body.insertAdjacentHTML('beforeend', GRID_HTML);
    sync(highlight, TWO_CARDS);

    expect(dimmedTitles()).toEqual([GRID_CARD_TITLE]);
  });

  it('should keep the filter and say so on a page holding none of that category', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, TWO_CARDS);
    expand();
    // "Lieu" comes first: one card of each category, sorted by label.
    items()[0]?.click();

    // The site paginated: the new page holds no card of the chosen category.
    document.body.innerHTML = GRID_HTML;
    sync(highlight, TWO_CARDS);

    expect(items().map((item) => item.textContent)).toEqual(['Science1', 'Lieu0']);
    expect(items()[1]?.getAttribute('aria-pressed')).toBe('true');
    expect(dimmedTitles()).toEqual([GRID_CARD_TITLE]);
  });

  it('should name the active filter in the toggle of a collapsed panel', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, TWO_CARDS);
    expand();
    items()[0]?.click();

    expand();

    expect(items()).toHaveLength(0);
    expect(toggle()?.textContent).toBe('Catégories (2) · Lieu');
    expect(clearButton()?.textContent).toBe('Tout afficher');
  });

  it('should take back every veil when the filter is cleared from the collapsed panel', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, TWO_CARDS);
    expand();
    items()[0]?.click();
    expand();

    clearButton()?.click();

    expect(dimmedTitles()).toEqual([]);
    expect(toggle()?.textContent).toBe('Catégories (2)');
  });

  it('should show no panel and no veil when the page shows no card at all', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, TWO_CARDS);
    expand();
    items()[0]?.click();

    // The site replaced the page: no card left, so no panel to clear either.
    document.body.innerHTML = '<div class="p-4">Aucune carte</div>';
    sync(highlight, TWO_CARDS);

    expect(panel()).toBeNull();
    expect(dimmedTitles()).toEqual([]);
  });

  it('should apply the remembered filter again when the cards come back', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, TWO_CARDS);
    expand();
    items()[0]?.click();
    document.body.innerHTML = '<div class="p-4">Aucune carte</div>';
    sync(highlight, TWO_CARDS);

    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, TWO_CARDS);

    expect(dimmedTitles()).toEqual([GRID_CARD_TITLE]);
  });

  it('should write nothing on a second sync of a page without the filtered category', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, TWO_CARDS);
    expand();
    items()[0]?.click();
    document.body.innerHTML = GRID_HTML;
    sync(highlight, TWO_CARDS);
    const observer = observeBody();

    sync(highlight, TWO_CARDS);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a second sync of the same page', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, TWO_CARDS);
    const observer = observeBody();

    sync(highlight, TWO_CARDS);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a second sync while a filter is active', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync(highlight, TWO_CARDS);
    expand();
    items()[0]?.click();
    const observer = observeBody();

    sync(highlight, TWO_CARDS);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should leave the cards of the page readable exactly as before', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const before = scanCards(document.body).map((observed) => observed.card);
    sync(highlight, TWO_CARDS);
    expand();

    items()[0]?.click();

    expect(scanCards(document.body).map((observed) => observed.card)).toEqual(before);
  });

  it('should take back every node it added when the context is invalidated', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const siteHtml = document.body.innerHTML;
    sync(highlight, TWO_CARDS);
    expand();
    items()[0]?.click();

    highlight.destroy();

    expect(panel()).toBeNull();
    expect(document.body.querySelectorAll(DIM_SELECTOR)).toHaveLength(0);
    expect(document.body.innerHTML).toBe(siteHtml);
  });
});
