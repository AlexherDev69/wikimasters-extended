import { storage, type StorageItemKey } from '#imports';
import { emptyTally, normalizeTally, type PullTally } from '../domain/pull-tally';
import type { PullTallyStore } from '../domain/pull-tally-store';

/**
 * One versioned key holding the six counts, like the settings: reading is a
 * single access, and a change of shape starts again from an empty tally
 * instead of reading a value it cannot understand.
 */
const PULL_TALLY_KEY: StorageItemKey = 'local:wme:pulls:v1';

export function createPullTallyStore(): PullTallyStore {
  return {
    async read(): Promise<PullTally> {
      try {
        return normalizeTally(await storage.getItem(PULL_TALLY_KEY));
      } catch {
        // Storage failing must never keep the panel off the page: an empty
        // tally is what a fresh installation shows anyway.
        return emptyTally();
      }
    },

    write(tally: PullTally): Promise<void> {
      return storage.setItem<PullTally>(PULL_TALLY_KEY, tally);
    },
  };
}
