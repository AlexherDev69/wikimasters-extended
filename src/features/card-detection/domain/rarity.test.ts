import { describe, it, expect } from 'vitest';
import { RARITIES, isRarity, parseRarityFromClassName } from './rarity';

describe('isRarity', () => {
  it('should accept every known rarity', () => {
    for (const rarity of RARITIES) {
      expect(isRarity(rarity)).toBe(true);
    }
  });

  it('should reject an unknown code and a non-string value', () => {
    expect(isRarity('xyz')).toBe(false);
    expect(isRarity('C')).toBe(false);
    expect(isRarity(null)).toBe(false);
  });
});

describe('parseRarityFromClassName', () => {
  it('should return the rarity when the class contains a valid glow-<rarity> token', () => {
    for (const rarity of RARITIES) {
      expect(parseRarityFromClassName(`glow-${rarity}`)).toBe(rarity);
    }
  });

  it('should parse the rarity from a multiline class string with surrounding whitespace', () => {
    const multilineClass = `
        w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)]
        glow-pc
        relative rounded-2xl overflow-hidden cursor-pointer hover:z-10
        transition-all duration-300 hover:scale-105

      `;
    expect(parseRarityFromClassName(multilineClass)).toBe('pc');
  });

  it('should return null when the class contains glow-xyz but xyz is not a valid rarity', () => {
    expect(parseRarityFromClassName('glow-xyz rounded-xl')).toBeNull();
  });

  it('should return null when the class contains hover:glow-c and not a bare glow-<rarity> token', () => {
    expect(parseRarityFromClassName('hover:glow-c text-sm')).toBeNull();
  });

  it('should return null when the class string is empty', () => {
    expect(parseRarityFromClassName('')).toBeNull();
  });

  it('should return null when text-glow-red is present but no valid glow-<rarity> token', () => {
    expect(parseRarityFromClassName('text-glow-red p-4')).toBeNull();
  });
});
