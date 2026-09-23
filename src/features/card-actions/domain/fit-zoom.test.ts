import { describe, it, expect } from 'vitest';
import { fitZoom } from './fit-zoom';

/** The card of the detail modal, `w-72 h-[420px]` on the site. */
const MODAL_CARD = { width: 288, height: 420 };

describe('fitZoom', () => {
  it('should let the height decide when the screen is wider than the card', () => {
    // 1080 * 0.9 / 420, well under 1920 * 0.9 / 288.
    expect(fitZoom({ width: 1920, height: 1080 }, MODAL_CARD)).toBeCloseTo(2.314, 3);
  });

  it('should let the width decide when the screen is narrower than the card', () => {
    // A phone upright: 390 * 0.9 / 288, under 844 * 0.9 / 420.
    expect(fitZoom({ width: 390, height: 844 }, MODAL_CARD)).toBeCloseTo(1.219, 3);
  });

  it('should shrink the card when the screen is smaller than it', () => {
    expect(fitZoom({ width: 200, height: 300 }, MODAL_CARD)).toBeLessThan(1);
  });

  it('should return the neutral zoom when a size could not be measured', () => {
    expect(fitZoom({ width: 1920, height: 1080 }, { width: 0, height: 0 })).toBe(1);
    expect(fitZoom({ width: 0, height: 1080 }, MODAL_CARD)).toBe(1);
    expect(fitZoom({ width: Number.NaN, height: 1080 }, MODAL_CARD)).toBe(1);
  });
});
