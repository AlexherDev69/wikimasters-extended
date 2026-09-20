import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '#imports';
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
import {
  createThumbnailUrlCache,
  THUMBNAIL_URL_KEY_PREFIX,
} from '../../missing-image/data/thumbnail-cache';
import { createThumbnailUrlResolver } from '../../missing-image/data/thumbnail-resolver';
import type { CommonsFile } from '../../missing-image/domain/card-image';
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
  type CategorizeCardsOptions,
} from './categorize-cards';
import type { EntityFacts } from './entity-facts';
import type {
  ArticleImageSource,
  CachedCardFacts,
  ClassResolution,
  Clock,
  ThumbnailUrlCache,
  ThumbnailUrlSource,
  TitleResolver,
} from './ports';

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
    // Every golden card was recorded before this source existed and has no
    // Wikidata image, so a real one here would send it a request the replay
    // fixtures know nothing about. The dedicated tests below give it their own.
    articleImageSource: emptyArticleImageSource(),
    thumbnailUrlSource: createThumbnailUrlResolver(httpOptions),
    thumbnailUrlCache: createThumbnailUrlCache(SYSTEM_CLOCK),
    logger,
  };
}

interface FakeArticleImageSource extends ArticleImageSource {
  /** Every batch of titles this fake was asked about, in call order. */
  calls: string[][];
}

/** An answer that never resolves anything: every title stays unknown, exactly like a truncated batch. */
function emptyArticleImageSource(): ArticleImageSource {
  return {
    findArticleImages: (): Promise<Map<string, CommonsFile | null>> => Promise.resolve(new Map()),
  };
}

/**
 * Answers only for the titles present in `definiteAnswers`, a file or an
 * explicit null: a requested title absent from it is left out of the answer
 * altogether, exactly as the real source leaves a title MediaWiki's
 * continuation cut off.
 */
function fakeArticleImageSource(
  definiteAnswers: ReadonlyMap<string, CommonsFile | null>,
): FakeArticleImageSource {
  const calls: string[][] = [];
  return {
    calls,
    findArticleImages(titles: readonly string[]): Promise<Map<string, CommonsFile | null>> {
      calls.push([...titles]);
      const resolved = new Map<string, CommonsFile | null>();
      for (const title of titles) {
        if (definiteAnswers.has(title)) {
          resolved.set(title, definiteAnswers.get(title) ?? null);
        }
      }
      return Promise.resolve(resolved);
    },
  };
}

function failingArticleImageSource(error: Error): ArticleImageSource {
  return {
    findArticleImages: (): Promise<Map<string, CommonsFile | null>> => Promise.reject(error),
  };
}

/** Where the Wikimedia thumbnail servers answer from, and nowhere else. */
const THUMBNAIL_ORIGIN = 'https://upload.wikimedia.org/';

/** The addresses stored on this machine right now, whatever they say. */
async function imageCacheKeys(): Promise<string[]> {
  const snapshot = await storage.snapshot('local');
  return Object.keys(snapshot).filter((key) => key.startsWith(THUMBNAIL_URL_KEY_PREFIX));
}

/** What the content script asks for while the missing images feature is on. */
const WITH_IMAGE_URLS: CategorizeCardsOptions = { resolveImageUrls: true };

/** And what it asks for once the user has switched that feature off. */
const WITHOUT_IMAGE_URLS: CategorizeCardsOptions = { resolveImageUrls: false };

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
  image: null,
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
    articleImageSource: emptyArticleImageSource(),
    // The stub card has no image, so this stage is never reached.
    thumbnailUrlSource: emptyThumbnailUrlSource(),
    thumbnailUrlCache: emptyThumbnailUrlCache(),
    logger: makeLogger(),
  };
}

/**
 * A picture for the stub card. The recording of the entity facts was made
 * before the image properties were part of the query, so no card of the golden
 * set carries one: the stage that resolves addresses is exercised here instead,
 * with the real resolver and the real cache over a controlled answer.
 */
const STUB_IMAGE: EntityFacts['image'] = {
  fileName: 'Gallus gallus domesticus.jpg',
  kind: 'picture',
};

/** Both classes of the stub card resolved, so it is categorized whatever happens next. */
const STUB_CLASSES_RESOLVED = new Map<string, CategoryId | null>([
  [STUB_INSTANCE_CLASS_ID, 'living'],
  [STUB_PARENT_CLASS_ID, 'living'],
]);

function makeImageDeps(
  fetchImpl: FetchLike,
  image: EntityFacts['image'],
  logger: Logger = makeLogger(),
): CategorizeCardsDeps {
  const httpOptions: FetchJsonOptions = {
    fetchImpl,
    sleep: (): Promise<void> => Promise.resolve(),
    cooldownStore: createMemoryCooldownStore(),
  };

  return {
    ...makeStubDeps(STUB_CLASSES_RESOLVED),
    entityFactsSource: {
      fetchFacts: (): Promise<Map<string, EntityFacts>> =>
        Promise.resolve(new Map([[STUB_QID, { ...STUB_FACTS, image }]])),
    },
    thumbnailUrlSource: createThumbnailUrlResolver(httpOptions),
    thumbnailUrlCache: createThumbnailUrlCache(SYSTEM_CLOCK),
    logger,
  };
}

function emptyThumbnailUrlSource(): ThumbnailUrlSource {
  return {
    resolveThumbnailUrls: (): Promise<Map<string, string | null>> => Promise.resolve(new Map()),
  };
}

function emptyThumbnailUrlCache(): ThumbnailUrlCache {
  return {
    getFresh: (): Promise<Map<string, string | null>> => Promise.resolve(new Map()),
    putMany: (): Promise<void> => Promise.resolve(),
  };
}

describe('categorizeCards', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should return the expected category of every card of the golden set', async () => {
    const replay = createReplayFetch();

    const results = await categorizeCards(GOLDEN_CARDS, makeDeps(replay.fetchImpl), WITH_IMAGE_URLS);
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

    const results = await categorizeCards(GOLDEN_CARDS, makeDeps(replay.fetchImpl), WITH_IMAGE_URLS);
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

    await categorizeCards(
      GOLDEN_CARDS.slice(0, TITLES_PER_REQUEST),
      makeDeps(replay.fetchImpl),
      WITH_IMAGE_URLS,
    );

    expect(replay.countOf('frwiki')).toBe(1);
    expect(replay.countOf('entity-facts')).toBe(1);
  });

  it('should perform two requests of each kind for 100 unknown cards', async () => {
    const replay = createReplayFetch();

    await categorizeCards(GOLDEN_CARDS, makeDeps(replay.fetchImpl), WITH_IMAGE_URLS);

    expect(GOLDEN_CARDS).toHaveLength(2 * TITLES_PER_REQUEST);
    expect(replay.countOf('frwiki')).toBe(2);
    expect(replay.countOf('entity-facts')).toBe(2);
  });

  it('should perform no request at all on a second identical call', async () => {
    const firstReplay = createReplayFetch();
    await categorizeCards(GOLDEN_CARDS, makeDeps(firstReplay.fetchImpl), WITH_IMAGE_URLS);

    const secondReplay = createReplayFetch();
    const results = await categorizeCards(
      GOLDEN_CARDS,
      makeDeps(secondReplay.fetchImpl),
      WITH_IMAGE_URLS,
    );

    expect(secondReplay.calls).toHaveLength(0);
    expect(results.every((result) => result.status === 'categorized')).toBe(true);
  });

  it('should return not_found when the article does not exist', async () => {
    const replay = createReplayFetch();

    const results = await categorizeCards(
      [{ title: MISSING_TITLE, description: null }],
      makeDeps(replay.fetchImpl),
      WITH_IMAGE_URLS,
    );

    expect(results[0]).toEqual({
      title: MISSING_TITLE,
      status: 'not_found',
      qid: null,
      categoryId: null,
      primarySubtype: null,
      personSubtypes: [],
      letterboxdUrl: null,
      image: null,
    });
  });

  it('should return other when the entity has neither class nor parent', async () => {
    const card = GOLDEN_CARDS[0];
    if (card === undefined) {
      throw new Error('The golden set is empty');
    }
    const replay = createReplayFetch();

    const results = await categorizeCards(
      [card],
      makeDeps(factlessEntityFetch(replay)),
      WITH_IMAGE_URLS,
    );

    expect(results[0]).toMatchObject({
      status: 'categorized',
      categoryId: 'other',
      primarySubtype: null,
      personSubtypes: [],
    });
  });

  it('should categorize the card when a parent is unresolved but its classes elect a category', async () => {
    const deps = makeStubDeps(new Map([[STUB_INSTANCE_CLASS_ID, 'living']]));

    const results = await categorizeCards([STUB_CARD], deps, WITH_IMAGE_URLS);

    expect(results[0]).toMatchObject({ status: 'categorized', categoryId: 'living' });
  });

  it('should report an error when a parent is unresolved and the classes elect nobody', async () => {
    const deps = makeStubDeps(new Map([[STUB_INSTANCE_CLASS_ID, null]]));

    const results = await categorizeCards([STUB_CARD], deps, WITH_IMAGE_URLS);

    expect(results[0]?.status).toBe('error');
  });

  it('should report an error when one of the P31 classes is unresolved', async () => {
    const deps = makeStubDeps(new Map([[STUB_PARENT_CLASS_ID, 'living']]));

    const results = await categorizeCards([STUB_CARD], deps, WITH_IMAGE_URLS);

    expect(results[0]?.status).toBe('error');
  });

  it('should still categorize a cached card when the request of the other cards fails', async () => {
    const cachedCard = GOLDEN_CARDS[0];
    const expected = GOLDEN_EXPECTATIONS[0];
    if (cachedCard === undefined || expected === undefined) {
      throw new Error('The golden set is empty');
    }

    const replay = createReplayFetch();
    await categorizeCards([cachedCard], makeDeps(replay.fetchImpl), WITH_IMAGE_URLS);

    const logger = makeLogger();
    const failingFetch: FetchLike = () => Promise.reject(new Error('network down'));
    const results = await categorizeCards(
      [cachedCard, { title: MISSING_TITLE, description: null }],
      makeDeps(failingFetch, logger),
      WITH_IMAGE_URLS,
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

    const results = await categorizeCards([card, card], makeDeps(replay.fetchImpl), WITH_IMAGE_URLS);

    expect(results).toHaveLength(1);
  });

  it('should return nothing and perform no request when there is no card', async () => {
    const replay = createReplayFetch();

    const results = await categorizeCards([], makeDeps(replay.fetchImpl), WITH_IMAGE_URLS);

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

  it('should resolve the address of the picture of a card that has one', async () => {
    const replay = createReplayFetch();

    const results = await categorizeCards(
      [STUB_CARD],
      makeImageDeps(replay.fetchImpl, STUB_IMAGE),
      WITH_IMAGE_URLS,
    );

    expect(results[0]?.status).toBe('categorized');
    expect(results[0]?.image?.fileName).toBe(STUB_IMAGE?.fileName);
    const thumbnailUrl = results[0]?.image?.thumbnailUrl ?? '';
    expect(thumbnailUrl.startsWith(THUMBNAIL_ORIGIN)).toBe(true);
    expect(thumbnailUrl).toContain(encodeURIComponent(STUB_IMAGE?.fileName ?? ''));
    expect(replay.countOf('frwiki-images')).toBe(1);
  });

  it('should perform no request for the addresses when no card has a picture', async () => {
    const replay = createReplayFetch();

    const results = await categorizeCards(
      [STUB_CARD],
      makeImageDeps(replay.fetchImpl, null),
      WITH_IMAGE_URLS,
    );

    expect(results[0]?.image).toBeNull();
    expect(replay.calls).toHaveLength(0);
  });

  it('should perform no request for the addresses when the images are switched off', async () => {
    const replay = createReplayFetch();

    const results = await categorizeCards(
      [STUB_CARD],
      makeImageDeps(replay.fetchImpl, STUB_IMAGE),
      WITHOUT_IMAGE_URLS,
    );

    // The card keeps its category and its picture: only the address of that
    // picture is left unresolved, because nothing on the page would draw it.
    expect(results[0]?.status).toBe('categorized');
    expect(results[0]?.image?.fileName).toBe(STUB_IMAGE?.fileName);
    expect(results[0]?.image?.thumbnailUrl).toBeNull();
    expect(replay.countOf('frwiki-images')).toBe(0);
    // And nothing was written for it either: a feature that is off fills no
    // storage of its own.
    expect(await imageCacheKeys()).toHaveLength(0);
  });

  it('should perform no request for an address that is already cached', async () => {
    const firstReplay = createReplayFetch();
    await categorizeCards(
      [STUB_CARD],
      makeImageDeps(firstReplay.fetchImpl, STUB_IMAGE),
      WITH_IMAGE_URLS,
    );
    expect(firstReplay.countOf('frwiki-images')).toBe(1);

    const secondReplay = createReplayFetch();
    const results = await categorizeCards(
      [STUB_CARD],
      makeImageDeps(secondReplay.fetchImpl, STUB_IMAGE),
      WITH_IMAGE_URLS,
    );

    expect(secondReplay.countOf('frwiki-images')).toBe(0);
    // And the address is still there, read back from the cache.
    expect(results[0]?.image?.thumbnailUrl?.startsWith(THUMBNAIL_ORIGIN)).toBe(true);
  });

  it('should keep the card categorized and warn when the address cannot be resolved', async () => {
    const logger = makeLogger();
    const failingFetch: FetchLike = () => Promise.reject(new Error('imageinfo unavailable'));

    const results = await categorizeCards(
      [STUB_CARD],
      makeImageDeps(failingFetch, STUB_IMAGE, logger),
      WITH_IMAGE_URLS,
    );

    // Categorized, with its picture, and simply without a resolved address:
    // the content script then builds the slower one itself.
    expect(results[0]?.status).toBe('categorized');
    expect(results[0]?.categoryId).toBe('living');
    expect(results[0]?.image?.fileName).toBe(STUB_IMAGE?.fileName);
    expect(results[0]?.image?.thumbnailUrl).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'Thumbnail request failed',
      expect.objectContaining({ error: 'imageinfo unavailable' }),
    );
  });

  it('should keep the card categorized and warn when the address cache cannot be read', async () => {
    const logger = makeLogger();
    const replay = createReplayFetch();
    const deps: CategorizeCardsDeps = {
      ...makeImageDeps(replay.fetchImpl, STUB_IMAGE, logger),
      thumbnailUrlCache: {
        getFresh: (): Promise<Map<string, string | null>> =>
          Promise.reject(new Error('storage unavailable')),
        putMany: (): Promise<void> => Promise.resolve(),
      },
    };

    const results = await categorizeCards([STUB_CARD], deps, WITH_IMAGE_URLS);

    // The cache is a shortcut and nothing else: an unreadable one costs one
    // request, never the address and certainly never the category.
    expect(results[0]?.status).toBe('categorized');
    expect(results[0]?.image?.thumbnailUrl?.startsWith(THUMBNAIL_ORIGIN)).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      'Thumbnail cache read failed',
      expect.objectContaining({ error: 'storage unavailable' }),
    );
  });

  it('should keep the card categorized and warn when the address cannot be stored', async () => {
    const logger = makeLogger();
    const replay = createReplayFetch();
    const deps: CategorizeCardsDeps = {
      ...makeImageDeps(replay.fetchImpl, STUB_IMAGE, logger),
      thumbnailUrlCache: {
        getFresh: (): Promise<Map<string, string | null>> => Promise.resolve(new Map()),
        putMany: (): Promise<void> => Promise.reject(new Error('quota exceeded')),
      },
    };

    const results = await categorizeCards([STUB_CARD], deps, WITH_IMAGE_URLS);

    // A full local storage is the likely one here, and the address just
    // resolved is delivered anyway: only the next batch pays for it again.
    expect(results[0]?.status).toBe('categorized');
    expect(results[0]?.image?.thumbnailUrl?.startsWith(THUMBNAIL_ORIGIN)).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      'Thumbnail cache write failed',
      expect.objectContaining({ error: 'quota exceeded' }),
    );
  });

  it('should send no request to the article image source when Wikidata already gave an image', async () => {
    const replay = createReplayFetch();
    const articleSource = fakeArticleImageSource(new Map());
    const deps: CategorizeCardsDeps = {
      ...makeImageDeps(replay.fetchImpl, STUB_IMAGE),
      articleImageSource: articleSource,
    };

    const results = await categorizeCards([STUB_CARD], deps, WITH_IMAGE_URLS);

    expect(results[0]?.image?.fileName).toBe(STUB_IMAGE?.fileName);
    expect(articleSource.calls).toHaveLength(0);
  });

  it('should give the card the article file when Wikidata gave it no image', async () => {
    const replay = createReplayFetch();
    const articleImage: CommonsFile = { fileName: 'Poule.jpg', kind: 'picture' };
    const deps: CategorizeCardsDeps = {
      ...makeImageDeps(replay.fetchImpl, null),
      articleImageSource: fakeArticleImageSource(new Map([[STUB_CARD.title, articleImage]])),
    };

    const results = await categorizeCards([STUB_CARD], deps, WITH_IMAGE_URLS);

    expect(results[0]?.status).toBe('categorized');
    expect(results[0]?.image?.fileName).toBe(articleImage.fileName);
    expect(results[0]?.image?.kind).toBe(articleImage.kind);
  });

  it('should keep the card categorized with no image and warn when the article image request fails', async () => {
    const logger = makeLogger();
    const neverCalledFetch: FetchLike = () => {
      throw new Error('the thumbnail stage should not run when no picture was found');
    };
    const deps: CategorizeCardsDeps = {
      ...makeImageDeps(neverCalledFetch, null, logger),
      articleImageSource: failingArticleImageSource(new Error('frwiki unavailable')),
    };

    const results = await categorizeCards([STUB_CARD], deps, WITH_IMAGE_URLS);

    expect(results[0]?.status).toBe('categorized');
    expect(results[0]?.image).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'Article image request failed',
      expect.objectContaining({ error: 'frwiki unavailable' }),
    );
  });

  it('should send no request to the article image source when the images are switched off', async () => {
    const neverCalledFetch: FetchLike = () => {
      throw new Error('no stage of the picture should run while the setting is off');
    };
    const articleImage: CommonsFile = { fileName: 'Poule.jpg', kind: 'picture' };
    const articleSource = fakeArticleImageSource(new Map([[STUB_CARD.title, articleImage]]));
    const deps: CategorizeCardsDeps = {
      ...makeImageDeps(neverCalledFetch, null),
      articleImageSource: articleSource,
    };

    const results = await categorizeCards([STUB_CARD], deps, WITHOUT_IMAGE_URLS);

    expect(results[0]?.image).toBeNull();
    expect(articleSource.calls).toHaveLength(0);
  });

  it('should remember that the article gave no image either, so a later categorization sends no request for it', async () => {
    const firstReplay = createReplayFetch();
    // A definite null for the stub card: the article was checked and it has
    // no matching file, not merely that it was never asked about.
    const firstSource = fakeArticleImageSource(new Map([[STUB_CARD.title, null]]));
    await categorizeCards(
      [STUB_CARD],
      {
        ...makeImageDeps(firstReplay.fetchImpl, null),
        cardFactsCache: createCardFactsCache(SYSTEM_CLOCK),
        articleImageSource: firstSource,
      },
      WITH_IMAGE_URLS,
    );
    expect(firstSource.calls).toHaveLength(1);

    const secondReplay = createReplayFetch();
    const articleImage: CommonsFile = { fileName: 'Poule.jpg', kind: 'picture' };
    const secondSource = fakeArticleImageSource(new Map([[STUB_CARD.title, articleImage]]));
    const results = await categorizeCards(
      [STUB_CARD],
      {
        ...makeImageDeps(secondReplay.fetchImpl, null),
        cardFactsCache: createCardFactsCache(SYSTEM_CLOCK),
        articleImageSource: secondSource,
      },
      WITH_IMAGE_URLS,
    );

    // If the second run asked again it would find an image; it must not ask.
    expect(secondSource.calls).toHaveLength(0);
    expect(results[0]?.image).toBeNull();
  });

  it('should not remember an unresolved answer as tried, so a later categorization asks again', async () => {
    const firstReplay = createReplayFetch();
    // Omits the stub card entirely: unresolved, exactly like a title
    // MediaWiki's continuation left unexamined.
    const firstSource = fakeArticleImageSource(new Map());
    await categorizeCards(
      [STUB_CARD],
      {
        ...makeImageDeps(firstReplay.fetchImpl, null),
        cardFactsCache: createCardFactsCache(SYSTEM_CLOCK),
        articleImageSource: firstSource,
      },
      WITH_IMAGE_URLS,
    );
    expect(firstSource.calls).toHaveLength(1);

    const secondReplay = createReplayFetch();
    const articleImage: CommonsFile = { fileName: 'Poule.jpg', kind: 'picture' };
    const secondSource = fakeArticleImageSource(new Map([[STUB_CARD.title, articleImage]]));
    const results = await categorizeCards(
      [STUB_CARD],
      {
        ...makeImageDeps(secondReplay.fetchImpl, null),
        cardFactsCache: createCardFactsCache(SYSTEM_CLOCK),
        articleImageSource: secondSource,
      },
      WITH_IMAGE_URLS,
    );

    // Nothing was ever confirmed, so the second run asks again and finds it.
    expect(secondSource.calls).toHaveLength(1);
    expect(results[0]?.image?.fileName).toBe(articleImage.fileName);
  });

  it('should ignore an image for a title outside the batch it was asked about', async () => {
    const outOfScopeTitle = 'Un autre titre jamais demande';
    const outOfScopeImage: CommonsFile = { fileName: 'Sans rapport.jpg', kind: 'picture' };
    const misbehavingSource: ArticleImageSource = {
      findArticleImages: (): Promise<Map<string, CommonsFile | null>> =>
        Promise.resolve(new Map([[outOfScopeTitle, outOfScopeImage]])),
    };
    const deps: CategorizeCardsDeps = {
      ...makeImageDeps(() => {
        throw new Error('the thumbnail stage should not run when no picture was found');
      }, null),
      articleImageSource: misbehavingSource,
    };

    const results = await categorizeCards([STUB_CARD], deps, WITH_IMAGE_URLS);

    expect(results[0]?.image).toBeNull();
  });

  it('should ignore an image for a card of the batch it deliberately did not ask about', async () => {
    // The case above is unobservable on its own: a title that is in no card of
    // the batch has no facts to be written into either. This one is the real
    // hole the scope check closes, a card that IS in the batch and was left
    // out of the request on purpose because it was already tried.
    const triedCard: CardToCategorize = { title: 'Poulet', description: null };
    const unwantedImage: CommonsFile = { fileName: 'Poulet.jpg', kind: 'picture' };
    const bothTitlesResolver: TitleResolver = {
      resolveTitles: (): Promise<Map<string, string | null>> =>
        Promise.resolve(
          new Map([
            [STUB_CARD.title, STUB_QID],
            [triedCard.title, STUB_QID],
          ]),
        ),
    };
    const sharedDeps = (source: ArticleImageSource): CategorizeCardsDeps => ({
      ...makeImageDeps(createReplayFetch().fetchImpl, null),
      titleResolver: bothTitlesResolver,
      cardFactsCache: createCardFactsCache(SYSTEM_CLOCK),
      thumbnailUrlSource: emptyThumbnailUrlSource(),
      thumbnailUrlCache: emptyThumbnailUrlCache(),
      articleImageSource: source,
    });

    // First run marks the second card as tried, with a definite "no file".
    await categorizeCards(
      [triedCard],
      sharedDeps(fakeArticleImageSource(new Map([[triedCard.title, null]]))),
      WITH_IMAGE_URLS,
    );

    // Built by hand rather than with the fake above, which only ever answers
    // about the titles it was given: the point here is a source that does not.
    const calls: string[][] = [];
    const misbehavingSource: ArticleImageSource = {
      findArticleImages: (titles: readonly string[]): Promise<Map<string, CommonsFile | null>> => {
        calls.push([...titles]);
        return Promise.resolve(
          new Map<string, CommonsFile | null>([
            [STUB_CARD.title, null],
            [triedCard.title, unwantedImage],
          ]),
        );
      },
    };
    const results = await categorizeCards(
      [STUB_CARD, triedCard],
      sharedDeps(misbehavingSource),
      WITH_IMAGE_URLS,
    );

    // Asked about one card only, and the answer about the other one is dropped
    // rather than shown or written back.
    expect(calls).toEqual([[STUB_CARD.title]]);
    expect(byTitle(results).get(triedCard.title)?.image).toBeNull();
  });

  it('should remember the article image so a later categorization of the same card sends no request for it', async () => {
    const articleImage: CommonsFile = { fileName: 'Poule.jpg', kind: 'picture' };
    const firstReplay = createReplayFetch();
    const firstSource = fakeArticleImageSource(new Map([[STUB_CARD.title, articleImage]]));
    // The stub deps of every other test never write to a real cache: this one
    // does, because the point of the test is exactly what the cache remembers.
    await categorizeCards(
      [STUB_CARD],
      {
        ...makeImageDeps(firstReplay.fetchImpl, null),
        cardFactsCache: createCardFactsCache(SYSTEM_CLOCK),
        articleImageSource: firstSource,
      },
      WITH_IMAGE_URLS,
    );
    expect(firstSource.calls).toHaveLength(1);

    const secondReplay = createReplayFetch();
    // A source that fails would prove the point just as well; an empty one
    // proves it without needing to also assert on a warning that must not fire.
    const secondSource = fakeArticleImageSource(new Map());
    const results = await categorizeCards(
      [STUB_CARD],
      {
        ...makeImageDeps(secondReplay.fetchImpl, null),
        cardFactsCache: createCardFactsCache(SYSTEM_CLOCK),
        articleImageSource: secondSource,
      },
      WITH_IMAGE_URLS,
    );

    expect(secondSource.calls).toHaveLength(0);
    expect(results[0]?.image?.fileName).toBe(articleImage.fileName);
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

    const results = await categorizeCards(
      [card],
      makeDeps(partiallyFailingFetch, logger),
      WITH_IMAGE_URLS,
    );

    expect(results[0]?.status).toBe('error');
    expect(logger.warn).toHaveBeenCalledWith(
      'Class roots request failed',
      expect.objectContaining({ error: 'roots unavailable' }),
    );
  });
});
