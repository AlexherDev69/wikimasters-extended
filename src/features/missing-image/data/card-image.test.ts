import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from '../../card-detection/data/scan-cards';
import type { CardImage } from '../domain/card-image';
import { applyCardImage, removeCardImages } from './card-image';
import { findPictureArea } from './find-placeholder';
import {
  CARD_IMAGE_SELECTOR,
  IMAGE_FILE_ATTRIBUTE,
  IMAGE_KIND_ATTRIBUTE,
  IMAGE_LOADED_ATTRIBUTE,
} from './image-selectors';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const PLACEHOLDER_HTML = readFileSync(join(FIXTURES_DIR, 'placeholder-cards.html'), 'utf-8');

const PLACEHOLDER_TITLE = 'Adan Canto';
const REAL_PICTURE_TITLE = 'Airbus A400M Atlas';

const PORTRAIT: CardImage = { fileName: 'Adan Canto 2015.jpg', kind: 'picture' };
const PORTRAIT_URL =
  'https://commons.wikimedia.org/wiki/Special:FilePath/Adan%20Canto%202015.jpg?width=500';

const EMBLEM: CardImage = { fileName: 'Logo - République française.svg', kind: 'emblem' };

function cardRootOf(title: string): HTMLElement {
  const observed = scanCards(document.body).find((card) => card.card.title === title);
  if (observed === undefined) {
    throw new Error(`The fixture holds no card named ${title}`);
  }
  return observed.element;
}

function container(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(CARD_IMAGE_SELECTOR);
}

function ourImage(): HTMLImageElement | null {
  return container()?.querySelector<HTMLImageElement>('img') ?? null;
}

/** The page as the site wrote it, whatever we added to it. */
function siteHtmlWithoutOurNodes(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  removeCardImages(clone);
  return clone.innerHTML;
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

describe('applyCardImage', () => {
  beforeEach(() => {
    document.body.innerHTML = PLACEHOLDER_HTML;
  });

  it('should add one container as the last child of the image area of the card', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);

    applyCardImage(cardRoot, PORTRAIT);

    expect(document.body.querySelectorAll(CARD_IMAGE_SELECTOR)).toHaveLength(1);
    expect(findPictureArea(cardRoot)?.lastElementChild).toBe(container());
  });

  it('should show the thumbnail of the file, without a crossorigin attribute', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);

    expect(ourImage()?.getAttribute('src')).toBe(PORTRAIT_URL);
    // The Commons address answers with redirects that carry no CORS header.
    expect(ourImage()?.hasAttribute('crossorigin')).toBe(false);
  });

  it('should ask the browser for a lazy, decorative image that sends no referrer', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);

    expect(ourImage()?.getAttribute('alt')).toBe('');
    expect(ourImage()?.getAttribute('loading')).toBe('lazy');
    expect(ourImage()?.getAttribute('decoding')).toBe('async');
    expect(ourImage()?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(ourImage()?.getAttribute('draggable')).toBe('false');
  });

  it('should hold the file and the kind it shows, which is what the next sync compares', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), EMBLEM);

    expect(container()?.getAttribute(IMAGE_FILE_ATTRIBUTE)).toBe(EMBLEM.fileName);
    expect(container()?.getAttribute(IMAGE_KIND_ATTRIBUTE)).toBe('emblem');
  });

  it('should build the container from a div and an img only, so the scanner ignores it', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);

    const tags = [...(container()?.querySelectorAll('*') ?? [])].map((node) => node.tagName);
    expect(container()?.tagName).toBe('DIV');
    expect(new Set(tags)).toEqual(new Set(['IMG']));
  });

  it('should carry no class that the card detection could take for a card', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);

    const classNames = [container(), ...(container()?.querySelectorAll('*') ?? [])].map(
      (node) => node?.className ?? '',
    );
    expect(classNames.every((name) => !name.includes('glow-'))).toBe(true);
  });

  it('should become visible only once our own image has loaded', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);
    expect(container()?.hasAttribute(IMAGE_LOADED_ATTRIBUTE)).toBe(false);

    ourImage()?.dispatchEvent(new Event('load'));

    expect(container()?.hasAttribute(IMAGE_LOADED_ATTRIBUTE)).toBe(true);
  });

  it('should stay invisible when our own image fails to load', () => {
    // This one pins a deliberate ABSENCE: there is no `error` listener, and
    // nothing but the `load` listener ever marks the container as loaded. A
    // file that never arrives therefore leaves the placeholder of the site in
    // view on its own, and there is no error path to undo anything.
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);

    ourImage()?.dispatchEvent(new Event('error'));

    expect(container()?.hasAttribute(IMAGE_LOADED_ATTRIBUTE)).toBe(false);
    expect(container()).not.toBeNull();
  });

  it('should write nothing on a second call with the same image', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    applyCardImage(cardRoot, PORTRAIT);
    ourImage()?.dispatchEvent(new Event('load'));
    const observer = observeBody();

    applyCardImage(cardRoot, PORTRAIT);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing when the card has no image and carries no container', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    const observer = observeBody();

    applyCardImage(cardRoot, null);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should build a fresh container when the card shows another file', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    applyCardImage(cardRoot, PORTRAIT);
    ourImage()?.dispatchEvent(new Event('load'));

    applyCardImage(cardRoot, EMBLEM);

    expect(document.body.querySelectorAll(CARD_IMAGE_SELECTOR)).toHaveLength(1);
    expect(container()?.getAttribute(IMAGE_FILE_ATTRIBUTE)).toBe(EMBLEM.fileName);
    // The new file has not loaded yet, so the container is invisible again.
    expect(container()?.hasAttribute(IMAGE_LOADED_ATTRIBUTE)).toBe(false);
  });

  it('should rebuild a container whose picture was lost', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    applyCardImage(cardRoot, PORTRAIT);
    ourImage()?.remove();

    applyCardImage(cardRoot, PORTRAIT);

    expect(document.body.querySelectorAll(CARD_IMAGE_SELECTOR)).toHaveLength(1);
    expect(ourImage()?.getAttribute('src')).toBe(PORTRAIT_URL);
    // And the sync that follows the rebuild is back to writing nothing.
    const observer = observeBody();
    applyCardImage(cardRoot, PORTRAIT);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should remove our container when the card has no image any more', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    applyCardImage(cardRoot, PORTRAIT);

    applyCardImage(cardRoot, null);

    expect(container()).toBeNull();
  });

  it('should remove our container when the site swapped in a real picture', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    applyCardImage(cardRoot, PORTRAIT);
    // The site renders the card again, this time with its own picture: the
    // image area has no placeholder any more.
    cardRoot.querySelector('img[alt="WikiMasters"]')?.remove();

    applyCardImage(cardRoot, PORTRAIT);

    expect(container()).toBeNull();
  });

  it('should add nothing to a card the site shows a real picture for', () => {
    // The common case, three cards out of four: no placeholder, and no
    // container of ours was ever put in that card, so the pass writes nothing
    // and does not search the card either.
    const cardRoot = cardRootOf(REAL_PICTURE_TITLE);
    const observer = observeBody();

    applyCardImage(cardRoot, PORTRAIT);

    expect(observer.takeRecords()).toHaveLength(0);
    expect(container()).toBeNull();
    observer.disconnect();
  });

  it('should refuse a file name that could not be turned into an address', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);

    applyCardImage(cardRoot, { fileName: 'Adan Canto.exe', kind: 'picture' });

    expect(container()).toBeNull();
  });

  it('should leave the cards of the page readable exactly as before', () => {
    const before = scanCards(document.body).map((observed) => observed.card);

    for (const observed of scanCards(document.body)) {
      applyCardImage(observed.element, PORTRAIT);
    }

    expect(scanCards(document.body).map((observed) => observed.card)).toEqual(before);
  });

  it('should leave every node of the site untouched', () => {
    const siteHtml = document.body.innerHTML;
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);

    applyCardImage(cardRoot, PORTRAIT);
    applyCardImage(cardRoot, EMBLEM);

    expect(siteHtmlWithoutOurNodes()).toBe(siteHtml);
  });
});

describe('removeCardImages', () => {
  beforeEach(() => {
    document.body.innerHTML = PLACEHOLDER_HTML;
  });

  it('should take back every container and leave the site as it was', () => {
    const siteHtml = document.body.innerHTML;
    for (const observed of scanCards(document.body)) {
      applyCardImage(observed.element, PORTRAIT);
    }
    expect(document.body.querySelectorAll(CARD_IMAGE_SELECTOR).length).toBeGreaterThan(0);

    removeCardImages(document.body);

    expect(document.body.querySelectorAll(CARD_IMAGE_SELECTOR)).toHaveLength(0);
    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should do nothing when no container was added', () => {
    const observer = observeBody();

    removeCardImages(document.body);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
