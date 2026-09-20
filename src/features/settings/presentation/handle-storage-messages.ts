import type { Logger } from '../../../core/logger/logger';
import type { CategorizationCacheMaintenance } from '../../categorization/domain/ports';
import type { CollectionIndexRepository } from '../../collection-index/domain/collection-index';
import type { StorageStats } from '../domain/storage-stats';
import {
  isClearCategorizationCacheRequest,
  isGetStorageStatsRequest,
  STORAGE_UNAVAILABLE_ERROR,
  type ClearCategorizationCacheResponse,
  type StorageErrorResponse,
  type StorageStatsResponse,
} from './storage-messages';

export type StorageMessageResponse =
  | StorageStatsResponse
  | ClearCategorizationCacheResponse
  | StorageErrorResponse;

type SendStorageResponse = (response: StorageMessageResponse) => void;

export type StorageMessageHandler = (
  message: unknown,
  sendResponse: SendStorageResponse,
) => boolean;

export interface StorageMessageDeps {
  /** Counting and emptying only: reading a cache entry is not needed here. */
  cacheMaintenance: CategorizationCacheMaintenance;
  /** Only read, and only for its size: the popup owns its reset. */
  indexRepository: CollectionIndexRepository;
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

/** The three counts, read together: they are shown together. */
async function readStats(deps: StorageMessageDeps): Promise<StorageStats> {
  const [cache, index] = await Promise.all([
    deps.cacheMaintenance.countEntries(),
    deps.indexRepository.read(),
  ]);

  return {
    cardFacts: cache.cardFacts,
    classTargets: cache.classTargets,
    collectionCards: index.size,
  };
}

/**
 * Handles the two maintenance messages of the options page. Returns true so
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
      // The settings, the collection index and the host cooldowns are stored
      // under other prefixes, which this maintenance does not touch.
      return answer(
        async () => {
          await deps.cacheMaintenance.clear();
          return { cleared: true };
        },
        sendResponse,
        deps.logger,
      );
    }
    return false;
  };
}
