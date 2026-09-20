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

/** The site link the features of the extension insert their own nodes after. */
export const WIKIPEDIA_LINK_SELECTOR = 'a[href^="https://fr.wikipedia.org/wiki/"]';
