import { describe, it, expect } from 'vitest';
import type { CardCategory } from '../domain/category';
import {
  MAX_REMEMBERED_CATEGORIES,
  rememberCategories,
  type CategoryMemory,
} from './remember-categories';

function makeCategory(title: string, letterboxdUrl: string | null = null): CardCategory {
  return {
    title,
    status: 'categorized',
    qid: 'Q1',
    categoryId: 'film_tv',
    primarySubtype: null,
    personSubtypes: [],
    letterboxdUrl,
  };
}

function makeMemory(...titles: string[]): CategoryMemory {
  return {
    categoriesByTitle: new Map(titles.map((title) => [title, makeCategory(title)])),
    seenTitles: new Set(titles),
  };
}

const NOTHING_VISIBLE: ReadonlySet<string> = new Set<string>();

describe('rememberCategories', () => {
  it('should keep every result of a batch', () => {
    const memory = makeMemory();

    rememberCategories(memory, NOTHING_VISIBLE, [makeCategory('Alpha'), makeCategory('Beta')]);

    expect([...memory.categoriesByTitle.keys()]).toEqual(['Alpha', 'Beta']);
  });

  it('should replace the previous result of a title', () => {
    const memory = makeMemory();
    rememberCategories(memory, NOTHING_VISIBLE, [makeCategory('Alpha', null)]);

    rememberCategories(memory, NOTHING_VISIBLE, [
      makeCategory('Alpha', 'https://letterboxd.com/film/x/'),
    ]);

    expect(memory.categoriesByTitle.size).toBe(1);
    expect(memory.categoriesByTitle.get('Alpha')?.letterboxdUrl).toBe(
      'https://letterboxd.com/film/x/',
    );
  });

  it('should drop the oldest entries when the memory exceeds the maximum', () => {
    const memory = makeMemory();

    rememberCategories(
      memory,
      NOTHING_VISIBLE,
      [makeCategory('Alpha'), makeCategory('Beta')],
      2,
    );
    rememberCategories(memory, NOTHING_VISIBLE, [makeCategory('Gamma')], 2);

    expect([...memory.categoriesByTitle.keys()]).toEqual(['Beta', 'Gamma']);
  });

  it('should release a dropped title so its card can be asked again', () => {
    const memory = makeMemory('Alpha', 'Beta');

    rememberCategories(memory, NOTHING_VISIBLE, [makeCategory('Gamma')], 2);

    // The scan handler owns the adding, this function owns only the dropping.
    expect(memory.seenTitles.has('Alpha')).toBe(false);
    expect([...memory.seenTitles]).toEqual(['Beta']);
  });

  it('should never drop a title of the current scan, even the oldest one', () => {
    const memory = makeMemory('Alpha', 'Beta');

    rememberCategories(memory, new Set(['Alpha']), [makeCategory('Gamma')], 2);

    expect([...memory.categoriesByTitle.keys()]).toEqual(['Alpha', 'Gamma']);
    expect(memory.seenTitles.has('Alpha')).toBe(true);
    expect(memory.seenTitles.has('Beta')).toBe(false);
  });

  it('should stay above the maximum while the page shows more cards than it', () => {
    const memory = makeMemory('Alpha', 'Beta', 'Gamma');
    const visible = new Set(['Alpha', 'Beta', 'Gamma']);

    rememberCategories(memory, visible, [], 2);

    expect([...memory.categoriesByTitle.keys()]).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect([...memory.seenTitles]).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('should come back under the maximum as soon as the cards left the page', () => {
    const memory = makeMemory('Alpha', 'Beta', 'Gamma');
    rememberCategories(memory, new Set(['Alpha', 'Beta', 'Gamma']), [], 2);

    // A later scan with no new result at all: the page now shows one card.
    rememberCategories(memory, new Set(['Gamma']), [], 2);

    expect([...memory.categoriesByTitle.keys()]).toEqual(['Beta', 'Gamma']);
    expect(memory.seenTitles.has('Alpha')).toBe(false);
  });

  it('should keep a title that was categorized again as one of the newest', () => {
    const memory = makeMemory();

    rememberCategories(memory, NOTHING_VISIBLE, [makeCategory('Alpha'), makeCategory('Beta')], 2);
    rememberCategories(memory, NOTHING_VISIBLE, [makeCategory('Alpha')], 2);
    rememberCategories(memory, NOTHING_VISIBLE, [makeCategory('Gamma')], 2);

    expect([...memory.categoriesByTitle.keys()]).toEqual(['Alpha', 'Gamma']);
  });

  it('should keep the memory at the maximum when a batch is larger than it', () => {
    const memory = makeMemory();
    const batch = Array.from({ length: MAX_REMEMBERED_CATEGORIES + 10 }, (_unused, index) =>
      makeCategory(`Card ${String(index)}`),
    );

    rememberCategories(memory, NOTHING_VISIBLE, batch);

    expect(memory.categoriesByTitle.size).toBe(MAX_REMEMBERED_CATEGORIES);
    expect(memory.categoriesByTitle.has('Card 0')).toBe(false);
    expect(memory.categoriesByTitle.has(`Card ${String(MAX_REMEMBERED_CATEGORIES + 9)}`)).toBe(
      true,
    );
  });

  it('should change nothing when there is no result and the memory fits', () => {
    const memory = makeMemory('Alpha');

    rememberCategories(memory, NOTHING_VISIBLE);

    expect([...memory.categoriesByTitle.keys()]).toEqual(['Alpha']);
    expect([...memory.seenTitles]).toEqual(['Alpha']);
  });
});
