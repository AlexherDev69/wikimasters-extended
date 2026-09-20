/**
 * Everything this feature reads on the site's own DOM, and the marks of the
 * node it adds beside each chip.
 */

/**
 * The chip naming one card of a trade offer: a `span` carrying the FULL
 * article title in its `title` attribute, and the colour of its rarity in an
 * inline style. Neither a Tailwind class nor a place in the tree: the rarity
 * variables of the site are the same kind of signal as the `glow-<rarity>`
 * class the card detection already reads, and the site writes them itself.
 *
 * Counted on the page exports of 2026-09-21: this shape appears 54 times on
 * `/trades` and not once on `/collection`, `/global-collection`,
 * `/marketplace`, `/pulls` or the detail modal, although every one of those
 * pages uses the rarity variables. A `span` that names a card in its `title`
 * attribute is what a trade offer is made of, and nothing else on the site is
 * built that way.
 */
export const TRADE_CHIP_SELECTOR = 'span[title][style*="--color-rarity-"]';

/**
 * Reads the rarity code out of the inline style of a chip. Not a global
 * regular expression on purpose: a shared one would carry its `lastIndex`
 * from one chip to the next.
 */
export const TRADE_CHIP_RARITY_PATTERN = /--color-rarity-([a-z]+)\)/;

export const TRADE_CHIP_TITLE_ATTRIBUTE = 'title';

/** Marks our own preview, one per chip, inserted right before it. */
export const TRADE_PREVIEW_ATTRIBUTE = 'data-wme-trade-preview';

export const TRADE_PREVIEW_SELECTOR = `[${TRADE_PREVIEW_ATTRIBUTE}]`;

/**
 * Everything the preview shows, serialized: the rarity, the title and the
 * file it draws. Comparing it against the one just computed is what lets a
 * sync write nothing when the preview is already right, which the observer of
 * the content script makes a requirement rather than an optimization.
 */
export const TRADE_PREVIEW_KEY_ATTRIBUTE = 'data-wme-trade-key';

/** Carries the rarity, which the style sheet turns into the colour. */
export const TRADE_RARITY_ATTRIBUTE = 'data-wme-trade-rarity';

/** Carries `picture` or `emblem`: an emblem is shown whole, not cropped. */
export const TRADE_KIND_ATTRIBUTE = 'data-wme-trade-kind';

/** Set on the preview once its picture failed to load, so nothing shows. */
export const TRADE_FAILED_ATTRIBUTE = 'data-wme-trade-failed';
