import type { Logger } from '../../../core/logger/logger';
import { cinemaRoleFromRoots, CINEMA_SUBTYPE } from '../../letterboxd/domain/cinema-role';
import {
  resolveLetterboxdUrl,
  type CinemaRoleOccupation,
  type LetterboxdCard,
} from '../../letterboxd/domain/resolve-letterboxd-url';
import type { CardCategory, CategoryId, PersonSubtypeId } from './category';
import {
  classifyCachedCard,
  collectNeededClassIds,
  requiredClassIds,
  type CachedCardClassification,
  type NeededClassIds,
} from './classify-cached-card';
import { decisiveClassIds, isHuman } from './classify-entity';
import type { EntityFacts } from './entity-facts';
import type {
  CachedCardFacts,
  CardFactsCache,
  ClassResolution,
  ClassRootsSource,
  ClassTargetCache,
  EntityFactsSource,
  TitleResolver,
} from './ports';

export interface CardToCategorize {
  title: string;
  description: string | null;
}

export interface CategorizeCardsDeps {
  titleResolver: TitleResolver;
  entityFactsSource: EntityFactsSource;
  classRootsSource: ClassRootsSource;
  cardFactsCache: CardFactsCache;
  classTargetCache: ClassTargetCache;
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
      facts === undefined ? { status: 'not_found', facts: null } : { status: 'resolved', facts },
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

  return {
    title: card.title,
    status: 'categorized',
    qid: facts.qid,
    categoryId: classification.categoryId,
    primarySubtype: classification.primarySubtype,
    personSubtypes: classification.personSubtypes,
    letterboxdUrl: resolveLetterboxdUrl(toLetterboxdCard(card, facts, classification, stage)),
    image: facts.image,
  };
}

/**
 * Categorizes a batch of cards, one result per distinct title, in the order of
 * first appearance. Never rejects: a failing stage is logged and downgrades the
 * affected cards to the `error` status, while the cards served by the caches
 * are still categorized.
 */
export async function categorizeCards(
  cards: readonly CardToCategorize[],
  deps: CategorizeCardsDeps,
): Promise<CardCategory[]> {
  const uniqueCards = deduplicateByTitle(cards);
  if (uniqueCards.length === 0) {
    return [];
  }

  const factsByTitle = await loadFacts(uniqueCards, deps);
  const stage = await loadClassStage(factsByTitle, deps);

  return uniqueCards.map((card) => buildResult(card, factsByTitle.get(card.title), stage));
}
