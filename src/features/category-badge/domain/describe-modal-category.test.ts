import { describe, it, expect } from 'vitest';
import type { CardCategory } from '../../categorization/domain/category';
import { CATEGORY_ACCENT_COLORS } from './category-display';
import { describeModalCategory } from './describe-modal-category';

function makeCategory(overrides: Partial<CardCategory> = {}): CardCategory {
  return {
    title: 'Carte',
    status: 'categorized',
    qid: 'Q1',
    categoryId: 'film_tv',
    primarySubtype: null,
    personSubtypes: [],
    letterboxdUrl: null,
    ...overrides,
  };
}

describe('describeModalCategory', () => {
  it('should read as a category line when the card is not a person', () => {
    expect(describeModalCategory(makeCategory())?.text).toBe('Catégorie : Cinéma et TV');
  });

  it('should carry the accent colour of the category', () => {
    const descriptor = describeModalCategory(makeCategory({ categoryId: 'astronomy' }));

    expect(descriptor?.categoryId).toBe('astronomy');
    expect(descriptor?.accentColor).toBe(CATEGORY_ACCENT_COLORS.astronomy);
  });

  it('should show the main subtype of a person', () => {
    const descriptor = describeModalCategory(
      makeCategory({
        categoryId: 'person',
        primarySubtype: 'science',
        personSubtypes: ['science'],
      }),
    );

    expect(descriptor?.text).toBe('Catégorie : Personne · Science');
  });

  it('should list the other subtypes when the person has several', () => {
    const descriptor = describeModalCategory(
      makeCategory({
        categoryId: 'person',
        primarySubtype: 'music',
        personSubtypes: ['cinema', 'music', 'literature'],
      }),
    );

    expect(descriptor?.text).toBe('Catégorie : Personne · Musique (aussi : Cinéma, Littérature)');
  });

  it('should leave out the subtype that has no name of its own', () => {
    const descriptor = describeModalCategory(
      makeCategory({
        categoryId: 'person',
        primarySubtype: 'sport',
        personSubtypes: ['sport', 'other'],
      }),
    );

    expect(descriptor?.text).toBe('Catégorie : Personne · Sport');
  });

  it('should list the subtypes of a person whose main one could not be named', () => {
    const descriptor = describeModalCategory(
      makeCategory({
        categoryId: 'person',
        primarySubtype: 'other',
        personSubtypes: ['other', 'art'],
      }),
    );

    expect(descriptor?.text).toBe('Catégorie : Personne (aussi : Art)');
  });

  it('should ignore the subtypes of a card that is not a person', () => {
    const descriptor = describeModalCategory(
      makeCategory({ categoryId: 'film_tv', personSubtypes: ['cinema'] }),
    );

    expect(descriptor?.text).toBe('Catégorie : Cinéma et TV');
  });

  it('should describe nothing when the card has no category', () => {
    const missing = makeCategory({ status: 'not_found', categoryId: null });

    expect(describeModalCategory(missing)).toBeNull();
  });
});
