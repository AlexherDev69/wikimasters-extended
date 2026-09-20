import {
  MODAL_FRAME_SELECTOR,
  MODAL_ROOT_SELECTOR,
  WIKIPEDIA_LINK_SELECTOR,
} from './card-selectors';
import { scanCards } from './scan-cards';

/** The detail modal of the site, once found among the full-screen layers. */
export interface DetailModal {
  /** The layer itself, the subtree every feature of the extension works in. */
  root: Element;
  /**
   * Title of the card shown, read exactly as the scanner reads it, so it is
   * the very form the categorization was asked for. Null while the card cannot
   * be read, which the site does when it reuses the modal for the next card:
   * what the previous card got must go away rather than stay on the wrong one.
   */
  title: string | null;
  /** The site link our own nodes are inserted after. */
  wikipediaLink: HTMLAnchorElement;
}

/**
 * The detail modal among the full-screen layers: the one holding a card frame
 * and the Wikipedia link. Another layer of the site sharing the same utility
 * classes, a toast host or a dialog, is skipped instead of hiding the modal.
 *
 * Null when no detail modal is open: the extension then does nothing at all.
 */
export function findDetailModal(root: ParentNode): DetailModal | null {
  for (const layer of root.querySelectorAll(MODAL_ROOT_SELECTOR)) {
    const wikipediaLink = layer.querySelector<HTMLAnchorElement>(WIKIPEDIA_LINK_SELECTOR);
    if (wikipediaLink === null || layer.querySelector(MODAL_FRAME_SELECTOR) === null) {
      continue;
    }
    // The card of the modal is an ordinary card root, so the scanner reads it
    // like any other card of the page.
    const [observed] = scanCards(layer);
    return { root: layer, title: observed?.card.title ?? null, wikipediaLink };
  }
  return null;
}
