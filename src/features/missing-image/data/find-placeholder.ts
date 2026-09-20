import {
  CARD_IMAGE_SELECTOR,
  IMAGE_SOURCE_ATTRIBUTES,
  PLACEHOLDER_IMAGE_SELECTOR,
  PLACEHOLDER_SOURCE_MARKER,
} from './image-selectors';

/**
 * Finds the image area of a card the site has no picture for. Reads only: no
 * attribute, class or style is ever written on a node of the site.
 *
 * The area itself carries nothing to match on, its Tailwind classes change at
 * each deployment, so it is found structurally: the placeholder image is
 * located, then its ancestor that is a direct child of the card root. Null
 * when the card shows a real picture, and null when the layout is not the one
 * described in docs/DOM_NOTES.md, which leaves the card untouched.
 */

/** Both source attributes are read: the site fills either one. */
function hasPlaceholderSource(image: Element): boolean {
  return IMAGE_SOURCE_ATTRIBUTES.some((attribute) =>
    (image.getAttribute(attribute) ?? '').includes(PLACEHOLDER_SOURCE_MARKER),
  );
}

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

export function findPictureArea(cardRoot: HTMLElement): HTMLElement | null {
  for (const image of cardRoot.querySelectorAll(PLACEHOLDER_IMAGE_SELECTOR)) {
    // A container of ours is never read as the site: without this, a card
    // where the site swapped in a real picture could look like a card still
    // showing the placeholder, because of what we put there ourselves.
    if (image.closest(CARD_IMAGE_SELECTOR) !== null || !hasPlaceholderSource(image)) {
      continue;
    }
    const pictureArea = childOfCardRoot(image, cardRoot);
    if (pictureArea !== null) {
      return pictureArea;
    }
  }
  return null;
}
