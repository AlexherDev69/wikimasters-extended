import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CardCategory } from '../../categorization/domain/category';
import { findDetailModal } from '../../card-detection/data/detail-modal';
import { syncModalLink } from '../../letterboxd/presentation/sync-modal-link';
import { LETTERBOXD_LINK_SELECTOR } from '../../letterboxd/data/modal-selectors';
import { CATEGORY_LINE_SELECTOR } from '../data/badge-selectors';
import { syncModalCategory } from './sync-modal-category';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

const MODAL_CARD_TITLE = 'Dvorichté';
const OTHER_CARD_TITLE = 'Pulp Fiction';
const FILM_URL = 'https://letterboxd.com/film/pulp-fiction/';

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

function openModal(): void {
  document.body.innerHTML = MODAL_HTML;
}

/** What the content script does: find the modal once, then sync with it. */
function syncCategory(categoriesByTitle: ReadonlyMap<string, CardCategory>): void {
  syncModalCategory(findDetailModal(document.body), categoriesByTitle);
}

/** The Letterboxd feature syncs from the very same modal. */
function syncLink(categoriesByTitle: ReadonlyMap<string, CardCategory>): void {
  syncModalLink(findDetailModal(document.body), categoriesByTitle);
}

/** The site reuses the same modal for the next card it shows. */
function showOtherCard(title: string): void {
  const heading = document.body.querySelector('[class*="glow-"] h3');
  if (heading === null) {
    throw new Error('The fixture card has no title');
  }
  heading.textContent = title;
}

function ourLine(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(CATEGORY_LINE_SELECTOR);
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

describe('syncModalCategory', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should add the category of the card shown in the modal when it is known', () => {
    openModal();

    syncCategory(makeCategories(makeCategory(MODAL_CARD_TITLE)));

    expect(ourLine()?.textContent).toBe('Catégorie : Lieu');
  });

  it('should write nothing on a second sync', () => {
    openModal();
    const categories = makeCategories(makeCategory(MODAL_CARD_TITLE));
    syncCategory(categories);
    const observer = observeBody();

    syncCategory(categories);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should add nothing while the category of the card is still unknown', () => {
    openModal();
    const observer = observeBody();

    syncCategory(makeCategories(makeCategory(OTHER_CARD_TITLE)));

    expect(ourLine()).toBeNull();
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should add the line on the sync that follows the arrival of the results', () => {
    openModal();
    syncCategory(new Map());

    syncCategory(makeCategories(makeCategory(MODAL_CARD_TITLE, { categoryId: 'astronomy' })));

    expect(ourLine()?.textContent).toBe('Catégorie : Astronomie');
  });

  it('should update the line when the modal shows another card', () => {
    openModal();
    const categories = makeCategories(
      makeCategory(MODAL_CARD_TITLE),
      makeCategory(OTHER_CARD_TITLE, { categoryId: 'film_tv' }),
    );
    syncCategory(categories);

    showOtherCard(OTHER_CARD_TITLE);
    syncCategory(categories);

    expect(ourLine()?.textContent).toBe('Catégorie : Cinéma et TV');
    expect(document.body.querySelectorAll(CATEGORY_LINE_SELECTOR)).toHaveLength(1);
  });

  it('should remove the stale line when the new card has no category', () => {
    openModal();
    const categories = makeCategories(
      makeCategory(MODAL_CARD_TITLE),
      makeCategory(OTHER_CARD_TITLE, { status: 'not_found', categoryId: null }),
    );
    syncCategory(categories);

    showOtherCard(OTHER_CARD_TITLE);
    syncCategory(categories);

    expect(ourLine()).toBeNull();
  });

  it('should remove our line while the card of the modal cannot be read', () => {
    openModal();
    const categories = makeCategories(makeCategory(MODAL_CARD_TITLE));
    syncCategory(categories);

    showOtherCard('');
    syncCategory(categories);

    expect(ourLine()).toBeNull();
  });

  it('should do nothing when no modal is open', () => {
    document.body.innerHTML = '<div class="glow-c"><h3>Pulp Fiction</h3></div>';
    const observer = observeBody();

    syncCategory(makeCategories(makeCategory(OTHER_CARD_TITLE)));

    expect(ourLine()).toBeNull();
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should sit under the Letterboxd link when the link was synced first', () => {
    openModal();
    const categories = makeCategories(
      makeCategory(MODAL_CARD_TITLE, { categoryId: 'film_tv', letterboxdUrl: FILM_URL }),
    );

    syncLink(categories);
    syncCategory(categories);

    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)?.nextElementSibling).toBe(
      ourLine(),
    );
  });

  it('should sit under the Letterboxd link when the category was synced first', () => {
    openModal();
    const categories = makeCategories(
      makeCategory(MODAL_CARD_TITLE, { categoryId: 'film_tv', letterboxdUrl: FILM_URL }),
    );

    syncCategory(categories);
    syncLink(categories);

    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)?.nextElementSibling).toBe(
      ourLine(),
    );
  });

  it('should write nothing on a second sync of both features together', () => {
    openModal();
    const categories = makeCategories(
      makeCategory(MODAL_CARD_TITLE, { categoryId: 'film_tv', letterboxdUrl: FILM_URL }),
    );
    syncCategory(categories);
    syncLink(categories);
    const observer = observeBody();

    syncCategory(categories);
    syncLink(categories);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
