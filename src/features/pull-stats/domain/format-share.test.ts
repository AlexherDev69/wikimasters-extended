import { describe, it, expect } from 'vitest';
import { formatCount, formatPercent } from './format-share';

/** The space French typography puts before a percent sign, and fr-FR's group separator. */
const NARROW_NO_BREAK_SPACE = ' ';
const NO_BREAK_SPACE = ' ';

describe('formatPercent', () => {
  it('should write a plain zero when the rarity never came out', () => {
    expect(formatPercent(0)).toBe(`0${NO_BREAK_SPACE}%`);
  });

  it('should write one decimal with a comma when the share is an ordinary one', () => {
    expect(formatPercent(62.5)).toBe(`62,5${NO_BREAK_SPACE}%`);
    expect(formatPercent(7)).toBe(`7,0${NO_BREAK_SPACE}%`);
  });

  it('should round to one decimal when the share has more of them', () => {
    expect(formatPercent(33.333333)).toBe(`33,3${NO_BREAK_SPACE}%`);
  });

  it('should write a floor rather than zero when a rarity did come out but rounds to nothing', () => {
    // One legendary in four thousand cards: 0,025 %, which one decimal flattens.
    expect(formatPercent(0.025)).toBe(`< 0,1${NO_BREAK_SPACE}%`);
  });
});

describe('formatCount', () => {
  it('should write a small count as it is', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(37)).toBe('37');
  });

  it('should group the thousands the French way when the count is a large one', () => {
    expect(formatCount(4210)).toBe(`4${NARROW_NO_BREAK_SPACE}210`);
  });
});
