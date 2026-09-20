import { isRecord } from '../../../core/types/guards';
import { RARITIES, type Rarity } from '../../card-detection/domain/rarity';

/**
 * How many cards the whole game holds in each rarity, as the catalogue page
 * prints them in its header block. These are facts about the game and not
 * about the user: they are read where the site already displays them, never
 * fetched, since the extension calls no API of the site.
 */
export type CatalogueTotals = Record<Rarity, number>;

/** The last reading of the totals, with the moment it was taken. */
export interface CatalogueObservation {
  totals: CatalogueTotals;
  observedAt: number;
}

/**
 * Upper bound of one total. The catalogue announced 2 773 461 cards in all
 * when it was observed, so a rarity above this bound is a number the extension
 * misread rather than a catalogue that grew.
 */
export const MAX_CATALOGUE_TOTAL = 100_000_000;

/** Narrows totals read back from storage or received in a message. */
export function isCatalogueTotals(value: unknown): value is CatalogueTotals {
  if (!isRecord(value)) {
    return false;
  }
  return RARITIES.every((rarity) => {
    const total = value[rarity];
    return (
      typeof total === 'number' &&
      Number.isInteger(total) &&
      total >= 0 &&
      total <= MAX_CATALOGUE_TOTAL
    );
  });
}

/**
 * A moment in time, which the popup turns into a date: `NaN`, an infinity and
 * a negative value would all print something the user cannot read.
 */
function isObservedAt(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Narrows a whole observation, wherever it comes from. */
export function isCatalogueObservation(value: unknown): value is CatalogueObservation {
  return isRecord(value) && isCatalogueTotals(value['totals']) && isObservedAt(value['observedAt']);
}

/**
 * The totals as the service worker owns them: ONE observation, replaced by
 * each new one. There is no history to keep, the catalogue only ever has a
 * current size.
 */
export interface CatalogueTotalsRepository {
  read(): Promise<CatalogueObservation | null>;
  save(totals: CatalogueTotals): Promise<void>;
}
