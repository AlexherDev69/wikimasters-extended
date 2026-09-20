import { describe, it, expect } from 'vitest';
import { CATEGORY_ACCENT_COLORS } from '../../category-badge/domain/category-display';
import type { CategoryCount } from './category-counts';
import { listCategories } from './list-categories';

const PERSON: CategoryCount = {
  categoryId: 'person',
  label: 'Personne',
  accentColor: CATEGORY_ACCENT_COLORS.person,
  count: 3,
};

const PLACE: CategoryCount = {
  categoryId: 'place',
  label: 'Lieu',
  accentColor: CATEGORY_ACCENT_COLORS.place,
  count: 1,
};

describe('listCategories', () => {
  it('should list the categories of the page when no filter is active', () => {
    expect(listCategories([PERSON, PLACE], null)).toEqual([PERSON, PLACE]);
  });

  it('should change nothing when the active filter is one of them', () => {
    expect(listCategories([PERSON, PLACE], 'place')).toEqual([PERSON, PLACE]);
  });

  it('should add the active filter with a count of zero when the page lost it', () => {
    const lines = listCategories([PERSON], 'astronomy');

    expect(lines).toEqual([
      PERSON,
      {
        categoryId: 'astronomy',
        label: 'Astronomie',
        accentColor: CATEGORY_ACCENT_COLORS.astronomy,
        count: 0,
      },
    ]);
  });

  it('should put the line of the lost filter last', () => {
    const lines = listCategories([PERSON, PLACE], 'music');

    expect(lines.map((entry) => entry.categoryId)).toEqual(['person', 'place', 'music']);
  });

  it('should list the active filter alone when the page has no categorized card', () => {
    expect(listCategories([], 'sport')).toEqual([
      {
        categoryId: 'sport',
        label: 'Sport',
        accentColor: CATEGORY_ACCENT_COLORS.sport,
        count: 0,
      },
    ]);
  });

  it('should list nothing when the page has no category and no filter', () => {
    expect(listCategories([], null)).toEqual([]);
  });

  it('should leave the given counts untouched', () => {
    const counts = [PERSON];

    listCategories(counts, 'astronomy');

    expect(counts).toEqual([PERSON]);
  });
});
