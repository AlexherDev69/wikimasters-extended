import { isRecord } from '../../../core/types/guards';
import type { StorageStats } from '../domain/storage-stats';

/**
 * The two maintenance messages of the options page, with a guard for BOTH
 * directions: what the options page sends is untrusted input for the service
 * worker, and its answers are untrusted input for the options page.
 *
 * They live with the settings because the options page is their only caller.
 * The counts they carry are read from the repositories the service worker
 * already owns, so no other feature has to expose anything new.
 *
 * Neither message carries a payload: a known type is therefore either a valid
 * request or not that type at all, and there is no invalid payload to answer.
 */

export const GET_STORAGE_STATS_MESSAGE = 'wikimasters-extended:get-storage-stats';

export const CLEAR_CATEGORIZATION_CACHE_MESSAGE =
  'wikimasters-extended:clear-categorization-cache';

/** Answer to a message of this feature that could not be honoured. */
export const STORAGE_UNAVAILABLE_ERROR = 'storage-unavailable';

export interface GetStorageStatsRequest {
  type: typeof GET_STORAGE_STATS_MESSAGE;
}

export interface StorageStatsResponse {
  stats: StorageStats;
}

export interface ClearCategorizationCacheRequest {
  type: typeof CLEAR_CATEGORIZATION_CACHE_MESSAGE;
}

export interface ClearCategorizationCacheResponse {
  cleared: true;
}

export interface StorageErrorResponse {
  error: string;
}

export function isGetStorageStatsRequest(message: unknown): message is GetStorageStatsRequest {
  return isRecord(message) && message['type'] === GET_STORAGE_STATS_MESSAGE;
}

export function isClearCategorizationCacheRequest(
  message: unknown,
): message is ClearCategorizationCacheRequest {
  return isRecord(message) && message['type'] === CLEAR_CATEGORIZATION_CACHE_MESSAGE;
}

/** Counts travel as whole numbers: nothing else is one of ours. */
function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isStorageStats(value: unknown): value is StorageStats {
  return (
    isRecord(value) &&
    isCount(value['cardFacts']) &&
    isCount(value['classTargets']) &&
    isCount(value['collectionCards'])
  );
}

export function isStorageStatsResponse(message: unknown): message is StorageStatsResponse {
  return isRecord(message) && isStorageStats(message['stats']);
}

export function isClearCategorizationCacheResponse(
  message: unknown,
): message is ClearCategorizationCacheResponse {
  return isRecord(message) && message['cleared'] === true;
}
