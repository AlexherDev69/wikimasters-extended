import { CARD_ROOT_SELECTOR, CARD_TITLE_SELECTOR } from './card-selectors';
import { parseRarityFromClassName } from '../domain/rarity';

function isCardElement(element: HTMLElement): boolean {
  const rarity = parseRarityFromClassName(element.className);
  if (rarity === null) {
    return false;
  }
  const titleEl = element.querySelector(CARD_TITLE_SELECTOR);
  if (titleEl === null) {
    return false;
  }
  const text = titleEl.textContent;
  return text !== null && text.trim() !== '';
}

/**
 * Removes nested duplicates by walking each card's ancestor chain.
 * O(n * depth) instead of O(n^2) -- important for the marketplace
 * which can render 1000+ cards and triggers frequent observer rescans.
 */
function deduplicateNested(elements: HTMLElement[]): HTMLElement[] {
  const validSet = new Set<HTMLElement>(elements);

  return elements.filter((element) => {
    let ancestor = element.parentElement;
    while (ancestor !== null) {
      if (validSet.has(ancestor)) {
        return false;
      }
      ancestor = ancestor.parentElement;
    }
    return true;
  });
}

export function findCardElements(root: ParentNode): HTMLElement[] {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(CARD_ROOT_SELECTOR));
  const validCards = candidates.filter(isCardElement);
  return deduplicateNested(validCards);
}
