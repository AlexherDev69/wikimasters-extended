import { describe, it, expect } from 'vitest';
import type {
  CardCategory,
  CategorizationStatus,
  CategoryId,
  PersonSubtypeId,
} from '../../categorization/domain/category';
import { CATEGORY_ACCENT_COLORS, CATEGORY_LABELS } from './category-display';
import { describeCategory } from './describe-category';

function makeCategory(overrides: Partial<CardCategory> = {}): CardCategory {
  return {
    title: 'Carte',
    status: 'categorized',
    qid: 'Q1',
    categoryId: 'film_tv',
    primarySubtype: null,
    personSubtypes: [],
    letterboxdUrl: null,
    image: null,
    suggestedTags: [],
    ...overrides,
  };
}

function makePerson(primarySubtype: PersonSubtypeId | null): CardCategory {
  return makeCategory({
    categoryId: 'person',
    primarySubtype,
    personSubtypes: primarySubtype === null ? [] : [primarySubtype],
  });
}

const EVERY_CATEGORY_ID = Object.keys(CATEGORY_LABELS) as CategoryId[];

const EXPECTED_LABELS: Record<CategoryId, string> = {
  person: 'Personne',
  film_tv: 'Cinéma et TV',
  music: 'Musique',
  sport: 'Sport',
  living: 'Vivant',
  food_drink: 'Gastronomie',
  monument_building: 'Monument',
  religion_ideas: 'Religion et idées',
  work_culture: 'Oeuvre',
  place: 'Lieu',
  transport_tech: 'Technique',
  event: 'Évènement',
  organization: 'Organisation',
  astronomy: 'Astronomie',
  science_concept: 'Science',
  other: 'Autre',
};

const EXPECTED_PERSON_LABELS: Record<PersonSubtypeId, string> = {
  cinema: 'Personne · Cinéma',
  music: 'Personne · Musique',
  sport: 'Personne · Sport',
  politics: 'Personne · Politique',
  science: 'Personne · Science',
  literature: 'Personne · Littérature',
  art: 'Personne · Art',
  media: 'Personne · Médias',
  // A subtype the classification could not name reads as a plain person.
  other: 'Personne',
};

describe('describeCategory', () => {
  it.each(EVERY_CATEGORY_ID)('should label the category when it is %s', (categoryId) => {
    const descriptor = describeCategory(makeCategory({ categoryId }));

    expect(descriptor?.label).toBe(EXPECTED_LABELS[categoryId]);
    expect(descriptor?.categoryId).toBe(categoryId);
  });

  it.each(Object.keys(EXPECTED_PERSON_LABELS) as PersonSubtypeId[])(
    'should add the subtype to the label when the person is %s',
    (subtype) => {
      expect(describeCategory(makePerson(subtype))?.label).toBe(EXPECTED_PERSON_LABELS[subtype]);
    },
  );

  it('should label a person without subtype as a plain person', () => {
    expect(describeCategory(makePerson(null))?.label).toBe('Personne');
  });

  it('should ignore a subtype carried by a card that is not a person', () => {
    const descriptor = describeCategory(
      makeCategory({ categoryId: 'film_tv', primarySubtype: 'cinema' }),
    );

    expect(descriptor?.label).toBe('Cinéma et TV');
  });

  it.each(EVERY_CATEGORY_ID)('should give the accent colour of the category %s', (categoryId) => {
    expect(describeCategory(makeCategory({ categoryId }))?.accentColor).toBe(
      CATEGORY_ACCENT_COLORS[categoryId],
    );
  });

  it('should give a distinct accent colour to every category', () => {
    const colors = Object.values(CATEGORY_ACCENT_COLORS);

    expect(new Set(colors).size).toBe(colors.length);
  });

  it.each(['not_found', 'error'] satisfies CategorizationStatus[])(
    'should describe nothing when the status is %s',
    (status) => {
      expect(describeCategory(makeCategory({ status, categoryId: null }))).toBeNull();
    },
  );

  it('should describe nothing when the card has no category yet', () => {
    expect(describeCategory(makeCategory({ categoryId: null }))).toBeNull();
  });

  it('should describe nothing when a category is carried by a failed result', () => {
    // The service worker never does it, but a badge must not outlive a failure.
    expect(describeCategory(makeCategory({ status: 'error', categoryId: 'person' }))).toBeNull();
  });
});
