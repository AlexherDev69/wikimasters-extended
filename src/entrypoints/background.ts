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
import { createCatalogueTotalsRepository } from '../features/collection-index/data/catalogue-totals-repository';
import { createCollectionIndexRepository } from '../features/collection-index/data/collection-index-repository';
import { createCollectionMessageHandler } from '../features/collection-index/presentation/handle-collection-messages';
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
    // The two caches are shared: the summary of the collection reads exactly
    // what the categorization of the cards on screen has written.
    const cardFactsCache = createCardFactsCache(systemClock);
    const classTargetCache = createClassTargetCache();
    // Shared too: the options page counts what the popup summarizes.
    const indexRepository = createCollectionIndexRepository(systemClock);
    // Facts about the game, read on the catalogue page of the site: neither
    // maintenance operation of the options page touches them.
    const catalogueTotalsRepository = createCatalogueTotalsRepository(systemClock);

    const deps: CategorizeCardsDeps = {
      titleResolver: createTitleResolver(httpOptions),
      entityFactsSource: createEntityFactsSource(httpOptions),
      classRootsSource: createClassRootsSource(httpOptions),
      cardFactsCache,
      classTargetCache,
      logger,
    };
    const handleCategorize = createCategorizeMessageHandler(deps);
    const handleCollection = createCollectionMessageHandler({
      indexRepository,
      catalogueTotalsRepository,
      cardFactsCache,
      classTargetCache,
      logger,
    });
    // The maintenance of the options page receives the counting and emptying
    // side of the caches only, never the one that reads or writes an entry.
    const handleStorage = createStorageMessageHandler({
      cacheMaintenance: createCategorizationStorage(),
      indexRepository,
      logger,
    });

    browser.runtime.onMessage.addListener((message, _sender, sendResponse): boolean => {
      // Each handler answers the message types it knows and returns false for
      // the others, so a message of another origin is simply ignored.
      return (
        handleCategorize(message, sendResponse) ||
        handleCollection(message, sendResponse) ||
        handleStorage(message, sendResponse)
      );
    });
  },
});
