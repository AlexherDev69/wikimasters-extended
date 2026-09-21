/**
 * What this feature matches on the site's own DOM, and the mark it writes on
 * its own node.
 *
 * The site carries the font of its headings in an inline custom property,
 * which `docs/DOM_NOTES.md` records as the stable signal here: the Tailwind
 * classes around a node change at each deployment of the site, the name of a
 * variable does not. The title of a page carries that very same property, so
 * the name of the site is told apart by the one thing only it has, measured
 * on five real exports: it is the heading OF A LINK, the one that leads back
 * to the packs. A page title is never wrapped in a link.
 */
const HEADING_FONT_VARIABLE = '--font-heading';

/** The name of the site, at the top of its own navigation. */
export const SITE_NAME_SELECTOR = `a > h1[style*="${HEADING_FONT_VARIABLE}"]`;

/** Marks the one node this feature adds, so a second sync finds it again. */
export const BRAND_MARK_ATTRIBUTE = 'data-wme-brand-mark';

export const BRAND_MARK_SELECTOR = `[${BRAND_MARK_ATTRIBUTE}]`;
