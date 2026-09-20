/**
 * The selectors of this feature. The ones describing the site itself live with
 * the card detection, which finds the detail modal for every feature.
 */

/** Marks the only node this feature ever adds, so it can be found again. */
export const LETTERBOXD_LINK_ATTRIBUTE = 'data-wme-letterboxd';

export const LETTERBOXD_LINK_SELECTOR = `a[${LETTERBOXD_LINK_ATTRIBUTE}]`;
