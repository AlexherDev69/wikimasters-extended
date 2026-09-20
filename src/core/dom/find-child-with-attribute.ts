/**
 * The direct child of `parent` carrying `attribute`, searched from the last
 * child backwards, or null when there is none.
 *
 * The nodes the extension adds to a card are appended, so the last children
 * are the ones to look at first. A `querySelector` would walk the whole
 * subtree of every card on every scan, which a page of a thousand cards pays
 * several times a second, and it would also match a node deeper down. `:scope`
 * would express the same thing in one selector, but support for it in the DOM
 * implementations this code runs on is not something to depend on.
 */
export function findChildWithAttribute(parent: Element, attribute: string): Element | null {
  const { children } = parent;

  for (let index = children.length - 1; index >= 0; index -= 1) {
    const child = children[index];
    if (child !== undefined && child.hasAttribute(attribute)) {
      return child;
    }
  }
  return null;
}
