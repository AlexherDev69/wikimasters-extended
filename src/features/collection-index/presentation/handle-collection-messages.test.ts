import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from '../../../core/logger/logger';
import type { CategoryId, PersonSubtypeId } from '../../categorization/domain/category';
import type {
  CachedCardFacts,
  CardFactsCache,
  ClassResolution,
  ClassTargetCache,
} from '../../categorization/domain/ports';
import type {
  CollectionIndex,
  CollectionIndexRepository,
  RecordedCard,
} from '../domain/collection-index';
import {
  createCollectionMessageHandler,
  type CollectionMessageResponse,
} from './handle-collection-messages';
import {
  CLEAR_COLLECTION_INDEX_MESSAGE,
  GET_COLLECTION_SUMMARY_MESSAGE,
  INDEX_UNAVAILABLE_ERROR,
  INVALID_REQUEST_ERROR,
  isClearCollectionIndexResponse,
  isCollectionSummaryResponse,
  isRecordCollectionCardsResponse,
  RECORD_COLLECTION_CARDS_MESSAGE,
} from './messages';

const EMPTY_FACTS_CACHE: CardFactsCache = {
  getFresh: (): Promise<Map<string, CachedCardFacts>> => Promise.resolve(new Map()),
  putMany: (): Promise<void> => Promise.resolve(),
};

const EMPTY_CLASS_CACHE: ClassTargetCache = {
  getCategoryTargets: (): Promise<Map<string, ClassResolution<CategoryId>>> =>
    Promise.resolve(new Map()),
  putCategoryTargets: (): Promise<void> => Promise.resolve(),
  getOccupationTargets: (): Promise<Map<string, ClassResolution<PersonSubtypeId>>> =>
    Promise.resolve(new Map()),
  putOccupationTargets: (): Promise<void> => Promise.resolve(),
};

interface FakeRepository extends CollectionIndexRepository {
  recorded: RecordedCard[];
  cleared: boolean;
}

function makeRepository(index: CollectionIndex = new Map()): FakeRepository {
  const recorded: RecordedCard[] = [];
  let cleared = false;

  return {
    recorded,
    get cleared(): boolean {
      return cleared;
    },
    read: (): Promise<CollectionIndex> => Promise.resolve(index),
    upsert: (cards: readonly RecordedCard[]): Promise<void> => {
      recorded.push(...cards);
      return Promise.resolve();
    },
    clear: (): Promise<void> => {
      cleared = true;
      return Promise.resolve();
    },
  };
}

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createCollectionMessageHandler', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = makeLogger();
  });

  function makeHandler(
    repository: CollectionIndexRepository,
  ): ReturnType<typeof createCollectionMessageHandler> {
    return createCollectionMessageHandler({
      indexRepository: repository,
      cardFactsCache: EMPTY_FACTS_CACHE,
      classTargetCache: EMPTY_CLASS_CACHE,
      logger,
    });
  }

  it('should ignore a message of another feature', () => {
    const sendResponse = vi.fn();

    const handled = makeHandler(makeRepository())(
      { type: 'wikimasters-extended:categorize-cards', cards: [] },
      sendResponse,
    );

    expect(handled).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('should record the cards and answer their count when the request is valid', async () => {
    const repository = makeRepository();
    const sendResponse = vi.fn();
    const cards = [{ title: 'Alpha', rarity: 'sr' }];

    const handled = makeHandler(repository)(
      { type: RECORD_COLLECTION_CARDS_MESSAGE, cards },
      sendResponse,
    );

    expect(handled).toBe(true);
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    expect(repository.recorded).toEqual(cards);
    expect(isRecordCollectionCardsResponse(sendResponse.mock.calls[0]?.[0])).toBe(true);
  });

  it('should answer an explicit error when a known message carries an invalid payload', () => {
    const sendResponse = vi.fn();

    const handled = makeHandler(makeRepository())(
      { type: RECORD_COLLECTION_CARDS_MESSAGE, cards: [{ title: 'A|B', rarity: 'c' }] },
      sendResponse,
    );

    expect(handled).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({ error: INVALID_REQUEST_ERROR });
  });

  it('should answer a valid summary when the index is asked for', async () => {
    const sendResponse = vi.fn();

    makeHandler(makeRepository())({ type: GET_COLLECTION_SUMMARY_MESSAGE }, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    expect(isCollectionSummaryResponse(sendResponse.mock.calls[0]?.[0])).toBe(true);
  });

  it('should clear the index and confirm it when the reset is asked for', async () => {
    const repository = makeRepository();
    const sendResponse = vi.fn();

    makeHandler(repository)({ type: CLEAR_COLLECTION_INDEX_MESSAGE }, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    expect(repository.cleared).toBe(true);
    expect(isClearCollectionIndexResponse(sendResponse.mock.calls[0]?.[0])).toBe(true);
  });

  it('should answer an error and log it when the repository fails', async () => {
    const failing: CollectionIndexRepository = {
      read: (): Promise<CollectionIndex> => Promise.reject(new Error('storage down')),
      upsert: (): Promise<void> => Promise.resolve(),
      clear: (): Promise<void> => Promise.resolve(),
    };
    const sendResponse = vi.fn<(response: CollectionMessageResponse) => void>();

    makeHandler(failing)({ type: GET_COLLECTION_SUMMARY_MESSAGE }, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ error: INDEX_UNAVAILABLE_ERROR });
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Collection index message failed',
      expect.objectContaining({ error: 'storage down' }),
    );
  });
});
