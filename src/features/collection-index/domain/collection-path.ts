/**
 * Only the pages of the personal collection feed the index. The cards of the
 * marketplace, of the trades, of a pack being opened and of the global
 * collection are not owned by the user, so counting them as theirs would make
 * the whole summary wrong.
 */
const COLLECTION_PATH = '/collection';

/** The same page, with the trailing slash a browser may leave in the URL. */
const COLLECTION_PATH_WITH_SLASH = `${COLLECTION_PATH}/`;

/**
 * The rule is exactly these two paths. No sub route of the collection has ever
 * been observed on the site, and an unknown `/collection/<something>` could
 * list cards the user does not own, which the index could never tell apart
 * afterwards. It is widened only against a real page, never in anticipation.
 */
export function isCollectionPath(pathname: string): boolean {
  return pathname === COLLECTION_PATH || pathname === COLLECTION_PATH_WITH_SLASH;
}
