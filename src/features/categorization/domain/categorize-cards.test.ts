import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  createReplayFetch,
  MISSING_TITLE,
  readFixture,
  type ReplayFetch,
} from '../../../../tests/helpers/wikidata-replay';
import {
  createMemoryCooldownStore,
  type FetchJsonOptions,
  type FetchLike,
} from '../../../core/http/fetch-json';
import type { Logger } from '../../../core/logger/logger';
import { isNullableString, isRecord, isStringArray } from '../../../core/types/guards';
import { createCardFactsCache } from '../data/card-facts-cache';
import { createClassRootsSource } from '../data/class-roots-source';
import { createClassTargetCache } from '../data/class-target-cache';
import { createEntityFactsSource } from '../data/entity-facts-source';
import { createTitleResolver } from '../data/title-resolver';
import type { CardCategory, CategoryId, PersonSubtypeId } from './category';
import { CATEGORY_ROOT_GROUPS } from './category-roots';
import {
  categorizeCards,
  FILM_ROOT_IDS,
  type CardToCategorize,
  type CategorizeCardsDeps,
} from './categorize-cards';
import type { EntityFacts } from './entity-facts';
import type { CachedCardFacts, ClassResolution, Clock } from './ports';

/** Expected output of the 100 real cards, produced independently from the rules. */
interface GoldenEntry {
  title: string;
  description: string | null;
  categoryId: string;
  primarySubtype: string | null;
  personSubtypes: string[];
}

function parseGoldenEntry(raw: unknown): GoldenEntry {
  if (
    !isRecord(raw) ||
    typeof raw['title'] !== 'string' ||
    typeof raw['categoryId'] !== 'string' ||
    !isStringArray(raw['personSubtypes'])
  ) {
    throw new Error('Unexpected golden expectation shape');
  }
  const description = raw['description'];
  const primarySubtype = raw['primarySubtype'];

  return {
    title: raw['title'],
    description: typeof description === 'string' ? description : null,
    categoryId: raw['categoryId'],
    primarySubtype: typeof primarySubtype === 'string' ? primarySubtype : null,
    personSubtypes: raw['personSubtypes'],
  };
}

function readGoldenExpectations(): GoldenEntry[] {
  const raw = readFixture('golden-expectations.json');
  if (!Array.isArray(raw)) {
    throw new Error('Unexpected golden expectation shape');
  }
  return raw.map(parseGoldenEntry);
}

const GOLDEN_EXPECTATIONS = readGoldenExpectations();

/** Expected Letterboxd link of the same cards, produced the same way. */
interface GoldenLetterboxdEntry {
  title: string;
  letterboxdUrl: string | null;
}

function parseGoldenLetterboxdEntry(raw: unknown): GoldenLetterboxdEntry {
  if (
    !isRecord(raw) ||
    typeof raw['title'] !== 'string' ||
    !isNullableString(raw['letterboxdUrl'])
  ) {
    throw new Error('Unexpected golden Letterboxd shape');
  }
  return { title: raw['title'], letterboxdUrl: raw['letterboxdUrl'] };
}

function readGoldenLetterboxd(): GoldenLetterboxdEntry[] {
  const raw = readFixture('golden-letterboxd.json');
  if (!Array.isArray(raw)) {
    throw new Error('Unexpected golden Letterboxd shape');
  }
  return raw.map(parseGoldenLetterboxdEntry);
}

const GOLDEN_LETTERBOXD = readGoldenLetterboxd();

const GOLDEN_CARDS: CardToCategorize[] = GOLDEN_EXPECTATIONS.map((entry) => ({
  title: entry.title,
  description: entry.description,
}));

const SYSTEM_CLOCK: Clock = { now: (): number => Date.now() };

/** Hard limit of both APIs, so 100 cards always need two rounds of requests. */
const TITLES_PER_REQUEST = 50;

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeDeps(fetchImpl: FetchLike, logger: Logger = makeLogger()): CategorizeCardsDeps {
  // The sleep is neutralized so that a retried failure does not slow the test
  // down, and the cooldown store is private so no rate limit can leak from one
  // test to another.
  const httpOptions: FetchJsonOptions = {
    fetchImpl,
    sleep: (): Promise<void> => Promise.resolve(),
    cooldownStore: createMemoryCooldownStore(),
  };

  return {
    titleResolver: createTitleResolver(httpOptions),
    entityFactsSource: createEntityFactsSource(httpOptions),
    classRootsSource: createClassRootsSource(httpOptions),
    cardFactsCache: createCardFactsCache(SYSTEM_CLOCK),
    classTargetCache: createClassTargetCache(),
    logger,
  };
}

function byTitle(results: readonly CardCategory[]): Map<string, CardCategory> {
  return new Map(results.map((result) => [result.title, result]));
}

const HTTP_OK = 200;
const JSON_MEDIA_TYPE = 'application/json';
const ENTITY_URI_PREFIX = 'http://www.wikidata.org/entity/';
const FIRST_ENTITY_VALUE = /wd:(Q[1-9]\d*)/;
const ENTITY_FACTS_MARKER = 'wdt:P31';

/**
 * Serves the recording, except for the facts query which answers one row with
 * no class, no parent and no occupation at all. No such entity exists in the
 * recording, yet the extension must still answer something for it.
 */
function factlessEntityFetch(replay: ReplayFetch): FetchLike {
  return (url, init) => {
    const query = new URLSearchParams(typeof init.body === 'string' ? init.body : '').get('query');
    const qid = query === null ? null : (FIRST_ENTITY_VALUE.exec(query)?.[1] ?? null);
    if (query === null || qid === null || !query.includes(ENTITY_FACTS_MARKER)) {
      return replay.fetchImpl(url, init);
    }

    const row = {
      item: { value: `${ENTITY_URI_PREFIX}${qid}` },
      classes: { value: '' },
      parents: { value: '' },
      occupations: { value: '' },
    };
    return Promise.resolve(
      new Response(JSON.stringify({ head: { vars: [] }, results: { bindings: [row] } }), {
        status: HTTP_OK,
        headers: { 'Content-Type': JSON_MEDIA_TYPE },
      }),
    );
  };
}

/**
 * Real shape of "Gallus gallus domesticus": its P31 classes are resolved from
 * the cache, its P279 parents need the network.
 */
const STUB_CARD: CardToCategorize = { title: 'Poule', description: null };
const STUB_QID = 'Q1';
const STUB_INSTANCE_CLASS_ID = 'Q10';
const STUB_PARENT_CLASS_ID = 'Q11';

const STUB_FACTS: EntityFacts = {
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
    imdbId: null,
    tmdbMovieId: null,
    tmdbPersonId: null,
  },
};

/**
 * Deps whose class target cache answers `cachedTargets` and whose roots source
 * always fails, so exactly the class ids absent from `cachedTargets` end up
 * unresolved. The replay cannot express that: one request carries every id.
 */
function makeStubDeps(cachedTargets: Map<string, CategoryId | null>): CategorizeCardsDeps {
  const categoryResolutions = new Map<string, ClassResolution<CategoryId>>(
    [...cachedTargets].map(([classId, target]) => [
      classId,
      { target, label: null, matchedRootIds: [] },
    ]),
  );

  return {
    titleResolver: {
      resolveTitles: (): Promise<Map<string, string | null>> =>
        Promise.resolve(new Map([[STUB_CARD.title, STUB_QID]])),
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
    logger: makeLogger(),
  };
}

describe('categorizeCards', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should return the expected category of every card of the golden set', async () => {
    const replay = createReplayFetch();

    const results = await categorizeCards(GOLDEN_CARDS, makeDeps(replay.fetchImpl));
    const resultByTitle = byTitle(results);

    expect(results).toHaveLength(GOLDEN_EXPECTATIONS.length);
    for (const expected of GOLDEN_EXPECTATIONS) {
      const actual = resultByTitle.get(expected.title);
      expect({
        title: expected.title,
        status: actual?.status,
        categoryId: actual?.categoryId,
        primarySubtype: actual?.primarySubtype,
        personSubtypes: actual?.personSubtypes,
      }).toEqual({
        title: expected.title,
        status: 'categorized',
        categoryId: expected.categoryId,
        primarySubtype: expected.primarySubtype,
        personSubtypes: expected.personSubtypes,
      });
    }
  });

  it('should return the expected Letterboxd link of every card of the golden set', async () => {
    const replay = createReplayFetch();

    const results = await categorizeCards(GOLDEN_CARDS, makeDeps(replay.fetchImpl));
    const resultByTitle = byTitle(results);

    expect(GOLDEN_LETTERBOXD).toHaveLength(GOLDEN_EXPECTATIONS.length);
    for (const expected of GOLDEN_LETTERBOXD) {
      expect({
        title: expected.title,
        letterboxdUrl: resultByTitle.get(expected.title)?.letterboxdUrl,
      }).toEqual({ title: expected.title, letterboxdUrl: expected.letterboxdUrl });
    }
  });

  it('should perform one frwiki request and one entity facts request for 50 unknown cards', async () => {
    const replay = createReplayFetch();

    await categorizeCards(GOLDEN_CARDS.slice(0, TITLES_PER_REQUEST), makeDeps(replay.fetchImpl));

    expect(replay.countOf('frwiki')).toBe(1);
    expect(replay.countOf('entity-facts')).toBe(1);
  });

  it('should perform two requests of each kind for 100 unknown cards', async () => {
    const replay = createReplayFetch();

    await categorizeCards(GOLDEN_CARDS, makeDeps(replay.fetchImpl));

    expect(GOLDEN_CARDS).toHaveLength(2 * TITLES_PER_REQUEST);
    expect(replay.countOf('frwiki')).toBe(2);
    expect(replay.countOf('entity-facts')).toBe(2);
  });

  it('should perform no request at all on a second identical call', async () => {
    const firstReplay = createReplayFetch();
    await categorizeCards(GOLDEN_CARDS, makeDeps(firstReplay.fetchImpl));

    const secondReplay = createReplayFetch();
    const results = await categorizeCards(GOLDEN_CARDS, makeDeps(secondReplay.fetchImpl));

    expect(secondReplay.calls).toHaveLength(0);
    expect(results.every((result) => result.status === 'categorized')).toBe(true);
  });

  it('should return not_found when the article does not exist', async () => {
    const replay = createReplayFetch();

    const results = await categorizeCards(
      [{ title: MISSING_TITLE, description: null }],
      makeDeps(replay.fetchImpl),
    );

    expect(results[0]).toEqual({
      title: MISSING_TITLE,
      status: 'not_found',
      qid: null,
      categoryId: null,
      primarySubtype: null,
      personSubtypes: [],
      letterboxdUrl: null,
    });
  });

  it('should return other when the entity has neither class nor parent', async () => {
    const card = GOLDEN_CARDS[0];
    if (card === undefined) {
      throw new Error('The golden set is empty');
    }
    const replay = createReplayFetch();

    const results = await categorizeCards([card], makeDeps(factlessEntityFetch(replay)));

    expect(results[0]).toMatchObject({
      status: 'categorized',
      categoryId: 'other',
      primarySubtype: null,
      personSubtypes: [],
    });
  });

  it('should categorize the card when a parent is unresolved but its classes elect a category', async () => {
    const deps = makeStubDeps(new Map([[STUB_INSTANCE_CLASS_ID, 'living']]));

    const results = await categorizeCards([STUB_CARD], deps);

    expect(results[0]).toMatchObject({ status: 'categorized', categoryId: 'living' });
  });

  it('should report an error when a parent is unresolved and the classes elect nobody', async () => {
    const deps = makeStubDeps(new Map([[STUB_INSTANCE_CLASS_ID, null]]));

    const results = await categorizeCards([STUB_CARD], deps);

    expect(results[0]?.status).toBe('error');
  });

  it('should report an error when one of the P31 classes is unresolved', async () => {
    const deps = makeStubDeps(new Map([[STUB_PARENT_CLASS_ID, 'living']]));

    const results = await categorizeCards([STUB_CARD], deps);

    expect(results[0]?.status).toBe('error');
  });

  it('should still categorize a cached card when the request of the other cards fails', async () => {
    const cachedCard = GOLDEN_CARDS[0];
    const expected = GOLDEN_EXPECTATIONS[0];
    if (cachedCard === undefined || expected === undefined) {
      throw new Error('The golden set is empty');
    }

    const replay = createReplayFetch();
    await categorizeCards([cachedCard], makeDeps(replay.fetchImpl));

    const logger = makeLogger();
    const failingFetch: FetchLike = () => Promise.reject(new Error('network down'));
    const results = await categorizeCards(
      [cachedCard, { title: MISSING_TITLE, description: null }],
      makeDeps(failingFetch, logger),
    );
    const resultByTitle = byTitle(results);

    expect(resultByTitle.get(cachedCard.title)).toMatchObject({
      status: 'categorized',
      categoryId: expected.categoryId,
    });
    expect(resultByTitle.get(MISSING_TITLE)?.status).toBe('error');
    expect(logger.warn).toHaveBeenCalledWith(
      'Card facts request failed',
      expect.objectContaining({ error: 'network down' }),
    );
  });

  it('should return one result per distinct title when a title appears twice', async () => {
    const card = GOLDEN_CARDS[0];
    if (card === undefined) {
      throw new Error('The golden set is empty');
    }
    const replay = createReplayFetch();

    const results = await categorizeCards([card, card], makeDeps(replay.fetchImpl));

    expect(results).toHaveLength(1);
  });

  it('should return nothing and perform no request when there is no card', async () => {
    const replay = createReplayFetch();

    const results = await categorizeCards([], makeDeps(replay.fetchImpl));

    expect(results).toEqual([]);
    expect(replay.calls).toHaveLength(0);
  });

  it('should read its film roots from the roots the film_tv group queries', () => {
    // The two lists repeat the same ids: removing one from the group would
    // silently stop every film from getting a link.
    const filmGroups = CATEGORY_ROOT_GROUPS.filter((group) => group.target === 'film_tv');
    const queriedRootIds = new Set(filmGroups.flatMap((group) => [...group.rootIds]));

    expect(FILM_ROOT_IDS.length).toBeGreaterThan(0);
    for (const rootId of FILM_ROOT_IDS) {
      expect(queriedRootIds).toContain(rootId);
    }
  });

  it('should report an error when the class roots request fails for an uncached class', async () => {
    const card = GOLDEN_CARDS[0];
    if (card === undefined) {
      throw new Error('The golden set is empty');
    }
    const replay = createReplayFetch();
    const logger = makeLogger();
    // Only the class roots query fails, the facts of the card are fetched normally.
    const partiallyFailingFetch: FetchLike = (url, init) => {
      const body = typeof init.body === 'string' ? init.body : '';
      const query = new URLSearchParams(body).get('query') ?? '';
      if (query.includes('FILTER(?root IN')) {
        return Promise.reject(new Error('roots unavailable'));
      }
      return replay.fetchImpl(url, init);
    };

    const results = await categorizeCards([card], makeDeps(partiallyFailingFetch, logger));

    expect(results[0]?.status).toBe('error');
    expect(logger.warn).toHaveBeenCalledWith(
      'Class roots request failed',
      expect.objectContaining({ error: 'roots unavailable' }),
    );
  });
});
