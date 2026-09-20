import { RARITIES_RAREST_FIRST, type Rarity } from '../../card-detection/domain/rarity';
import type { CatalogueTotals } from './catalogue-totals';
import type { RarityCount } from './collection-summary';

/** Where the user stands in one rarity, against the whole catalogue. */
export interface RarityCompletion {
  rarity: Rarity;
  /** Cards of that rarity in the local index. */
  owned: number;
  /** Cards of that rarity in the game, as the catalogue page displayed them. */
  total: number;
  /** Between 0 and 1, and 0 when the game holds no card of that rarity. */
  share: number;
}

/** Full completion, the value a share is capped at. */
const MAX_SHARE = 1;

/**
 * What the popup shows per rarity: how many cards of the index against how
 * many the game holds. Every rarity gets a line, including the ones the user
 * owns nothing of, which is exactly what a completion is about.
 *
 * The index may hold more cards than the catalogue announces, since the totals
 * are those of the last reading and the catalogue may have shrunk since. The
 * share is capped rather than the count, so the numbers shown stay the real
 * ones.
 */
export function computeRarityCompletion(
  rarityCounts: readonly RarityCount[],
  totals: CatalogueTotals,
): RarityCompletion[] {
  const owned = new Map<Rarity, number>(rarityCounts.map((entry) => [entry.rarity, entry.count]));

  return RARITIES_RAREST_FIRST.map((rarity) => {
    const count = owned.get(rarity) ?? 0;
    const total = totals[rarity];

    return {
      rarity,
      owned: count,
      total,
      share: total === 0 ? 0 : Math.min(count / total, MAX_SHARE),
    };
  });
}
