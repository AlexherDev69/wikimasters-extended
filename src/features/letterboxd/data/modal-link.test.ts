import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDetailModal } from '../../card-detection/data/detail-modal';
import {
  applyModalLink,
  findModalLinkTarget,
  removeModalLink,
  type ModalLinkTarget,
} from './modal-link';
import { LETTERBOXD_LINK_SELECTOR } from './modal-selectors';

/** Another full-screen layer of the site, rendered before the detail modal. */
const DECOY_LAYER_HTML =
  '<div class="fixed inset-0 z-50 flex items-start justify-center p-4">' +
  '<div class="rounded-lg p-3">Enchère enregistrée</div></div>';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** Real sanitized export of the detail modal, card "Dvorichté". */
const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

const MODAL_CARD_TITLE = 'Dvorichté';
const FILM_URL = 'https://letterboxd.com/film/pulp-fiction/';
const OTHER_URL = 'https://letterboxd.com/film/lost-river/';
const LINK_TEXT = 'Voir sur Letterboxd →';

function openModal(): void {
  document.body.innerHTML = MODAL_HTML;
}

/** The site reuses the modal and renders the next card as a skeleton. */
function makeCardUnreadable(): void {
  const heading = document.body.querySelector('[class*="glow-"] h3');
  if (heading === null) {
    throw new Error('The fixture card has no title');
  }
  heading.textContent = '';
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

/** The content script finds the modal once and hands it to every feature. */
function requireTarget(): ModalLinkTarget {
  const modal = findDetailModal(document.body);
  if (modal === null) {
    throw new Error('The fixture modal was not found');
  }
  return findModalLinkTarget(modal);
}

function ourLink(): HTMLAnchorElement | null {
  return document.body.querySelector<HTMLAnchorElement>(LETTERBOXD_LINK_SELECTOR);
}

describe('findModalLinkTarget', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return the title of the card and the Wikipedia link when the modal is open', () => {
    openModal();

    const target = requireTarget();

    expect(target.title).toBe(MODAL_CARD_TITLE);
    expect(target.wikipediaLink.getAttribute('href')).toBe(
      'https://fr.wikipedia.org/wiki/Dvoricht%C3%A9',
    );
    expect(target.ourLink).toBeNull();
  });

  it('should return the link of a previous sync when there is one', () => {
    openModal();
    applyModalLink(requireTarget(), FILM_URL);

    expect(requireTarget().ourLink).toBe(ourLink());
  });

  it('should return no title when the card of the modal cannot be read', () => {
    openModal();
    makeCardUnreadable();

    expect(requireTarget().title).toBeNull();
  });
});

describe('applyModalLink', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should insert one link right after the Wikipedia link when there is a URL', () => {
    openModal();
    const target = requireTarget();

    applyModalLink(target, FILM_URL);

    const inserted = ourLink();
    expect(inserted).not.toBeNull();
    expect(target.wikipediaLink.nextElementSibling).toBe(inserted);
    expect(document.body.querySelectorAll(LETTERBOXD_LINK_SELECTOR)).toHaveLength(1);
  });

  it('should open the link in a new tab without opener and with the text of the feature', () => {
    openModal();

    applyModalLink(requireTarget(), FILM_URL);

    const inserted = ourLink();
    expect(inserted?.getAttribute('href')).toBe(FILM_URL);
    expect(inserted?.getAttribute('target')).toBe('_blank');
    expect(inserted?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(inserted?.textContent).toBe(LINK_TEXT);
  });

  it('should copy the class of the Wikipedia link and put ours on its own line', () => {
    openModal();
    const target = requireTarget();

    applyModalLink(target, FILM_URL);

    expect(ourLink()?.className).toBe(target.wikipediaLink.className);
    expect(ourLink()?.style.display).toBe('flex');
  });

  it('should update the href when the modal shows another card', () => {
    openModal();
    applyModalLink(requireTarget(), FILM_URL);

    applyModalLink(requireTarget(), OTHER_URL);

    expect(ourLink()?.getAttribute('href')).toBe(OTHER_URL);
    expect(document.body.querySelectorAll(LETTERBOXD_LINK_SELECTOR)).toHaveLength(1);
  });

  it('should remove our link when the card has no URL', () => {
    openModal();
    applyModalLink(requireTarget(), FILM_URL);

    applyModalLink(requireTarget(), null);

    expect(ourLink()).toBeNull();
  });

  it('should write nothing when the card has no URL and no link was added', () => {
    openModal();
    const target = requireTarget();
    const observer = observeBody();

    applyModalLink(target, null);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing when the link already carries the right URL', () => {
    openModal();
    applyModalLink(requireTarget(), FILM_URL);
    const observer = observeBody();

    applyModalLink(requireTarget(), FILM_URL);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should restore the target and the rel of our link when they were changed', () => {
    openModal();
    applyModalLink(requireTarget(), FILM_URL);
    const inserted = ourLink();
    inserted?.setAttribute('target', '_self');
    inserted?.removeAttribute('rel');

    applyModalLink(requireTarget(), FILM_URL);

    expect(ourLink()?.getAttribute('target')).toBe('_blank');
    expect(ourLink()?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should ignore a URL that is not on the Letterboxd origin', () => {
    openModal();

    applyModalLink(requireTarget(), 'https://evil.example.com/film/x/');

    expect(ourLink()).toBeNull();
  });

  it('should remove our link rather than point it to another origin', () => {
    openModal();
    applyModalLink(requireTarget(), FILM_URL);

    applyModalLink(requireTarget(), 'https://letterboxd.com.evil.example.com/film/x/');

    expect(ourLink()).toBeNull();
  });

  it('should insert one link in the detail modal when another layer is open', () => {
    document.body.innerHTML = DECOY_LAYER_HTML + MODAL_HTML;
    const target = requireTarget();

    applyModalLink(target, FILM_URL);

    expect(target.wikipediaLink.nextElementSibling).toBe(ourLink());
    expect(document.body.querySelectorAll(LETTERBOXD_LINK_SELECTOR)).toHaveLength(1);
  });

  it('should leave every node of the site untouched', () => {
    openModal();
    const siteHtml = document.body.innerHTML;

    applyModalLink(requireTarget(), FILM_URL);
    applyModalLink(requireTarget(), OTHER_URL);
    ourLink()?.remove();

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});

describe('removeModalLink', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should take back the link and leave the site as it was', () => {
    openModal();
    const siteHtml = document.body.innerHTML;
    applyModalLink(requireTarget(), FILM_URL);

    removeModalLink(document.body);

    expect(ourLink()).toBeNull();
    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should do nothing when no link was added', () => {
    openModal();
    const observer = observeBody();

    removeModalLink(document.body);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
