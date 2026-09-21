import { isRecord } from '../../../core/types/guards';

/**
 * What the user can switch off, one boolean per part of the overlay. Every
 * switch but two is on by default: an extension that was installed and never
 * configured does exactly what its description says. `hideCardStats` is one
 * exception, off by default, because its effect is subtractive rather than
 * additive: it hides something of the site instead of adding a node of ours,
 * so an installation that never touched the options page must keep seeing
 * exactly what the site shows. `tagAutoFill` is the other: it writes a tag
 * into a field of the site on a click, which the rules of wiki-masters.com
 * describe as interacting in the user's place, with a ban announced as the
 * sanction, so nobody ends up doing that without having chosen to. See its
 * own comment and README.md.
 */
export interface Settings {
  /** Badge on the cards, and category line in the detail modal. */
  categoryBadges: boolean;
  /** Letterboxd link in the detail modal, and the button on the card itself. */
  letterboxdLink: boolean;
  /** Image of Wikimedia Commons on the cards the site leaves without one. */
  missingImages: boolean;
  /**
   * Draws the cards a trade offer names, in place of the truncated chips the
   * page of the exchanges shows instead.
   */
  tradeCards: boolean;
  /** Hides the ATK/DEF numbers of the cards and of the detail modal. */
  hideCardStats: boolean;
  /** Proposals in the tag area of the detail modal. Read-only: see tagAutoFill. */
  tagSuggestions: boolean;
  /**
   * A click on a proposal writes it in the tag field of the site and
   * validates it, which is interacting in the user's place. Off by default,
   * on its own from `tagSuggestions`: showing proposals never writes on the
   * site, whatever this one says.
   */
  tagAutoFill: boolean;
  /**
   * Counts the cards the packs reveal, and shows the share of each rarity on
   * the page of the packs. Read-only like the rest: it counts what the site
   * shows, it opens nothing.
   */
  pullStats: boolean;
  /**
   * The button that draws the grids of `/collection` and `/global-collection`
   * at about two thirds of their size, to fit more cards on screen. The view
   * itself is remembered apart from this switch, which only decides whether
   * the button is offered at all.
   */
  compactView: boolean;
}

/** Exported so a view can give every switch a place in a display order. */
export const SETTING_KEYS = [
  'categoryBadges',
  'letterboxdLink',
  'missingImages',
  'tradeCards',
  'hideCardStats',
  'tagSuggestions',
  'tagAutoFill',
  'pullStats',
  'compactView',
] as const satisfies readonly (keyof Settings)[];

export type SettingKey = (typeof SETTING_KEYS)[number];

export const DEFAULT_SETTINGS: Settings = {
  categoryBadges: true,
  letterboxdLink: true,
  missingImages: true,
  tradeCards: true,
  hideCardStats: false,
  tagSuggestions: true,
  tagAutoFill: false,
  pullStats: true,
  compactView: true,
};

/**
 * The settings whose feature needs to know a card's category, and therefore
 * whether Wikidata has to be asked about the cards on screen. `hideCardStats`
 * is deliberately left out: it hides two numbers already on the page and
 * needs nothing from Wikidata, so switching it on alone must never start any
 * traffic, exactly as switching it off must never stop traffic another
 * setting still needs. `tagAutoFill` is left out too: it changes what a click
 * on an already shown proposal does, never whether Wikidata is asked at all,
 * which `tagSuggestions` alone decides. `pullStats` is left out for the same
 * reason as `hideCardStats`: it counts the rarity the card already carries in
 * its own class, and asks nothing of anyone. `compactView` is left out too:
 * it changes the size the cards are painted at, not what is known of them.
 */
const CATEGORIZATION_SETTING_KEYS = [
  'categoryBadges',
  'letterboxdLink',
  'missingImages',
  'tradeCards',
  'tagSuggestions',
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
 * True while at least one categorization-consuming feature is on. With every
 * one of them off the content script asks for no categorization at all, so a
 * user who turns them off entirely sends nothing to Wikimedia. `hideCardStats`
 * and `tagAutoFill` are not among them, on purpose: see
 * CATEGORIZATION_SETTING_KEYS.
 */
export function hasEnabledFeature(settings: Settings): boolean {
  return CATEGORIZATION_SETTING_KEYS.some((key) => settings[key]);
}
