import type { Logger } from '../../../core/logger/logger';
import { cinemaRoleFromRoots, CINEMA_SUBTYPE } from '../../letterboxd/domain/cinema-role';
import {
  resolveLetterboxdUrl,
  type CinemaRoleOccupation,
  type LetterboxdCard,
} from '../../letterboxd/domain/resolve-letterboxd-url';
import type { CommonsFile } from '../../missing-image/domain/card-image';
import { suggestTags } from '../../tag-suggestions/domain/suggest-tags';
import type { CardCategory, CategoryId, PersonSubtypeId } from './category';
import {
  classifyCachedCard,
  collectNeededClassIds,
  requiredClassIds,
  resolveOccupations,
  type CachedCardClassification,
  type NeededClassIds,
} from './classify-cached-card';
import { decisiveClassIds, isHuman } from './classify-entity';
import type { EntityFacts } from './entity-facts';
import type {
  ArticleImageSource,
  CachedCardFacts,
  CardFactsCache,
  ClassResolution,
  ClassRootsSource,
  ClassTargetCache,
  EntityFactsSource,
  ThumbnailUrlCache,
  ThumbnailUrlSource,
  TitleResolver,
} from './ports';

export interface CardToCategorize {
  title: string;
  description: string | null;
}

/** What a batch asks for beyond the categories themselves. */
export interface CategorizeCardsOptions {
  /**
   * Whether the addresses of the pictures are resolved for this batch. It
   * carries the state of the missing images setting, read when the batch
   * leaves: the content script draws nothing with those addresses while the
   * feature is off, so not one request is sent and not one entry is stored for
   * a feature the user has switched off.
   */
  resolveImageUrls: boolean;
}

export interface CategorizeCardsDeps {
  titleResolver: TitleResolver;
  entityFactsSource: EntityFactsSource;
  classRootsSource: ClassRootsSource;
  cardFactsCache: CardFactsCache;
  classTargetCache: ClassTargetCache;
  articleImageSource: ArticleImageSource;
  thumbnailUrlSource: ThumbnailUrlSource;
  thumbnailUrlCache: ThumbnailUrlCache;
  logger: Logger;
}

interface ClassKindGateway<TTarget> {
  read(classIds: readonly string[]): Promise<Map<string, ClassResolution<TTarget>>>;
  write(entries: ReadonlyMap<string, ClassResolution<TTarget>>): Promise<void>;
  resolve(classIds: readonly string[]): Promise<Map<string, ClassResolution<TTarget>>>;
}

interface ClassStage {
  categoryResolutions: Map<string, ClassResolution<CategoryId>>;
  /** Targets alone, the shape the classification reads. */
  categoryTargets: Map<string, CategoryId | null>;
  occupationResolutions: Map<string, ClassResolution<PersonSubtypeId>>;
  /**
   * Class ids a failed request left unresolved: their cards report an error.
   * One set per kind, because the same id can be a category class for one card
   * and an occupation for another, and a failure of one kind must not
   * downgrade the cards of the other.
   */
  unresolvedCategoryIds: Set<string>;
  unresolvedOccupationIds: Set<string>;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function deduplicateByTitle(cards: readonly CardToCategorize[]): CardToCategorize[] {
  const byTitle = new Map<string, CardToCategorize>();
  for (const card of cards) {
    if (!byTitle.has(card.title)) {
      byTitle.set(card.title, card);
    }
  }
  return [...byTitle.values()];
}

function emptyResult(title: string, status: 'not_found' | 'error'): CardCategory {
  return {
    title,
    status,
    qid: null,
    categoryId: null,
    primarySubtype: null,
    personSubtypes: [],
    letterboxdUrl: null,
    image: null,
    suggestedTags: [],
  };
}

async function readCachedFacts(
  titles: readonly string[],
  deps: CategorizeCardsDeps,
): Promise<Map<string, CachedCardFacts>> {
  try {
    return await deps.cardFactsCache.getFresh(titles);
  } catch (error) {
    deps.logger.warn('Card cache read failed', { error: toErrorMessage(error) });
    return new Map();
  }
}

async function fetchMissingFacts(
  missingTitles: readonly string[],
  deps: CategorizeCardsDeps,
): Promise<Map<string, CachedCardFacts>> {
  const qidByTitle = await deps.titleResolver.resolveTitles(missingTitles);
  const qids = [...new Set([...qidByTitle.values()].filter((qid) => qid !== null))];
  const factsByQid = await deps.entityFactsSource.fetchFacts(qids);

  const fetched = new Map<string, CachedCardFacts>();
  for (const title of missingTitles) {
    const qid = qidByTitle.get(title) ?? null;
    const facts = qid === null ? undefined : factsByQid.get(qid);
    fetched.set(
      title,
      facts === undefined
        ? { status: 'not_found', facts: null, articleImageTried: false }
        : { status: 'resolved', facts, articleImageTried: false },
    );
  }
  return fetched;
}

/**
 * Cache hits keep their facts even when the network stage fails: only the
 * titles that were missing end up without an entry, and report an error.
 */
async function loadFacts(
  cards: readonly CardToCategorize[],
  deps: CategorizeCardsDeps,
): Promise<Map<string, CachedCardFacts>> {
  const titles = cards.map((card) => card.title);
  const factsByTitle = await readCachedFacts(titles, deps);

  const missingTitles = titles.filter((title) => !factsByTitle.has(title));
  if (missingTitles.length === 0) {
    return factsByTitle;
  }

  let fetched: Map<string, CachedCardFacts>;
  try {
    fetched = await fetchMissingFacts(missingTitles, deps);
  } catch (error) {
    deps.logger.warn('Card facts request failed', {
      error: toErrorMessage(error),
      missingCount: missingTitles.length,
    });
    return factsByTitle;
  }

  try {
    await deps.cardFactsCache.putMany(fetched);
  } catch (error) {
    deps.logger.warn('Card cache write failed', { error: toErrorMessage(error) });
  }

  for (const [title, entry] of fetched) {
    factsByTitle.set(title, entry);
  }
  return factsByTitle;
}

async function readClassCache<TTarget>(
  classIds: readonly string[],
  gateway: ClassKindGateway<TTarget>,
  logger: Logger,
): Promise<Map<string, ClassResolution<TTarget>>> {
  try {
    return await gateway.read(classIds);
  } catch (error) {
    logger.warn('Class cache read failed', { error: toErrorMessage(error) });
    return new Map();
  }
}

async function resolveClassKind<TTarget>(
  classIds: readonly string[],
  gateway: ClassKindGateway<TTarget>,
  unresolvedIds: Set<string>,
  logger: Logger,
): Promise<Map<string, ClassResolution<TTarget>>> {
  const resolutions = await readClassCache(classIds, gateway, logger);

  const missingIds = classIds.filter((classId) => !resolutions.has(classId));
  if (missingIds.length === 0) {
    return resolutions;
  }

  let fetched: Map<string, ClassResolution<TTarget>>;
  try {
    fetched = await gateway.resolve(missingIds);
  } catch (error) {
    logger.warn('Class roots request failed', {
      error: toErrorMessage(error),
      missingCount: missingIds.length,
    });
    for (const classId of missingIds) {
      unresolvedIds.add(classId);
    }
    return resolutions;
  }

  try {
    await gateway.write(fetched);
  } catch (error) {
    logger.warn('Class cache write failed', { error: toErrorMessage(error) });
  }

  for (const [classId, resolution] of fetched) {
    resolutions.set(classId, resolution);
  }
  return resolutions;
}

async function loadClassStage(
  factsByTitle: ReadonlyMap<string, CachedCardFacts>,
  deps: CategorizeCardsDeps,
): Promise<ClassStage> {
  // Every class id the batch needs, from the cache hits as well as the
  // fetched facts.
  const { categoryIds, occupationIds }: NeededClassIds = collectNeededClassIds(
    factsByTitle.values(),
  );
  const unresolvedCategoryIds = new Set<string>();
  const unresolvedOccupationIds = new Set<string>();

  const categoryResolutions = await resolveClassKind<CategoryId>(
    categoryIds,
    {
      read: (ids) => deps.classTargetCache.getCategoryTargets(ids),
      write: (entries) => deps.classTargetCache.putCategoryTargets(entries),
      resolve: (ids) => deps.classRootsSource.resolveCategoryClasses(ids),
    },
    unresolvedCategoryIds,
    deps.logger,
  );
  const occupationResolutions = await resolveClassKind<PersonSubtypeId>(
    occupationIds,
    {
      read: (ids) => deps.classTargetCache.getOccupationTargets(ids),
      write: (entries) => deps.classTargetCache.putOccupationTargets(entries),
      resolve: (ids) => deps.classRootsSource.resolveOccupationClasses(ids),
    },
    unresolvedOccupationIds,
    deps.logger,
  );

  const categoryTargets = new Map<string, CategoryId | null>();
  for (const [classId, resolution] of categoryResolutions) {
    categoryTargets.set(classId, resolution.target);
  }

  return {
    categoryResolutions,
    categoryTargets,
    occupationResolutions,
    unresolvedCategoryIds,
    unresolvedOccupationIds,
  };
}

/**
 * The two film roots of the `film_tv` group. A card that only matches the
 * television roots shares the `film_tv` category but is not a film, and
 * Letterboxd covers almost no series.
 *
 * Exported so a test checks that the group still queries both: dropping one
 * there would silently turn every film into a card without a link.
 */
export const FILM_ROOT_IDS: readonly string[] = ['Q11424', 'Q24856'];

function isFilm(facts: EntityFacts, categoryId: CategoryId, stage: ClassStage): boolean {
  if (categoryId !== 'film_tv') {
    return false;
  }
  // The classes that really voted, so a parent of an already elected card
  // cannot turn a television series into a film.
  return decisiveClassIds(facts, stage.categoryTargets).some((classId) => {
    const matchedRootIds = stage.categoryResolutions.get(classId)?.matchedRootIds ?? [];
    return matchedRootIds.some((rootId) => FILM_ROOT_IDS.includes(rootId));
  });
}

/** Occupations carrying a Letterboxd role, with the label of the tie-break. */
function cinemaRolesOf(facts: EntityFacts, stage: ClassStage): CinemaRoleOccupation[] {
  const roles: CinemaRoleOccupation[] = [];

  for (const classId of facts.occupationIds) {
    const resolution = stage.occupationResolutions.get(classId);
    if (resolution === undefined || resolution.target !== CINEMA_SUBTYPE) {
      continue;
    }
    const role = cinemaRoleFromRoots(resolution.matchedRootIds);
    if (role !== null) {
      roles.push({ role, label: resolution.label });
    }
  }
  return roles;
}

/** Everything the Letterboxd resolver needs, gathered from this batch. */
function toLetterboxdCard(
  card: CardToCategorize,
  facts: EntityFacts,
  classification: CachedCardClassification,
  stage: ClassStage,
): LetterboxdCard {
  return {
    title: card.title,
    description: card.description,
    categoryId: classification.categoryId,
    personSubtypes: classification.personSubtypes,
    externalIds: facts.externalIds,
    isFilm: isFilm(facts, classification.categoryId, stage),
    cinemaRoles: cinemaRolesOf(facts, stage),
  };
}

function buildResult(
  card: CardToCategorize,
  entry: CachedCardFacts | undefined,
  stage: ClassStage,
): CardCategory {
  if (entry === undefined) {
    return emptyResult(card.title, 'error');
  }
  if (entry.status === 'not_found' || entry.facts === null) {
    return emptyResult(card.title, 'not_found');
  }

  const facts = entry.facts;
  const unresolvedIds = isHuman(facts)
    ? stage.unresolvedOccupationIds
    : stage.unresolvedCategoryIds;
  if (requiredClassIds(facts, stage.categoryTargets).some((classId) => unresolvedIds.has(classId))) {
    return emptyResult(card.title, 'error');
  }

  const classification = classifyCachedCard(
    facts,
    card.description,
    stage.categoryTargets,
    stage.occupationResolutions,
  );
  // Occupation labels the class cache already resolved for the tie-break
  // above, reused here rather than fetched again: no new SPARQL property and
  // no new request for the tags this card proposes.
  const occupationLabels = resolveOccupations(facts, stage.occupationResolutions).map(
    (occupation) => occupation.label,
  );

  return {
    title: card.title,
    status: 'categorized',
    qid: facts.qid,
    categoryId: classification.categoryId,
    primarySubtype: classification.primarySubtype,
    personSubtypes: classification.personSubtypes,
    letterboxdUrl: resolveLetterboxdUrl(toLetterboxdCard(card, facts, classification, stage)),
    // The address of the picture is resolved by the stage below, once the whole
    // batch is known: one request for every file rather than one per card.
    image: facts.image === null ? null : { ...facts.image, thumbnailUrl: null },
    suggestedTags: suggestTags({
      categoryId: classification.categoryId,
      primarySubtype: classification.primarySubtype,
      occupationLabels,
    }),
  };
}

/**
 * Titles whose card was categorized, Wikidata gave it no image at all, and
 * whose fresh facts were not already marked as tried against the article's
 * own image: a title still absent from `factsByTitle` (should not happen for
 * a categorized result) is treated as untried, exactly like a missing flag.
 */
function titlesWithoutImage(
  results: readonly CardCategory[],
  factsByTitle: ReadonlyMap<string, CachedCardFacts>,
): string[] {
  return results
    .filter(
      (result) =>
        result.status === 'categorized' &&
        result.image === null &&
        factsByTitle.get(result.title)?.articleImageTried !== true,
    )
    .map((result) => result.title);
}

/**
 * Persists what this run definitely learned about the article's own image, as
 * part of the facts of each card: the next categorization of the same card,
 * still inside its 90 day lifetime, then reads it back from the cache instead
 * of asking again. This source gets no cache level of its own, it rides in
 * the existing one, which is also why a card whose facts were never loaded
 * (should not happen for a categorized result) is simply skipped rather than
 * forced into the cache on its own.
 *
 * `articleImages` holds only the titles this run got a DEFINITE answer for,
 * found or not: a title MediaWiki's continuation left unresolved (see
 * ARTICLE_TITLE_BATCH_SIZE in the source) is absent from it on purpose, so it
 * is retried on the next categorization instead of remembered as a miss it
 * never actually was. Every title written here is marked `articleImageTried`,
 * whether or not a file was found, which is what lets `titlesWithoutImage`
 * stop asking about it.
 *
 * This write does not preserve the original `fetchedAt` of the entry:
 * `cardFactsCache.putMany` always stamps the current time, so an enrichment
 * restarts the card's 90 day lifetime from today. Accepted as is: it can
 * happen at most once per card, since a tried card is never asked again, so
 * the extra lifetime this buys is bounded, and the classes and external ids
 * kept in service a little longer are the very ones this same batch just
 * confirmed accurate.
 */
async function rememberArticleImages(
  articleImages: ReadonlyMap<string, CommonsFile | null>,
  factsByTitle: ReadonlyMap<string, CachedCardFacts>,
  deps: CategorizeCardsDeps,
): Promise<void> {
  const enrichedFacts = new Map<string, CachedCardFacts>();
  for (const [title, image] of articleImages) {
    const entry = factsByTitle.get(title);
    if (entry?.facts) {
      enrichedFacts.set(title, {
        ...entry,
        facts: image === null ? entry.facts : { ...entry.facts, image },
        articleImageTried: true,
      });
    }
  }
  if (enrichedFacts.size === 0) {
    return;
  }

  try {
    await deps.cardFactsCache.putMany(enrichedFacts);
  } catch (error) {
    deps.logger.warn('Article image cache write failed', { error: toErrorMessage(error) });
  }
}

/**
 * Fills the hole Wikidata left on a card with the image the article uses for
 * itself, for the titles that qualify: rule 1 of the phase 7d specification
 * restricts this to a card Wikidata gave no image to, so only those titles are
 * ever asked for. Follows the same rules as the thumbnail resolution stage
 * below: it never downgrades a card, every failure is caught and logged at
 * warn, and a card this stage cannot help is simply left without an image.
 */
async function withArticleImages(
  results: readonly CardCategory[],
  factsByTitle: ReadonlyMap<string, CachedCardFacts>,
  deps: CategorizeCardsDeps,
): Promise<CardCategory[]> {
  const candidateTitles = titlesWithoutImage(results, factsByTitle);
  // Not one card of the batch is missing its Wikidata image, which is the
  // common case: nothing is asked and nothing is written.
  if (candidateTitles.length === 0) {
    return results.slice();
  }
  // The source only ever answers about the titles it was given, but this
  // keeps that invariant in one place rather than trusting it a second time.
  const candidateTitleSet = new Set(candidateTitles);

  let articleImages: Map<string, CommonsFile | null>;
  try {
    articleImages = await deps.articleImageSource.findArticleImages(candidateTitles);
  } catch (error) {
    deps.logger.warn('Article image request failed', {
      error: toErrorMessage(error),
      candidateCount: candidateTitles.length,
    });
    return results.slice();
  }

  // Both what is persisted and what is shown are read from this map, so a
  // title the source answered about without being asked reaches neither.
  const definiteAnswers = new Map<string, CommonsFile | null>();
  for (const [title, image] of articleImages) {
    if (candidateTitleSet.has(title)) {
      definiteAnswers.set(title, image);
    }
  }

  await rememberArticleImages(definiteAnswers, factsByTitle, deps);

  const foundImages = new Map<string, CommonsFile>();
  for (const [title, image] of definiteAnswers) {
    if (image !== null) {
      foundImages.set(title, image);
    }
  }

  return results.map((result) => {
    const image = foundImages.get(result.title);
    return image === undefined ? result : { ...result, image: { ...image, thumbnailUrl: null } };
  });
}

/** The distinct Commons files the results of a batch name, in no order. */
function fileNamesOf(results: readonly CardCategory[]): string[] {
  const fileNames = new Set<string>();

  for (const result of results) {
    if (result.image !== null) {
      fileNames.add(result.image.fileName);
    }
  }
  return [...fileNames];
}

/**
 * The address of each file, cache first and one request for what is left.
 * Every failure here is logged and swallowed: a card whose address is unknown
 * keeps its category and shows its picture through the address the content
 * script builds itself, which is the path that shipped before this stage.
 */
async function loadThumbnailUrls(
  fileNames: readonly string[],
  deps: CategorizeCardsDeps,
): Promise<Map<string, string | null>> {
  let urlByFileName = new Map<string, string | null>();
  try {
    urlByFileName = await deps.thumbnailUrlCache.getFresh(fileNames);
  } catch (error) {
    deps.logger.warn('Thumbnail cache read failed', { error: toErrorMessage(error) });
  }

  const missingFileNames = fileNames.filter((fileName) => !urlByFileName.has(fileName));
  if (missingFileNames.length === 0) {
    return urlByFileName;
  }

  let resolved: Map<string, string | null>;
  try {
    resolved = await deps.thumbnailUrlSource.resolveThumbnailUrls(missingFileNames);
  } catch (error) {
    deps.logger.warn('Thumbnail request failed', {
      error: toErrorMessage(error),
      missingCount: missingFileNames.length,
    });
    return urlByFileName;
  }

  try {
    await deps.thumbnailUrlCache.putMany(resolved);
  } catch (error) {
    deps.logger.warn('Thumbnail cache write failed', { error: toErrorMessage(error) });
  }

  for (const [fileName, url] of resolved) {
    urlByFileName.set(fileName, url);
  }
  return urlByFileName;
}

/** The same results, each known picture carrying the address resolved for it. */
async function withThumbnailUrls(
  results: CardCategory[],
  deps: CategorizeCardsDeps,
): Promise<CardCategory[]> {
  const fileNames = fileNamesOf(results);
  // Not one card of the batch has a picture, which is the common case: nothing
  // is read, nothing is asked and nothing is written.
  if (fileNames.length === 0) {
    return results;
  }

  const urlByFileName = await loadThumbnailUrls(fileNames, deps);

  return results.map((result) => {
    const thumbnailUrl = result.image === null ? null : urlByFileName.get(result.image.fileName);
    if (result.image === null || thumbnailUrl === undefined || thumbnailUrl === null) {
      return result;
    }
    return { ...result, image: { ...result.image, thumbnailUrl } };
  });
}

/**
 * Categorizes a batch of cards, one result per distinct title, in the order of
 * first appearance. Never rejects: a failing stage is logged and downgrades the
 * affected cards to the `error` status, while the cards served by the caches
 * are still categorized.
 *
 * The picture of a card is resolved last, in two stages run after the
 * classification: first the article's own image fills a hole Wikidata left,
 * then the address of whatever picture the card now has is resolved. Both
 * share one property that sets them apart from every earlier stage: their
 * failure costs nothing, since a card never loses its category or its
 * Wikidata image because one of them failed. They are also the only stages
 * the caller can decline, through the very same flag, and are then skipped
 * together rather than made to fail.
 */
export async function categorizeCards(
  cards: readonly CardToCategorize[],
  deps: CategorizeCardsDeps,
  options: CategorizeCardsOptions,
): Promise<CardCategory[]> {
  const uniqueCards = deduplicateByTitle(cards);
  if (uniqueCards.length === 0) {
    return [];
  }

  const factsByTitle = await loadFacts(uniqueCards, deps);
  const stage = await loadClassStage(factsByTitle, deps);
  const results = uniqueCards.map((card) =>
    buildResult(card, factsByTitle.get(card.title), stage),
  );
  if (!options.resolveImageUrls) {
    return results;
  }

  const withFallbackImages = await withArticleImages(results, factsByTitle, deps);
  return withThumbnailUrls(withFallbackImages, deps);
}
