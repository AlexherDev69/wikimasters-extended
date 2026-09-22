/**
 * The stage that gives a card its picture: the image Wikidata holds, then the
 * file the article itself leads with, then the picture of the series the card
 * is one edition of, and finally the address of the thumbnail with the cache
 * that spares asking for it twice.
 *
 * The seam: this stage runs after a card has been categorized and never
 * touches the stages before it, so it is driven over the stub card rather than
 * over the golden set that `categorize-cards.test.ts` replays.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createReplayFetch } from '../../../../tests/helpers/wikidata-replay';
import {
  createMemoryCooldownStore,
  type FetchJsonOptions,
  type FetchLike,
} from '../../../core/http/fetch-json';
import type { Logger } from '../../../core/logger/logger';
import type { CommonsFile } from '../../../core/mediawiki/card-image';
import {
  createThumbnailUrlCache,
  THUMBNAIL_URL_KEY_PREFIX,
} from '../../missing-image/data/thumbnail-cache';
import { createThumbnailUrlResolver } from '../../missing-image/data/thumbnail-resolver';
import { resolveLetterboxdCardLink } from '../../letterboxd/domain/letterboxd-card-link';
import { createCardFactsCache } from '../data/card-facts-cache';
import type { CategoryId } from './category';
import {
  categorizeCards,
  type CardToCategorize,
  type CategorizeCardsDeps,
} from './categorize-cards';
import type { EntityFacts } from './entity-facts';
import type { ArticleImageSource, ResolvedTitle, TitleResolver } from './ports';
import {
  byTitle,
  emptyThumbnailUrlCache,
  emptyThumbnailUrlSource,
  makeLogger,
  makeStubDeps,
  STUB_CARD,
  STUB_FACTS,
  STUB_INSTANCE_CLASS_ID,
  STUB_PARENT_CLASS_ID,
  STUB_QID,
  SYSTEM_CLOCK,
  WITH_IMAGE_URLS,
  WITHOUT_IMAGE_URLS,
} from '../../../../tests/helpers/categorize-cards-deps';

interface FakeArticleImageSource extends ArticleImageSource {
  /** Every batch of titles this fake was asked about, in call order. */
  calls: string[][];
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
    resolveCardLink: resolveLetterboxdCardLink,
    logger,
  };
}

/**
 * The same deps, the item of the stub card also carrying the picture of the
 * whole it is one edition of.
 */
function withSeriesImageFacts(
  deps: CategorizeCardsDeps,
  seriesImage: EntityFacts['seriesImage'],
  image: EntityFacts['image'] = null,
): CategorizeCardsDeps {
  return {
    ...deps,
    entityFactsSource: {
      fetchFacts: (): Promise<Map<string, EntityFacts>> =>
        Promise.resolve(new Map([[STUB_QID, { ...STUB_FACTS, image, seriesImage }]])),
    },
  };
}

describe('categorizeCards', () => {
  beforeEach(() => {
    fakeBrowser.reset();
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

  it('should draw the picture the article leads with, rather than the one Wikidata holds', async () => {
    // The site draws that very file. Wikidata may hold several pictures of
    // the same subject and the query answers with one of them without a
    // defined order, so the card could otherwise change picture on its own
    // once its cache entry has expired.
    const replay = createReplayFetch();
    const leadImage: CommonsFile = { fileName: 'Lead picture.jpg', kind: 'picture' };

    const results = await categorizeCards(
      [STUB_CARD],
      {
        ...makeImageDeps(replay.fetchImpl, STUB_IMAGE),
        titleResolver: {
          resolveTitles: (): Promise<Map<string, ResolvedTitle>> =>
            Promise.resolve(new Map([[STUB_CARD.title, { qid: STUB_QID, leadImage }]])),
        },
      },
      WITHOUT_IMAGE_URLS,
    );

    expect(results[0]?.image).toEqual({ ...leadImage, thumbnailUrl: null });
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

  it('should give the card the picture of its series when Wikidata and the article gave none', async () => {
    // "Trophée des champions 2005": the season item holds no picture and
    // its article uses none, while the competition it is one edition of holds
    // a photograph of the trophy (measured 2026-09-21). The article answers a
    // definite null, the answer the common case really carries, and not an
    // empty map, which stands for a title a truncated batch never examined.
    const replay = createReplayFetch();
    const seriesImage: CommonsFile = { fileName: 'Trophée des champions.jpeg', kind: 'picture' };
    const deps = withSeriesImageFacts(
      {
        ...makeImageDeps(replay.fetchImpl, null),
        articleImageSource: fakeArticleImageSource(new Map([[STUB_CARD.title, null]])),
      },
      seriesImage,
    );

    const results = await categorizeCards([STUB_CARD], deps, WITH_IMAGE_URLS);

    expect(results[0]?.status).toBe('categorized');
    expect(results[0]?.image?.fileName).toBe(seriesImage.fileName);
    expect(results[0]?.image?.kind).toBe(seriesImage.kind);
  });

  it('should leave the card without an image when its classes stayed unresolved', async () => {
    // The card is downgraded to `error`, and the image of any status but
    // `categorized` has to stay null: the guard of the message refuses a
    // picture on every other one.
    const deps = withSeriesImageFacts(makeStubDeps(new Map([[STUB_INSTANCE_CLASS_ID, null]])), {
      fileName: 'Grown-ish logo.png',
      kind: 'emblem',
    });

    const results = await categorizeCards([STUB_CARD], deps, WITH_IMAGE_URLS);

    expect(results[0]?.status).toBe('error');
    expect(results[0]?.image).toBeNull();
  });

  it('should prefer the file the article itself uses over the picture of the series', async () => {
    const replay = createReplayFetch();
    const articleImage: CommonsFile = { fileName: 'Poule.jpg', kind: 'picture' };
    const deps = withSeriesImageFacts(
      {
        ...makeImageDeps(replay.fetchImpl, null),
        articleImageSource: fakeArticleImageSource(new Map([[STUB_CARD.title, articleImage]])),
      },
      { fileName: 'Grown-ish logo.png', kind: 'emblem' },
    );

    const results = await categorizeCards([STUB_CARD], deps, WITH_IMAGE_URLS);

    expect(results[0]?.image?.fileName).toBe(articleImage.fileName);
  });

  it('should prefer the picture of the card itself over the picture of its series', async () => {
    const replay = createReplayFetch();
    const articleSource = fakeArticleImageSource(new Map());
    const deps = withSeriesImageFacts(
      { ...makeImageDeps(replay.fetchImpl, null), articleImageSource: articleSource },
      { fileName: 'Grown-ish logo.png', kind: 'emblem' },
      STUB_IMAGE,
    );

    const results = await categorizeCards([STUB_CARD], deps, WITH_IMAGE_URLS);

    expect(results[0]?.image?.fileName).toBe(STUB_IMAGE?.fileName);
    // The card never lost its Wikidata picture, so the article was not asked.
    expect(articleSource.calls).toHaveLength(0);
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
      resolveTitles: (): Promise<Map<string, ResolvedTitle>> =>
        Promise.resolve(
          new Map([
            [STUB_CARD.title, { qid: STUB_QID, leadImage: null }],
            [triedCard.title, { qid: STUB_QID, leadImage: null }],
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
});
