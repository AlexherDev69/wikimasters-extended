import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WIKIPEDIA_BUTTON_ATTRIBUTE } from '../../wikipedia-link/data/wikipedia-button-selectors';
import { WIKIPEDIA_LINK_SELECTOR } from './card-selectors';
import { findDetailModal } from './detail-modal';

/** Another full-screen layer of the site, rendered before the detail modal. */
const DECOY_LAYER_HTML =
  '<div class="fixed inset-0 z-50 flex items-start justify-center p-4">' +
  '<div class="rounded-lg p-3">Enchère enregistrée</div></div>';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** Real sanitized export of the detail modal, card "Dvorichté". */
const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

const MODAL_CARD_TITLE = 'Dvorichté';
const MODAL_ARTICLE_URL = 'https://fr.wikipedia.org/wiki/Dvoricht%C3%A9';

function openModal(): void {
  document.body.innerHTML = MODAL_HTML;
}

/**
 * Puts the button of the extension on the card of the modal, where the sync
 * of the cards puts it: the card of the modal is a card like any other.
 */
function addOurButtonToTheCard(): void {
  const card = document.body.querySelector('[class*="glow-"]');
  if (card === null) {
    throw new Error('The fixture has no card');
  }
  const button = document.createElement('a');
  button.setAttribute(WIKIPEDIA_BUTTON_ATTRIBUTE, '');
  button.href = MODAL_ARTICLE_URL;
  card.appendChild(button);
}

/** The site reuses the modal and renders the next card as a skeleton. */
function makeCardUnreadable(): void {
  const heading = document.body.querySelector('[class*="glow-"] h3');
  if (heading === null) {
    throw new Error('The fixture card has no title');
  }
  heading.textContent = '';
}

describe('findDetailModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return the title of the card and the Wikipedia link when the modal is open', () => {
    openModal();

    const modal = findDetailModal(document.body);

    expect(modal?.title).toBe(MODAL_CARD_TITLE);
    expect(modal?.wikipediaLink.getAttribute('href')).toBe(MODAL_ARTICLE_URL);
  });

  it('should return the full-screen layer as the root of the modal', () => {
    openModal();

    const modal = findDetailModal(document.body);

    expect(modal?.root).toBe(document.body.firstElementChild);
  });

  it('should return nothing when no modal is open', () => {
    document.body.innerHTML = '<div class="p-4"><h3>Pulp Fiction</h3></div>';

    expect(findDetailModal(document.body)).toBeNull();
  });

  it('should return nothing when the modal carries no Wikipedia link', () => {
    openModal();
    document.body.querySelector(WIKIPEDIA_LINK_SELECTOR)?.remove();

    expect(findDetailModal(document.body)).toBeNull();
  });

  it('should return no title when the card of the modal cannot be read', () => {
    openModal();
    makeCardUnreadable();

    const modal = findDetailModal(document.body);

    expect(modal).not.toBeNull();
    expect(modal?.title).toBeNull();
  });

  it('should skip a full-screen layer that is not the detail modal', () => {
    document.body.innerHTML = DECOY_LAYER_HTML + MODAL_HTML;

    const modal = findDetailModal(document.body);

    expect(modal?.title).toBe(MODAL_CARD_TITLE);
    expect(modal?.wikipediaLink.getAttribute('href')).toBe(MODAL_ARTICLE_URL);
  });

  it('should return nothing when the only layer carries no card frame', () => {
    document.body.innerHTML = DECOY_LAYER_HTML;

    expect(findDetailModal(document.body)).toBeNull();
  });

  it('should read the link of the site when our own button is on the card of the modal', () => {
    // Our button points at the very same article and is drawn on the card,
    // which the site renders before the column holding its own link. Taking
    // it for the link of the site would anchor everything the extension adds
    // to the modal inside the card instead of under that link.
    openModal();
    addOurButtonToTheCard();

    const modal = findDetailModal(document.body);

    expect(modal?.wikipediaLink.hasAttribute(WIKIPEDIA_BUTTON_ATTRIBUTE)).toBe(false);
    expect(modal?.wikipediaLink.getAttribute('href')).toBe(MODAL_ARTICLE_URL);
  });

  it('should return nothing when our own button is the only Wikipedia link of the modal', () => {
    // A modal whose column has not rendered yet is not a modal to write in:
    // what the extension adds there goes under the link of the site, and
    // there is none to go under.
    openModal();
    document.body.querySelector(WIKIPEDIA_LINK_SELECTOR)?.remove();
    addOurButtonToTheCard();

    expect(findDetailModal(document.body)).toBeNull();
  });

  it('should write nothing in the modal it reads', () => {
    openModal();
    const siteHtml = document.body.innerHTML;

    findDetailModal(document.body);

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});
