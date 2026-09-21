import type { CommonsFile } from '../../missing-image/domain/card-image';
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
  /**
   * The picture the article leads with, which is the one the site itself
   * draws. Null when the article has none, and then only what Wikidata holds
   * can fill the card.
   */
  leadImage: CommonsFile | null;
  /**
   * Whether the article's own image (phase 7d) was already looked up for this
   * card. Always false for a `not_found` card, which never reaches that
   * stage, and for a card whose answer MediaWiki's continuation left
   * unresolved: only a definite yes or no marks a card as tried.
   */
  articleImageTried: boolean;
}

/** What one article answers about itself, in the one request its title costs. */
export interface ResolvedTitle {
  /** The Wikidata item of the article, or null when it has none. */
  qid: string | null;
  /** The picture the article leads with, or null when it has none. */
  leadImage: CommonsFile | null;
}

export interface TitleResolver {
  /** Maps each requested frwiki title to what its article answers about itself. */
  resolveTitles(titles: readonly string[]): Promise<Map<string, ResolvedTitle>>;
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

/**
 * The final address of a Commons file on the Wikimedia thumbnail servers. The
 * address the extension builds itself answers with two redirects the browser is
 * told not to cache, so it is walked again on every single display; resolving it
 * once and remembering it is what this port is for.
 *
 * Null is an answer: the file has no usable thumbnail, and the card falls back
 * to the address built from its name.
 */
export interface ThumbnailUrlSource {
  resolveThumbnailUrls(fileNames: readonly string[]): Promise<Map<string, string | null>>;
}

/**
 * The image an article uses for itself, for a card whose Wikidata image
 * properties (P18 and friends) leave it without one. Null is an answer: none
 * of the guards of this second image source were satisfied, and the card
 * stays without a picture exactly as before this source existed.
 */
export interface ArticleImageSource {
  findArticleImages(titles: readonly string[]): Promise<Map<string, CommonsFile | null>>;
}

export interface ThumbnailUrlCache {
  /**
   * Only returns entries that are present, of the current schema and not
   * expired. An entry holding null is a remembered "no usable thumbnail", which
   * is why it is an entry at all rather than a miss.
   */
  getFresh(fileNames: readonly string[]): Promise<Map<string, string | null>>;
  putMany(entries: ReadonlyMap<string, string | null>): Promise<void>;
}

/** How many entries each level of the categorization cache holds. */
export interface CategorizationCacheCounts {
  /** Cards, whatever their age or their schema version. */
  cardFacts: number;
  /** Wikidata classes, of both kinds and whatever their roots version. */
  classTargets: number;
  /** Commons files whose thumbnail address is known, resolved or not. */
  thumbnailUrls: number;
}

/**
 * Counting and emptying the levels of the categorization cache, kept apart
 * from the ports that read and write their entries. The categorization use
 * case receives those and only those, so it cannot empty a cache; the
 * maintenance of the options page holds this one and knows nothing of what the
 * entries mean.
 *
 * Every level is counted together and emptied together, so each operation
 * lists the storage area exactly once.
 */
export interface CategorizationCacheMaintenance {
  countEntries(): Promise<CategorizationCacheCounts>;
  /** Removes every entry of every level, and nothing else. */
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
