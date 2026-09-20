import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from '../../card-detection/data/scan-cards';
import { findPictureArea } from './find-placeholder';
import {
  CARD_IMAGE_ATTRIBUTE,
  PLACEHOLDER_IMAGE_SELECTOR,
  PLACEHOLDER_SOURCE_MARKER,
} from './image-selectors';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/**
 * Real sanitized export of the catalogue: two cards the site shows its logo
 * for, and one card with a real picture.
 */
const PLACEHOLDER_HTML = readFileSync(join(FIXTURES_DIR, 'placeholder-cards.html'), 'utf-8');

const PLACEHOLDER_TITLES: readonly string[] = ['Adan Canto', 'Affaire Romand'];
const REAL_PICTURE_TITLE = 'Airbus A400M Atlas';

function cardRootOf(title: string): HTMLElement {
  const observed = scanCards(document.body).find((card) => card.card.title === title);
  if (observed === undefined) {
    throw new Error(`The fixture holds no card named ${title}`);
  }
  return observed.element;
}

/** A container of ours, as `applyCardImage` adds it to a card. */
function addOurContainer(cardRoot: HTMLElement): HTMLElement {
  const container = document.createElement('div');
  container.setAttribute(CARD_IMAGE_ATTRIBUTE, '');
  cardRoot.appendChild(container);
  return container;
}

describe('findPictureArea', () => {
  beforeEach(() => {
    document.body.innerHTML = PLACEHOLDER_HTML;
  });

  it.each(PLACEHOLDER_TITLES)(
    'should find the image area of the card %s, which shows the site logo',
    (title) => {
      const cardRoot = cardRootOf(title);

      const pictureArea = findPictureArea(cardRoot);

      expect(pictureArea).not.toBeNull();
      expect(pictureArea?.parentElement).toBe(cardRoot);
      expect(pictureArea?.querySelector(PLACEHOLDER_IMAGE_SELECTOR)).not.toBeNull();
    },
  );

  it('should find nothing on a card that shows a real picture', () => {
    expect(findPictureArea(cardRootOf(REAL_PICTURE_TITLE))).toBeNull();
  });

  it('should find nothing when the image is named after the site but is not its logo', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLES[0] ?? '');
    const placeholder = cardRoot.querySelector(PLACEHOLDER_IMAGE_SELECTOR);
    placeholder?.setAttribute('src', './global-collection_files/une-photo.png');
    placeholder?.setAttribute('srcset', '/_next/image?url=%2Fune-photo.png&w=32 32w');

    expect(findPictureArea(cardRoot)).toBeNull();
  });

  it('should read the marker in the srcset when the src does not hold it', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLES[0] ?? '');
    // What the live site serves: both attributes name the optimizer route.
    cardRoot
      .querySelector(PLACEHOLDER_IMAGE_SELECTOR)
      ?.setAttribute('src', '/_next/image?url=%2Fautre.png&w=32');

    expect(findPictureArea(cardRoot)?.querySelector(PLACEHOLDER_IMAGE_SELECTOR)).not.toBeNull();
  });

  it('should ignore a placeholder that sits inside one of our own containers', () => {
    const cardRoot = cardRootOf(REAL_PICTURE_TITLE);
    const ourImage = document.createElement('img');
    ourImage.alt = 'WikiMasters';
    ourImage.setAttribute('src', `./global-collection_files/${PLACEHOLDER_SOURCE_MARKER}`);
    addOurContainer(cardRoot).appendChild(ourImage);

    expect(findPictureArea(cardRoot)).toBeNull();
  });

  it('should leave every node of the site untouched', () => {
    const siteHtml = document.body.innerHTML;

    for (const observed of scanCards(document.body)) {
      findPictureArea(observed.element);
    }

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});
