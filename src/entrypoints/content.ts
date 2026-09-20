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

const INVALID_RESPONSE_MESSAGE = 'Unexpected categorization response';

/**
 * Asks the service worker for the categories. The answer crosses a process
 * boundary, so it is validated: an invalid one rejects, which lets the caller
 * schedule a retry.
 */
async function categorize(cards: readonly CardToCategorize[]): Promise<CardCategory[]> {
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
    const seenTitles = new Set<string>();

    function onScan(observedCards: ObservedCard[]): void {
      handleScan(observedCards, seenTitles, logger, categorize);
    }

    const root = document.body;
    onScan(scanCards(root));

    const disconnect = observeCards({ root, onScan });
    ctx.onInvalidated(disconnect);
  },
});
