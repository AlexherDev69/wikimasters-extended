/**
 * The dependencies of `categorizeCards`, shared by the two files that split
 * `categorize-cards.test.ts` apart: the stub card whose stages are driven one
 * by one, and the empty sources the stages that are not under test are given.
 *
 * Only what both files need lives here: a fake a single file uses stays in
 * that file.
 */

import { vi } from 'vitest';
import type { Logger } from '../../src/core/logger/logger';
import type { CommonsFile } from '../../src/core/mediawiki/card-image';
import type {
  CardCategory,
  CategoryId,
  PersonSubtypeId,
} from '../../src/features/categorization/domain/category';
import type {
  CardToCategorize,
  CategorizeCardsDeps,
  CategorizeCardsOptions,
} from '../../src/features/categorization/domain/categorize-cards';
import type { EntityFacts } from '../../src/features/categorization/domain/entity-facts';
import type {
  ArticleImageSource,
  CachedCardFacts,
  ClassResolution,
  Clock,
  ResolvedTitle,
  ThumbnailUrlCache,
  ThumbnailUrlSource,
} from '../../src/features/categorization/domain/ports';
import { resolveLetterboxdCardLink } from '../../src/features/letterboxd/domain/letterboxd-card-link';

export const SYSTEM_CLOCK: Clock = { now: (): number => Date.now() };

export function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/** An answer that never resolves anything: every title stays unknown, exactly like a truncated batch. */
export function emptyArticleImageSource(): ArticleImageSource {
  return {
    findArticleImages: (): Promise<Map<string, CommonsFile | null>> => Promise.resolve(new Map()),
  };
}

/** What the content script asks for while the missing images feature is on. */
export const WITH_IMAGE_URLS: CategorizeCardsOptions = { resolveImageUrls: true };

/** And what it asks for once the user has switched that feature off. */
export const WITHOUT_IMAGE_URLS: CategorizeCardsOptions = { resolveImageUrls: false };

export function byTitle(results: readonly CardCategory[]): Map<string, CardCategory> {
  return new Map(results.map((result) => [result.title, result]));
}

/**
 * Real shape of "Gallus gallus domesticus": its P31 classes are resolved from
 * the cache, its P279 parents need the network.
 */
export const STUB_CARD: CardToCategorize = { title: 'Poule', description: null };
export const STUB_QID = 'Q1';
export const STUB_INSTANCE_CLASS_ID = 'Q10';
export const STUB_PARENT_CLASS_ID = 'Q11';

export const STUB_FACTS: EntityFacts = {
  qid: STUB_QID,
  classIds: [STUB_INSTANCE_CLASS_ID],
  parentClassIds: [STUB_PARENT_CLASS_ID],
  occupationIds: [],
  externalIds: {
    letterboxdFilm: null,
    letterboxdActor: null,
    letterboxdDirector: null,
    letterboxdWriter: null,
    letterboxdProducer: null,
    letterboxdStudio: null,
    tmdbMovieId: null,
    tmdbPersonId: null,
  },
  image: null,
  seriesImage: null,
};

/**
 * Deps whose class target cache answers `cachedTargets` and whose roots source
 * always fails, so exactly the class ids absent from `cachedTargets` end up
 * unresolved. The replay cannot express that: one request carries every id.
 */
export function makeStubDeps(cachedTargets: Map<string, CategoryId | null>): CategorizeCardsDeps {
  const categoryResolutions = new Map<string, ClassResolution<CategoryId>>(
    [...cachedTargets].map(([classId, target]) => [
      classId,
      { target, label: null, matchedRootIds: [] },
    ]),
  );

  return {
    titleResolver: {
      resolveTitles: (): Promise<Map<string, ResolvedTitle>> =>
        Promise.resolve(new Map([[STUB_CARD.title, { qid: STUB_QID, leadImage: null }]])),
    },
    entityFactsSource: {
      fetchFacts: (): Promise<Map<string, EntityFacts>> =>
        Promise.resolve(new Map([[STUB_QID, STUB_FACTS]])),
    },
    classRootsSource: {
      resolveCategoryClasses: (): Promise<Map<string, ClassResolution<CategoryId>>> =>
        Promise.reject(new Error('roots unavailable')),
      resolveOccupationClasses: (): Promise<Map<string, ClassResolution<PersonSubtypeId>>> =>
        Promise.reject(new Error('roots unavailable')),
    },
    cardFactsCache: {
      getFresh: (): Promise<Map<string, CachedCardFacts>> => Promise.resolve(new Map()),
      putMany: (): Promise<void> => Promise.resolve(),
    },
    classTargetCache: {
      getCategoryTargets: (): Promise<Map<string, ClassResolution<CategoryId>>> =>
        Promise.resolve(categoryResolutions),
      putCategoryTargets: (): Promise<void> => Promise.resolve(),
      getOccupationTargets: (): Promise<Map<string, ClassResolution<PersonSubtypeId>>> =>
        Promise.resolve(new Map()),
      putOccupationTargets: (): Promise<void> => Promise.resolve(),
    },
    articleImageSource: emptyArticleImageSource(),
    // The stub card has no image, so this stage is never reached.
    thumbnailUrlSource: emptyThumbnailUrlSource(),
    thumbnailUrlCache: emptyThumbnailUrlCache(),
    resolveCardLink: resolveLetterboxdCardLink,
    logger: makeLogger(),
  };
}

export function emptyThumbnailUrlSource(): ThumbnailUrlSource {
  return {
    resolveThumbnailUrls: (): Promise<Map<string, string | null>> => Promise.resolve(new Map()),
  };
}

export function emptyThumbnailUrlCache(): ThumbnailUrlCache {
  return {
    getFresh: (): Promise<Map<string, string | null>> => Promise.resolve(new Map()),
    putMany: (): Promise<void> => Promise.resolve(),
  };
}
