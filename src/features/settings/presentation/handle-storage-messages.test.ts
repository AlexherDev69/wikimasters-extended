import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from '../../../core/logger/logger';
import type {
  CategorizationCacheCounts,
  CategorizationCacheMaintenance,
} from '../../categorization/domain/ports';
import type {
  CollectionIndex,
  CollectionIndexRepository,
} from '../../collection-index/domain/collection-index';
import {
  createStorageMessageHandler,
  type StorageMessageDeps,
  type StorageMessageResponse,
} from './handle-storage-messages';
import {
  CLEAR_CATEGORIZATION_CACHE_MESSAGE,
  GET_STORAGE_STATS_MESSAGE,
  isClearCategorizationCacheResponse,
  isStorageStatsResponse,
  STORAGE_UNAVAILABLE_ERROR,
} from './storage-messages';

const SEEN_AT = new Date('2026-02-01T12:00:00.000Z').getTime();

interface FakeMaintenance extends CategorizationCacheMaintenance {
  cleared: boolean;
}

function makeMaintenance(entries: CategorizationCacheCounts): FakeMaintenance {
  let cleared = false;

  return {
    get cleared(): boolean {
      return cleared;
    },
    countEntries: (): Promise<CategorizationCacheCounts> =>
      Promise.resolve(cleared ? { cardFacts: 0, classTargets: 0 } : entries),
    clear: (): Promise<void> => {
      cleared = true;
      return Promise.resolve();
    },
  };
}

function makeIndex(titles: readonly string[]): CollectionIndex {
  return new Map(
    titles.map((title) => [title, { rarity: 'c' as const, firstSeenAt: SEEN_AT, lastSeenAt: SEEN_AT }]),
  );
}

function makeRepository(index: CollectionIndex): CollectionIndexRepository {
  return {
    read: (): Promise<CollectionIndex> => Promise.resolve(index),
    upsert: (): Promise<void> => Promise.resolve(),
    clear: (): Promise<void> => Promise.resolve(),
  };
}

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createStorageMessageHandler', () => {
  let logger: Logger;
  let cacheMaintenance: FakeMaintenance;

  beforeEach(() => {
    logger = makeLogger();
    cacheMaintenance = makeMaintenance({ cardFacts: 12, classTargets: 4 });
  });

  function makeHandler(
    overrides: Partial<StorageMessageDeps> = {},
  ): ReturnType<typeof createStorageMessageHandler> {
    return createStorageMessageHandler({
      cacheMaintenance,
      indexRepository: makeRepository(makeIndex(['Alpha', 'Beta', 'Gamma'])),
      logger,
      ...overrides,
    });
  }

  it('should ignore a message of another feature', () => {
    const sendResponse = vi.fn();

    const handled = makeHandler()(
      { type: 'wikimasters-extended:categorize-cards', cards: [] },
      sendResponse,
    );

    expect(handled).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('should answer the three counts when the stats are asked for', async () => {
    const sendResponse = vi.fn<(response: StorageMessageResponse) => void>();

    const handled = makeHandler()({ type: GET_STORAGE_STATS_MESSAGE }, sendResponse);

    expect(handled).toBe(true);
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    expect(sendResponse).toHaveBeenCalledWith({
      stats: { cardFacts: 12, classTargets: 4, collectionCards: 3 },
    });
    expect(isStorageStatsResponse(sendResponse.mock.calls[0]?.[0])).toBe(true);
  });

  it('should empty both levels of the cache when the clear is asked for', async () => {
    const sendResponse = vi.fn<(response: StorageMessageResponse) => void>();

    makeHandler()({ type: CLEAR_CATEGORIZATION_CACHE_MESSAGE }, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    expect(cacheMaintenance.cleared).toBe(true);
    expect(isClearCategorizationCacheResponse(sendResponse.mock.calls[0]?.[0])).toBe(true);
  });

  it('should leave the collection index alone when the cache is cleared', async () => {
    const repository = makeRepository(makeIndex(['Alpha']));
    const clear = vi.spyOn(repository, 'clear');
    const sendResponse = vi.fn<(response: StorageMessageResponse) => void>();

    makeHandler({ indexRepository: repository })(
      { type: CLEAR_CATEGORIZATION_CACHE_MESSAGE },
      sendResponse,
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    expect(clear).not.toHaveBeenCalled();
  });

  it('should count the index as empty once the cache has been cleared', async () => {
    const handler = makeHandler({ indexRepository: makeRepository(new Map()) });
    const sendResponse = vi.fn<(response: StorageMessageResponse) => void>();

    handler({ type: CLEAR_CATEGORIZATION_CACHE_MESSAGE }, vi.fn());
    await vi.waitFor(() => {
      expect(cacheMaintenance.cleared).toBe(true);
    });
    handler({ type: GET_STORAGE_STATS_MESSAGE }, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        stats: { cardFacts: 0, classTargets: 0, collectionCards: 0 },
      });
    });
  });

  it('should answer an error and log it when a count fails', async () => {
    const failing: CategorizationCacheMaintenance = {
      countEntries: (): Promise<CategorizationCacheCounts> =>
        Promise.reject(new Error('storage down')),
      clear: (): Promise<void> => Promise.resolve(),
    };
    const sendResponse = vi.fn<(response: StorageMessageResponse) => void>();

    makeHandler({ cacheMaintenance: failing })({ type: GET_STORAGE_STATS_MESSAGE }, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ error: STORAGE_UNAVAILABLE_ERROR });
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Storage maintenance message failed',
      expect.objectContaining({ error: 'storage down' }),
    );
  });

  it('should answer an error when the clear fails', async () => {
    const failing: CategorizationCacheMaintenance = {
      countEntries: (): Promise<CategorizationCacheCounts> =>
        Promise.resolve({ cardFacts: 0, classTargets: 0 }),
      clear: (): Promise<void> => Promise.reject(new Error('storage down')),
    };
    const sendResponse = vi.fn<(response: StorageMessageResponse) => void>();

    makeHandler({ cacheMaintenance: failing })(
      { type: CLEAR_CATEGORIZATION_CACHE_MESSAGE },
      sendResponse,
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ error: STORAGE_UNAVAILABLE_ERROR });
    });
  });
});
