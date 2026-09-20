import type { CardCategory } from '../../categorization/domain/category';

/**
 * How many categories the content script keeps. Browsing the marketplace
 * scans thousands of cards in one visit, so the oldest are dropped once the
 * cards they describe have left the page.
 */
export const MAX_REMEMBERED_CATEGORIES = 500;

/** The two sets the content script keeps for the cards it has met. */
export interface CategoryMemory {
  /** Result of each known title, oldest first, as a Map iterates. */
  categoriesByTitle: Map<string, CardCategory>;
  /** Titles already asked for, shared with the scan handler. */
  seenTitles: Set<string>;
}

/**
 * Stores `results`, then drops the oldest entries until the memory fits in
 * `maxEntries`. Called on every scan, with the results of the batch when they
 * arrive and without any in between, so the memory shrinks as soon as enough
 * cards have left the page.
 *
 * A title still in the DOM is never dropped, whatever its age: its card is on
 * screen and may be opened in the modal at any moment. The memory therefore
 * exceeds the cap while the page itself shows more cards than the cap, which
 * is the only correct answer to "the page holds more than we remember".
 *
 * A dropped title is released from `seenTitles` in the same move: its card is
 * gone, so nothing asks for it again until it comes back, and it is then
 * requested once more and served by the cache of the service worker. Keeping
 * it as seen would mean losing its link for the rest of the page session.
 */
export function rememberCategories(
  memory: CategoryMemory,
  visibleTitles: ReadonlySet<string>,
  results: readonly CardCategory[] = [],
  maxEntries: number = MAX_REMEMBERED_CATEGORIES,
): void {
  for (const result of results) {
    // Deleting first moves an already known title back to the newest position.
    memory.categoriesByTitle.delete(result.title);
    memory.categoriesByTitle.set(result.title, result);
  }

  for (const title of memory.categoriesByTitle.keys()) {
    if (memory.categoriesByTitle.size <= maxEntries) {
      return;
    }
    if (visibleTitles.has(title)) {
      continue;
    }
    memory.categoriesByTitle.delete(title);
    memory.seenTitles.delete(title);
  }
}
