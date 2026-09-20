import { describe, it, expect } from 'vitest';
import type { CategoryId, PersonSubtypeId } from './category';
import {
  classifyCachedCard,
  collectNeededClassIds,
  requiredClassIds,
  resolveOccupations,
  type CategoryTargets,
  type OccupationResolutions,
} from './classify-cached-card';
import type { EntityFacts } from './entity-facts';
import type { CachedCardFacts, ClassResolution } from './ports';

const HUMAN_CLASS_ID = 'Q5';
const ACTOR_ID = 'Q33999';
const SINGER_ID = 'Q177220';
const FILM_CLASS_ID = 'Q11424';
const METACLASS_ID = 'Q99999';
const PARENT_CLASS_ID = 'Q42889';

function makeFacts(overrides: Partial<EntityFacts> = {}): EntityFacts {
  return {
    qid: 'Q1',
    classIds: [],
    parentClassIds: [],
    occupationIds: [],
    externalIds: {
      letterboxdFilm: null,
      letterboxdActor: null,
      letterboxdDirector: null,
      letterboxdWriter: null,
      letterboxdProducer: null,
      letterboxdStudio: null,
      imdbId: null,
      tmdbMovieId: null,
      tmdbPersonId: null,
    },
    ...overrides,
  };
}

function makeEntry(facts: EntityFacts | null): CachedCardFacts {
  return facts === null ? { status: 'not_found', facts: null } : { status: 'resolved', facts };
}

function makeOccupations(
  entries: readonly [string, PersonSubtypeId, string][],
): OccupationResolutions {
  const resolutions = new Map<string, ClassResolution<PersonSubtypeId>>();
  for (const [classId, target, label] of entries) {
    resolutions.set(classId, { target, label, matchedRootIds: [] });
  }
  return resolutions;
}

const NO_OCCUPATIONS: OccupationResolutions = new Map();

describe('collectNeededClassIds', () => {
  it('should list the occupations of a human and the classes of anything else', () => {
    const human = makeEntry(makeFacts({ classIds: [HUMAN_CLASS_ID], occupationIds: [ACTOR_ID] }));
    const film = makeEntry(
      makeFacts({ classIds: [FILM_CLASS_ID], parentClassIds: [PARENT_CLASS_ID] }),
    );

    expect(collectNeededClassIds([human, film])).toEqual({
      categoryIds: [FILM_CLASS_ID, PARENT_CLASS_ID],
      occupationIds: [ACTOR_ID],
    });
  });

  it('should skip an entry without facts and de-duplicate the ids', () => {
    const film = makeEntry(makeFacts({ classIds: [FILM_CLASS_ID] }));

    expect(collectNeededClassIds([film, film, makeEntry(null)])).toEqual({
      categoryIds: [FILM_CLASS_ID],
      occupationIds: [],
    });
  });
});

describe('requiredClassIds', () => {
  it('should keep the parents out when the classes already elect a category', () => {
    const facts = makeFacts({ classIds: [FILM_CLASS_ID], parentClassIds: [PARENT_CLASS_ID] });
    const targets: CategoryTargets = new Map<string, CategoryId | null>([
      [FILM_CLASS_ID, 'film_tv'],
    ]);

    expect(requiredClassIds(facts, targets)).toEqual([FILM_CLASS_ID]);
  });

  it('should add the parents when the classes elect nobody', () => {
    const facts = makeFacts({ classIds: [METACLASS_ID], parentClassIds: [PARENT_CLASS_ID] });
    const targets: CategoryTargets = new Map<string, CategoryId | null>([[METACLASS_ID, null]]);

    expect(requiredClassIds(facts, targets)).toEqual([METACLASS_ID, PARENT_CLASS_ID]);
  });

  it('should require the occupations when the card is a human', () => {
    const facts = makeFacts({
      classIds: [HUMAN_CLASS_ID],
      parentClassIds: [PARENT_CLASS_ID],
      occupationIds: [ACTOR_ID],
    });

    expect(requiredClassIds(facts, new Map())).toEqual([ACTOR_ID]);
  });
});

describe('resolveOccupations', () => {
  it('should keep an unresolved occupation in place when its class is unknown', () => {
    const facts = makeFacts({ occupationIds: [ACTOR_ID, SINGER_ID] });
    const occupations = makeOccupations([[SINGER_ID, 'music', 'chanteur ou chanteuse']]);

    expect(resolveOccupations(facts, occupations)).toEqual([
      { label: null, subtype: null },
      { label: 'chanteur ou chanteuse', subtype: 'music' },
    ]);
  });
});

describe('classifyCachedCard', () => {
  it('should classify a non-human card and leave its subtypes empty', () => {
    const facts = makeFacts({ classIds: [FILM_CLASS_ID] });
    const targets: CategoryTargets = new Map<string, CategoryId | null>([
      [FILM_CLASS_ID, 'film_tv'],
    ]);

    expect(classifyCachedCard(facts, 'un film', targets, NO_OCCUPATIONS)).toEqual({
      categoryId: 'film_tv',
      primarySubtype: null,
      personSubtypes: [],
    });
  });

  it('should pick the subtype named earliest in the description when there is one', () => {
    const facts = makeFacts({ classIds: [HUMAN_CLASS_ID], occupationIds: [ACTOR_ID, SINGER_ID] });
    const occupations = makeOccupations([
      [ACTOR_ID, 'cinema', 'acteur ou actrice'],
      [SINGER_ID, 'music', 'chanteur ou chanteuse'],
    ]);

    const classification = classifyCachedCard(facts, 'chanteuse et actrice', new Map(), occupations);

    expect(classification).toEqual({
      categoryId: 'person',
      primarySubtype: 'music',
      personSubtypes: ['cinema', 'music'],
    });
  });

  it('should fall back to the majority vote when the description is null', () => {
    const facts = makeFacts({ classIds: [HUMAN_CLASS_ID], occupationIds: [ACTOR_ID, SINGER_ID] });
    const occupations = makeOccupations([
      [ACTOR_ID, 'cinema', 'acteur ou actrice'],
      [SINGER_ID, 'music', 'chanteur ou chanteuse'],
    ]);

    const classification = classifyCachedCard(facts, null, new Map(), occupations);

    // One vote each, so the person level priority decides: cinema before music.
    expect(classification.primarySubtype).toBe('cinema');
  });
});
