import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_ROOT_SELECTOR, WIKIPEDIA_LINK_SELECTOR } from '../../card-detection/data/card-selectors';
import { findDetailModal, type DetailModal } from '../../card-detection/data/detail-modal';
import { CATEGORY_LINE_SELECTOR } from '../../category-badge/data/badge-selectors';
import { applyModalCategoryLine, findModalCategoryTarget } from '../../category-badge/data/modal-category-line';
import type { ModalCategoryDescriptor } from '../../category-badge/domain/describe-modal-category';
import { applyModalLink, findModalLinkTarget } from '../../letterboxd/data/modal-link';
import { LETTERBOXD_LINK_SELECTOR } from '../../letterboxd/data/modal-selectors';
import { IMAGE_CREDIT_SELECTOR } from './image-selectors';
import {
  applyModalCreditLine,
  findModalCreditTarget,
  removeModalCreditLines,
  type ModalCreditTarget,
} from './modal-credit-line';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** Real sanitized export of the detail modal, card "Dvorichté". */
const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

/** Real sanitized export of the catalogue, two of its cards show the logo. */
const PLACEHOLDER_HTML = readFileSync(join(FIXTURES_DIR, 'placeholder-cards.html'), 'utf-8');

const FILE_NAME = 'Adan Canto 2015.jpg';
const OTHER_FILE_NAME = 'Logo - République française.svg';

const FILE_PAGE_URL =
  'https://commons.wikimedia.org/wiki/File:Adan%20Canto%202015.jpg';

const CREDIT_TEXT = 'Image : Wikimedia Commons (auteur et licence)';

const FILM_URL = 'https://letterboxd.com/film/pulp-fiction/';

const PLACE: ModalCategoryDescriptor = {
  categoryId: 'place',
  accentColor: '#6ce0ac',
  text: 'Catégorie : Lieu',
};

/**
 * The detail modal showing a card the site has no picture for: the card of the
 * modal export is replaced by a card of the catalogue export, which is what
 * the site renders when such a card is opened. The Wikipedia link of the
 * fixture still names the card it was exported with, which changes nothing
 * here: the credit line only uses it as an anchor.
 */
function openModal(): void {
  document.body.innerHTML = MODAL_HTML + PLACEHOLDER_HTML;
  const [modalCard, placeholderCard] = document.body.querySelectorAll(CARD_ROOT_SELECTOR);
  if (modalCard === undefined || placeholderCard === undefined) {
    throw new Error('The fixtures hold no card');
  }
  modalCard.replaceWith(placeholderCard);
}

/** The content script finds the modal once and hands it to every feature. */
function requireModal(): DetailModal {
  const modal = findDetailModal(document.body);
  if (modal === null) {
    throw new Error('The fixture modal was not found');
  }
  return modal;
}

function requireTarget(): ModalCreditTarget {
  return findModalCreditTarget(requireModal());
}

/** The Letterboxd feature adds its link the same way the content script does. */
function addLetterboxdLink(): void {
  applyModalLink(findModalLinkTarget(requireModal()), FILM_URL);
}

/** The category feature adds its line the same way. */
function addCategoryLine(): void {
  applyModalCategoryLine(findModalCategoryTarget(requireModal()), PLACE);
}

function ourLine(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(IMAGE_CREDIT_SELECTOR);
}

function ourLink(): HTMLAnchorElement | null {
  return ourLine()?.querySelector<HTMLAnchorElement>('a') ?? null;
}

function wikipediaLink(): Element | null {
  return document.body.querySelector(WIKIPEDIA_LINK_SELECTOR);
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

describe('findModalCreditTarget', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should aim under the Wikipedia link when the extension added nothing yet', () => {
    openModal();

    expect(requireTarget().anchor).toBe(wikipediaLink());
  });

  it('should aim under the Letterboxd link when that link is the last one there', () => {
    openModal();
    addLetterboxdLink();

    expect(requireTarget().anchor).toBe(document.body.querySelector(LETTERBOXD_LINK_SELECTOR));
  });

  it('should aim under the category line when there is one', () => {
    openModal();
    addLetterboxdLink();
    addCategoryLine();

    expect(requireTarget().anchor).toBe(document.body.querySelector(CATEGORY_LINE_SELECTOR));
  });

  it('should return the line of a previous sync when there is one', () => {
    openModal();
    applyModalCreditLine(requireTarget(), FILE_NAME);

    expect(requireTarget().ourLine).toBe(ourLine());
  });

  it('should return no title when the card of the modal cannot be read', () => {
    openModal();
    const heading = document.body.querySelector(`${CARD_ROOT_SELECTOR} h3`);
    if (heading === null) {
      throw new Error('The fixture card has no title');
    }
    heading.textContent = '';

    expect(requireTarget().title).toBeNull();
  });
});

describe('applyModalCreditLine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should insert one line right after the Wikipedia link when nothing else is there', () => {
    openModal();

    applyModalCreditLine(requireTarget(), FILE_NAME);

    expect(wikipediaLink()?.nextElementSibling).toBe(ourLine());
    expect(document.body.querySelectorAll(IMAGE_CREDIT_SELECTOR)).toHaveLength(1);
  });

  it('should credit Commons with one link to the page of the file', () => {
    openModal();

    applyModalCreditLine(requireTarget(), FILE_NAME);

    expect(ourLine()?.textContent).toBe(CREDIT_TEXT);
    expect(ourLine()?.querySelectorAll('a')).toHaveLength(1);
    expect(ourLink()?.getAttribute('href')).toBe(FILE_PAGE_URL);
    expect(ourLink()?.getAttribute('target')).toBe('_blank');
    expect(ourLink()?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should sit under the category line when the three features arrived in order', () => {
    openModal();
    addLetterboxdLink();
    addCategoryLine();

    applyModalCreditLine(requireTarget(), FILE_NAME);

    expect(document.body.querySelector(CATEGORY_LINE_SELECTOR)?.nextElementSibling).toBe(
      ourLine(),
    );
  });

  it('should sit under the Letterboxd link when the category line never comes', () => {
    openModal();
    addLetterboxdLink();

    applyModalCreditLine(requireTarget(), FILE_NAME);

    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)?.nextElementSibling).toBe(
      ourLine(),
    );
  });

  it('should end up under the category line when the credit arrived first', () => {
    openModal();
    applyModalCreditLine(requireTarget(), FILE_NAME);

    addCategoryLine();
    addLetterboxdLink();

    // Each feature anchors on the last node that must come before it, so the
    // three always end up in the same order whatever the order they arrive in.
    expect(document.body.querySelector(CATEGORY_LINE_SELECTOR)?.nextElementSibling).toBe(
      ourLine(),
    );
    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)?.nextElementSibling).toBe(
      document.body.querySelector(CATEGORY_LINE_SELECTOR),
    );
  });

  it('should write nothing on a second call with the same file', () => {
    openModal();
    applyModalCreditLine(requireTarget(), FILE_NAME);
    const observer = observeBody();

    applyModalCreditLine(requireTarget(), FILE_NAME);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing when the card has no image and no line was added', () => {
    openModal();
    const observer = observeBody();

    applyModalCreditLine(requireTarget(), null);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should update the line in place when the modal shows another file', () => {
    openModal();
    applyModalCreditLine(requireTarget(), FILE_NAME);
    const first = ourLine();

    applyModalCreditLine(requireTarget(), OTHER_FILE_NAME);

    expect(ourLine()).toBe(first);
    expect(ourLink()?.getAttribute('href')).toBe(
      'https://commons.wikimedia.org/wiki/File:Logo%20-%20R%C3%A9publique%20fran%C3%A7aise.svg',
    );
    expect(document.body.querySelectorAll(IMAGE_CREDIT_SELECTOR)).toHaveLength(1);
  });

  it('should remove our line when the card has no image any more', () => {
    openModal();
    applyModalCreditLine(requireTarget(), FILE_NAME);

    applyModalCreditLine(requireTarget(), null);

    expect(ourLine()).toBeNull();
  });

  it('should show no line for a file name it could not turn into an address', () => {
    openModal();

    applyModalCreditLine(requireTarget(), 'Adan Canto.exe');

    expect(ourLine()).toBeNull();
  });

  it('should rebuild a line whose parts were lost', () => {
    openModal();
    applyModalCreditLine(requireTarget(), FILE_NAME);
    ourLink()?.remove();

    applyModalCreditLine(requireTarget(), FILE_NAME);

    expect(ourLine()?.textContent).toBe(CREDIT_TEXT);
    expect(document.body.querySelectorAll(IMAGE_CREDIT_SELECTOR)).toHaveLength(1);
  });

  it('should leave every node of the site untouched', () => {
    openModal();
    const siteHtml = document.body.innerHTML;

    applyModalCreditLine(requireTarget(), FILE_NAME);
    applyModalCreditLine(requireTarget(), OTHER_FILE_NAME);
    ourLine()?.remove();

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});

describe('removeModalCreditLines', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should take back the line and leave the site as it was', () => {
    openModal();
    const siteHtml = document.body.innerHTML;
    applyModalCreditLine(requireTarget(), FILE_NAME);

    removeModalCreditLines(document.body);

    expect(ourLine()).toBeNull();
    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should do nothing when no line was added', () => {
    openModal();
    const observer = observeBody();

    removeModalCreditLines(document.body);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
