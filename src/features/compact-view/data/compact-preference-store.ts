import { storage, type StorageItemKey } from '#imports';
import type { CompactPreferenceStore } from '../domain/compact-preference-store';

/**
 * One versioned key holding one boolean, like the settings: a value that is
 * not a boolean, including none at all, reads as "off", which is exactly what
 * a fresh installation shows.
 */
const COMPACT_KEY: StorageItemKey = 'local:wme:compact:v1';

export function createCompactPreferenceStore(): CompactPreferenceStore {
  return {
    async read(): Promise<boolean> {
      try {
        return (await storage.getItem(COMPACT_KEY)) === true;
      } catch {
        // Storage failing must never keep the cards off the page: the site's
        // own format is what a fresh installation shows anyway.
        return false;
      }
    },

    write(isCompact: boolean): Promise<void> {
      return storage.setItem<boolean>(COMPACT_KEY, isCompact);
    },
  };
}
