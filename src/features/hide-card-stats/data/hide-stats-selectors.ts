import {
  CARD_ROOT_SELECTOR,
  MODAL_FRAME_SELECTOR,
  MODAL_ROOT_SELECTOR,
} from '../../card-detection/data/card-selectors';

/**
 * Everything this feature matches on the site's own DOM. Both shapes are
 * identified by a lucide icon class, never by a Tailwind utility class: the
 * same signal docs/DOM_NOTES.md already treats as a stable fallback for
 * detecting a card at all.
 */
const ATTACK_ICON_SELECTOR = 'svg.lucide-swords';
const DEFENSE_ICON_SELECTOR = 'svg.lucide-shield';

/**
 * The ATK/DEF value block at the bottom of a card: an icon and its number,
 * direct children of one row. Matches on the card itself (grid format, large
 * format) and on the small card the detail modal shows for itself, since it
 * is built from the very same component.
 *
 * Scoped to a card root (CARD_ROOT_SELECTOR, the site's own `glow-<rarity>`
 * class) rather than written as a bare `div:has(...)`, which `:has()` would
 * otherwise evaluate against the whole document.
 */
export const CARD_ATTACK_VALUE_SELECTOR = `${CARD_ROOT_SELECTOR} div:has(> ${ATTACK_ICON_SELECTOR})`;
export const CARD_DEFENSE_VALUE_SELECTOR = `${CARD_ROOT_SELECTOR} div:has(> ${DEFENSE_ICON_SELECTOR})`;

/**
 * The grid holding the two big ATK/DEF panels of the detail modal (not the
 * small card it also shows, matched above).
 *
 * Scoped to the modal layer itself, and not to `card-frame` alone:
 * docs/DOM_NOTES.md lists that class on the header block of
 * `/global-collection` and on the tiles of the marketplace as well, so it
 * names a panel of the site in general, not a panel of this modal. Without
 * the layer in front, a grid of `card-frame` panels showing an attack value
 * anywhere else on the site would be taken down whole, its other panels with
 * it, on a route this extension has never even looked at.
 */
export const MODAL_ATTACK_PANELS_SELECTOR = `${MODAL_ROOT_SELECTOR} div.grid:has(> ${MODAL_FRAME_SELECTOR} > div > ${ATTACK_ICON_SELECTOR})`;
export const MODAL_DEFENSE_PANELS_SELECTOR = `${MODAL_ROOT_SELECTOR} div.grid:has(> ${MODAL_FRAME_SELECTOR} > div > ${DEFENSE_ICON_SELECTOR})`;

/** Marks the one style element this feature adds, always in `document.head`. */
export const HIDE_STATS_STYLE_ATTRIBUTE = 'data-wme-hide-stats';

export const HIDE_STATS_STYLE_SELECTOR = `style[${HIDE_STATS_STYLE_ATTRIBUTE}]`;
