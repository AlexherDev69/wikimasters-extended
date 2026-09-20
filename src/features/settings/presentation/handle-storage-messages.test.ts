import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from '../../../core/logger/logger';
import type {
  CategorizationCacheCounts,
  CategorizationCacheMaintenance,
} from '../../categorization/domain/ports';
import type { LegacyIndexData } from '../domain/legacy-index-data';
import {
  createStorageMessageHandler,
  type StorageMessageDeps,
  type StorageMessageResponse,
} from './handle-storage-messages';
import {
  CLEAR_CATEGORIZATION_CACHE_MESSAGE,
  GET_STORAGE_STATS_MESSAGE,
  isClearCategorizationCacheResponse,
  isRemoveLegacyIndexDataResponse,
  isStorageStatsResponse,
  REMOVE_LEGACY_INDEX_DATA_MESSAGE,
  STORAGE_UNAVAILABLE_ERROR,
} from './storage-messages';

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

interface FakeLegacyData extends LegacyIndexData {
  removed: boolean;
}

function makeLegacyData(present: boolean): FakeLegacyData {
  let removed = false;

  return {
    get removed(): boolean {
      return removed;
    },
    isPresent: (): Promise<boolean> => Promise.resolve(present && !removed),
    remove: (): Promise<void> => {
      removed = true;
      return Promise.resolve();
    },
  };
}

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createStorageMessageHandler', () => {
  let logger: Logger;
  let cacheMaintenance: FakeMaintenance;
  let legacyIndexData: FakeLegacyData;

  beforeEach(() => {
    logger = makeLogger();
    cacheMaintenance = makeMaintenance({ cardFacts: 12, classTargets: 4 });
    legacyIndexData = makeLegacyData(true);
  });

  function makeHandler(
    overrides: Partial<StorageMessageDeps> = {},
  ): ReturnType<typeof createStorageMessageHandler> {
    return createStorageMessageHandler({
      cacheMaintenance,
      legacyIndexData,
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

  it('should answer the counts and the old data when the stats are asked for', async () => {
    const sendResponse = vi.fn<(response: StorageMessageResponse) => void>();

    const handled = makeHandler()({ type: GET_STORAGE_STATS_MESSAGE }, sendResponse);

    expect(handled).toBe(true);
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    expect(sendResponse).toHaveBeenCalledWith({
      stats: { cardFacts: 12, classTargets: 4, hasLegacyIndexData: true },
    });
    expect(isStorageStatsResponse(sendResponse.mock.calls[0]?.[0])).toBe(true);
  });

  it('should say that there is no old data on an installation that holds none', async () => {
    const sendResponse = vi.fn<(response: StorageMessageResponse) => void>();

    makeHandler({ legacyIndexData: makeLegacyData(false) })(
      { type: GET_STORAGE_STATS_MESSAGE },
      sendResponse,
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        stats: { cardFacts: 12, classTargets: 4, hasLegacyIndexData: false },
      });
    });
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

  it('should leave the old index data alone when the cache is cleared', async () => {
    const sendResponse = vi.fn<(response: StorageMessageResponse) => void>();

    makeHandler()({ type: CLEAR_CATEGORIZATION_CACHE_MESSAGE }, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    expect(legacyIndexData.removed).toBe(false);
  });

  it('should remove the old index data when its own removal is asked for', async () => {
    const sendResponse = vi.fn<(response: StorageMessageResponse) => void>();

    const handled = makeHandler()({ type: REMOVE_LEGACY_INDEX_DATA_MESSAGE }, sendResponse);

    expect(handled).toBe(true);
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    expect(legacyIndexData.removed).toBe(true);
    expect(isRemoveLegacyIndexDataResponse(sendResponse.mock.calls[0]?.[0])).toBe(true);
  });

  it('should leave both levels of the cache alone when the old data is removed', async () => {
    const sendResponse = vi.fn<(response: StorageMessageResponse) => void>();

    makeHandler()({ type: REMOVE_LEGACY_INDEX_DATA_MESSAGE }, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    expect(cacheMaintenance.cleared).toBe(false);
  });

  it('should count nothing left once the cache and the old data are gone', async () => {
    const handler = makeHandler();
    const sendResponse = vi.fn<(response: StorageMessageResponse) => void>();

    handler({ type: CLEAR_CATEGORIZATION_CACHE_MESSAGE }, vi.fn());
    handler({ type: REMOVE_LEGACY_INDEX_DATA_MESSAGE }, vi.fn());
    await vi.waitFor(() => {
      expect(cacheMaintenance.cleared).toBe(true);
      expect(legacyIndexData.removed).toBe(true);
    });
    handler({ type: GET_STORAGE_STATS_MESSAGE }, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        stats: { cardFacts: 0, classTargets: 0, hasLegacyIndexData: false },
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

  it('should answer an error when the removal of the old data fails', async () => {
    const failing: LegacyIndexData = {
      isPresent: (): Promise<boolean> => Promise.resolve(true),
      remove: (): Promise<void> => Promise.reject(new Error('storage down')),
    };
    const sendResponse = vi.fn<(response: StorageMessageResponse) => void>();

    makeHandler({ legacyIndexData: failing })(
      { type: REMOVE_LEGACY_INDEX_DATA_MESSAGE },
      sendResponse,
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ error: STORAGE_UNAVAILABLE_ERROR });
    });
  });
});
