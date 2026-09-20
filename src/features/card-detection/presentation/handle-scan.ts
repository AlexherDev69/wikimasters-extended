import type { Logger } from '../../../core/logger/logger';
import type {
  CardCategory,
  CategorizationStatus,
  CategoryId,
  PersonSubtypeId,
} from '../../categorization/domain/category';
import type { CardToCategorize } from '../../categorization/domain/categorize-cards';
import type { DetectedCard } from '../domain/detected-card';
import { selectUnseenCards } from '../domain/select-unseen-cards';

/**
 * What this module needs of one thing observed on the page: the card it
 * names, never the node that names it. A card of the page comes from the
 * scanner with its root, a card of a trade offer from the chip that names it,
 * and one batch may hold both.
 */
export interface ScannedCard {
  card: DetectedCard;
}

/** Asks the service worker for the category of each card. */
export type CategorizeCards = (cards: readonly CardToCategorize[]) => Promise<CardCategory[]>;

/** Runs `callback` later. Injected so tests do not depend on real timers. */
export type ScheduleRetry = (callback: () => void, delayMs: number) => void;

/**
 * Delay before a card that could not be categorized becomes eligible again.
 * Retrying at once would hammer Wikimedia during an outage, because a page
 * that mutates continuously triggers a scan every 200 ms.
 */
export const CATEGORIZATION_RETRY_DELAY_MS = 60_000;

const defaultScheduleRetry: ScheduleRetry = (callback, delayMs) => {
  setTimeout(callback, delayMs);
};

interface CardLogEntry {
  title: string;
  rarity: string;
  status: CategorizationStatus;
  categoryId: CategoryId | null;
  primarySubtype: PersonSubtypeId | null;
}

function toLogEntries(
  newCards: readonly DetectedCard[],
  resultByTitle: ReadonlyMap<string, CardCategory>,
): CardLogEntry[] {
  return newCards.map((card) => {
    const result = resultByTitle.get(card.title);
    return {
      title: card.title,
      rarity: card.rarity,
      status: result?.status ?? 'error',
      categoryId: result?.categoryId ?? null,
      primarySubtype: result?.primarySubtype ?? null,
    };
  });
}

/** Titles that did not get a usable category and deserve a later attempt. */
function selectRetryableTitles(
  newCards: readonly DetectedCard[],
  resultByTitle: ReadonlyMap<string, CardCategory>,
): string[] {
  return newCards
    .map((card) => card.title)
    .filter((title) => (resultByTitle.get(title)?.status ?? 'error') === 'error');
}

/**
 * Processes a batch of observed cards: selects the unseen ones synchronously,
 * adds them to `seenTitles`, then logs one info entry once their categories
 * come back.
 *
 * Titles are marked as seen immediately so that the scans firing while the
 * answer is pending do not ask again. Those that failed are released after
 * CATEGORIZATION_RETRY_DELAY_MS so a transient outage is not permanent for the
 * lifetime of the page.
 *
 * Exported so it can be unit-tested independently of the WXT runtime.
 */
export function handleScan(
  observedCards: readonly ScannedCard[],
  seenTitles: Set<string>,
  logger: Logger,
  categorize: CategorizeCards,
  scheduleRetry: ScheduleRetry = defaultScheduleRetry,
): void {
  const allCards = observedCards.map((observed) => observed.card);
  const newCards = selectUnseenCards(seenTitles, allCards);

  if (newCards.length === 0) {
    return;
  }

  for (const card of newCards) {
    seenTitles.add(card.title);
  }

  function releaseForRetry(titles: readonly string[]): void {
    if (titles.length === 0) {
      return;
    }
    scheduleRetry(() => {
      for (const title of titles) {
        seenTitles.delete(title);
      }
    }, CATEGORIZATION_RETRY_DELAY_MS);
  }

  const toCategorize: CardToCategorize[] = newCards.map((card) => ({
    title: card.title,
    description: card.description,
  }));

  void categorize(toCategorize)
    .then((results) => {
      const resultByTitle = new Map(results.map((result) => [result.title, result]));
      logger.info('Cards categorized', {
        pathname: window.location.pathname,
        count: newCards.length,
        cards: toLogEntries(newCards, resultByTitle),
      });
      releaseForRetry(selectRetryableTitles(newCards, resultByTitle));
    })
    .catch((error: unknown) => {
      logger.warn('Card categorization failed', {
        error: error instanceof Error ? error.message : String(error),
        count: newCards.length,
      });
      releaseForRetry(newCards.map((card) => card.title));
    });
}
