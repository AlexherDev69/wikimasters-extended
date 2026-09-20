import type { CategoryId } from './category';
import { CATEGORY_PRIORITY, HUMAN_CLASS_ID } from './category-roots';
import type { EntityFacts } from './entity-facts';

/** Category used when an item has P279 parents but no P31 class: it is itself a class. */
const CLASS_ITEM_CATEGORY: CategoryId = 'science_concept';

const FALLBACK_CATEGORY: CategoryId = 'other';

export function isHuman(facts: EntityFacts): boolean {
  return facts.classIds.includes(HUMAN_CLASS_ID);
}

/** P31 classes of a non-human item, the human class excluded. */
function instanceClassIds(facts: EntityFacts): string[] {
  return facts.classIds.filter((classId) => classId !== HUMAN_CLASS_ID);
}

/**
 * Every class id the category of these facts may depend on. Both lists are
 * needed because the P279 parents vote when the P31 classes elect nobody.
 *
 * Exported so the use case resolves exactly the ids the classification needs.
 */
export function categoryClassIds(facts: EntityFacts): string[] {
  return [...instanceClassIds(facts), ...facts.parentClassIds];
}

function countVotes(
  classIds: readonly string[],
  classTargets: ReadonlyMap<string, CategoryId | null>,
): Map<CategoryId, number> {
  const votes = new Map<CategoryId, number>();
  for (const classId of classIds) {
    const target = classTargets.get(classId);
    if (target === undefined || target === null) {
      continue;
    }
    votes.set(target, (votes.get(target) ?? 0) + 1);
  }
  return votes;
}

/** Highest count wins, ties broken by the order of CATEGORY_PRIORITY. */
function elect(
  classIds: readonly string[],
  classTargets: ReadonlyMap<string, CategoryId | null>,
): CategoryId | null {
  const votes = countVotes(classIds, classTargets);

  let winner: CategoryId | null = null;
  let bestCount = 0;
  for (const target of CATEGORY_PRIORITY) {
    const count = votes.get(target) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      winner = target;
    }
  }
  return winner;
}

/**
 * Class ids the verdict of `classifyEntity` actually depends on, given what is
 * already known of the targets. The P279 parents only matter when the P31
 * classes elect nobody, so a card whose classes already elect a category must
 * not be downgraded because an unrelated parent failed to resolve: 16 of the
 * 100 recorded entities have both, "Gallus gallus domesticus" among them.
 *
 * Shares `elect` with the classification, so the cascade has a single owner.
 */
export function decisiveClassIds(
  facts: EntityFacts,
  classTargets: ReadonlyMap<string, CategoryId | null>,
): string[] {
  const classIds = instanceClassIds(facts);
  if (elect(classIds, classTargets) !== null) {
    return classIds;
  }
  return [...classIds, ...facts.parentClassIds];
}

/**
 * The P31 classes vote first. When they elect nobody the P279 parents vote,
 * which rescues the items whose only P31 is a metaclass leading nowhere, such
 * as "type of disease" or "firearm model".
 */
export function classifyEntity(
  facts: EntityFacts,
  classTargets: ReadonlyMap<string, CategoryId | null>,
): CategoryId {
  if (isHuman(facts)) {
    return 'person';
  }

  const classIds = instanceClassIds(facts);
  const fromClasses = elect(classIds, classTargets);
  if (fromClasses !== null) {
    return fromClasses;
  }

  const fromParents = elect(facts.parentClassIds, classTargets);
  if (fromParents !== null) {
    return fromParents;
  }

  const isClassItself = classIds.length === 0 && facts.parentClassIds.length > 0;
  return isClassItself ? CLASS_ITEM_CATEGORY : FALLBACK_CATEGORY;
}
