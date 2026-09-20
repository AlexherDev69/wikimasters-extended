import { describe, it, expect } from 'vitest';
import type { Rarity } from '../../card-detection/domain/rarity';
import type { CatalogueTotals } from './catalogue-totals';
import type { RarityCount } from './collection-summary';
import { computeRarityCompletion, type RarityCompletion } from './rarity-completion';

/** The totals the catalogue page announced when it was observed. */
const TOTALS: CatalogueTotals = {
  l: 1761,
  ur: 12_368,
  sr: 66_788,
  r: 179_657,
  pc: 516_762,
  c: 1_996_125,
};

const EMPTY_TOTALS: CatalogueTotals = { l: 0, ur: 0, sr: 0, r: 0, pc: 0, c: 0 };

function completionOf(
  rarityCounts: readonly RarityCount[],
  totals: CatalogueTotals = TOTALS,
): Map<Rarity, RarityCompletion> {
  return new Map(
    computeRarityCompletion(rarityCounts, totals).map((entry) => [entry.rarity, entry]),
  );
}

describe('computeRarityCompletion', () => {
  it('should give one line per rarity, rarest first, when the index holds a single card', () => {
    const completion = computeRarityCompletion([{ rarity: 'l', count: 3 }], TOTALS);

    expect(completion.map((entry) => entry.rarity)).toEqual(['l', 'ur', 'sr', 'r', 'pc', 'c']);
  });

  it('should count what the index holds against what the catalogue announces', () => {
    const line = completionOf([{ rarity: 'l', count: 3 }]).get('l');

    expect(line).toMatchObject({ owned: 3, total: 1761 });
    expect(line?.share).toBeCloseTo(3 / 1761, 10);
  });

  it('should give a share of zero to a rarity the index holds no card of', () => {
    const line = completionOf([{ rarity: 'l', count: 3 }]).get('c');

    expect(line).toEqual({ rarity: 'c', owned: 0, total: 1_996_125, share: 0 });
  });

  it('should give a full share when every card of a rarity is owned', () => {
    const line = completionOf([{ rarity: 'l', count: 1761 }]).get('l');

    expect(line?.share).toBe(1);
  });

  it('should cap the share at one when the catalogue shrank since it was read', () => {
    const line = completionOf([{ rarity: 'l', count: 2000 }]).get('l');

    // The real count is still shown: only the share is capped.
    expect(line).toEqual({ rarity: 'l', owned: 2000, total: 1761, share: 1 });
  });

  it('should give a share of zero when the catalogue holds no card of that rarity', () => {
    const line = completionOf([{ rarity: 'l', count: 3 }], EMPTY_TOTALS).get('l');

    expect(line).toEqual({ rarity: 'l', owned: 3, total: 0, share: 0 });
  });

  it('should give every rarity a share of zero when the index is empty', () => {
    const completion = computeRarityCompletion([], TOTALS);

    expect(completion.every((entry) => entry.owned === 0 && entry.share === 0)).toBe(true);
    expect(completion).toHaveLength(6);
  });
});
