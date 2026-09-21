import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, hasEnabledFeature, normalizeSettings, type Settings } from './settings';

const ALL_OFF: Settings = {
  categoryBadges: false,
  letterboxdLink: false,
  missingImages: false,
  tradeCards: false,
  hideCardStats: false,
  tagSuggestions: false,
  tagAutoFill: false,
  pullStats: false,
  compactView: false,
};

describe('normalizeSettings', () => {
  it('should return the current defaults when nothing was ever saved', () => {
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
      letterboxdLink: false,
      missingImages: true,
      tradeCards: true,
      hideCardStats: false,
      tagSuggestions: true,
      tagAutoFill: false,
      pullStats: true,
      compactView: true,
    });
  });

  it('should default a switch whose stored value is not a boolean', () => {
    expect(normalizeSettings({ categoryBadges: 'false', letterboxdLink: 0 })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('should default hideCardStats to false when nothing was ever saved', () => {
    expect(normalizeSettings(null).hideCardStats).toBe(false);
  });

  it('should read hideCardStats as false when a stored record does not hold it', () => {
    expect(
      normalizeSettings({ categoryBadges: false, letterboxdLink: false }).hideCardStats,
    ).toBe(false);
  });

  it('should fall back to false when the stored value of hideCardStats is not a boolean', () => {
    expect(normalizeSettings({ hideCardStats: 'true' }).hideCardStats).toBe(false);
    expect(normalizeSettings({ hideCardStats: 1 }).hideCardStats).toBe(false);
  });

  it('should read hideCardStats back as true when it was saved that way, keeping the other defaults', () => {
    expect(normalizeSettings({ hideCardStats: true })).toEqual({
      ...DEFAULT_SETTINGS,
      hideCardStats: true,
    });
  });

  it('should ignore a key that is not one of the settings', () => {
    expect(normalizeSettings({ categoryBadges: false, someOtherSwitch: true })).toEqual({
      ...DEFAULT_SETTINGS,
      categoryBadges: false,
    });
  });

  it('should ignore the switch of the category highlight a previous version saved', () => {
    // Same case as the collection index below: the highlight was removed, so
    // an upgraded installation reads a record that still carries its key.
    expect(normalizeSettings({ categoryHighlight: false, letterboxdLink: false })).toEqual({
      ...DEFAULT_SETTINGS,
      letterboxdLink: false,
    });
  });

  it('should ignore the switch of the collection index a previous version saved', () => {
    // An upgrade reads a record written by the version that still had that
    // setting: the key is simply not one of ours any more.
    expect(normalizeSettings({ collectionIndex: false, letterboxdLink: false })).toEqual({
      ...DEFAULT_SETTINGS,
      letterboxdLink: false,
    });
  });

  it('should return a record of its own rather than the shared defaults', () => {
    const settings = normalizeSettings(undefined);
    settings.categoryBadges = false;

    expect(DEFAULT_SETTINGS.categoryBadges).toBe(true);
  });

  it('should read every saved switch back when all six were written', () => {
    expect(normalizeSettings(ALL_OFF)).toEqual(ALL_OFF);
  });

  it('should default tagSuggestions to true and tagAutoFill to false when nothing was ever saved', () => {
    const settings = normalizeSettings(null);

    expect(settings.tagSuggestions).toBe(true);
    expect(settings.tagAutoFill).toBe(false);
  });

  it('should fall back to the defaults when the stored value of the two new switches is not a boolean', () => {
    expect(normalizeSettings({ tagSuggestions: 'false', tagAutoFill: 1 })).toEqual(DEFAULT_SETTINGS);
  });

  it('should read tagSuggestions and tagAutoFill back as saved, keeping the other defaults', () => {
    expect(normalizeSettings({ tagSuggestions: false, tagAutoFill: true })).toEqual({
      ...DEFAULT_SETTINGS,
      tagSuggestions: false,
      tagAutoFill: true,
    });
  });
});

describe('hasEnabledFeature', () => {
  it('should be true when every feature is on', () => {
    expect(hasEnabledFeature(DEFAULT_SETTINGS)).toBe(true);
  });

  it('should be true when a single feature is left on', () => {
    expect(hasEnabledFeature({ ...ALL_OFF, letterboxdLink: true })).toBe(true);
  });

  it('should be false when every feature is off', () => {
    expect(hasEnabledFeature(ALL_OFF)).toBe(false);
  });

  it('should be false when hideCardStats is the only setting on', () => {
    // Hiding the stats needs nothing from Wikidata: turning it on alone must
    // never start the traffic the other settings ask for.
    expect(hasEnabledFeature({ ...ALL_OFF, hideCardStats: true })).toBe(false);
  });

  it('should be true when tagSuggestions is the only feature left on', () => {
    expect(hasEnabledFeature({ ...ALL_OFF, tagSuggestions: true })).toBe(true);
  });

  it('should be false when tagAutoFill is the only setting on', () => {
    // It only changes what a click on an already shown proposal does: on its
    // own it must never start the traffic that shows a proposal in the first
    // place.
    expect(hasEnabledFeature({ ...ALL_OFF, tagAutoFill: true })).toBe(false);
  });
});
