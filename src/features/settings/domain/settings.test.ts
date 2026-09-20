import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, hasEnabledFeature, normalizeSettings, type Settings } from './settings';

const ALL_OFF: Settings = {
  categoryBadges: false,
  categoryHighlight: false,
  letterboxdLink: false,
  collectionIndex: false,
  missingImages: false,
};

describe('normalizeSettings', () => {
  it('should return every feature on when nothing was ever saved', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('should return the defaults when the stored value is not a record', () => {
    expect(normalizeSettings('oops')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(['categoryBadges'])).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(7)).toEqual(DEFAULT_SETTINGS);
  });

  it('should keep the saved switches and default the ones the record does not hold', () => {
    expect(normalizeSettings({ categoryBadges: false, letterboxdLink: false })).toEqual({
      categoryBadges: false,
      categoryHighlight: true,
      letterboxdLink: false,
      collectionIndex: true,
      missingImages: true,
    });
  });

  it('should default a switch whose stored value is not a boolean', () => {
    expect(normalizeSettings({ categoryBadges: 'false', categoryHighlight: 0 })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('should ignore a key that is not one of the settings', () => {
    expect(normalizeSettings({ categoryBadges: false, someOtherSwitch: true })).toEqual({
      ...DEFAULT_SETTINGS,
      categoryBadges: false,
    });
  });

  it('should return a record of its own rather than the shared defaults', () => {
    const settings = normalizeSettings(undefined);
    settings.categoryBadges = false;

    expect(DEFAULT_SETTINGS.categoryBadges).toBe(true);
  });

  it('should read every saved switch back when all five were written', () => {
    expect(normalizeSettings(ALL_OFF)).toEqual(ALL_OFF);
  });
});

describe('hasEnabledFeature', () => {
  it('should be true when every feature is on', () => {
    expect(hasEnabledFeature(DEFAULT_SETTINGS)).toBe(true);
  });

  it('should be true when a single feature is left on', () => {
    expect(hasEnabledFeature({ ...ALL_OFF, collectionIndex: true })).toBe(true);
  });

  it('should be false when every feature is off', () => {
    expect(hasEnabledFeature(ALL_OFF)).toBe(false);
  });
});
