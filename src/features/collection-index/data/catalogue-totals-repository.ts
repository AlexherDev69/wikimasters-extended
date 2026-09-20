import { storage, type StorageItemKey } from '#imports';
import type { Clock } from '../../categorization/domain/ports';
import {
  isCatalogueObservation,
  type CatalogueObservation,
  type CatalogueTotals,
  type CatalogueTotalsRepository,
} from '../domain/catalogue-totals';

/**
 * ONE versioned key for the one observation there is to keep. The version is
 * part of the key, as for the index and the caches: a change of shape reads as
 * "never observed" instead of a value the extension cannot understand.
 *
 * The key belongs to neither maintenance operation of the options page. What
 * the catalogue announces is a fact about the game, not personal data and not
 * a cache of Wikimedia, so emptying the categorization cache or resetting the
 * collection index leaves it alone.
 */
const TOTALS_KEY: StorageItemKey = 'local:wme:catalogue-totals:v1';

/**
 * The six rarities and nothing else. The guard that let the value in reads
 * those six and ignores whatever other key a message may carry, so the record
 * is rebuilt here: storage holds what the extension understands, and a key it
 * has never heard of never lives on in it.
 */
function onlyKnownRarities(totals: CatalogueTotals): CatalogueTotals {
  return {
    c: totals.c,
    pc: totals.pc,
    r: totals.r,
    sr: totals.sr,
    ur: totals.ur,
    l: totals.l,
  };
}

export function createCatalogueTotalsRepository(clock: Clock): CatalogueTotalsRepository {
  return {
    async read(): Promise<CatalogueObservation | null> {
      const stored: unknown = await storage.getItem(TOTALS_KEY);
      return isCatalogueObservation(stored) ? stored : null;
    },

    save(totals: CatalogueTotals): Promise<void> {
      // Each reading replaces the previous one whole: there is no history to
      // keep, the catalogue only ever has a current size.
      return storage.setItem<CatalogueObservation>(TOTALS_KEY, {
        totals: onlyKnownRarities(totals),
        observedAt: clock.now(),
      });
    },
  };
}
