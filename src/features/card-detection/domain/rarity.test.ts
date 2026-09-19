import { describe, it, expect } from 'vitest';
import { RARITIES, parseRarityFromClassName } from './rarity';

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
