import { isRecord } from '../../../core/types/guards';

/**
 * What the user can switch off, one boolean per part of the overlay. The
 * first four are on by default: an extension that was installed and never
 * configured does exactly what its description says. `hideCardStats` is the
 * exception, off by default, because its effect is subtractive rather than
 * additive: it hides something of the site instead of adding a node of ours,
 * so an installation that never touched the options page must keep seeing
 * exactly what the site shows.
 */
export interface Settings {
  /** Badge on the cards, and category line in the detail modal. */
  categoryBadges: boolean;
  /** Floating panel of the page, and the veils of the filter it drives. */
  categoryHighlight: boolean;
  /** Letterboxd link in the detail modal, and the button on the card itself. */
  letterboxdLink: boolean;
  /** Image of Wikimedia Commons on the cards the site leaves without one. */
  missingImages: boolean;
  /** Hides the ATK/DEF numbers of the cards and of the detail modal. */
  hideCardStats: boolean;
}

/** Exported so a view can give every switch a place in a display order. */
export const SETTING_KEYS = [
  'categoryBadges',
  'categoryHighlight',
  'letterboxdLink',
  'missingImages',
  'hideCardStats',
] as const satisfies readonly (keyof Settings)[];

export type SettingKey = (typeof SETTING_KEYS)[number];

export const DEFAULT_SETTINGS: Settings = {
  categoryBadges: true,
  categoryHighlight: true,
  letterboxdLink: true,
  missingImages: true,
  hideCardStats: false,
};

/**
 * The settings whose feature needs to know a card's category, and therefore
 * whether Wikidata has to be asked about the cards on screen. `hideCardStats`
 * is deliberately left out: it hides two numbers already on the page and
 * needs nothing from Wikidata, so switching it on alone must never start any
 * traffic, exactly as switching it off must never stop traffic another
 * setting still needs.
 */
const CATEGORIZATION_SETTING_KEYS = [
  'categoryBadges',
  'categoryHighlight',
  'letterboxdLink',
  'missingImages',
] as const satisfies readonly (keyof Settings)[];

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
 * True while at least one categorization-consuming feature is on. With all
 * four off the content script asks for no categorization at all, so a user
 * who turns them off entirely sends nothing to Wikimedia. `hideCardStats` is
 * not one of them, on purpose: see CATEGORIZATION_SETTING_KEYS.
 */
export function hasEnabledFeature(settings: Settings): boolean {
  return CATEGORIZATION_SETTING_KEYS.some((key) => settings[key]);
}
