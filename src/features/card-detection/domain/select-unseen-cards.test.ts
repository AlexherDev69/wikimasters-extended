import { describe, it, expect } from 'vitest';
import type { DetectedCard } from './detected-card';
import { selectUnseenCards } from './select-unseen-cards';

function card(title: string): DetectedCard {
  return { title, description: null, rarity: 'c' };
}

describe('selectUnseenCards', () => {
  it('should return only unseen cards when some titles are already in the seen set', () => {
    const seen = new Set(['Alpha']);
    const cards = [card('Alpha'), card('Beta')];
    const result = selectUnseenCards(seen, cards);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Beta');
  });

  it('should de-duplicate within a batch keeping the first occurrence', () => {
    const seen = new Set<string>();
    const cards = [card('Alpha'), card('Alpha'), card('Beta')];
    const result = selectUnseenCards(seen, cards);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.title)).toEqual(['Alpha', 'Beta']);
  });

  it('should return an empty array when all cards are already seen', () => {
    const seen = new Set(['Alpha', 'Beta']);
    const cards = [card('Alpha'), card('Beta')];
    expect(selectUnseenCards(seen, cards)).toHaveLength(0);
  });

  it('should not mutate the input seen set', () => {
    const seen = new Set(['Alpha']);
    const originalSize = seen.size;
    selectUnseenCards(seen, [card('Beta'), card('Gamma')]);
    expect(seen.size).toBe(originalSize);
    expect(seen.has('Beta')).toBe(false);
  });

  it('should preserve first-seen order within the batch', () => {
    const seen = new Set<string>();
    const cards = [card('C'), card('A'), card('B')];
    const result = selectUnseenCards(seen, cards);
    expect(result.map((c) => c.title)).toEqual(['C', 'A', 'B']);
  });
});
