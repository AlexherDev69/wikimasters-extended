import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WIKIPEDIA_LINK_SELECTOR } from '../../card-detection/data/card-selectors';
import { findDetailModal, type DetailModal } from '../../card-detection/data/detail-modal';
import { applyModalLink, findModalLinkTarget } from '../../letterboxd/data/modal-link';
import { LETTERBOXD_LINK_SELECTOR } from '../../letterboxd/data/modal-selectors';
import type { ModalCategoryDescriptor } from '../domain/describe-modal-category';
import { CATEGORY_ATTRIBUTE, CATEGORY_LINE_SELECTOR } from './badge-selectors';
import {
  applyModalCategoryLine,
  findModalCategoryTarget,
  removeModalCategoryLines,
  type ModalCategoryTarget,
} from './modal-category-line';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** Real sanitized export of the detail modal, card "Dvorichté". */
const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

const MODAL_CARD_TITLE = 'Dvorichté';
const FILM_URL = 'https://letterboxd.com/film/pulp-fiction/';

const PLACE: ModalCategoryDescriptor = {
  categoryId: 'place',
  accentColor: '#6ce0ac',
  text: 'Catégorie : Lieu',
};

const PERSON: ModalCategoryDescriptor = {
  categoryId: 'person',
  accentColor: '#6c90e0',
  text: 'Catégorie : Personne · Cinéma (aussi : Musique)',
};

function openModal(): void {
  document.body.innerHTML = MODAL_HTML;
}

/** The content script finds the modal once and hands it to every feature. */
function requireModal(): DetailModal {
  const modal = findDetailModal(document.body);
  if (modal === null) {
    throw new Error('The fixture modal was not found');
  }
  return modal;
}

/** The Letterboxd feature adds its link the same way the content script does. */
function addLetterboxdLink(): void {
  applyModalLink(findModalLinkTarget(requireModal()), FILM_URL);
}

function requireTarget(): ModalCategoryTarget {
  return findModalCategoryTarget(requireModal());
}

function ourLine(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(CATEGORY_LINE_SELECTOR);
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

describe('findModalCategoryTarget', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should aim under the Wikipedia link when the modal carries no Letterboxd link', () => {
    openModal();

    expect(requireTarget().anchor).toBe(wikipediaLink());
    expect(requireTarget().title).toBe(MODAL_CARD_TITLE);
  });

  it('should aim under the Letterboxd link when the extension already added one', () => {
    openModal();
    addLetterboxdLink();

    expect(requireTarget().anchor).toBe(document.body.querySelector(LETTERBOXD_LINK_SELECTOR));
  });

  it('should return the line of a previous sync when there is one', () => {
    openModal();
    applyModalCategoryLine(requireTarget(), PLACE);

    expect(requireTarget().ourLine).toBe(ourLine());
  });

  it('should return no title when the card of the modal cannot be read', () => {
    openModal();
    const heading = document.body.querySelector('[class*="glow-"] h3');
    if (heading === null) {
      throw new Error('The fixture card has no title');
    }
    heading.textContent = '';

    expect(requireTarget().title).toBeNull();
  });
});

describe('applyModalCategoryLine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should insert one line right after the Wikipedia link when there is a category', () => {
    openModal();

    applyModalCategoryLine(requireTarget(), PLACE);

    expect(wikipediaLink()?.nextElementSibling).toBe(ourLine());
    expect(document.body.querySelectorAll(CATEGORY_LINE_SELECTOR)).toHaveLength(1);
  });

  it('should read as the category of the card', () => {
    openModal();

    applyModalCategoryLine(requireTarget(), PERSON);

    expect(ourLine()?.textContent).toBe('Catégorie : Personne · Cinéma (aussi : Musique)');
    expect(ourLine()?.getAttribute(CATEGORY_ATTRIBUTE)).toBe('person');
  });

  it('should colour the dot with the accent of the category', () => {
    openModal();

    applyModalCategoryLine(requireTarget(), PLACE);

    expect(ourLine()?.querySelector<HTMLElement>('.wme-line-dot')?.style.backgroundColor).not.toBe(
      '',
    );
  });

  it('should sit under the Letterboxd link when that link came first', () => {
    openModal();
    addLetterboxdLink();

    applyModalCategoryLine(requireTarget(), PLACE);

    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)?.nextElementSibling).toBe(
      ourLine(),
    );
  });

  it('should end up under the Letterboxd link when that link came second', () => {
    openModal();
    applyModalCategoryLine(requireTarget(), PLACE);

    addLetterboxdLink();

    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)?.nextElementSibling).toBe(
      ourLine(),
    );
  });

  it('should write nothing on a second call with the same category', () => {
    openModal();
    applyModalCategoryLine(requireTarget(), PLACE);
    const observer = observeBody();

    applyModalCategoryLine(requireTarget(), PLACE);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing when the card has no category and no line was added', () => {
    openModal();
    const observer = observeBody();

    applyModalCategoryLine(requireTarget(), null);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should update the line in place when the modal shows another card', () => {
    openModal();
    applyModalCategoryLine(requireTarget(), PLACE);
    const first = ourLine();

    applyModalCategoryLine(requireTarget(), PERSON);

    expect(ourLine()).toBe(first);
    expect(ourLine()?.textContent).toBe('Catégorie : Personne · Cinéma (aussi : Musique)');
    expect(document.body.querySelectorAll(CATEGORY_LINE_SELECTOR)).toHaveLength(1);
  });

  it('should remove our line when the card has no category any more', () => {
    openModal();
    applyModalCategoryLine(requireTarget(), PLACE);

    applyModalCategoryLine(requireTarget(), null);

    expect(ourLine()).toBeNull();
  });

  it('should rebuild a line whose parts were lost', () => {
    openModal();
    applyModalCategoryLine(requireTarget(), PLACE);
    ourLine()?.querySelector('.wme-line-text')?.remove();

    applyModalCategoryLine(requireTarget(), PLACE);

    expect(ourLine()?.textContent).toBe('Catégorie : Lieu');
    expect(document.body.querySelectorAll(CATEGORY_LINE_SELECTOR)).toHaveLength(1);
  });

  it('should leave every node of the site untouched', () => {
    openModal();
    const siteHtml = document.body.innerHTML;

    applyModalCategoryLine(requireTarget(), PLACE);
    applyModalCategoryLine(requireTarget(), PERSON);
    ourLine()?.remove();

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});

describe('removeModalCategoryLines', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should take back the line and leave the site as it was', () => {
    openModal();
    const siteHtml = document.body.innerHTML;
    applyModalCategoryLine(requireTarget(), PLACE);

    removeModalCategoryLines(document.body);

    expect(ourLine()).toBeNull();
    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should do nothing when no line was added', () => {
    openModal();
    const observer = observeBody();

    removeModalCategoryLines(document.body);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
