/**
 * The catalogue of the game, the only page of the site that displays how many
 * cards each rarity holds. Its cards are not owned by anyone, so it never
 * feeds the index: only the totals of its header block are read.
 */
const CATALOGUE_PATH = '/global-collection';

/** The same page, with the trailing slash a browser may leave in the URL. */
const CATALOGUE_PATH_WITH_SLASH = `${CATALOGUE_PATH}/`;

/**
 * The rule is exactly these two paths, as for the collection. A sub route of
 * the catalogue has never been observed, and an unknown one could show a
 * filtered listing whose header announces totals of its own.
 */
export function isCataloguePath(pathname: string): boolean {
  return pathname === CATALOGUE_PATH || pathname === CATALOGUE_PATH_WITH_SLASH;
}
