/**
 * Everything this feature matches on, in one file: the two marks of the site
 * it reads, and the attributes of the nodes it adds. The site ships no data
 * attribute and its Tailwind classes change at each deployment, so the only
 * things read here are an `alt` text and the name of an image file.
 */

/** The image the site shows on a card it has no picture for. */
export const PLACEHOLDER_IMAGE_SELECTOR = 'img[alt="WikiMasters"]';

/** Its source, in `src` or in `srcset`: the site logo used as a placeholder. */
export const PLACEHOLDER_SOURCE_MARKER = 'logo.png';

/** The attributes the site sets its image sources in, both read, never written. */
export const IMAGE_SOURCE_ATTRIBUTES: readonly string[] = ['src', 'srcset'];

/** Marks the container this feature adds inside the image area of a card. */
export const CARD_IMAGE_ATTRIBUTE = 'data-wme-card-image';

export const CARD_IMAGE_SELECTOR = `[${CARD_IMAGE_ATTRIBUTE}]`;

/**
 * File name the container currently shows. It is the comparison key of the
 * zero write rule: a card already showing the right file costs no mutation,
 * and the observer of the content script comes to rest.
 */
export const IMAGE_FILE_ATTRIBUTE = 'data-wme-image-file';

/** Kind of the image shown, which the style sheet frames differently. */
export const IMAGE_KIND_ATTRIBUTE = 'data-wme-image-kind';

/**
 * Set by our own `load` listener, and the only thing that makes the container
 * visible: an image that never arrives leaves the placeholder of the site in
 * view rather than a hole.
 */
export const IMAGE_LOADED_ATTRIBUTE = 'data-wme-image-loaded';

/** Marks the credit line added to the detail modal. */
export const IMAGE_CREDIT_ATTRIBUTE = 'data-wme-image-credit';

export const IMAGE_CREDIT_SELECTOR = `[${IMAGE_CREDIT_ATTRIBUTE}]`;
