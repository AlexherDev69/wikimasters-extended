import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from '../../card-detection/data/scan-cards';
import type { CardCategory } from '../../categorization/domain/category';
import { CARD_IMAGE_SELECTOR, IMAGE_FILE_ATTRIBUTE } from '../data/image-selectors';
import type { CardImage } from '../domain/card-image';
import { syncCardImages } from './sync-card-images';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const PLACEHOLDER_HTML = readFileSync(join(FIXTURES_DIR, 'placeholder-cards.html'), 'utf-8');

const FIRST_TITLE = 'Adan Canto';
const SECOND_TITLE = 'Affaire Romand';
const REAL_PICTURE_TITLE = 'Airbus A400M Atlas';
const OTHER_TITLE = 'Pulp Fiction';

const RESOLVED_URL =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Adan_Canto.jpg/500px-Adan_Canto.jpg';

const PORTRAIT: CardImage = {
  fileName: 'Adan Canto 2015.jpg',
  kind: 'picture',
  thumbnailUrl: RESOLVED_URL,
};
const EMBLEM: CardImage = {
  fileName: 'Logo - République française.svg',
  kind: 'emblem',
  thumbnailUrl: null,
};

function makeCategory(title: string, overrides: Partial<CardCategory> = {}): CardCategory {
  return {
    title,
    status: 'categorized',
    qid: 'Q1',
    categoryId: 'person',
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

/** What the content script does on every scan and on every batch of results. */
function sync(categoriesByTitle: ReadonlyMap<string, CardCategory>): void {
  syncCardImages(scanCards(document.body), categoriesByTitle);
}

function containers(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>(CARD_IMAGE_SELECTOR)];
}

function shownFiles(): (string | null)[] {
  return containers().map((container) => container.getAttribute(IMAGE_FILE_ATTRIBUTE));
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

describe('syncCardImages', () => {
  beforeEach(() => {
    document.body.innerHTML = PLACEHOLDER_HTML;
  });

  it('should show the image of every card of the page that has one', () => {
    sync(
      makeCategories(
        makeCategory(FIRST_TITLE, { image: PORTRAIT }),
        makeCategory(SECOND_TITLE, { image: EMBLEM }),
      ),
    );

    expect(shownFiles()).toEqual([PORTRAIT.fileName, EMBLEM.fileName]);
  });

  it('should ask for the resolved address when there is one and build it otherwise', () => {
    sync(
      makeCategories(
        makeCategory(FIRST_TITLE, { image: PORTRAIT }),
        makeCategory(SECOND_TITLE, { image: EMBLEM }),
      ),
    );

    const sources = containers().map(
      (container) => container.querySelector('img')?.getAttribute('src'),
    );
    expect(sources).toEqual([
      RESOLVED_URL,
      'https://commons.wikimedia.org/wiki/Special:FilePath/Logo%20-%20R%C3%A9publique%20fran%C3%A7aise.svg?width=500',
    ]);
  });

  it('should show nothing on a card the site shows a real picture for', () => {
    sync(makeCategories(makeCategory(REAL_PICTURE_TITLE, { image: PORTRAIT })));

    expect(containers()).toHaveLength(0);
  });

  it('should write nothing on a second sync', () => {
    const categories = makeCategories(makeCategory(FIRST_TITLE, { image: PORTRAIT }));
    sync(categories);
    const observer = observeBody();

    sync(categories);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should add nothing while the facts of the card are still unknown', () => {
    const observer = observeBody();

    sync(makeCategories(makeCategory(OTHER_TITLE, { image: PORTRAIT })));

    expect(containers()).toHaveLength(0);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should add the image on the sync that follows the arrival of the results', () => {
    sync(new Map());

    sync(makeCategories(makeCategory(FIRST_TITLE, { image: PORTRAIT })));

    expect(shownFiles()).toEqual([PORTRAIT.fileName]);
  });

  it('should show the image of the card a reused node shows now', () => {
    const categories = makeCategories(
      makeCategory(FIRST_TITLE, { image: PORTRAIT }),
      makeCategory(OTHER_TITLE, { image: EMBLEM }),
    );
    sync(categories);

    showOtherCard(OTHER_TITLE);
    sync(categories);

    expect(shownFiles()).toEqual([EMBLEM.fileName]);
  });

  it('should remove the image of a reused node whose new card has none', () => {
    const categories = makeCategories(makeCategory(FIRST_TITLE, { image: PORTRAIT }));
    sync(categories);

    showOtherCard(OTHER_TITLE);
    sync(categories);

    expect(containers()).toHaveLength(0);
  });

  it('should show no image for a card that was not found', () => {
    sync(
      makeCategories(
        makeCategory(FIRST_TITLE, { status: 'not_found', categoryId: null, image: null }),
      ),
    );

    expect(containers()).toHaveLength(0);
  });

  it('should leave the cards of the page readable exactly as before', () => {
    const before = scanCards(document.body).map((observed) => observed.card);

    sync(
      makeCategories(
        makeCategory(FIRST_TITLE, { image: PORTRAIT }),
        makeCategory(SECOND_TITLE, { image: EMBLEM }),
      ),
    );

    expect(scanCards(document.body).map((observed) => observed.card)).toEqual(before);
  });
});
