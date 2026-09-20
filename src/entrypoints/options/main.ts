import { browser } from '#imports';
import { createLogger } from '../../core/logger/logger';
import { createSettingsRepository } from '../../features/settings/data/settings-repository';
import type { Settings } from '../../features/settings/domain/settings';
import type { StorageStats } from '../../features/settings/domain/storage-stats';
import { mountOptions } from '../../features/settings/presentation/options-app';
import {
  CLEAR_CATEGORIZATION_CACHE_MESSAGE,
  GET_STORAGE_STATS_MESSAGE,
  isClearCategorizationCacheResponse,
  isRemoveLegacyIndexDataResponse,
  isStorageStatsResponse,
  REMOVE_LEGACY_INDEX_DATA_MESSAGE,
  type ClearCategorizationCacheRequest,
  type GetStorageStatsRequest,
  type RemoveLegacyIndexDataRequest,
} from '../../features/settings/presentation/storage-messages';

const APP_ELEMENT_ID = 'app';

const INVALID_STATS_RESPONSE = 'Unexpected storage stats response';
const INVALID_CLEAR_CACHE_RESPONSE = 'Unexpected clear cache response';
const INVALID_REMOVE_LEGACY_RESPONSE = 'Unexpected legacy index removal response';

/**
 * The three answers cross a process boundary, so they are validated like any
 * other untrusted input: an unexpected one rejects and the page shows its
 * error rather than drawing something made up.
 */
async function readStats(): Promise<StorageStats> {
  const request: GetStorageStatsRequest = { type: GET_STORAGE_STATS_MESSAGE };
  const response: unknown = await browser.runtime.sendMessage(request);

  if (!isStorageStatsResponse(response)) {
    throw new Error(INVALID_STATS_RESPONSE);
  }
  return response.stats;
}

async function clearCategorizationCache(): Promise<void> {
  const request: ClearCategorizationCacheRequest = { type: CLEAR_CATEGORIZATION_CACHE_MESSAGE };
  const response: unknown = await browser.runtime.sendMessage(request);

  if (!isClearCategorizationCacheResponse(response)) {
    throw new Error(INVALID_CLEAR_CACHE_RESPONSE);
  }
}

async function removeLegacyIndexData(): Promise<void> {
  const request: RemoveLegacyIndexDataRequest = { type: REMOVE_LEGACY_INDEX_DATA_MESSAGE };
  const response: unknown = await browser.runtime.sendMessage(request);

  if (!isRemoveLegacyIndexDataResponse(response)) {
    throw new Error(INVALID_REMOVE_LEGACY_RESPONSE);
  }
}

const container = document.getElementById(APP_ELEMENT_ID);
if (container === null) {
  createLogger('options').error('The options page has no container element');
} else {
  // The settings are read and written straight from storage: they are not the
  // business of the service worker, and the tabs of the site follow the change
  // through the watcher of the repository.
  const settingsRepository = createSettingsRepository();

  mountOptions(container, {
    // The strict read: a page that showed the defaults it had not read would
    // write those four switches over the saved ones on the next toggle.
    readSettings: (): Promise<Settings> => settingsRepository.readStrict(),
    writeSettings: (settings: Settings): Promise<void> => settingsRepository.write(settings),
    readStats,
    clearCategorizationCache,
    removeLegacyIndexData,
  });
}
