import { browser, defineBackground } from '#imports';
import type { FetchJsonOptions } from '../core/http/fetch-json';
import { createLogger } from '../core/logger/logger';
import { createStoredCooldownStore } from '../core/storage/cooldown-store';
import { createCardFactsCache } from '../features/categorization/data/card-facts-cache';
import { createCategorizationStorage } from '../features/categorization/data/categorization-storage';
import { createClassRootsSource } from '../features/categorization/data/class-roots-source';
import { createClassTargetCache } from '../features/categorization/data/class-target-cache';
import { createEntityFactsSource } from '../features/categorization/data/entity-facts-source';
import { createTitleResolver } from '../features/categorization/data/title-resolver';
import type { CategorizeCardsDeps } from '../features/categorization/domain/categorize-cards';
import type { Clock } from '../features/categorization/domain/ports';
import { createCategorizeMessageHandler } from '../features/categorization/presentation/handle-categorize-message';
import { createLegacyIndexStorage } from '../features/settings/data/legacy-index-storage';
import { createActionClickHandler } from '../features/settings/presentation/handle-action-click';
import { createStorageMessageHandler } from '../features/settings/presentation/handle-storage-messages';

const systemClock: Clock = {
  now(): number {
    return Date.now();
  },
};

export default defineBackground({
  type: 'module',
  main(): void {
    // Shared by every source so that one rate limited host pauses the whole
    // pipeline, and keeps pausing it after the worker has been restarted.
    const httpOptions: FetchJsonOptions = { cooldownStore: createStoredCooldownStore() };
    const logger = createLogger('background');

    const deps: CategorizeCardsDeps = {
      titleResolver: createTitleResolver(httpOptions),
      entityFactsSource: createEntityFactsSource(httpOptions),
      classRootsSource: createClassRootsSource(httpOptions),
      cardFactsCache: createCardFactsCache(systemClock),
      classTargetCache: createClassTargetCache(),
      logger,
    };
    const handleCategorize = createCategorizeMessageHandler(deps);
    // The maintenance of the options page receives the counting and emptying
    // side of the caches only, never the one that reads or writes an entry.
    const handleStorage = createStorageMessageHandler({
      cacheMaintenance: createCategorizationStorage(),
      legacyIndexData: createLegacyIndexStorage(),
      logger,
    });

    browser.runtime.onMessage.addListener((message, _sender, sendResponse): boolean => {
      // Each handler answers the message types it knows and returns false for
      // the others, so a message of another origin is simply ignored.
      return handleCategorize(message, sendResponse) || handleStorage(message, sendResponse);
    });

    // The toolbar button has no popup: a click opens the options page, which
    // is the only window the extension has left.
    browser.action.onClicked.addListener(
      createActionClickHandler(() => browser.runtime.openOptionsPage(), logger),
    );
  },
});
