export const RARITIES = ['c', 'pc', 'r', 'sr', 'ur', 'l'] as const;

export type Rarity = (typeof RARITIES)[number];

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
