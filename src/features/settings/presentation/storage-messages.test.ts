import { describe, it, expect } from 'vitest';
import {
  CLEAR_CATEGORIZATION_CACHE_MESSAGE,
  GET_STORAGE_STATS_MESSAGE,
  isClearCategorizationCacheRequest,
  isClearCategorizationCacheResponse,
  isGetStorageStatsRequest,
  isRemoveLegacyIndexDataRequest,
  isRemoveLegacyIndexDataResponse,
  isStorageStatsResponse,
  REMOVE_LEGACY_INDEX_DATA_MESSAGE,
} from './storage-messages';

const STATS = { cardFacts: 12, classTargets: 4, thumbnailUrls: 7, hasLegacyIndexData: true };

describe('isGetStorageStatsRequest', () => {
  it('should accept the message the options page sends', () => {
    expect(isGetStorageStatsRequest({ type: GET_STORAGE_STATS_MESSAGE })).toBe(true);
  });

  it('should refuse a message of another type', () => {
    expect(isGetStorageStatsRequest({ type: CLEAR_CATEGORIZATION_CACHE_MESSAGE })).toBe(false);
    expect(isGetStorageStatsRequest({ type: 'something-else' })).toBe(false);
  });

  it('should refuse a value that is not a record', () => {
    expect(isGetStorageStatsRequest(null)).toBe(false);
    expect(isGetStorageStatsRequest([GET_STORAGE_STATS_MESSAGE])).toBe(false);
    expect(isGetStorageStatsRequest(GET_STORAGE_STATS_MESSAGE)).toBe(false);
  });
});

describe('isClearCategorizationCacheRequest', () => {
  it('should accept the message the options page sends', () => {
    expect(isClearCategorizationCacheRequest({ type: CLEAR_CATEGORIZATION_CACHE_MESSAGE })).toBe(
      true,
    );
  });

  it('should refuse a message of another type', () => {
    expect(isClearCategorizationCacheRequest({ type: GET_STORAGE_STATS_MESSAGE })).toBe(false);
  });

  it('should refuse a value that is not a record', () => {
    expect(isClearCategorizationCacheRequest(undefined)).toBe(false);
  });
});

describe('isStorageStatsResponse', () => {
  it('should accept an answer carrying the counts and the old data', () => {
    expect(isStorageStatsResponse({ stats: STATS })).toBe(true);
  });

  it('should accept counts at zero and no old data left', () => {
    expect(
      isStorageStatsResponse({
        stats: { cardFacts: 0, classTargets: 0, thumbnailUrls: 0, hasLegacyIndexData: false },
      }),
    ).toBe(true);
  });

  it('should refuse an answer missing one of the counts', () => {
    expect(
      isStorageStatsResponse({ stats: { cardFacts: 1, thumbnailUrls: 0, hasLegacyIndexData: false } }),
    ).toBe(false);
    expect(
      isStorageStatsResponse({ stats: { cardFacts: 1, classTargets: 2, hasLegacyIndexData: false } }),
    ).toBe(false);
  });

  it('should refuse an answer that does not say whether old data is left', () => {
    expect(
      isStorageStatsResponse({ stats: { cardFacts: 1, classTargets: 2, thumbnailUrls: 0 } }),
    ).toBe(false);
    expect(isStorageStatsResponse({ stats: { ...STATS, hasLegacyIndexData: 'true' } })).toBe(false);
  });

  it('should refuse a count that is not a whole positive number', () => {
    expect(isStorageStatsResponse({ stats: { ...STATS, cardFacts: -1 } })).toBe(false);
    expect(isStorageStatsResponse({ stats: { ...STATS, cardFacts: 1.5 } })).toBe(false);
    expect(isStorageStatsResponse({ stats: { ...STATS, cardFacts: '12' } })).toBe(false);
  });

  it('should refuse the error answer of a failing service worker', () => {
    expect(isStorageStatsResponse({ error: 'storage-unavailable' })).toBe(false);
  });

  it('should refuse the answer of a service worker that never woke up', () => {
    expect(isStorageStatsResponse(undefined)).toBe(false);
  });
});

describe('isClearCategorizationCacheResponse', () => {
  it('should accept the confirmation of the service worker', () => {
    expect(isClearCategorizationCacheResponse({ cleared: true })).toBe(true);
  });

  it('should refuse anything else than an explicit confirmation', () => {
    expect(isClearCategorizationCacheResponse({ cleared: false })).toBe(false);
    expect(isClearCategorizationCacheResponse({ cleared: 'true' })).toBe(false);
    expect(isClearCategorizationCacheResponse({ error: 'storage-unavailable' })).toBe(false);
    expect(isClearCategorizationCacheResponse(undefined)).toBe(false);
  });
});

describe('isRemoveLegacyIndexDataRequest', () => {
  it('should accept the message the options page sends', () => {
    expect(isRemoveLegacyIndexDataRequest({ type: REMOVE_LEGACY_INDEX_DATA_MESSAGE })).toBe(true);
  });

  it('should refuse a message of another type', () => {
    expect(isRemoveLegacyIndexDataRequest({ type: CLEAR_CATEGORIZATION_CACHE_MESSAGE })).toBe(
      false,
    );
  });

  it('should refuse a value that is not a record', () => {
    expect(isRemoveLegacyIndexDataRequest(undefined)).toBe(false);
  });
});

describe('isRemoveLegacyIndexDataResponse', () => {
  it('should accept the confirmation of the service worker', () => {
    expect(isRemoveLegacyIndexDataResponse({ removed: true })).toBe(true);
  });

  it('should refuse anything else than an explicit confirmation', () => {
    expect(isRemoveLegacyIndexDataResponse({ removed: false })).toBe(false);
    expect(isRemoveLegacyIndexDataResponse({ cleared: true })).toBe(false);
    expect(isRemoveLegacyIndexDataResponse({ error: 'storage-unavailable' })).toBe(false);
    expect(isRemoveLegacyIndexDataResponse(undefined)).toBe(false);
  });
});
