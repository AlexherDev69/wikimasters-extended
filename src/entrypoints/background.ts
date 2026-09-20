import { browser, defineBackground } from '#imports';
import type { FetchJsonOptions } from '../core/http/fetch-json';
import { createLogger } from '../core/logger/logger';
import { createStoredCooldownStore } from '../core/storage/cooldown-store';
import { createCardFactsCache } from '../features/categorization/data/card-facts-cache';
import { createClassRootsSource } from '../features/categorization/data/class-roots-source';
import { createClassTargetCache } from '../features/categorization/data/class-target-cache';
import { createEntityFactsSource } from '../features/categorization/data/entity-facts-source';
import { createTitleResolver } from '../features/categorization/data/title-resolver';
import type { CategorizeCardsDeps } from '../features/categorization/domain/categorize-cards';
import type { Clock } from '../features/categorization/domain/ports';
import { createCategorizeMessageHandler } from '../features/categorization/presentation/handle-categorize-message';

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

    const deps: CategorizeCardsDeps = {
      titleResolver: createTitleResolver(httpOptions),
      entityFactsSource: createEntityFactsSource(httpOptions),
      classRootsSource: createClassRootsSource(httpOptions),
      cardFactsCache: createCardFactsCache(systemClock),
      classTargetCache: createClassTargetCache(),
      logger: createLogger('background'),
    };
    const handleMessage = createCategorizeMessageHandler(deps);

    browser.runtime.onMessage.addListener((message, _sender, sendResponse): boolean => {
      return handleMessage(message, sendResponse);
    });
  },
});
