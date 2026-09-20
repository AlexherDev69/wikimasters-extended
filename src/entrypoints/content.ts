import { browser, defineContentScript } from '#imports';
import { SITE_MATCH_PATTERNS } from '../core/config/site';
import { createLogger } from '../core/logger/logger';
import { observeCards } from '../features/card-detection/data/card-observer';
import { scanCards, type ObservedCard } from '../features/card-detection/data/scan-cards';
import { handleScan } from '../features/card-detection/presentation/handle-scan';
import type { CardCategory } from '../features/categorization/domain/category';
import type { CardToCategorize } from '../features/categorization/domain/categorize-cards';
import {
  CATEGORIZE_CARDS_MESSAGE,
  isCategorizeCardsResponse,
  type CategorizeCardsRequest,
} from '../features/categorization/presentation/messages';
import {
  rememberCategories,
  type CategoryMemory,
} from '../features/letterboxd/presentation/remember-categories';
import { syncModalLink } from '../features/letterboxd/presentation/sync-modal-link';

const INVALID_RESPONSE_MESSAGE = 'Unexpected categorization response';

/**
 * Asks the service worker for the categories. The answer crosses a process
 * boundary, so it is validated: an invalid one rejects, which lets the caller
 * schedule a retry.
 */
async function requestCategories(cards: readonly CardToCategorize[]): Promise<CardCategory[]> {
  const request: CategorizeCardsRequest = {
    type: CATEGORIZE_CARDS_MESSAGE,
    cards: [...cards],
  };
  const response: unknown = await browser.runtime.sendMessage(request);

  if (!isCategorizeCardsResponse(response)) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }
  return response.cards;
}

export default defineContentScript({
  matches: [...SITE_MATCH_PATTERNS],
  runAt: 'document_idle',
  main(ctx): void {
    const logger = createLogger('content-script');
    // Results of the cards met so far, read by the modal sync, and the titles
    // already asked for. Bounded together, so a title dropped from one is
    // dropped from the other and can be asked again if its card comes back.
    const memory: CategoryMemory = {
      categoriesByTitle: new Map<string, CardCategory>(),
      seenTitles: new Set<string>(),
    };
    /** Titles of the last scan, the cards the page shows right now. */
    let visibleTitles: ReadonlySet<string> = new Set<string>();

    async function categorize(cards: readonly CardToCategorize[]): Promise<CardCategory[]> {
      const results = await requestCategories(cards);
      rememberCategories(memory, visibleTitles, results);
      // The modal is usually already open when its results come back.
      syncModalLink(document.body, memory.categoriesByTitle);
      return results;
    }

    function onScan(observedCards: ObservedCard[]): void {
      visibleTitles = new Set(observedCards.map((observed) => observed.card.title));

      handleScan(observedCards, memory.seenTitles, logger, categorize);
      rememberCategories(memory, visibleTitles);
      // The observer of the cards also fires when the modal opens, so no
      // observer, no polling and no timer of its own is needed here.
      syncModalLink(document.body, memory.categoriesByTitle);
    }

    const root = document.body;
    onScan(scanCards(root));

    const disconnect = observeCards({ root, onScan });
    ctx.onInvalidated(disconnect);
  },
});
