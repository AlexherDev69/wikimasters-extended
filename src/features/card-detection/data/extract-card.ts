import { CARD_DESCRIPTION_SELECTOR, CARD_TITLE_SELECTOR } from './card-selectors';
import type { DetectedCard } from '../domain/detected-card';
import { parseRarityFromClassName } from '../domain/rarity';

/** Collapses any run of whitespace (including newlines) to a single space and trims. */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts card data from a DOM element that is expected to be a card root.
 * Returns null when a required field (rarity or title) is missing or empty.
 */
export function extractCard(element: HTMLElement): DetectedCard | null {
  const rarity = parseRarityFromClassName(element.className);
  if (rarity === null) {
    return null;
  }

  const titleEl = element.querySelector(CARD_TITLE_SELECTOR);
  if (titleEl === null) {
    return null;
  }
  const title = normalizeWhitespace(titleEl.textContent ?? '');
  if (title === '') {
    return null;
  }

  const descEl = element.querySelector(CARD_DESCRIPTION_SELECTOR);
  const rawDescription = descEl !== null ? normalizeWhitespace(descEl.textContent ?? '') : null;
  const description = rawDescription === null || rawDescription === '' ? null : rawDescription;

  return { title, description, rarity };
}
