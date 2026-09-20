/**
 * Every selector this feature uses, gathered here: the site ships no data
 * attribute and its Tailwind classes change at each deployment, so this is the
 * single place to fix when the modal moves.
 */

/**
 * Full-screen layers of the page. The detail modal is one of them, and the
 * site may render others with the same utility classes, so a layer is only the
 * detail modal when it also holds the frame below.
 */
export const MODAL_ROOT_SELECTOR = 'div.fixed.inset-0.z-50';

/** Frame of a card, the semantic class the site puts on its own modal. */
export const MODAL_FRAME_SELECTOR = 'div.card-frame';

/** The site link our own link is inserted after. */
export const WIKIPEDIA_LINK_SELECTOR = 'a[href^="https://fr.wikipedia.org/wiki/"]';

/** Marks the only node this feature ever adds, so it can be found again. */
export const LETTERBOXD_LINK_ATTRIBUTE = 'data-wme-letterboxd';

export const LETTERBOXD_LINK_SELECTOR = `a[${LETTERBOXD_LINK_ATTRIBUTE}]`;
