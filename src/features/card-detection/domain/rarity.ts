export const RARITIES = ['c', 'pc', 'r', 'sr', 'ur', 'l'] as const;

export type Rarity = (typeof RARITIES)[number];

/** Rarest first, the order a collector reads their own cards in. */
export const RARITIES_RAREST_FIRST: readonly Rarity[] = [...RARITIES].reverse();

/** Narrows a rarity read back from storage or received in a message. */
export function isRarity(value: unknown): value is Rarity {
  return typeof value === 'string' && RARITIES.some((candidate) => candidate === value);
}

export function parseRarityFromClassName(className: string): Rarity | null {
  const tokens = className.split(/\s+/);
  for (const token of tokens) {
    for (const rarity of RARITIES) {
      if (token === `glow-${rarity}`) {
        return rarity;
      }
    }
  }
  return null;
}
