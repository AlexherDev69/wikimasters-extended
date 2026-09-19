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

export function findCardElements(root: ParentNode): HTMLElement[] {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(CARD_ROOT_SELECTOR));
  const validCards = candidates.filter(isCardElement);

  return validCards.filter((element) =>
    !validCards.some((other) => other !== element && other.contains(element)),
  );
}
