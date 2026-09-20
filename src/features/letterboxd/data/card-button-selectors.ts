/**
 * Marks the button this feature adds inside the text area of a card. The
 * selectors of the link added to the detail modal live in ./modal-selectors.ts:
 * the two nodes are independent, so each keeps its own attribute.
 */
export const CARD_BUTTON_ATTRIBUTE = 'data-wme-letterboxd-card';

export const CARD_BUTTON_SELECTOR = `a[${CARD_BUTTON_ATTRIBUTE}]`;
