import { BRAND_MARK_ATTRIBUTE, BRAND_MARK_SELECTOR, SITE_NAME_SELECTOR } from './brand-selectors';

/**
 * The word the extension writes under the name of the site: the one place
 * that says, at a glance, that this browser is showing more than the site
 * sends. It is the signature of the extension, not a feature of its own, so
 * it has no switch: it appears wherever the site draws its own name, and it
 * goes away whole with the extension.
 *
 * Only our own node is created. The name of the site is read and used as a
 * place to stand under: not one of its attributes, classes or styles is
 * touched, and nothing of the site is moved or removed.
 */

const MARK_TAG = 'span';

const MARK_TEXT = 'Extended';

/**
 * The name of the site is a link, and the link belongs to the site: a screen
 * reader must keep reading it as the site wrote it, "WikiMasters", and not as
 * "WikiMasters Extended". The word is there for the eye alone; the popup and
 * the options page are what tell the rest.
 */
const HIDDEN_ATTRIBUTE = 'aria-hidden';

function buildMark(document: Document): HTMLElement {
  const mark = document.createElement(MARK_TAG);

  // The attribute is the whole identity of the node: the style sheet reads it,
  // and so does the pass that looks for the word already written.
  mark.setAttribute(BRAND_MARK_ATTRIBUTE, '');
  mark.setAttribute(HIDDEN_ATTRIBUTE, 'true');
  mark.textContent = MARK_TEXT;

  return mark;
}

/**
 * Writes the word under the name of the site, and writes NOTHING when it is
 * already there. The content script observes `document.body`, so a sync that
 * always wrote would schedule a scan that syncs again, forever.
 *
 * Called on every scan, like every other sync of the overlay: the site
 * navigates from one page to the next without ever reloading, and React
 * rebuilds its navigation whenever it pleases, so the word is put back by the
 * scan that the rebuild itself raises.
 */
export function applyBrandMark(root: ParentNode): void {
  // Every name the site draws, and not just the first one: one page holds one
  // today, measured on five real exports, but a navigation of its own for the
  // narrow screens would hold a second, and it costs nothing to write under
  // both.
  for (const siteName of root.querySelectorAll(SITE_NAME_SELECTOR)) {
    // The selector asks for the heading of a link, so the parent is that link.
    const link = siteName.parentElement;

    // Ours is looked for inside that link only, and not anywhere on the page:
    // the one left in a navigation React has just thrown away would otherwise
    // pass for the one we are about to need.
    if (link === null || link.querySelector(BRAND_MARK_SELECTOR) !== null) {
      continue;
    }
    siteName.insertAdjacentElement('afterend', buildMark(link.ownerDocument));
  }
}

/**
 * Takes back every word this feature wrote, and writes NOTHING when there is
 * none. Called when the content script context is invalidated, so reloading
 * the extension does not leave its signature on a page it no longer watches.
 */
export function removeBrandMarks(root: ParentNode): void {
  for (const mark of root.querySelectorAll(BRAND_MARK_SELECTOR)) {
    mark.remove();
  }
}
