import { isRecord } from '../../../core/types/guards';

/**
 * What the user can switch off, one boolean per part of the overlay. All four
 * are on by default: an extension that was installed and never configured does
 * exactly what its description says.
 */
export interface Settings {
  /** Badge on the cards, and category line in the detail modal. */
  categoryBadges: boolean;
  /** Floating panel of the page, and the veils of the filter it drives. */
  categoryHighlight: boolean;
  /** Letterboxd link in the detail modal. */
  letterboxdLink: boolean;
  /** Recording of the cards displayed on the collection pages. */
  collectionIndex: boolean;
}

/** Exported so a view can give every switch a place in a display order. */
export const SETTING_KEYS = [
  'categoryBadges',
  'categoryHighlight',
  'letterboxdLink',
  'collectionIndex',
] as const satisfies readonly (keyof Settings)[];

export type SettingKey = (typeof SETTING_KEYS)[number];

export const DEFAULT_SETTINGS: Settings = {
  categoryBadges: true,
  categoryHighlight: true,
  letterboxdLink: true,
  collectionIndex: true,
};

/**
 * Narrows a value read from storage. Anything that is not a boolean, including
 * a missing key, falls back to the default of that setting rather than to
 * "off": a value the extension cannot understand must never silently turn a
 * feature off, and a setting added in a later version reads as its default
 * from a record written before it existed.
 */
export function normalizeSettings(value: unknown): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS };

  if (!isRecord(value)) {
    return settings;
  }
  for (const key of SETTING_KEYS) {
    const stored = value[key];
    if (typeof stored === 'boolean') {
      settings[key] = stored;
    }
  }
  return settings;
}

/**
 * True while at least one feature is on. With everything off the content
 * script asks for no categorization at all, so a user who turns the extension
 * off entirely sends nothing to Wikimedia.
 */
export function hasEnabledFeature(settings: Settings): boolean {
  return SETTING_KEYS.some((key) => settings[key]);
}
