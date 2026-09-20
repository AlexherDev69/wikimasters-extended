/**
 * The marks of the nodes this feature adds. It reads the site through the
 * selectors of the card detection and adds nothing else of its own here.
 */

/** Marks the badge added to a card root. */
export const BADGE_ATTRIBUTE = 'data-wme-badge';

export const BADGE_SELECTOR = `[${BADGE_ATTRIBUTE}]`;

/** Marks the category line added to the detail modal. */
export const CATEGORY_LINE_ATTRIBUTE = 'data-wme-category-line';

export const CATEGORY_LINE_SELECTOR = `[${CATEGORY_LINE_ATTRIBUTE}]`;

/**
 * Holds the category one of our nodes currently shows. The accent colour is
 * written with it and only with it: a colour read back from a style comes back
 * in the normalized form of the browser (`rgb(...)`), which never equals the
 * constant it was written from, so comparing colours would write on every sync
 * and the observer of the content script would never come to rest.
 */
export const CATEGORY_ATTRIBUTE = 'data-wme-category';
