import { browser, defineContentScript } from '#imports';
import { SITE_MATCH_PATTERNS } from '../core/config/site';
import { createLogger } from '../core/logger/logger';
import { observeCards } from '../features/card-detection/data/card-observer';
import { findDetailModal } from '../features/card-detection/data/detail-modal';
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
} from '../features/categorization/presentation/remember-categories';
import { removeCardBadges } from '../features/category-badge/data/card-badge';
import { removeModalCategoryLines } from '../features/category-badge/data/modal-category-line';
import { syncCardBadges } from '../features/category-badge/presentation/sync-card-badges';
import { syncModalCategory } from '../features/category-badge/presentation/sync-modal-category';
import {
  createCategoryHighlight,
} from '../features/category-highlight/presentation/category-highlight';
import { removeModalLink } from '../features/letterboxd/data/modal-link';
import { syncModalLink } from '../features/letterboxd/presentation/sync-modal-link';
import '../features/category-badge/presentation/category-badge.css';
import '../features/category-highlight/presentation/category-highlight.css';

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
    const root = document.body;
    // Results of the cards met so far, read by every part of the overlay, and
    // the titles already asked for. Bounded together, so a title dropped from
    // one is dropped from the other and can be asked again if its card returns.
    const memory: CategoryMemory = {
      categoriesByTitle: new Map<string, CardCategory>(),
      seenTitles: new Set<string>(),
    };
    /** Titles of the last scan, the cards the page shows right now. */
    let visibleTitles: ReadonlySet<string> = new Set<string>();
    const highlight = createCategoryHighlight(root);

    /**
     * Brings the whole overlay in line with what is known of the cards given.
     * Every sync writes only what differs, so running it on every scan costs
     * nothing once the page already shows the right thing.
     */
    function syncOverlay(observedCards: readonly ObservedCard[]): void {
      syncCardBadges(observedCards, memory.categoriesByTitle);
      highlight.sync(observedCards, memory.categoriesByTitle);
      // The observer of the cards also fires when the modal opens, so no
      // observer, no polling and no timer of its own is needed here. The modal
      // is looked up once and shared: both features write in the same one.
      const modal = findDetailModal(root);
      syncModalLink(modal, memory.categoriesByTitle);
      syncModalCategory(modal, memory.categoriesByTitle);
    }

    async function categorize(cards: readonly CardToCategorize[]): Promise<CardCategory[]> {
      const results = await requestCategories(cards);
      rememberCategories(memory, visibleTitles, results);
      // The page has kept mutating while the answer was on its way, so the
      // cards are read again rather than taken from the scan that asked.
      syncOverlay(scanCards(root));
      return results;
    }

    function onScan(observedCards: ObservedCard[]): void {
      visibleTitles = new Set(observedCards.map((observed) => observed.card.title));

      handleScan(observedCards, memory.seenTitles, logger, categorize);
      rememberCategories(memory, visibleTitles);
      syncOverlay(observedCards);
    }

    onScan(scanCards(root));

    const disconnect = observeCards({ root, onScan });
    ctx.onInvalidated(() => {
      disconnect();
      // Reloading the extension leaves the page open: everything the overlay
      // added goes away with it, rather than staying behind with nobody to
      // keep it in line with the cards on screen.
      highlight.destroy();
      removeCardBadges(root);
      removeModalCategoryLines(root);
      removeModalLink(root);
    });
  },
});
