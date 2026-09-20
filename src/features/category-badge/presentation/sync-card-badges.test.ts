import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from '../../card-detection/data/scan-cards';
import type { CardCategory } from '../../categorization/domain/category';
import { BADGE_SELECTOR } from '../data/badge-selectors';
import { syncCardBadges } from './sync-card-badges';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const GRID_HTML = readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8');
const LARGE_HTML = readFileSync(join(FIXTURES_DIR, 'card-large-no-description.html'), 'utf-8');
const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

const GRID_CARD_TITLE = "Jeu d'horreur";
const LARGE_CARD_TITLE = 'Dvorichté';
const OTHER_CARD_TITLE = 'Pulp Fiction';

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

function makeCategories(...results: CardCategory[]): Map<string, CardCategory> {
  return new Map(results.map((result) => [result.title, result]));
}

/** What the content script does on every scan and on every batch of results. */
function sync(categoriesByTitle: ReadonlyMap<string, CardCategory>): void {
  syncCardBadges(scanCards(document.body), categoriesByTitle);
}

function badges(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>(BADGE_SELECTOR)];
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

describe('syncCardBadges', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should badge every card of the page whose category is known', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;

    sync(
      makeCategories(
        makeCategory(GRID_CARD_TITLE, { categoryId: 'science_concept' }),
        makeCategory(LARGE_CARD_TITLE, { categoryId: 'place' }),
      ),
    );

    expect(badges().map((node) => node.textContent)).toEqual(['Science', 'Lieu']);
  });

  it('should badge the card shown in the detail modal', () => {
    document.body.innerHTML = MODAL_HTML;

    sync(makeCategories(makeCategory(LARGE_CARD_TITLE)));

    expect(badges()).toHaveLength(1);
    expect(badges()[0]?.textContent).toBe('Lieu');
  });

  it('should write nothing on a second sync', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const categories = makeCategories(
      makeCategory(GRID_CARD_TITLE),
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

    sync(makeCategories(makeCategory(OTHER_CARD_TITLE)));

    expect(badges()).toHaveLength(0);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should add the badge on the sync that follows the arrival of the results', () => {
    document.body.innerHTML = GRID_HTML;
    sync(new Map());

    sync(makeCategories(makeCategory(GRID_CARD_TITLE, { categoryId: 'food_drink' })));

    expect(badges()[0]?.textContent).toBe('Gastronomie');
  });

  it('should badge the card a reused node shows now and not the one it showed before', () => {
    document.body.innerHTML = LARGE_HTML;
    const categories = makeCategories(
      makeCategory(LARGE_CARD_TITLE, { categoryId: 'place' }),
      makeCategory(OTHER_CARD_TITLE, { categoryId: 'film_tv' }),
    );
    sync(categories);

    showOtherCard(OTHER_CARD_TITLE);
    sync(categories);

    expect(badges()).toHaveLength(1);
    expect(badges()[0]?.textContent).toBe('Cinéma et TV');
  });

  it('should remove the badge of a reused node whose new card has no category', () => {
    document.body.innerHTML = LARGE_HTML;
    const categories = makeCategories(makeCategory(LARGE_CARD_TITLE));
    sync(categories);

    showOtherCard(OTHER_CARD_TITLE);
    sync(categories);

    expect(badges()).toHaveLength(0);
  });

  it('should remove the badge when the card lost its category', () => {
    document.body.innerHTML = GRID_HTML;
    sync(makeCategories(makeCategory(GRID_CARD_TITLE)));

    sync(makeCategories(makeCategory(GRID_CARD_TITLE, { status: 'error', categoryId: null })));

    expect(badges()).toHaveLength(0);
  });

  it('should badge no card whose article could not be found', () => {
    document.body.innerHTML = GRID_HTML;

    sync(makeCategories(makeCategory(GRID_CARD_TITLE, { status: 'not_found', categoryId: null })));

    expect(badges()).toHaveLength(0);
  });

  it('should show the main subtype of a person', () => {
    document.body.innerHTML = GRID_HTML;

    sync(
      makeCategories(
        makeCategory(GRID_CARD_TITLE, {
          categoryId: 'person',
          primarySubtype: 'music',
          personSubtypes: ['music'],
        }),
      ),
    );

    expect(badges()[0]?.textContent).toBe('Personne · Musique');
  });

  it('should leave the cards of the page readable exactly as before', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const before = scanCards(document.body).map((observed) => observed.card);

    sync(makeCategories(makeCategory(GRID_CARD_TITLE), makeCategory(LARGE_CARD_TITLE)));

    expect(scanCards(document.body).map((observed) => observed.card)).toEqual(before);
  });
});
