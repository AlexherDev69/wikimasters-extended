import type { CategoryId, PersonSubtypeId } from './category';
import type { EntityFacts } from './entity-facts';

/** Injected so the cache expiry logic stays testable. */
export interface Clock {
  now(): number;
}

/** Resolved target of one Wikidata class, plus its French label for occupations. */
export interface ClassResolution<TTarget> {
  target: TTarget | null;
  label: string | null;
  /**
   * Roots of the queried list the class reaches through P279*, sorted. A class
   * that IS one of the roots contains at least itself. The target alone loses
   * which root was matched, and the Letterboxd link needs it: a film and a
   * television series share the `film_tv` target, an actor and a director the
   * `cinema` one.
   */
  matchedRootIds: string[];
}

export type CardFactsStatus = 'resolved' | 'not_found';

export interface CachedCardFacts {
  status: CardFactsStatus;
  /** Null when `status` is `not_found`. */
  facts: EntityFacts | null;
}

export interface TitleResolver {
  /** Maps each requested frwiki title to its QID, or null when there is none. */
  resolveTitles(titles: readonly string[]): Promise<Map<string, string | null>>;
}

export interface EntityFactsSource {
  fetchFacts(qids: readonly string[]): Promise<Map<string, EntityFacts>>;
}

export interface ClassRootsSource {
  resolveCategoryClasses(
    classIds: readonly string[],
  ): Promise<Map<string, ClassResolution<CategoryId>>>;
  resolveOccupationClasses(
    classIds: readonly string[],
  ): Promise<Map<string, ClassResolution<PersonSubtypeId>>>;
}

export interface CardFactsCache {
  /** Only returns entries that are present, of the current schema and not expired. */
  getFresh(titles: readonly string[]): Promise<Map<string, CachedCardFacts>>;
  putMany(entries: ReadonlyMap<string, CachedCardFacts>): Promise<void>;
}

/** How many entries each level of the categorization cache holds. */
export interface CategorizationCacheCounts {
  /** Cards, whatever their age or their schema version. */
  cardFacts: number;
  /** Wikidata classes, of both kinds and whatever their roots version. */
  classTargets: number;
}

/**
 * Counting and emptying the two levels of the categorization cache, kept apart
 * from the ports that read and write their entries. The categorization use
 * case receives those and only those, so it cannot empty a cache; the
 * maintenance of the options page holds this one and knows nothing of what the
 * entries mean.
 *
 * Both levels are counted together and emptied together, so each operation
 * lists the storage area exactly once.
 */
export interface CategorizationCacheMaintenance {
  countEntries(): Promise<CategorizationCacheCounts>;
  /** Removes every entry of both levels, and nothing else. */
  clear(): Promise<void>;
}

export interface ClassTargetCache {
  getCategoryTargets(
    classIds: readonly string[],
  ): Promise<Map<string, ClassResolution<CategoryId>>>;
  putCategoryTargets(entries: ReadonlyMap<string, ClassResolution<CategoryId>>): Promise<void>;
  getOccupationTargets(
    classIds: readonly string[],
  ): Promise<Map<string, ClassResolution<PersonSubtypeId>>>;
  putOccupationTargets(
    entries: ReadonlyMap<string, ClassResolution<PersonSubtypeId>>,
  ): Promise<void>;
}
