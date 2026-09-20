import { describe, it, expect } from 'vitest';
import { chunk } from './chunk';

describe('chunk', () => {
  it('should split the items into chunks of the requested size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('should return a single chunk when the size covers every item', () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });

  it('should return no chunk when there is no item', () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it('should reject a size below one', () => {
    expect(() => chunk([1], 0)).toThrow('Chunk size must be at least 1');
  });
});
