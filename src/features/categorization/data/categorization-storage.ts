import { listLocalKeys, removeLocalKeys } from '../../../core/storage/local-keys';
import type {
  CategorizationCacheCounts,
  CategorizationCacheMaintenance,
} from '../domain/ports';
import { CARD_FACTS_KEY_PREFIX } from './card-facts-cache';
import { CLASS_TARGET_KEY_PREFIX } from './class-target-cache';

/**
 * Maintenance of the two levels of the categorization cache. Both spread over
 * one key per entry under a prefix of their own, so counting or emptying them
 * means listing the area and filtering: doing it here rather than in each cache
 * lists the area once per operation instead of twice.
 */
const CACHE_PREFIXES: readonly string[] = [CARD_FACTS_KEY_PREFIX, CLASS_TARGET_KEY_PREFIX];

function belongsToCache(key: string): boolean {
  return CACHE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function createCategorizationStorage(): CategorizationCacheMaintenance {
  return {
    async countEntries(): Promise<CategorizationCacheCounts> {
      const keys = await listLocalKeys();
      return {
        cardFacts: keys.filter((key) => key.startsWith(CARD_FACTS_KEY_PREFIX)).length,
        classTargets: keys.filter((key) => key.startsWith(CLASS_TARGET_KEY_PREFIX)).length,
      };
    },

    async clear(): Promise<void> {
      // Only the keys of these two prefixes: the settings, the host cooldowns
      // and what an old index left behind are none of its business.
      const keys = await listLocalKeys();
      await removeLocalKeys(keys.filter(belongsToCache));
    },
  };
}
