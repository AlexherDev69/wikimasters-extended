import type { DetectedCard } from './detected-card';

/**
 * Returns the subset of `cards` whose title has not been seen before,
 * de-duplicating within the batch (first occurrence wins), in order.
 * Does NOT mutate `seenTitles`.
 */
export function selectUnseenCards(
  seenTitles: ReadonlySet<string>,
  cards: readonly DetectedCard[],
): DetectedCard[] {
  const batchSeen = new Set<string>();
  const result: DetectedCard[] = [];

  for (const card of cards) {
    if (!seenTitles.has(card.title) && !batchSeen.has(card.title)) {
      batchSeen.add(card.title);
      result.push(card);
    }
  }

  return result;
}
