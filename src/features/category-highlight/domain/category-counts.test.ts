import { describe, it, expect } from 'vitest';
import type { CardCategory, CategoryId } from '../../categorization/domain/category';
import { CATEGORY_ACCENT_COLORS } from '../../category-badge/domain/category-display';
import { countCategories } from './category-counts';

function makeCategory(title: string, overrides: Partial<CardCategory> = {}): CardCategory {
  return {
    title,
    status: 'categorized',
    qid: 'Q1',
    categoryId: 'place',
    primarySubtype: null,
    personSubtypes: [],
    letterboxdUrl: null,
    ...overrides,
  };
}

function makeCategories(...results: CardCategory[]): Map<string, CardCategory> {
  return new Map(results.map((result) => [result.title, result]));
}

const NOTHING_KNOWN: ReadonlyMap<string, CardCategory> = new Map();

describe('countCategories', () => {
  it('should count the cards of each category on the page', () => {
    const counts = countCategories(
      ['Alpha', 'Beta', 'Gamma'],
      makeCategories(
        makeCategory('Alpha', { categoryId: 'person' }),
        makeCategory('Beta', { categoryId: 'person' }),
        makeCategory('Gamma', { categoryId: 'place' }),
      ),
    );

    expect(counts).toEqual([
      {
        categoryId: 'person',
        label: 'Personne',
        accentColor: CATEGORY_ACCENT_COLORS.person,
        count: 2,
      },
      { categoryId: 'place', label: 'Lieu', accentColor: CATEGORY_ACCENT_COLORS.place, count: 1 },
    ]);
  });

  it('should count a title once when the page renders the same card twice', () => {
    // The grid behind the detail modal renders the card the modal shows.
    const counts = countCategories(
      ['Alpha', 'Alpha'],
      makeCategories(makeCategory('Alpha', { categoryId: 'person' })),
    );

    expect(counts).toEqual([
      {
        categoryId: 'person',
        label: 'Personne',
        accentColor: CATEGORY_ACCENT_COLORS.person,
        count: 1,
      },
    ]);
  });

  it('should sort by count and then by label', () => {
    const counts = countCategories(
      ['Alpha', 'Beta', 'Gamma', 'Delta'],
      makeCategories(
        makeCategory('Alpha', { categoryId: 'sport' }),
        makeCategory('Beta', { categoryId: 'astronomy' }),
        makeCategory('Gamma', { categoryId: 'music' }),
        makeCategory('Delta', { categoryId: 'music' }),
      ),
    );

    expect(counts.map((entry) => entry.label)).toEqual(['Musique', 'Astronomie', 'Sport']);
  });

  it('should sort two categories of the same count as a French reader expects', () => {
    const counts = countCategories(
      ['Alpha', 'Beta'],
      makeCategories(
        makeCategory('Alpha', { categoryId: 'event' }),
        makeCategory('Beta', { categoryId: 'science_concept' }),
      ),
    );

    // "Évènement" sorts before "Science" although its first letter is accented.
    expect(counts.map((entry) => entry.label)).toEqual(['Évènement', 'Science']);
  });

  it('should count a person under the category and not under the subtype', () => {
    const counts = countCategories(
      ['Alpha', 'Beta'],
      makeCategories(
        makeCategory('Alpha', {
          categoryId: 'person',
          primarySubtype: 'cinema',
          personSubtypes: ['cinema'],
        }),
        makeCategory('Beta', {
          categoryId: 'person',
          primarySubtype: 'sport',
          personSubtypes: ['sport'],
        }),
      ),
    );

    expect(counts).toEqual([
      {
        categoryId: 'person',
        label: 'Personne',
        accentColor: CATEGORY_ACCENT_COLORS.person,
        count: 2,
      },
    ]);
  });

  it('should count no card whose category is still unknown', () => {
    expect(countCategories(['Alpha', 'Beta'], NOTHING_KNOWN)).toEqual([]);
  });

  it.each(['not_found', 'error'] as const)(
    'should count no card whose status is %s',
    (status) => {
      const counts = countCategories(
        ['Alpha'],
        makeCategories(makeCategory('Alpha', { status, categoryId: null })),
      );

      expect(counts).toEqual([]);
    },
  );

  it('should count nothing when the page shows no card', () => {
    expect(countCategories([], makeCategories(makeCategory('Alpha')))).toEqual([]);
  });

  it('should give the accent colour of every category it lists', () => {
    const titles = ['Alpha', 'Beta'];
    const counts = countCategories(
      titles,
      makeCategories(
        makeCategory('Alpha', { categoryId: 'food_drink' }),
        makeCategory('Beta', { categoryId: 'organization' }),
      ),
    );

    for (const entry of counts) {
      expect(entry.accentColor).toBe(CATEGORY_ACCENT_COLORS[entry.categoryId satisfies CategoryId]);
    }
  });
});
