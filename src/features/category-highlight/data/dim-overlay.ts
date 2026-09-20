import { findChildWithAttribute } from '../../../core/dom/find-child-with-attribute';
import { DIM_ATTRIBUTE, DIM_SELECTOR } from './highlight-selectors';

/**
 * The veil is a bare `div`: the scanner reads the title of a card in its first
 * `h3` and its description in its first `p`, and a card without description
 * has no `p` at all, so neither tag may appear inside a card root.
 */
const OVERLAY_TAG = 'div';

const OVERLAY_CLASS = 'wme-dim';

/**
 * Covers one card with our veil, or takes it back, and writes NOTHING when the
 * card is already in the right state. The content script observes
 * document.body, so a sync that always wrote would schedule a scan that syncs
 * again, forever.
 *
 * The veil is a child of ours added to the card. The card itself is read,
 * never restyled: nothing of the site is touched, and the veil lets every
 * click through to the card underneath.
 */
export function applyDimOverlay(cardRoot: HTMLElement, dimmed: boolean): void {
  // The veil is a child of the card root, so only the children are looked at:
  // this runs for every card of the page on every scan.
  const existing = findChildWithAttribute(cardRoot, DIM_ATTRIBUTE);

  if (!dimmed) {
    existing?.remove();
    return;
  }
  if (existing !== null) {
    return;
  }

  const overlay = cardRoot.ownerDocument.createElement(OVERLAY_TAG);
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute(DIM_ATTRIBUTE, '');
  cardRoot.appendChild(overlay);
}

/**
 * Takes back every veil under `root`. Called when the filter is dropped for
 * cards that left the page, and when the content script context is
 * invalidated, so reloading the extension leaves no card veiled.
 */
export function removeDimOverlays(root: ParentNode): void {
  for (const overlay of root.querySelectorAll(DIM_SELECTOR)) {
    overlay.remove();
  }
}
