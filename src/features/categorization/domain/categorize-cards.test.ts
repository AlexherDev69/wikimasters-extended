/**
 * The stages that turn a title into a category: the titles resolved against
 * frwiki, the facts fetched from Wikidata, the class roots that elect a
 * category, the caches that spare a second request, and what each of those
 * stages answers when it fails.
 *
 * The seam: the golden set of 100 real cards drives these stages and never
 * reaches the one that resolves a picture, which `categorize-cards.images`
 * drives on its own over the stub card of
 * `tests/helpers/categorize-cards-deps.ts`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
import { isNullableString, isRecord } from '../../../core/types/guards';
import { createThumbnailUrlCache } from '../../missing-image/data/thumbnail-cache';
import { createThumbnailUrlResolver } from '../../missing-image/data/thumbnail-resolver';
import { createCardFactsCache } from '../data/card-facts-cache';
import { createClassRootsSource } from '../data/class-roots-source';
import { createClassTargetCache } from '../data/class-target-cache';
import { createEntityFactsSource } from '../data/entity-facts-source';
import { createTitleResolver } from '../data/title-resolver';
import { CATEGORY_ROOT_GROUPS } from './category-roots';
import {
  categorizeCards,
  type CardToCategorize,
  type CategorizeCardsDeps,
} from './categorize-cards';
import {
  FILM_ROOT_IDS,
  resolveLetterboxdCardLink,
} from '../../letterboxd/domain/letterboxd-card-link';
import {
  byTitle,
  emptyArticleImageSource,
  makeLogger,
  makeStubDeps,
  STUB_CARD,
  STUB_INSTANCE_CLASS_ID,
  STUB_PARENT_CLASS_ID,
  SYSTEM_CLOCK,
  WITH_IMAGE_URLS,
} from '../../../../tests/helpers/categorize-cards-deps';

/** One of the 100 real cards of the golden set, as the site shows it. */
function parseGoldenCard(raw: unknown): CardToCategorize {
  if (!isRecord(raw) || typeof raw['title'] !== 'string') {
    throw new Error('Unexpected golden card shape');
  }
  const description = raw['description'];

  return {
    title: raw['title'],
    description: typeof description === 'string' ? description : null,
  };
}

function readGoldenCards(): CardToCategorize[] {
  const raw = readFixture('golden-cards.json');
  if (!Array.isArray(raw)) {
    throw new Error('Unexpected golden card shape');
  }
  return raw.map(parseGoldenCard);
}

const GOLDEN_CARDS = readGoldenCards();

/** Expected Letterboxd link of those cards, produced independently from the rules. */
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

/** Hard limit of both APIs, so 100 cards always need two rounds of requests. */
const TITLES_PER_REQUEST = 50;

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
    classTargetCache: createClassTargetCache(SYSTEM_CLOCK),
    // Every golden card was recorded before this source existed and has no
    // Wikidata image, so a real one here would send it a request the replay
    // fixtures know nothing about. The dedicated tests below give it their own.
    articleImageSource: emptyArticleImageSource(),
    thumbnailUrlSource: createThumbnailUrlResolver(httpOptions),
    thumbnailUrlCache: createThumbnailUrlCache(SYSTEM_CLOCK),
    resolveCardLink: resolveLetterboxdCardLink,
    logger,
  };
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

describe('categorizeCards', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });


  it('should categorize every card of the golden set', async () => {
    const replay = createReplayFetch();

    const results = await categorizeCards(GOLDEN_CARDS, makeDeps(replay.fetchImpl), WITH_IMAGE_URLS);

    expect(results).toHaveLength(GOLDEN_CARDS.length);
    expect(results.filter((result) => result.status !== 'categorized')).toEqual([]);
  });

  it('should return the expected Letterboxd link of every card of the golden set', async () => {
    const replay = createReplayFetch();

    const results = await categorizeCards(GOLDEN_CARDS, makeDeps(replay.fetchImpl), WITH_IMAGE_URLS);
    const resultByTitle = byTitle(results);

    expect(GOLDEN_LETTERBOXD).toHaveLength(GOLDEN_CARDS.length);
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
      letterboxdUrl: null,
      image: null,
    });
  });

  it('should categorize an entity that has neither class nor parent', async () => {
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

    expect(results[0]?.status).toBe('categorized');
  });

  it('should categorize the card when a parent is unresolved but its classes elect a category', async () => {
    const deps = makeStubDeps(new Map([[STUB_INSTANCE_CLASS_ID, 'living']]));

    const results = await categorizeCards([STUB_CARD], deps, WITH_IMAGE_URLS);

    expect(results[0]?.status).toBe('categorized');
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
    if (cachedCard === undefined) {
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

    expect(resultByTitle.get(cachedCard.title)?.status).toBe('categorized');
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
