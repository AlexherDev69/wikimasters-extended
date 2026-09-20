import type { Logger } from '../../../core/logger/logger';
import type { CategorizationCacheMaintenance } from '../../categorization/domain/ports';
import type { LegacyIndexData } from '../domain/legacy-index-data';
import type { StorageStats } from '../domain/storage-stats';
import {
  isClearCategorizationCacheRequest,
  isGetStorageStatsRequest,
  isRemoveLegacyIndexDataRequest,
  STORAGE_UNAVAILABLE_ERROR,
  type ClearCategorizationCacheResponse,
  type RemoveLegacyIndexDataResponse,
  type StorageErrorResponse,
  type StorageStatsResponse,
} from './storage-messages';

export type StorageMessageResponse =
  | StorageStatsResponse
  | ClearCategorizationCacheResponse
  | RemoveLegacyIndexDataResponse
  | StorageErrorResponse;

type SendStorageResponse = (response: StorageMessageResponse) => void;

export type StorageMessageHandler = (
  message: unknown,
  sendResponse: SendStorageResponse,
) => boolean;

export interface StorageMessageDeps {
  /** Counting and emptying only: reading a cache entry is not needed here. */
  cacheMaintenance: CategorizationCacheMaintenance;
  /** What an upgraded installation still holds of the removed index. */
  legacyIndexData: LegacyIndexData;
  logger: Logger;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Runs `task` and answers with its result. A rejection is logged and answered
 * with an error shape: the options page must never be left waiting for a
 * response that will not come.
 *
 * The rejection handler is the second argument of `then` and not a `catch`
 * after it: a `catch` would also run when `sendResponse` itself throws, and
 * answer a second time for an operation that had succeeded.
 */
function answer(
  task: () => Promise<StorageMessageResponse>,
  sendResponse: SendStorageResponse,
  logger: Logger,
): boolean {
  void task().then(sendResponse, (error: unknown) => {
    logger.error('Storage maintenance message failed', { error: toErrorMessage(error) });
    sendResponse({ error: STORAGE_UNAVAILABLE_ERROR });
  });

  return true;
}

/** Everything the section of the options page shows, read in one go. */
async function readStats(deps: StorageMessageDeps): Promise<StorageStats> {
  const [cache, hasLegacyIndexData] = await Promise.all([
    deps.cacheMaintenance.countEntries(),
    deps.legacyIndexData.isPresent(),
  ]);

  return {
    cardFacts: cache.cardFacts,
    classTargets: cache.classTargets,
    hasLegacyIndexData,
  };
}

/**
 * Handles the three maintenance messages of the options page. Returns true so
 * the caller keeps the message channel open, and false for a message of
 * another feature, which is simply ignored.
 *
 * Kept out of the entrypoint so it can be unit-tested.
 */
export function createStorageMessageHandler(deps: StorageMessageDeps): StorageMessageHandler {
  return function handleStorageMessage(
    message: unknown,
    sendResponse: SendStorageResponse,
  ): boolean {
    if (isGetStorageStatsRequest(message)) {
      return answer(async () => ({ stats: await readStats(deps) }), sendResponse, deps.logger);
    }

    if (isClearCategorizationCacheRequest(message)) {
      // The settings, the keys of the old index and the host cooldowns are
      // stored under other prefixes, which this maintenance does not touch.
      return answer(
        async () => {
          await deps.cacheMaintenance.clear();
          return { cleared: true };
        },
        sendResponse,
        deps.logger,
      );
    }

    if (isRemoveLegacyIndexDataRequest(message)) {
      // The other way around: exactly the two keys of the removed index, and
      // neither level of the cache.
      return answer(
        async () => {
          await deps.legacyIndexData.remove();
          return { removed: true };
        },
        sendResponse,
        deps.logger,
      );
    }
    return false;
  };
}
