import { listLocalKeys, removeLocalKeys } from '../../../core/storage/local-keys';
import type { LegacyIndexData } from '../domain/legacy-index-data';

/**
 * The two keys the collection index wrote, listed here because nothing else
 * knows them any more: the feature that owned them is gone. They are matched
 * whole and never by prefix, so a key of another version is left alone.
 */
const LEGACY_KEYS: readonly string[] = ['wme:collection-index:v1', 'wme:catalogue-totals:v1'];

function isLegacyKey(key: string): boolean {
  return LEGACY_KEYS.includes(key);
}

export function createLegacyIndexStorage(): LegacyIndexData {
  return {
    async isPresent(): Promise<boolean> {
      return (await listLocalKeys()).some(isLegacyKey);
    },

    async remove(): Promise<void> {
      // The keys that are actually there: removing a key that was never
      // written would be a write of its own in some implementations.
      const keys = await listLocalKeys();
      await removeLocalKeys(keys.filter(isLegacyKey));
    },
  };
}
