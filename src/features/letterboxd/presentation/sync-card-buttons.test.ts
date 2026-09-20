import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from '../../card-detection/data/scan-cards';
import type { CardCategory } from '../../categorization/domain/category';
import { CARD_BUTTON_SELECTOR } from '../data/card-button-selectors';
import { syncCardButtons } from './sync-card-buttons';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const GRID_HTML = readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8');
const LARGE_HTML = readFileSync(join(FIXTURES_DIR, 'card-large-no-description.html'), 'utf-8');

const GRID_CARD_TITLE = "Jeu d'horreur";
const LARGE_CARD_TITLE = 'Dvorichté';
const OTHER_CARD_TITLE = 'Pulp Fiction';
const FILM_URL = 'https://letterboxd.com/film/pulp-fiction/';
const OTHER_URL = 'https://letterboxd.com/film/lost-river/';

function makeCategory(title: string, overrides: Partial<CardCategory> = {}): CardCategory {
  return {
    title,
    status: 'categorized',
    qid: 'Q1',
    categoryId: 'film_tv',
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

/** What the content script does on every scan and on every batch of results. */
function sync(categoriesByTitle: ReadonlyMap<string, CardCategory>): void {
  syncCardButtons(scanCards(document.body), categoriesByTitle);
}

function buttons(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>(CARD_BUTTON_SELECTOR)];
}

/** The site reuses a card node and renders another card in it when paginating. */
function showOtherCard(title: string): void {
  const heading = document.body.querySelector('[class*="glow-"] h3');
  if (heading === null) {
    throw new Error('The fixture card has no title');
  }
  heading.textContent = title;
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

describe('syncCardButtons', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should show the button of every card whose address is known', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;

    sync(
      makeCategories(
        makeCategory(GRID_CARD_TITLE, { letterboxdUrl: FILM_URL }),
        makeCategory(LARGE_CARD_TITLE),
      ),
    );

    expect(buttons()).toHaveLength(1);
    expect(buttons()[0]?.getAttribute('href')).toBe(FILM_URL);
  });

  it('should write nothing on a second sync', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const categories = makeCategories(
      makeCategory(GRID_CARD_TITLE, { letterboxdUrl: FILM_URL }),
      makeCategory(LARGE_CARD_TITLE),
    );
    sync(categories);
    const observer = observeBody();

    sync(categories);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should add nothing while the category of the card is still unknown', () => {
    document.body.innerHTML = GRID_HTML;
    const observer = observeBody();

    sync(makeCategories(makeCategory(OTHER_CARD_TITLE, { letterboxdUrl: FILM_URL })));

    expect(buttons()).toHaveLength(0);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should show the button of a reused node for the card it shows now, not the one it showed before', () => {
    document.body.innerHTML = LARGE_HTML;
    const categories = makeCategories(
      makeCategory(LARGE_CARD_TITLE, { letterboxdUrl: FILM_URL }),
      makeCategory(OTHER_CARD_TITLE, { letterboxdUrl: OTHER_URL }),
    );
    sync(categories);

    showOtherCard(OTHER_CARD_TITLE);
    sync(categories);

    expect(buttons()).toHaveLength(1);
    expect(buttons()[0]?.getAttribute('href')).toBe(OTHER_URL);
  });

  it('should remove the button of a reused node whose new card has no address', () => {
    document.body.innerHTML = LARGE_HTML;
    const categories = makeCategories(makeCategory(LARGE_CARD_TITLE, { letterboxdUrl: FILM_URL }));
    sync(categories);

    showOtherCard(OTHER_CARD_TITLE);
    sync(categories);

    expect(buttons()).toHaveLength(0);
  });

  it('should leave the cards of the page readable exactly as before', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const before = scanCards(document.body).map((observed) => observed.card);

    sync(
      makeCategories(
        makeCategory(GRID_CARD_TITLE, { letterboxdUrl: FILM_URL }),
        makeCategory(LARGE_CARD_TITLE),
      ),
    );

    expect(scanCards(document.body).map((observed) => observed.card)).toEqual(before);
  });
});
