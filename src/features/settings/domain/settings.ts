import { isRecord } from '../../../core/types/guards';

/**
 * What the user can switch off, one boolean per part of the overlay. Every
 * switch but one is on by default: an extension that was installed and never
 * configured does exactly what its description says. `hideCardStats` is the
 * exception, off by default, because its effect is subtractive rather than
 * additive: it hides something of the site instead of adding a node of ours,
 * so an installation that never touched the options page must keep seeing
 * exactly what the site shows.
 */
export interface Settings {
  /** Letterboxd link in the detail modal, and the button on the card itself. */
  letterboxdLink: boolean;
  /**
   * The button that opens the Wikipedia article of a card, on the card
   * itself. It asks nothing of anyone: the address is built from the title
   * the card already shows.
   */
  wikipediaLink: boolean;
  /** Image of Wikimedia Commons on the cards the site leaves without one. */
  missingImages: boolean;
  /**
   * Draws the cards a trade offer names, in place of the truncated chips the
   * page of the exchanges shows instead.
   */
  tradeCards: boolean;
  /** Hides the ATK/DEF numbers of the cards and of the detail modal. */
  hideCardStats: boolean;
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
  /**
   * The button beside the card of the detail modal that shows that card in
   * full screen. Read-only like the rest: the browser enlarges the card the
   * site already shows, and nothing of the site is written for it.
   */
  fullscreenCard: boolean;
  /**
   * The button beside the card of the detail modal that copies that card to
   * the clipboard, as a picture. It reads the card the site shows and the
   * files the page has already loaded, and writes nothing on the site.
   */
  copyCard: boolean;
  /**
   * A game of Pong over the loading screen, when the site keeps the reader
   * waiting for several seconds. Read-only like the rest: it is played in a
   * canvas of ours, over a page that has nothing to show yet, and it goes
   * away as soon as the page has.
   */
  loadingPong: boolean;
  /**
   * A short sound when the bell of the site goes up. It listens to the badge
   * the site already shows and adds nothing to the page: no node, no listener
   * on anything of the site, and no notification of the browser.
   */
  notificationSound: boolean;
}

/** Exported so a view can give every switch a place in a display order. */
export const SETTING_KEYS = [
  'letterboxdLink',
  'wikipediaLink',
  'missingImages',
  'tradeCards',
  'hideCardStats',
  'pullStats',
  'compactView',
  'fullscreenCard',
  'copyCard',
  'loadingPong',
  'notificationSound',
] as const satisfies readonly (keyof Settings)[];

export type SettingKey = (typeof SETTING_KEYS)[number];

export const DEFAULT_SETTINGS: Settings = {
  letterboxdLink: true,
  wikipediaLink: true,
  missingImages: true,
  tradeCards: true,
  hideCardStats: false,
  pullStats: true,
  compactView: true,
  fullscreenCard: true,
  copyCard: true,
  loadingPong: true,
  notificationSound: true,
};

/**
 * The settings whose feature needs what Wikidata knows of a card, and
 * therefore whether it has to be asked about the cards on screen at all.
 * `hideCardStats` is deliberately left out: it hides two numbers already on
 * the page and needs nothing from Wikidata, so switching it on alone must
 * never start any traffic, exactly as switching it off must never stop
 * traffic another setting still needs. `pullStats` is left out for the same
 * reason: it counts the rarity the card already carries in its own class, and
 * asks nothing of anyone. `compactView` is left out too: it changes the size
 * the cards are painted at, not what is known of them. `fullscreenCard` and
 * `copyCard` are left out for the same reason: they enlarge or copy a card
 * the modal already shows.
 * `wikipediaLink` is
 * left out for the plainest reason there is: the title of a card IS the
 * title of its article, so its button is built from what the page already
 * shows and no one is ever asked anything. `loadingPong` is left
 * out for the plainest reason of all: it only runs while the page shows no
 * card at all, so there is nothing to look up. `notificationSound` is left
 * out too: it reads a number in the navigation of the site, which names no
 * card at all.
 */
const CATEGORIZATION_SETTING_KEYS = [
  'letterboxdLink',
  'missingImages',
  'tradeCards',
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
 * True while at least one Wikidata-consuming feature is on. With every one of
 * them off the content script asks for no categorization at all, so a user
 * who turns them off entirely sends nothing to Wikimedia. `hideCardStats` is
 * not among them, on purpose: see CATEGORIZATION_SETTING_KEYS.
 */
export function hasEnabledFeature(settings: Settings): boolean {
  return CATEGORIZATION_SETTING_KEYS.some((key) => settings[key]);
}
