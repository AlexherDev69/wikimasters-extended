import type { Logger } from '../../../core/logger/logger';
import type { ObservedCard } from '../data/scan-cards';
import { selectUnseenCards } from '../domain/select-unseen-cards';

interface CardLogEntry {
  title: string;
  rarity: string;
  description: string | null;
}

/**
 * Processes a batch of observed cards, adds unseen titles to `seenTitles`,
 * and logs one info entry when new cards are found.
 *
 * Exported so it can be unit-tested independently of the WXT runtime.
 */
export function handleScan(
  observedCards: ObservedCard[],
  seenTitles: Set<string>,
  logger: Logger,
): void {
  const allCards = observedCards.map((oc) => oc.card);
  const newCards = selectUnseenCards(seenTitles, allCards);

  if (newCards.length === 0) {
    return;
  }

  for (const card of newCards) {
    seenTitles.add(card.title);
  }

  const cards: CardLogEntry[] = newCards.map((card) => ({
    title: card.title,
    rarity: card.rarity,
    description: card.description,
  }));

  logger.info('New cards detected', {
    newCount: newCards.length,
    totalSeen: seenTitles.size,
    pathname: window.location.pathname,
    cards,
  });
}
