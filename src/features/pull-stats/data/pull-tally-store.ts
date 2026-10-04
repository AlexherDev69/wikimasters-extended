import { storage, type StorageItemKey } from '#imports';
import type { Rarity } from '../../card-detection/domain/rarity';
import { addPull, emptyTally, normalizeTally, type PullTally } from '../domain/pull-tally';
import type { PullTallyStore } from '../domain/pull-tally-store';

/**
 * One versioned key holding the six counts, like the settings: reading is a
 * single access, and a change of shape starts again from an empty tally
 * instead of reading a value it cannot understand.
 */
const PULL_TALLY_KEY: StorageItemKey = 'local:wme:pulls:v1';

/**
 * Read without the fallback of `read`: a storage that fails must fail the
 * addition, since an empty tally taken for the one kept would be written back
 * over every card ever counted.
 */
async function addToStored(rarity: Rarity): Promise<PullTally> {
  const tally = addPull(normalizeTally(await storage.getItem(PULL_TALLY_KEY)), rarity);
  await storage.setItem<PullTally>(PULL_TALLY_KEY, tally);
  return tally;
}

export function createPullTallyStore(): PullTallyStore {
  /**
   * The additions of this page go one at a time. The storage has no
   * transaction, so two cards counted in a row would otherwise both read the
   * same tally before either has written, and one of them would be lost.
   */
  let lastAddition: Promise<unknown> = Promise.resolve();

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

    add(rarity: Rarity): Promise<PullTally> {
      const addition = lastAddition.then(() => addToStored(rarity));
      // The line outlives an addition that failed: the next card is added
      // all the same.
      lastAddition = addition.catch(() => undefined);
      return addition;
    },
  };
}
