import { CARD_TITLE_SELECTOR } from '../../card-detection/data/card-selectors';

/**
 * Finds the text area of a card: the child of the card root that holds the
 * `h3` the scanner reads as its title. Reads only: no attribute, class or
 * style is ever written on a node of the site.
 *
 * The area carries nothing of its own to match on, and its Tailwind classes
 * change at each deployment, so it is found structurally, exactly as
 * missing-image/data/find-placeholder.ts finds the picture area: the heading
 * is located first, then its ancestor that is a direct child of the card
 * root. Null when the card has no heading, or when the layout is not the one
 * described in docs/DOM_NOTES.md, which leaves the card untouched.
 */

/** The ancestor of `node` that is a direct child of `cardRoot`, or null. */
function childOfCardRoot(node: Element, cardRoot: HTMLElement): HTMLElement | null {
  let ancestor = node.parentElement;

  while (ancestor !== null && ancestor !== cardRoot) {
    if (ancestor.parentElement === cardRoot) {
      return ancestor;
    }
    ancestor = ancestor.parentElement;
  }
  return null;
}

export function findTextArea(cardRoot: HTMLElement): HTMLElement | null {
  const heading = cardRoot.querySelector(CARD_TITLE_SELECTOR);
  return heading === null ? null : childOfCardRoot(heading, cardRoot);
}
