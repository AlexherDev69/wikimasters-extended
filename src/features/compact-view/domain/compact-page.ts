/**
 * Where the compact view is offered. The two pages that show a grid of cards
 * and nothing else: your own collection, and the catalogue of every card of
 * the game.
 *
 * This is the one place in the extension that looks at the route rather than
 * at the shape of a node. The rarity filter row the button is added to is not
 * enough on its own: the marketplace ships the very same row, and its cards
 * sit in a tile of their own, with a price under them, which this view has
 * never been measured against. The path is read, never written, and a page
 * that is not one of these two is left exactly as the site drew it.
 */
const COMPACT_PATHS: readonly string[] = ['/collection', '/global-collection'];

/**
 * True on the two pages above, whatever trailing slash or query the site
 * happens to use. The site navigates without reloading, so this is read again
 * at every sync rather than once when the page loaded.
 */
export function isCompactPage(pathname: string): boolean {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return COMPACT_PATHS.includes(path);
}
