import { describe, it, expect } from 'vitest';
import { RARITIES } from '../../card-detection/domain/rarity';
import {
  addPull,
  emptyTally,
  normalizeTally,
  pullShares,
  TALLY_DISPLAY_ORDER,
  totalPulls,
} from './pull-tally';

describe('emptyTally', () => {
  it('should give a count of zero to every rarity the extension knows', () => {
    const tally = emptyTally();

    expect(Object.keys(tally).sort()).toEqual([...RARITIES].sort());
    expect(totalPulls(tally)).toBe(0);
  });
});

describe('normalizeTally', () => {
  it('should read back a tally that was written as it is', () => {
    const tally = { c: 42, pc: 12, r: 6, sr: 3, ur: 1, l: 0 };

    expect(normalizeTally(tally)).toEqual(tally);
  });

  it('should return an empty tally when the stored value is not a record', () => {
    expect(normalizeTally(null)).toEqual(emptyTally());
    expect(normalizeTally('oops')).toEqual(emptyTally());
    expect(normalizeTally(7)).toEqual(emptyTally());
  });

  it('should keep the other counts when one of them is not a whole number at least zero', () => {
    const stored = { c: 10, pc: -1, r: 1.5, sr: 'many', ur: null, l: 2 };

    expect(normalizeTally(stored)).toEqual({ c: 10, pc: 0, r: 0, sr: 0, ur: 0, l: 2 });
  });

  it('should read a rarity the stored record does not have as zero', () => {
    expect(normalizeTally({ c: 3 })).toEqual({ c: 3, pc: 0, r: 0, sr: 0, ur: 0, l: 0 });
  });

  it('should ignore a key that is not a rarity', () => {
    const normalized = normalizeTally({ c: 1, mythic: 99 });

    expect(normalized).toEqual({ c: 1, pc: 0, r: 0, sr: 0, ur: 0, l: 0 });
    expect(Object.keys(normalized)).not.toContain('mythic');
  });
});

describe('addPull', () => {
  it('should add one to the rarity given and leave the tally it was handed alone', () => {
    const before = emptyTally();
    const after = addPull(before, 'sr');

    expect(after.sr).toBe(1);
    expect(before.sr).toBe(0);
    expect(totalPulls(after)).toBe(1);
  });
});

describe('pullShares', () => {
  it('should list every rarity from the rarest to the most common', () => {
    const rarities = pullShares(emptyTally()).map((share) => share.rarity);

    expect(rarities).toEqual(['l', 'ur', 'sr', 'r', 'pc', 'c']);
    expect(rarities).toEqual([...TALLY_DISPLAY_ORDER]);
  });

  it('should give every rarity a share of zero when nothing was ever counted', () => {
    for (const share of pullShares(emptyTally())) {
      expect(share.count).toBe(0);
      expect(share.percent).toBe(0);
    }
  });

  it('should give the share of each rarity out of the whole when cards were counted', () => {
    const shares = pullShares({ c: 6, pc: 2, r: 1, sr: 1, ur: 0, l: 0 });
    const byRarity = new Map(shares.map((share) => [share.rarity, share]));

    expect(byRarity.get('c')?.percent).toBe(60);
    expect(byRarity.get('pc')?.percent).toBe(20);
    expect(byRarity.get('r')?.percent).toBe(10);
    expect(byRarity.get('sr')?.percent).toBe(10);
    expect(byRarity.get('ur')?.percent).toBe(0);
  });

  it('should keep a rarity that never came out in the list', () => {
    const shares = pullShares({ c: 1, pc: 0, r: 0, sr: 0, ur: 0, l: 0 });

    expect(shares).toHaveLength(RARITIES.length);
    expect(shares.find((share) => share.rarity === 'l')).toEqual({
      rarity: 'l',
      count: 0,
      percent: 0,
    });
  });

  it('should have its shares add up to a hundred when cards were counted', () => {
    const total = pullShares({ c: 7, pc: 5, r: 3, sr: 2, ur: 1, l: 1 }).reduce(
      (sum, share) => sum + share.percent,
      0,
    );

    expect(total).toBeCloseTo(100);
  });
});
