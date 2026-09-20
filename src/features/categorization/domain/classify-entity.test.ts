import { describe, it, expect } from 'vitest';
import type { CategoryId } from './category';
import { HUMAN_CLASS_ID } from './category-roots';
import { categoryClassIds, classifyEntity, isHuman } from './classify-entity';
import type { EntityFacts } from './entity-facts';
import type { ExternalIds } from './entity-facts';

const EMPTY_EXTERNAL_IDS: ExternalIds = {
  letterboxdFilm: null,
  letterboxdActor: null,
  letterboxdDirector: null,
  letterboxdWriter: null,
  letterboxdProducer: null,
  letterboxdStudio: null,
  imdbId: null,
  tmdbMovieId: null,
  tmdbPersonId: null,
};

function makeFacts(partial: Partial<EntityFacts>): EntityFacts {
  return {
    qid: 'Q1',
    classIds: [],
    parentClassIds: [],
    occupationIds: [],
    externalIds: EMPTY_EXTERNAL_IDS,
    ...partial,
  };
}

function targets(entries: Record<string, CategoryId | null>): Map<string, CategoryId | null> {
  return new Map(Object.entries(entries));
}

describe('classifyEntity', () => {
  it('should return person when the item is an instance of human', () => {
    const facts = makeFacts({ classIds: [HUMAN_CLASS_ID, 'Q10'] });
    expect(classifyEntity(facts, targets({ Q10: 'film_tv' }))).toBe('person');
  });

  it('should return the majority category when classes disagree', () => {
    // Real shape of "McDonald's": one class resolves to place, four to organization.
    const facts = makeFacts({ classIds: ['Q10', 'Q11', 'Q12', 'Q13', 'Q14'] });
    const classTargets = targets({
      Q10: 'place',
      Q11: 'organization',
      Q12: 'organization',
      Q13: 'organization',
      Q14: 'organization',
    });

    expect(classifyEntity(facts, classTargets)).toBe('organization');
  });

  it('should break a tie with the category priority', () => {
    const facts = makeFacts({ classIds: ['Q10', 'Q11'] });
    // place comes before organization in CATEGORY_PRIORITY, so it wins a tie.
    expect(classifyEntity(facts, targets({ Q10: 'organization', Q11: 'place' }))).toBe('place');
  });

  it('should break a tie in favour of monument_building over place', () => {
    const facts = makeFacts({ classIds: ['Q10', 'Q11'] });
    // The body of water group sits early among the groups, which must not
    // promote place above monument_building in the vote tie-break.
    expect(classifyEntity(facts, targets({ Q10: 'place', Q11: 'monument_building' }))).toBe(
      'monument_building',
    );
  });

  it('should break a tie in favour of religion_ideas over organization', () => {
    const facts = makeFacts({ classIds: ['Q10', 'Q11'] });
    expect(classifyEntity(facts, targets({ Q10: 'organization', Q11: 'religion_ideas' }))).toBe(
      'religion_ideas',
    );
  });

  it('should let the parent classes vote when the P31 classes elect nobody', () => {
    // Real shape of "Colt M1911": its only P31 is a metaclass leading nowhere.
    const facts = makeFacts({ classIds: ['Q10'], parentClassIds: ['Q11'] });
    const classTargets = targets({ Q10: null, Q11: 'transport_tech' });

    expect(classifyEntity(facts, classTargets)).toBe('transport_tech');
  });

  it('should ignore the parent classes when the P31 classes elect a category', () => {
    const facts = makeFacts({ classIds: ['Q10'], parentClassIds: ['Q11'] });
    const classTargets = targets({ Q10: 'film_tv', Q11: 'place' });

    expect(classifyEntity(facts, classTargets)).toBe('film_tv');
  });

  it('should let the parent classes vote when the item has no P31 class', () => {
    // Real shape of "Hutte": P279 parents but no P31.
    const facts = makeFacts({ parentClassIds: ['Q10', 'Q11'] });
    const classTargets = targets({ Q10: 'monument_building', Q11: null });

    expect(classifyEntity(facts, classTargets)).toBe('monument_building');
  });

  it('should return science_concept when the item is a class whose parents elect nobody', () => {
    const facts = makeFacts({ parentClassIds: ['Q10'] });
    expect(classifyEntity(facts, targets({ Q10: null }))).toBe('science_concept');
  });

  it('should return other when the item has a P31 class but no vote at all', () => {
    const facts = makeFacts({ classIds: ['Q10'], parentClassIds: ['Q11'] });
    expect(classifyEntity(facts, targets({ Q10: null, Q11: null }))).toBe('other');
  });

  it('should return other when the item has neither a P31 class nor a parent', () => {
    expect(classifyEntity(makeFacts({}), targets({}))).toBe('other');
  });

  it('should ignore a class that is missing from the target map', () => {
    const facts = makeFacts({ classIds: ['Q10', 'Q11'] });
    expect(classifyEntity(facts, targets({ Q11: 'music' }))).toBe('music');
  });
});

describe('categoryClassIds', () => {
  it('should list the P31 classes without the human class and then the parents', () => {
    const facts = makeFacts({ classIds: [HUMAN_CLASS_ID, 'Q10'], parentClassIds: ['Q11'] });
    expect(categoryClassIds(facts)).toEqual(['Q10', 'Q11']);
  });

  it('should list the parents when the item has no P31 class', () => {
    expect(categoryClassIds(makeFacts({ parentClassIds: ['Q11'] }))).toEqual(['Q11']);
  });
});

describe('isHuman', () => {
  it('should detect the human class among the P31 classes', () => {
    expect(isHuman(makeFacts({ classIds: ['Q10', HUMAN_CLASS_ID] }))).toBe(true);
    expect(isHuman(makeFacts({ classIds: ['Q10'] }))).toBe(false);
  });
});
