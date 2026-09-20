import { RARITIES, type Rarity } from '../../card-detection/domain/rarity';
import {
  CATEGORY_IDS,
  PERSON_SUBTYPE_IDS,
  type CategoryId,
  type PersonSubtypeId,
} from '../../categorization/domain/category';
import {
  CATEGORY_PRIORITY,
  PERSON_SUBTYPE_PRIORITY,
} from '../../categorization/domain/category-roots';
import {
  classifyCachedCard,
  collectNeededClassIds,
  requiredClassIds,
  type CachedCardClassification,
  type CategoryTargets,
  type OccupationResolutions,
} from '../../categorization/domain/classify-cached-card';
import { isHuman } from '../../categorization/domain/classify-entity';
import type { EntityFacts } from '../../categorization/domain/entity-facts';
import type {
  CachedCardFacts,
  CardFactsCache,
  ClassTargetCache,
} from '../../categorization/domain/ports';
import type {
  CollectionCardEntry,
  CollectionIndex,
  CollectionIndexRepository,
} from './collection-index';
import type {
  CategorySummary,
  CollectionSummary,
  NamedPersonSubtype,
  RarityCount,
  SubtypeCount,
  SummaryCard,
} from './collection-summary';

/** The titles are French, so the card lists sort as a French reader expects. */
const TITLE_LOCALE = 'fr';

/**
 * Tie-break between two categories of equal count. CATEGORY_PRIORITY
 * arbitrates the vote between the classes of one card and leaves out `person`,
 * elected by its P31 alone, and `other`, which is the absence of a verdict:
 * both are appended here so that every row has a place in the order.
 */
const CATEGORY_ORDER: readonly CategoryId[] = [
  ...CATEGORY_PRIORITY,
  ...CATEGORY_IDS.filter((categoryId) => !CATEGORY_PRIORITY.includes(categoryId)),
];

/** Same rule for the subtypes of a person. */
const SUBTYPE_ORDER: readonly PersonSubtypeId[] = [
  ...PERSON_SUBTYPE_PRIORITY,
  ...PERSON_SUBTYPE_IDS.filter((subtype) => !PERSON_SUBTYPE_PRIORITY.includes(subtype)),
];

/** Rarest first, the order a collector reads their own cards in. */
const RARITY_ORDER: readonly Rarity[] = [...RARITIES].reverse();

/**
 * The caches this use case reads. There is no network port on purpose: opening
 * the popup must never send a request to Wikimedia, whatever the state of the
 * caches. A card the caches cannot answer for is simply counted as
 * uncategorized, and the next display of it categorizes it for good.
 */
export interface SummarizeCollectionDeps {
  indexRepository: CollectionIndexRepository;
  cardFactsCache: CardFactsCache;
  classTargetCache: ClassTargetCache;
}

/** The class targets of the batch, as the two caches answered them. */
interface CachedClassData {
  categoryTargets: CategoryTargets;
  occupations: OccupationResolutions;
}

/** The cards of one category, gathered before they are sorted. */
interface CategoryBucket {
  cards: SummaryCard[];
  subtypeCounts: Map<NamedPersonSubtype, number>;
}

function compareCategories(left: CategorySummary, right: CategorySummary): number {
  return left.count === right.count
    ? CATEGORY_ORDER.indexOf(left.categoryId) - CATEGORY_ORDER.indexOf(right.categoryId)
    : right.count - left.count;
}

function compareSubtypes(left: SubtypeCount, right: SubtypeCount): number {
  return left.count === right.count
    ? SUBTYPE_ORDER.indexOf(left.subtype) - SUBTYPE_ORDER.indexOf(right.subtype)
    : right.count - left.count;
}

function compareCards(left: SummaryCard, right: SummaryCard): number {
  const byRarity = RARITY_ORDER.indexOf(left.rarity) - RARITY_ORDER.indexOf(right.rarity);
  return byRarity === 0 ? left.title.localeCompare(right.title, TITLE_LOCALE) : byRarity;
}

async function readClassData(
  entries: ReadonlyMap<string, CachedCardFacts>,
  classTargetCache: ClassTargetCache,
): Promise<CachedClassData> {
  const { categoryIds, occupationIds } = collectNeededClassIds(entries.values());
  const categoryResolutions = await classTargetCache.getCategoryTargets(categoryIds);
  const occupations = await classTargetCache.getOccupationTargets(occupationIds);

  const categoryTargets = new Map<string, CategoryId | null>();
  for (const [classId, resolution] of categoryResolutions) {
    categoryTargets.set(classId, resolution.target);
  }
  return { categoryTargets, occupations };
}

/**
 * True when every class the verdict depends on is in the cache. A card missing
 * one is left uncategorized rather than classified on partial data.
 */
function isFullyResolved(facts: EntityFacts, data: CachedClassData): boolean {
  const known: ReadonlyMap<string, unknown> = isHuman(facts)
    ? data.occupations
    : data.categoryTargets;
  return requiredClassIds(facts, data.categoryTargets).every((classId) => known.has(classId));
}

function bucketOf(
  buckets: Map<CategoryId, CategoryBucket>,
  categoryId: CategoryId,
): CategoryBucket {
  const existing = buckets.get(categoryId);
  if (existing !== undefined) {
    return existing;
  }
  const bucket: CategoryBucket = { cards: [], subtypeCounts: new Map() };
  buckets.set(categoryId, bucket);
  return bucket;
}

function addCard(
  buckets: Map<CategoryId, CategoryBucket>,
  title: string,
  entry: CollectionCardEntry,
  classification: CachedCardClassification,
): void {
  // `other` means "no trade worth naming", so it is not counted as a subtype.
  const primarySubtype =
    classification.primarySubtype === null || classification.primarySubtype === 'other'
      ? null
      : classification.primarySubtype;

  const bucket = bucketOf(buckets, classification.categoryId);
  bucket.cards.push({ title, rarity: entry.rarity, primarySubtype });
  if (primarySubtype !== null) {
    bucket.subtypeCounts.set(primarySubtype, (bucket.subtypeCounts.get(primarySubtype) ?? 0) + 1);
  }
}

function toSubtypeCounts(counts: ReadonlyMap<NamedPersonSubtype, number>): SubtypeCount[] {
  return [...counts]
    .map(([subtype, count]) => ({ subtype, count }))
    .sort(compareSubtypes);
}

function toCategorySummaries(buckets: ReadonlyMap<CategoryId, CategoryBucket>): CategorySummary[] {
  return [...buckets]
    .map(([categoryId, bucket]) => ({
      categoryId,
      count: bucket.cards.length,
      subtypes: toSubtypeCounts(bucket.subtypeCounts),
      cards: [...bucket.cards].sort(compareCards),
    }))
    .sort(compareCategories);
}

function countRarities(index: CollectionIndex): RarityCount[] {
  const counts = new Map<Rarity, number>();
  for (const entry of index.values()) {
    counts.set(entry.rarity, (counts.get(entry.rarity) ?? 0) + 1);
  }

  return RARITY_ORDER.filter((rarity) => counts.has(rarity)).map((rarity) => ({
    rarity,
    count: counts.get(rarity) ?? 0,
  }));
}

function mostRecentSeenAt(index: CollectionIndex): number | null {
  let latest: number | null = null;
  for (const entry of index.values()) {
    if (latest === null || entry.lastSeenAt > latest) {
      latest = entry.lastSeenAt;
    }
  }
  return latest;
}

function emptySummary(): CollectionSummary {
  return {
    totalCards: 0,
    uncategorizedCount: 0,
    lastSeenAt: null,
    categories: [],
    rarities: [],
  };
}

/**
 * What the index holds, seen through the caches: how many cards of each
 * category and of each rarity, the subtypes of the persons, and the cards
 * themselves so the popup can list them.
 *
 * The index keeps no description, so the main subtype of a person is decided
 * by the majority vote alone. It may therefore differ from the subtype the
 * badge shows on the card itself, where the description arbitrates. This is a
 * known and accepted approximation, written down in the README.
 */
export async function summarizeCollection(
  deps: SummarizeCollectionDeps,
): Promise<CollectionSummary> {
  const index = await deps.indexRepository.read();
  const titles = [...index.keys()];
  if (titles.length === 0) {
    return emptySummary();
  }

  const factsByTitle = await deps.cardFactsCache.getFresh(titles);
  const classData = await readClassData(factsByTitle, deps.classTargetCache);

  const buckets = new Map<CategoryId, CategoryBucket>();
  let uncategorizedCount = 0;

  for (const [title, entry] of index) {
    // A missing entry, an expired one and a card whose article was not found
    // all land here: the popup counts them together, and displaying them again
    // is what fills the caches.
    const facts = factsByTitle.get(title)?.facts ?? null;
    if (facts === null || !isFullyResolved(facts, classData)) {
      uncategorizedCount += 1;
      continue;
    }
    addCard(
      buckets,
      title,
      entry,
      classifyCachedCard(facts, null, classData.categoryTargets, classData.occupations),
    );
  }

  return {
    totalCards: titles.length,
    uncategorizedCount,
    lastSeenAt: mostRecentSeenAt(index),
    categories: toCategorySummaries(buckets),
    rarities: countRarities(index),
  };
}
