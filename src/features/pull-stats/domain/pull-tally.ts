import { isRecord } from '../../../core/types/guards';
import { RARITIES, type Rarity } from '../../card-detection/domain/rarity';

/**
 * How many cards of each rarity the extension has seen this user pull, all
 * packs since the feature was switched on. Nothing else is kept: not the
 * titles, not the dates, not the packs. The whole point is one number per
 * rarity, and a number that says nothing about what was in a pack cannot say
 * anything about the user either.
 *
 * The site publishes no drop rate to compare this against, and there is none
 * to publish: a card's rarity is read from the monthly page views of its
 * article (C under 50 views, PC 50+, R 250+, SR 1 000+, UR 5 000+, L 20 000+,
 * read from the site's own "Comment ça marche ?" on 2026-09-21). So this is
 * an observation and never a verdict on the game.
 */
export type PullTally = Record<Rarity, number>;

/**
 * The rarest first, which is the order the site itself lists them in on its
 * collection pages, and the order that puts the rare pulls where the eye
 * lands first.
 */
export const TALLY_DISPLAY_ORDER: readonly Rarity[] = [...RARITIES].reverse();

const PERCENT_SCALE = 100;

export function emptyTally(): PullTally {
  return { c: 0, pc: 0, r: 0, sr: 0, ur: 0, l: 0 };
}

/**
 * Narrows a tally read back from storage. A count that is not a whole number
 * at least zero reads as zero rather than failing the whole tally: one
 * corrupted rarity must not cost the user every other count.
 */
export function normalizeTally(value: unknown): PullTally {
  const tally = emptyTally();
  if (!isRecord(value)) {
    return tally;
  }
  for (const rarity of RARITIES) {
    const count = value[rarity];
    if (typeof count === 'number' && Number.isInteger(count) && count >= 0) {
      tally[rarity] = count;
    }
  }
  return tally;
}

export function totalPulls(tally: PullTally): number {
  return RARITIES.reduce((total, rarity) => total + tally[rarity], 0);
}

/** The same tally with one more card of `rarity`, never modified in place. */
export function addPull(tally: PullTally, rarity: Rarity): PullTally {
  return { ...tally, [rarity]: tally[rarity] + 1 };
}

export interface PullShare {
  rarity: Rarity;
  count: number;
  /** Percentage of the whole, 0 while nothing was ever counted. */
  percent: number;
}

/**
 * One share per rarity, in TALLY_DISPLAY_ORDER, every rarity present even
 * with a count of zero: a rarity that never came out is exactly what the user
 * wants to see, and a row that appears only once it is no longer zero would
 * move every other row on the day it arrives.
 */
export function pullShares(tally: PullTally): PullShare[] {
  const total = totalPulls(tally);

  return TALLY_DISPLAY_ORDER.map((rarity) => ({
    rarity,
    count: tally[rarity],
    percent: total === 0 ? 0 : (tally[rarity] * PERCENT_SCALE) / total,
  }));
}
