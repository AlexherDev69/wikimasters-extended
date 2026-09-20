import { describe, it, expect } from 'vitest';
import type { CardCategory } from '../../categorization/domain/category';
import { selectDimmedTitles } from './dimmed-titles';

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

const CATEGORIES = makeCategories(
  makeCategory('Alpha', { categoryId: 'person' }),
  makeCategory('Beta', { categoryId: 'place' }),
  makeCategory('Gamma', { categoryId: 'person' }),
);

describe('selectDimmedTitles', () => {
  it('should dim every card of another category when a filter is active', () => {
    const dimmed = selectDimmedTitles(['Alpha', 'Beta', 'Gamma'], CATEGORIES, 'person');

    expect([...dimmed]).toEqual(['Beta']);
  });

  it('should dim nothing when no filter is active', () => {
    const dimmed = selectDimmedTitles(['Alpha', 'Beta', 'Gamma'], CATEGORIES, null);

    expect(dimmed.size).toBe(0);
  });

  it('should dim a card whose category is not known yet', () => {
    const dimmed = selectDimmedTitles(['Alpha', 'Delta'], CATEGORIES, 'person');

    expect([...dimmed]).toEqual(['Delta']);
  });

  it('should dim a card whose article was not found', () => {
    const categories = makeCategories(
      makeCategory('Alpha', { categoryId: 'person' }),
      makeCategory('Beta', { status: 'not_found', categoryId: null }),
    );

    const dimmed = selectDimmedTitles(['Alpha', 'Beta'], categories, 'person');

    expect([...dimmed]).toEqual(['Beta']);
  });

  it('should dim every card when no card belongs to the active category', () => {
    const dimmed = selectDimmedTitles(['Alpha', 'Beta'], CATEGORIES, 'astronomy');

    expect([...dimmed]).toEqual(['Alpha', 'Beta']);
  });

  it('should dim nothing when the page shows no card', () => {
    expect(selectDimmedTitles([], CATEGORIES, 'person').size).toBe(0);
  });
});
