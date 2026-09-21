import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDetailModal } from '../../card-detection/data/detail-modal';
import type { CardCategory } from '../../categorization/domain/category';
import { LETTERBOXD_LINK_SELECTOR } from '../data/modal-selectors';
import { syncModalLink } from './sync-modal-link';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

const MODAL_CARD_TITLE = 'Dvorichté';
const OTHER_CARD_TITLE = 'Pulp Fiction';
const FILM_URL = 'https://letterboxd.com/film/pulp-fiction/';

function makeCategory(title: string, letterboxdUrl: string | null): CardCategory {
  return {
    title,
    status: 'categorized',
    qid: 'Q1',
    letterboxdUrl,
    image: null,
  };
}

function makeCategories(...results: CardCategory[]): Map<string, CardCategory> {
  return new Map(results.map((result) => [result.title, result]));
}

function openModal(): void {
  document.body.innerHTML = MODAL_HTML;
}

/** What the content script does: find the modal once, then sync with it. */
function sync(categoriesByTitle: ReadonlyMap<string, CardCategory>): void {
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

function ourLink(): HTMLAnchorElement | null {
  return document.body.querySelector<HTMLAnchorElement>(LETTERBOXD_LINK_SELECTOR);
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

describe('syncModalLink', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should add the link of the card shown in the modal when its category is known', () => {
    openModal();

    sync(makeCategories(makeCategory(MODAL_CARD_TITLE, FILM_URL)));

    expect(ourLink()?.getAttribute('href')).toBe(FILM_URL);
  });

  it('should write nothing on a second sync', () => {
    openModal();
    const categories = makeCategories(makeCategory(MODAL_CARD_TITLE, FILM_URL));
    sync(categories);
    const observer = observeBody();

    sync(categories);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should add nothing while the category of the card is still unknown', () => {
    openModal();
    const observer = observeBody();

    sync(makeCategories(makeCategory(OTHER_CARD_TITLE, FILM_URL)));

    expect(ourLink()).toBeNull();
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should add the link on the sync that follows the arrival of the results', () => {
    openModal();
    sync(new Map());

    sync(makeCategories(makeCategory(MODAL_CARD_TITLE, FILM_URL)));

    expect(ourLink()?.getAttribute('href')).toBe(FILM_URL);
  });

  it('should update the link when the modal shows another card', () => {
    openModal();
    const categories = makeCategories(
      makeCategory(MODAL_CARD_TITLE, FILM_URL),
      makeCategory(OTHER_CARD_TITLE, 'https://letterboxd.com/film/lost-river/'),
    );
    sync(categories);

    showOtherCard(OTHER_CARD_TITLE);
    sync(categories);

    expect(ourLink()?.getAttribute('href')).toBe('https://letterboxd.com/film/lost-river/');
    expect(document.body.querySelectorAll(LETTERBOXD_LINK_SELECTOR)).toHaveLength(1);
  });

  it('should remove the stale link when the new card has no URL', () => {
    openModal();
    const categories = makeCategories(
      makeCategory(MODAL_CARD_TITLE, FILM_URL),
      makeCategory(OTHER_CARD_TITLE, null),
    );
    sync(categories);

    showOtherCard(OTHER_CARD_TITLE);
    sync(categories);

    expect(ourLink()).toBeNull();
  });

  it('should remove our link while the card of the modal cannot be read', () => {
    openModal();
    const categories = makeCategories(makeCategory(MODAL_CARD_TITLE, FILM_URL));
    sync(categories);

    // The site reuses the modal and renders the next card as a skeleton: our
    // link would otherwise still point at the film shown before.
    showOtherCard('');
    sync(categories);

    expect(ourLink()).toBeNull();
  });

  it('should write nothing while the card cannot be read and we added no link', () => {
    openModal();
    showOtherCard('');
    const observer = observeBody();

    sync(makeCategories(makeCategory(MODAL_CARD_TITLE, FILM_URL)));

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should do nothing when no modal is open', () => {
    document.body.innerHTML = '<div class="glow-c"><h3>Pulp Fiction</h3></div>';
    const observer = observeBody();

    sync(makeCategories(makeCategory(OTHER_CARD_TITLE, FILM_URL)));

    expect(ourLink()).toBeNull();
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
