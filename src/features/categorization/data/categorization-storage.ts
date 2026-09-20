import { listLocalKeys, removeLocalKeys } from '../../../core/storage/local-keys';
import { THUMBNAIL_URL_KEY_PREFIX } from '../../missing-image/data/thumbnail-cache';
import type {
  CategorizationCacheCounts,
  CategorizationCacheMaintenance,
} from '../domain/ports';
import { CARD_FACTS_KEY_PREFIX } from './card-facts-cache';
import { CLASS_TARGET_KEY_PREFIX } from './class-target-cache';

/**
 * Maintenance of the three levels of the categorization cache: the facts of
 * each card, the category of each Wikidata class and the thumbnail address of
 * each Commons file. All three spread over one key per entry under a prefix of
 * their own, so counting or emptying them means listing the area and filtering:
 * doing it here rather than in each cache lists the area once per operation
 * instead of three times.
 *
 * The addresses are in here because they are a cache of Wikimedia data exactly
 * like the others: emptying the cache must leave nothing of Wikimedia behind.
 */
const CACHE_PREFIXES: readonly string[] = [
  CARD_FACTS_KEY_PREFIX,
  CLASS_TARGET_KEY_PREFIX,
  THUMBNAIL_URL_KEY_PREFIX,
];

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
        thumbnailUrls: keys.filter((key) => key.startsWith(THUMBNAIL_URL_KEY_PREFIX)).length,
      };
    },

    async clear(): Promise<void> {
      // Only the keys of these three prefixes: the settings, the host cooldowns
      // and what an old index left behind are none of its business.
      const keys = await listLocalKeys();
      await removeLocalKeys(keys.filter(belongsToCache));
    },
  };
}
