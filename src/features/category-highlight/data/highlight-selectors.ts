/**
 * The marks of the nodes this feature adds. It reads the site through the
 * selectors of the card detection and adds nothing else of its own here.
 */

/** Marks the floating panel, the only node this feature adds to the body. */
export const PANEL_ATTRIBUTE = 'data-wme-panel';

export const PANEL_SELECTOR = `[${PANEL_ATTRIBUTE}]`;

/** Marks the veil added to a card that the active filter leaves aside. */
export const DIM_ATTRIBUTE = 'data-wme-dim';

export const DIM_SELECTOR = `[${DIM_ATTRIBUTE}]`;
