import { WIKIPEDIA_BUTTON_ATTRIBUTE } from '../../wikipedia-link/data/wikipedia-button-selectors';

/**
 * Every selector of the site this extension reads, gathered here: the site
 * ships no data attribute and its Tailwind classes change at each deployment,
 * so this is the single place to fix when the DOM moves.
 */

export const CARD_ROOT_SELECTOR = 'div[class*="glow-"]';
export const CARD_TITLE_SELECTOR = 'h3';
export const CARD_DESCRIPTION_SELECTOR = 'p';

/**
 * Full-screen layers of the page. The detail modal is one of them, and the
 * site may render others with the same utility classes, so a layer is only the
 * detail modal when it also holds the frame below.
 */
export const MODAL_ROOT_SELECTOR = 'div.fixed.inset-0.z-50';

/**
 * Frame of a panel, the one semantic class the site writes itself. It is not
 * specific to the detail modal: docs/DOM_NOTES.md also finds it on the header
 * block of `/global-collection` and on the tiles of the marketplace, so a
 * selector that means "a panel OF THE MODAL" needs MODAL_ROOT_SELECTOR in
 * front of it.
 */
export const MODAL_FRAME_SELECTOR = 'div.card-frame';

/**
 * The site link the features of the extension insert their own nodes after.
 *
 * Our own button on the card points at the very same article, so it is left
 * out by name: the modal renders its card before the column holding the link
 * of the site, so the first match would be ours, and everything the extension
 * adds to the modal would be anchored inside the card.
 *
 * The name of that attribute is taken from the feature that writes it, which
 * is the one import this file makes of a feature rather than the other way
 * round. Copying the string here would put the same name in two places, and
 * the day one of them moved, this selector would quietly stop excluding
 * anything. The file imported holds two constants and imports nothing.
 */
export const WIKIPEDIA_LINK_SELECTOR = `a[href^="https://fr.wikipedia.org/wiki/"]:not([${WIKIPEDIA_BUTTON_ATTRIBUTE}])`;
