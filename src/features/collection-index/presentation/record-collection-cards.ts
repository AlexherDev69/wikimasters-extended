import { chunk } from '../../../core/array/chunk';
import type { Logger } from '../../../core/logger/logger';
import type { ObservedCard } from '../../card-detection/data/scan-cards';
import { selectUnseenCards } from '../../card-detection/domain/select-unseen-cards';
import {
  CATEGORIZATION_RETRY_DELAY_MS,
  type ScheduleRetry,
} from '../../card-detection/presentation/handle-scan';
import { isValidTitle, MAX_CARDS_PER_REQUEST } from '../../categorization/presentation/messages';
import { isCollectionPath } from '../domain/collection-path';
import type { RecordedCard } from '../domain/collection-index';
import { createRouteMemory } from './route-memory';

/** Sends one batch to the service worker. Rejects when it was not recorded. */
export type SendRecordedCards = (cards: readonly RecordedCard[]) => Promise<void>;

export interface CollectionRecorderDeps {
  send: SendRecordedCards;
  logger: Logger;
  /**
   * The same scheduler as the categorization retry, armed on the content
   * script context: a timer of its own would fire after the teardown.
   */
  scheduleRetry: ScheduleRetry;
  /**
   * Whether the setting of the feature is on, asked on every scan. The recorder
   * is called on every scan whatever the answer, so that the path of the
   * previous scan keeps following the route while the feature is off: a
   * recorder that stops looking would take the first scan after a client side
   * navigation for an ordinary one and record the page being left.
   */
  isEnabled: () => boolean;
}

export interface CollectionRecorder {
  /** Called once per scan, with the cards on screen and the current path. */
  record: (observedCards: readonly ObservedCard[], pathname: string) => void;
}

/**
 * Reports to the service worker the cards the user displays on their
 * collection, and only there: the marketplace, the trades and the packs show
 * cards that are not theirs.
 *
 * The extension never turns a page by itself, so the index grows with what the
 * user looks at, and with nothing else.
 */
export function createCollectionRecorder(deps: CollectionRecorderDeps): CollectionRecorder {
  /**
   * Titles already sent since the page was loaded. A collection page mutates
   * every few hundred milliseconds and every scan sees the same cards: without
   * this, the same batch would travel again on every single one of them.
   */
  const sentTitles = new Set<string>();

  /**
   * Recording the cards of the page being left would say the user owns cards
   * of the marketplace, for good, so the first scan after a client side
   * navigation is skipped: the rendering of the new page triggers the next one.
   */
  const routeMemory = createRouteMemory();

  /**
   * Gives the titles of a rejected batch another chance, no sooner than the
   * retry delay of the categorization. Resending at once would hammer a
   * service worker that is already failing.
   */
  function releaseForRetry(titles: readonly string[]): void {
    deps.scheduleRetry(() => {
      for (const title of titles) {
        sentTitles.delete(title);
      }
    }, CATEGORIZATION_RETRY_DELAY_MS);
  }

  /** One message, with its own resend: a batch fails for itself alone. */
  function sendBatch(cards: readonly RecordedCard[]): void {
    for (const card of cards) {
      sentTitles.add(card.title);
    }

    void deps.send(cards).catch((error: unknown) => {
      deps.logger.warn('Collection cards not recorded', {
        error: error instanceof Error ? error.message : String(error),
        count: cards.length,
      });
      releaseForRetry(cards.map((card) => card.title));
    });
  }

  /**
   * The cards of this scan that can really be recorded. A title is read from
   * the DOM of the site, and the guard of the service worker refuses a whole
   * batch for a single title it cannot use, so those are left out here. They
   * are not remembered as sent, so the filter simply runs again on every scan.
   */
  function selectRecordableCards(observedCards: readonly ObservedCard[]): RecordedCard[] {
    const newCards = selectUnseenCards(
      sentTitles,
      observedCards.map((observed) => observed.card),
    );

    return newCards
      .filter((card) => isValidTitle(card.title))
      .map((card) => ({ title: card.title, rarity: card.rarity }));
  }

  return {
    record(observedCards: readonly ObservedCard[], pathname: string): void {
      // Noted before anything else, so the route memory keeps advancing while
      // the feature is off.
      const routeChanged = routeMemory.noteScan(pathname);

      // Nothing is sent and nothing is remembered as sent while the feature is
      // off, so the cards seen meanwhile are sent by the first scan that
      // follows it being switched back on.
      if (!deps.isEnabled() || !isCollectionPath(pathname) || routeChanged) {
        return;
      }

      // One message per batch the guard accepts, so a page holding more cards
      // than the limit records all of them instead of none.
      for (const batch of chunk(selectRecordableCards(observedCards), MAX_CARDS_PER_REQUEST)) {
        sendBatch(batch);
      }
    },
  };
}
