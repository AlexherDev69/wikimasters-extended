import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, hasEnabledFeature, normalizeSettings, type Settings } from './settings';

const ALL_OFF: Settings = {
  letterboxdLink: false,
  wikipediaLink: false,
  missingImages: false,
  tradeCards: false,
  hideCardStats: false,
  pullStats: false,
  compactView: false,
  loadingPong: false,
  notificationSound: false,
};

describe('normalizeSettings', () => {
  it('should return the current defaults when nothing was ever saved', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('should return the defaults when the stored value is not a record', () => {
    expect(normalizeSettings('oops')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(['letterboxdLink'])).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(7)).toEqual(DEFAULT_SETTINGS);
  });

  it('should keep the saved switches and default the ones the record does not hold', () => {
    expect(normalizeSettings({ letterboxdLink: false, missingImages: false })).toEqual({
      letterboxdLink: false,
      wikipediaLink: true,
      missingImages: false,
      tradeCards: true,
      hideCardStats: false,
      pullStats: true,
      compactView: true,
      loadingPong: true,
      notificationSound: true,
    });
  });

  it('should default a switch whose stored value is not a boolean', () => {
    expect(normalizeSettings({ letterboxdLink: 'false', missingImages: 0 })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('should default hideCardStats to false when nothing was ever saved', () => {
    expect(normalizeSettings(null).hideCardStats).toBe(false);
  });

  it('should read hideCardStats as false when a stored record does not hold it', () => {
    expect(normalizeSettings({ letterboxdLink: false }).hideCardStats).toBe(false);
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
    expect(normalizeSettings({ letterboxdLink: false, someOtherSwitch: true })).toEqual({
      ...DEFAULT_SETTINGS,
      letterboxdLink: false,
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
    settings.letterboxdLink = false;

    expect(DEFAULT_SETTINGS.letterboxdLink).toBe(true);
  });

  it('should read every saved switch back when all of them were written', () => {
    expect(normalizeSettings(ALL_OFF)).toEqual(ALL_OFF);
  });

  it('should ignore the switches of the category features a previous version saved', () => {
    // Same case as the two above: the badge, the proposals of tags and the
    // click that filled them were removed, so an upgraded installation reads a
    // record that still carries their keys.
    expect(
      normalizeSettings({
        categoryBadges: false,
        tagSuggestions: false,
        tagAutoFill: true,
        letterboxdLink: false,
      }),
    ).toEqual({ ...DEFAULT_SETTINGS, letterboxdLink: false });
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

  it('should be false when one of the switches that read nothing is the only one on', () => {
    // None of them asks Wikidata anything: the pull tally counts the rarity
    // the card already carries, the compact view only changes the size the
    // cards are painted at, and Pong runs while no card is shown at all.
    expect(hasEnabledFeature({ ...ALL_OFF, pullStats: true })).toBe(false);
    expect(hasEnabledFeature({ ...ALL_OFF, compactView: true })).toBe(false);
    expect(hasEnabledFeature({ ...ALL_OFF, loadingPong: true })).toBe(false);
  });
});
