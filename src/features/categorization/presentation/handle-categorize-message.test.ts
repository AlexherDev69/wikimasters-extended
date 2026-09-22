import { describe, it, expect, vi } from 'vitest';
import type { Logger } from '../../../core/logger/logger';
import type { CommonsFile } from '../../../core/mediawiki/card-image';
import type { CardCategory } from '../domain/category';
import type { CategorizeCardsDeps } from '../domain/categorize-cards';
import type { CachedCardFacts, ClassResolution } from '../domain/ports';
import { resolveLetterboxdCardLink } from '../../letterboxd/domain/letterboxd-card-link';
import { createCategorizeMessageHandler } from './handle-categorize-message';
import { CATEGORIZE_CARDS_MESSAGE, type CategorizeCardsResponse } from './messages';

const CATEGORIZED_CARD: CardCategory = {
  title: 'Pulp Fiction',
  status: 'categorized',
  qid: 'Q104123',
  // The stubbed facts carry no external id, so the film falls back to a search.
  letterboxdUrl: 'https://letterboxd.com/search/Pulp%20Fiction/',
  image: null,
};

/** Deps that resolve the single test card entirely from the card cache. */
function makeDeps(): CategorizeCardsDeps {
  const cached: CachedCardFacts = {
    status: 'resolved',
    facts: {
      qid: 'Q104123',
      classIds: ['Q11424'],
      parentClassIds: [],
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
    },
    leadImage: null,
    articleImageTried: false,
  };
  const logger: Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  return {
    titleResolver: { resolveTitles: vi.fn() },
    entityFactsSource: { fetchFacts: vi.fn() },
    classRootsSource: {
      resolveCategoryClasses: vi.fn(),
      resolveOccupationClasses: vi.fn(),
    },
    cardFactsCache: {
      getFresh: (): Promise<Map<string, CachedCardFacts>> =>
        Promise.resolve(new Map([['Pulp Fiction', cached]])),
      putMany: (): Promise<void> => Promise.resolve(),
    },
    classTargetCache: {
      getCategoryTargets: (): Promise<Map<string, ClassResolution<'film_tv'>>> =>
        Promise.resolve(
          new Map([['Q11424', { target: 'film_tv', label: null, matchedRootIds: ['Q11424'] }]]),
        ),
      putCategoryTargets: (): Promise<void> => Promise.resolve(),
      getOccupationTargets: (): Promise<Map<string, ClassResolution<never>>> =>
        Promise.resolve(new Map()),
      putOccupationTargets: (): Promise<void> => Promise.resolve(),
    },
    // The test card's Wikidata image is null, so this one is asked and finds
    // nothing either: the thumbnail stage after it is never reached.
    articleImageSource: {
      findArticleImages: (): Promise<Map<string, CommonsFile | null>> => Promise.resolve(new Map()),
    },
    thumbnailUrlSource: { resolveThumbnailUrls: vi.fn() },
    thumbnailUrlCache: { getFresh: vi.fn(), putMany: vi.fn() },
    resolveCardLink: resolveLetterboxdCardLink,
    logger,
  };
}

describe('createCategorizeMessageHandler', () => {
  it('should return true and answer asynchronously for a categorization message', async () => {
    const handler = createCategorizeMessageHandler(makeDeps());
    const sendResponse = vi.fn();

    const handled = handler(
      {
        type: CATEGORIZE_CARDS_MESSAGE,
        cards: [{ title: 'Pulp Fiction', description: null }],
        resolveImageUrls: true,
      },
      sendResponse,
    );

    expect(handled).toBe(true);
    expect(sendResponse).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    const response: CategorizeCardsResponse = { cards: [CATEGORIZED_CARD] };
    expect(sendResponse).toHaveBeenCalledWith(response);
  });

  it('should return false and answer nothing for another message', () => {
    const handler = createCategorizeMessageHandler(makeDeps());
    const sendResponse = vi.fn();

    expect(handler({ type: 'something-else' }, sendResponse)).toBe(false);
    expect(handler(null, sendResponse)).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('should return false for a malformed categorization message', () => {
    const handler = createCategorizeMessageHandler(makeDeps());
    const sendResponse = vi.fn();

    expect(handler({ type: CATEGORIZE_CARDS_MESSAGE, cards: 'nope' }, sendResponse)).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });
});
