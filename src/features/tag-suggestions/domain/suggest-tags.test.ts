import { describe, it, expect } from 'vitest';
import {
  MAX_SUGGESTED_TAGS,
  MAX_TAG_LENGTH,
  normalizeTag,
  suggestTags,
  type CardForTagSuggestions,
} from './suggest-tags';

function makeCard(overrides: Partial<CardForTagSuggestions> = {}): CardForTagSuggestions {
  return {
    categoryId: 'place',
    primarySubtype: null,
    occupationLabels: [],
    ...overrides,
  };
}

describe('normalizeTag', () => {

  it('should still fit the field when putting the first letter in upper case makes it longer', () => {
    // The German eszett upper cases to two letters, so capping before that
    // step hands back one character more than the field accepts, and the
    // guard of the message then refuses the whole batch of cards.
    const raw = 'ß' + 'a'.repeat(MAX_TAG_LENGTH - 1);

    const normalized = normalizeTag(raw);

    expect(normalized).not.toBeNull();
    expect((normalized as string).length).toBeLessThanOrEqual(MAX_TAG_LENGTH);
  });

  it('should leave no trailing space when the cap falls between two words', () => {
    const raw = 'a'.repeat(MAX_TAG_LENGTH - 1) + ' bcd';

    expect(normalizeTag(raw)).toBe('A' + 'a'.repeat(MAX_TAG_LENGTH - 2));
  });
  it('should trim and collapse inner whitespace', () => {
    expect(normalizeTag('  footballeur   professionnel  ')).toBe('Footballeur professionnel');
  });

  it('should upper case only the first letter and leave the rest untouched', () => {
    expect(normalizeTag('footballeur')).toBe('Footballeur');
    expect(normalizeTag('cinéaste')).toBe('Cinéaste');
  });

  it('should never lower case the rest of the name', () => {
    expect(normalizeTag('FC Barcelone')).toBe('FC Barcelone');
  });

  it('should return null when nothing is left after trimming', () => {
    expect(normalizeTag('   ')).toBeNull();
    expect(normalizeTag('')).toBeNull();
  });

  it('should truncate to MAX_TAG_LENGTH characters', () => {
    const raw = 'a'.repeat(MAX_TAG_LENGTH + 10);

    const normalized = normalizeTag(raw);

    expect(normalized).toHaveLength(MAX_TAG_LENGTH);
  });
});

describe('suggestTags', () => {
  it('should propose the category label alone for a card that is not a person', () => {
    expect(suggestTags(makeCard({ categoryId: 'place' }))).toEqual(['Lieu']);
  });

  it('should propose the category then the primary subtype for a person', () => {
    const tags = suggestTags(
      makeCard({ categoryId: 'person', primarySubtype: 'sport', occupationLabels: [] }),
    );

    expect(tags).toEqual(['Personne', 'Sport']);
  });

  it('should skip the primary subtype when it is other', () => {
    const tags = suggestTags(makeCard({ categoryId: 'person', primarySubtype: 'other' }));

    expect(tags).toEqual(['Personne']);
  });

  it('should append the occupation labels after the category and the subtype', () => {
    const tags = suggestTags(
      makeCard({
        categoryId: 'person',
        primarySubtype: 'sport',
        occupationLabels: ['footballeur', 'entraîneur'],
      }),
    );

    expect(tags).toEqual(['Personne', 'Sport', 'Footballeur', 'Entraîneur']);
  });

  it('should propose the profession rather than guessing a topic from it', () => {
    // A footballer's occupation label is "footballeur", not the sport itself:
    // guessing "Football" from a profession is left alone on purpose.
    const tags = suggestTags(
      makeCard({ categoryId: 'person', primarySubtype: 'sport', occupationLabels: ['footballeur'] }),
    );

    expect(tags).toContain('Footballeur');
    expect(tags).not.toContain('Football');
  });

  it('should skip an occupation whose label the class cache could not resolve', () => {
    const tags = suggestTags(
      makeCard({ categoryId: 'person', occupationLabels: [null, 'réalisateur'] }),
    );

    expect(tags).toEqual(['Personne', 'Réalisateur']);
  });

  it('should deduplicate case-insensitively while keeping the first spelling', () => {
    const tags = suggestTags(
      makeCard({
        categoryId: 'person',
        primarySubtype: 'sport',
        occupationLabels: ['sport', 'SPORT'],
      }),
    );

    expect(tags).toEqual(['Personne', 'Sport']);
  });

  it('should cap the list at MAX_SUGGESTED_TAGS', () => {
    const tags = suggestTags(
      makeCard({
        categoryId: 'person',
        primarySubtype: 'sport',
        occupationLabels: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      }),
    );

    expect(tags).toHaveLength(MAX_SUGGESTED_TAGS);
  });

  it('should drop a candidate that normalizes to nothing', () => {
    const tags = suggestTags(makeCard({ categoryId: 'person', occupationLabels: ['   '] }));

    expect(tags).toEqual(['Personne']);
  });
});
