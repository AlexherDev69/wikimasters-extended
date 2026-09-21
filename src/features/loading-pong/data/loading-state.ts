/**
 * What "the site is still loading" looks like in the page. The site draws one
 * spinner, alone in its main area, while it waits for its own data: a `div`
 * carrying the `animate-spin` utility, and nothing else on the page.
 *
 * Matched on that utility rather than on the classes around it, which change
 * at each deployment (see docs/DOM_NOTES.md). The same utility also spins in
 * a button of the site here and there, which is why a page showing cards is
 * never treated as loading: something to look at is already there.
 */
const SPINNER_SELECTOR = 'div[class*="animate-spin"]';

/**
 * True while the page shows a spinner and not one card. `cardCount` comes
 * from the scan the overlay has just run, so this costs one query of the DOM
 * and nothing else.
 */
export function isPageLoading(root: ParentNode, cardCount: number): boolean {
  return cardCount === 0 && root.querySelector(SPINNER_SELECTOR) !== null;
}
