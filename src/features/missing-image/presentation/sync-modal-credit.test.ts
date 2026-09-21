import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_ROOT_SELECTOR } from '../../card-detection/data/card-selectors';
import { findDetailModal } from '../../card-detection/data/detail-modal';
import type { CardCategory } from '../../categorization/domain/category';
import { LETTERBOXD_LINK_SELECTOR } from '../../letterboxd/data/modal-selectors';
import { syncModalLink } from '../../letterboxd/presentation/sync-modal-link';
import { IMAGE_CREDIT_SELECTOR } from '../data/image-selectors';
import type { CardImage } from '../domain/card-image';
import { syncModalCredit } from './sync-modal-credit';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');
const PLACEHOLDER_HTML = readFileSync(join(FIXTURES_DIR, 'placeholder-cards.html'), 'utf-8');

/** The card of the modal export, which the site shows a real picture for. */
const REAL_PICTURE_TITLE = 'Dvorichté';
/** The card put in the modal below, which the site shows its logo for. */
const PLACEHOLDER_TITLE = 'Adan Canto';

const PORTRAIT: CardImage = {
  fileName: 'Adan Canto 2015.jpg',
  kind: 'picture',
  thumbnailUrl: null,
};

const CREDIT_TEXT = 'Image : Wikimedia Commons (auteur et licence)';

const FILM_URL = 'https://letterboxd.com/film/pulp-fiction/';

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

function makeCategories(...results: CardCategory[]): Map<string, CardCategory> {
  return new Map(results.map((result) => [result.title, result]));
}

/** The modal as the site exported it, showing a card with a real picture. */
function openModalWithRealPicture(): void {
  document.body.innerHTML = MODAL_HTML;
}

/**
 * The same modal showing a card the site has no picture for: its card is
 * replaced by a card of the catalogue export, which is what the site renders
 * when such a card is opened.
 */
function openModalWithPlaceholder(): void {
  document.body.innerHTML = MODAL_HTML + PLACEHOLDER_HTML;
  const [modalCard, placeholderCard] = document.body.querySelectorAll(CARD_ROOT_SELECTOR);
  if (modalCard === undefined || placeholderCard === undefined) {
    throw new Error('The fixtures hold no card');
  }
  modalCard.replaceWith(placeholderCard);
}

/** What the content script does: find the modal once, then sync with it. */
function syncCredit(categoriesByTitle: ReadonlyMap<string, CardCategory>): void {
  syncModalCredit(findDetailModal(document.body), categoriesByTitle);
}

/** The Letterboxd feature syncs from the very same modal. */
function syncLink(categoriesByTitle: ReadonlyMap<string, CardCategory>): void {
  syncModalLink(findDetailModal(document.body), categoriesByTitle);
}

function ourLine(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(IMAGE_CREDIT_SELECTOR);
}

/** The site reuses the same modal for the next card it shows. */
function showOtherCard(title: string): void {
  const heading = document.body.querySelector(`${CARD_ROOT_SELECTOR} h3`);
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

describe('syncModalCredit', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should credit the image shown over the placeholder of the card', () => {
    openModalWithPlaceholder();

    syncCredit(makeCategories(makeCategory(PLACEHOLDER_TITLE, { image: PORTRAIT })));

    expect(ourLine()?.textContent).toBe(CREDIT_TEXT);
  });

  it('should add no line when the site shows a real picture for the card', () => {
    openModalWithRealPicture();
    const observer = observeBody();

    syncCredit(makeCategories(makeCategory(REAL_PICTURE_TITLE, { image: PORTRAIT })));

    expect(ourLine()).toBeNull();
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should add no line while Wikidata knows no image for the card', () => {
    openModalWithPlaceholder();

    syncCredit(makeCategories(makeCategory(PLACEHOLDER_TITLE)));

    expect(ourLine()).toBeNull();
  });

  it('should add no line while the facts of the card are still unknown', () => {
    openModalWithPlaceholder();
    const observer = observeBody();

    syncCredit(new Map());

    expect(ourLine()).toBeNull();
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a second sync', () => {
    openModalWithPlaceholder();
    const categories = makeCategories(makeCategory(PLACEHOLDER_TITLE, { image: PORTRAIT }));
    syncCredit(categories);
    const observer = observeBody();

    syncCredit(categories);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should remove our line while the card of the modal cannot be read', () => {
    openModalWithPlaceholder();
    const categories = makeCategories(makeCategory(PLACEHOLDER_TITLE, { image: PORTRAIT }));
    syncCredit(categories);

    showOtherCard('');
    syncCredit(categories);

    expect(ourLine()).toBeNull();
  });

  it('should do nothing when no modal is open', () => {
    document.body.innerHTML = PLACEHOLDER_HTML;
    const observer = observeBody();

    syncCredit(makeCategories(makeCategory(PLACEHOLDER_TITLE, { image: PORTRAIT })));

    expect(ourLine()).toBeNull();
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should sit under the Letterboxd link when the credit synced before it', () => {
    openModalWithPlaceholder();
    const categories = makeCategories(
      makeCategory(PLACEHOLDER_TITLE, { image: PORTRAIT, letterboxdUrl: FILM_URL }),
    );

    syncCredit(categories);
    syncLink(categories);

    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)?.nextElementSibling).toBe(
      ourLine(),
    );
  });
});
