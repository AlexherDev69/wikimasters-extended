import { CARD_ROOT_SELECTOR, MODAL_ROOT_SELECTOR } from '../../card-detection/data/card-selectors';

/**
 * Everything this feature matches on the site's own DOM, and the marks it
 * writes on its own nodes.
 *
 * The site's rarity filter buttons carry their colour in an inline style,
 * which is what identifies them: `docs/DOM_NOTES.md` records that the
 * Tailwind classes around them change at each deployment, while the variable
 * name does not. The same shape names the chips of a trade offer, which is
 * why the row is reached through a BUTTON: a chip is a `span`.
 */
const RARITY_VARIABLE = '--color-rarity-';

/** One button of the rarity filter, whatever spacing the page writes. */
export const RARITY_FILTER_BUTTON_SELECTOR = `button[style*="${RARITY_VARIABLE}"]`;

/** Marks our button, so a second sync finds the one already there. */
export const TOGGLE_ATTRIBUTE = 'data-wme-compact-toggle';

export const TOGGLE_SELECTOR = `[${TOGGLE_ATTRIBUTE}]`;

/** Marks the one style element this feature adds, always in `document.head`. */
export const COMPACT_STYLE_ATTRIBUTE = 'data-wme-compact-style';

export const COMPACT_STYLE_SELECTOR = `style[${COMPACT_STYLE_ATTRIBUTE}]`;

/**
 * A card of a grid, and never the one the detail modal shows for itself: the
 * modal opens over these very pages, and a card looked at on purpose is the
 * one place where nothing should be made smaller.
 *
 * Written as a negation rather than scoped to the grid, which carries nothing
 * to match on: `/collection` wraps each card in a `div` of its own and
 * `/global-collection` does not, so no single parent shape covers both.
 */
export const COMPACT_CARD_SELECTOR = `${CARD_ROOT_SELECTOR}:not(${MODAL_ROOT_SELECTOR} *)`;

/**
 * The picture area of a card: the only direct child of the root that holds a
 * picture through a wrapper. Found structurally, exactly as
 * missing-image/data/find-placeholder.ts finds it, since it carries nothing
 * of its own to match on.
 */
export const COMPACT_PICTURE_SELECTOR = `${COMPACT_CARD_SELECTOR} > div:has(> div > img)`;

/** The text area: the direct child of the root holding the title. */
export const COMPACT_TEXT_SELECTOR = `${COMPACT_CARD_SELECTOR} > div:has(> h3)`;
