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
 * Set by our own `load` listener, and the only thing that shows the picture and
 * the mark naming its source: an image that never arrives leaves the
 * placeholder of the site in view rather than a hole.
 */
export const IMAGE_LOADED_ATTRIBUTE = 'data-wme-image-loaded';

/**
 * Set by our own `error` listener. It hides everything of ours, so a picture
 * that cannot be loaded leaves exactly what the site shows on a card the
 * extension found nothing for: a failure must never look like a broken card.
 *
 * Neither attribute means the picture is still on its way, which is the state
 * the style sheet draws the loading state in.
 */
export const IMAGE_FAILED_ATTRIBUTE = 'data-wme-image-failed';

/**
 * Marks the small node naming where the picture comes from, inside the
 * container. Named apart from `IMAGE_SOURCE_ATTRIBUTES` above, which are the
 * two attributes of the site this feature reads a source address in: one
 * belongs to us and is written, the others belong to the site and are only
 * ever read.
 */
export const IMAGE_SOURCE_MARK_ATTRIBUTE = 'data-wme-image-source';

/** Marks the credit line added to the detail modal. */
export const IMAGE_CREDIT_ATTRIBUTE = 'data-wme-image-credit';

export const IMAGE_CREDIT_SELECTOR = `[${IMAGE_CREDIT_ATTRIBUTE}]`;

/**
 * Marks the credit of a picture drawn on a card the extension builds itself,
 * which opens no detail modal and therefore reaches no credit line. A name of
 * its own rather than a shape of the one above: the two are looked up apart,
 * and an attribute selector matches a name whole, so neither can ever take
 * back the other's node.
 */
export const IMAGE_CREDIT_MARK_ATTRIBUTE = 'data-wme-image-credit-mark';

export const IMAGE_CREDIT_MARK_SELECTOR = `[${IMAGE_CREDIT_MARK_ATTRIBUTE}]`;
