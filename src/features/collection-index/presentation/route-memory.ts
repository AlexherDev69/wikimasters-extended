/**
 * The path of the previous scan, shared by the two recorders of this feature.
 *
 * A scan is debounced, so the first one after a client side navigation can
 * still read the DOM of the page being left while the URL already names the
 * new one. What that scan sees belongs to neither page with certainty, and
 * both recorders write down facts that can never be told apart afterwards: the
 * cards the user owns, and how big the catalogue is. So both skip it.
 *
 * It must be fed on EVERY scan, including the ones their setting makes them
 * ignore: a memory that stopped advancing would take the first scan after a
 * navigation for an ordinary one the moment the feature came back on.
 */
export interface RouteMemory {
  /** Notes the path of this scan and says whether the route just changed. */
  noteScan: (pathname: string) => boolean;
}

export function createRouteMemory(): RouteMemory {
  /**
   * Null before the first scan: a page loaded straight on its own route has
   * nothing to skip, since its URL and its DOM agree from the start.
   */
  let previousPathname: string | null = null;

  return {
    noteScan(pathname: string): boolean {
      const changed = previousPathname !== null && previousPathname !== pathname;
      previousPathname = pathname;
      return changed;
    },
  };
}
