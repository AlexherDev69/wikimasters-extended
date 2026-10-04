/**
 * The page of the packs, the only one where the site reveals a pack. The
 * mutations of that page are read as they come, and those of every other page
 * are left to the scan: a grid of fifty cards has nothing to be counted, and
 * reading it at every mutation would cost what the delay of the scan is there
 * to spare.
 *
 * The path is read, never written. Should the site ever move the page, the
 * scan still counts the cards it sees, as it always did.
 */
const PULLS_PATH = '/pulls';

/**
 * True on the page above, whatever trailing slash the site happens to use.
 * The site navigates without reloading, so this is read again at every
 * mutation rather than once when the page loaded.
 */
export function isPullsPage(pathname: string): boolean {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return path === PULLS_PATH;
}
