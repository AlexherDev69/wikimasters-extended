import type { CategoryId, PersonSubtypeId } from './category';
import { categoryClassIds, classifyEntity, decisiveClassIds, isHuman } from './classify-entity';
import { classifyPerson, type ResolvedOccupation } from './classify-person';
import type { EntityFacts } from './entity-facts';
import type { CachedCardFacts, ClassResolution } from './ports';

/**
 * The step shared by every reader of the caches: turning the raw facts of a
 * card and the resolved targets of its classes into a verdict. The
 * categorization of the cards on screen and the summary of the collection go
 * through it, so the two can never disagree on what a card is.
 */

/** Target of each class id known so far, null for a class leading nowhere. */
export type CategoryTargets = ReadonlyMap<string, CategoryId | null>;

export type OccupationResolutions = ReadonlyMap<string, ClassResolution<PersonSubtypeId>>;

/** Class ids a batch needs, split by the kind each one must be resolved as. */
export interface NeededClassIds {
  categoryIds: string[];
  occupationIds: string[];
}

/** What the classification says of one card whose facts are in hand. */
export interface CachedCardClassification {
  categoryId: CategoryId;
  /** Non-null only when `categoryId` is `person`. */
  primarySubtype: PersonSubtypeId | null;
  personSubtypes: PersonSubtypeId[];
}

/** Class ids to resolve before classifying, both branches of the cascade included. */
function neededClassIds(facts: EntityFacts): string[] {
  return isHuman(facts) ? facts.occupationIds : categoryClassIds(facts);
}

/**
 * Every class id these entries need, deduplicated. A human is resolved against
 * the occupation roots and anything else against the category roots, so the
 * same id can be asked for as both kinds and then belongs to both lists.
 */
export function collectNeededClassIds(entries: Iterable<CachedCardFacts>): NeededClassIds {
  const categoryIds = new Set<string>();
  const occupationIds = new Set<string>();

  for (const entry of entries) {
    if (entry.facts === null) {
      continue;
    }
    const target = isHuman(entry.facts) ? occupationIds : categoryIds;
    for (const classId of neededClassIds(entry.facts)) {
      target.add(classId);
    }
  }

  return { categoryIds: [...categoryIds], occupationIds: [...occupationIds] };
}

/**
 * Class ids the verdict of this card really depends on, known only once the
 * targets are in: an id outside this list may stay unresolved without changing
 * anything, so a card is never downgraded for an unrelated failure.
 */
export function requiredClassIds(facts: EntityFacts, categoryTargets: CategoryTargets): string[] {
  return isHuman(facts) ? facts.occupationIds : decisiveClassIds(facts, categoryTargets);
}

/** One entry per P106 of the card, in its order, unresolved ones included. */
export function resolveOccupations(
  facts: EntityFacts,
  occupations: OccupationResolutions,
): ResolvedOccupation[] {
  return facts.occupationIds.map((classId) => {
    const resolution = occupations.get(classId);
    return { label: resolution?.label ?? null, subtype: resolution?.target ?? null };
  });
}

/**
 * The category of a card and, for a person, its subtypes.
 *
 * `description` refines the primary subtype of a person and is null when the
 * caller does not have it, which is the case of the collection index: the
 * majority vote then decides on its own.
 */
export function classifyCachedCard(
  facts: EntityFacts,
  description: string | null,
  categoryTargets: CategoryTargets,
  occupations: OccupationResolutions,
): CachedCardClassification {
  const categoryId = classifyEntity(facts, categoryTargets);
  if (categoryId !== 'person') {
    return { categoryId, primarySubtype: null, personSubtypes: [] };
  }

  const person = classifyPerson(description, resolveOccupations(facts, occupations));
  return {
    categoryId,
    primarySubtype: person.primarySubtype,
    personSubtypes: person.personSubtypes,
  };
}
