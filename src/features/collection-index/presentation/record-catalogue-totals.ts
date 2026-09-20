import type { Logger } from '../../../core/logger/logger';
import { RARITIES } from '../../card-detection/domain/rarity';
import {
  CATEGORIZATION_RETRY_DELAY_MS,
  type ScheduleRetry,
} from '../../card-detection/presentation/handle-scan';
import { readCatalogueTotals } from '../data/read-catalogue-totals';
import { isCataloguePath } from '../domain/catalogue-path';
import { isCatalogueTotals, type CatalogueTotals } from '../domain/catalogue-totals';
import { createRouteMemory } from './route-memory';

/** Sends one reading to the service worker. Rejects when it was not recorded. */
export type SendCatalogueTotals = (totals: CatalogueTotals) => Promise<void>;

export interface CatalogueRecorderDeps {
  send: SendCatalogueTotals;
  logger: Logger;
  /**
   * The same scheduler as the categorization retry, armed on the content
   * script context: a timer of its own would fire after the teardown.
   */
  scheduleRetry: ScheduleRetry;
  /**
   * Whether the setting of the collection index is on, asked on every scan.
   * The totals are the denominator of that index and have no switch of their
   * own: an index the user turned off has no completion to show.
   */
  isEnabled: () => boolean;
}

export interface CatalogueRecorder {
  /** Called once per scan, with the page read and the current path. */
  record: (root: ParentNode, pathname: string) => void;
}

function areSameTotals(left: CatalogueTotals, right: CatalogueTotals): boolean {
  return RARITIES.every((rarity) => left[rarity] === right[rarity]);
}

/**
 * Reports to the service worker how many cards the game holds per rarity,
 * read on the catalogue page of the site when the user happens to open it.
 *
 * Nothing is ever fetched and no page is ever turned: these are the numbers
 * the page displays, and the extension never navigates there by itself.
 */
export function createCatalogueRecorder(deps: CatalogueRecorderDeps): CatalogueRecorder {
  /**
   * The last reading handed over since the page was loaded. The catalogue page
   * mutates every few hundred milliseconds and every scan reads the same
   * numbers: without this, one message would travel per scan.
   */
  let sentTotals: CatalogueTotals | null = null;

  /**
   * The reader accepts any block whose six labels appear once and add up to
   * the total it displays itself, wherever it sits: the first scan after a
   * client side navigation could hand it such a block from the page being
   * left, and those totals would then stand until the catalogue is read again,
   * which a search in progress can hold off for as long as it lasts.
   */
  const routeMemory = createRouteMemory();

  /**
   * Gives a rejected reading another chance, no sooner than the retry delay of
   * the categorization: resending at once would hammer a service worker that
   * is already failing. A newer reading sent meanwhile stands, so the retry
   * only releases the one it was armed for.
   */
  function releaseForRetry(totals: CatalogueTotals): void {
    deps.scheduleRetry(() => {
      if (sentTotals !== null && areSameTotals(sentTotals, totals)) {
        sentTotals = null;
      }
    }, CATEGORIZATION_RETRY_DELAY_MS);
  }

  function sendTotals(totals: CatalogueTotals): void {
    sentTotals = totals;

    void deps.send(totals).catch((error: unknown) => {
      deps.logger.warn('Catalogue totals not recorded', {
        error: error instanceof Error ? error.message : String(error),
      });
      releaseForRetry(totals);
    });
  }

  return {
    record(root: ParentNode, pathname: string): void {
      // Noted before anything else, so the route memory keeps advancing while
      // the feature is off.
      const routeChanged = routeMemory.noteScan(pathname);

      if (!deps.isEnabled() || !isCataloguePath(pathname) || routeChanged) {
        return;
      }
      // Null on anything the reader is not certain of, a search in progress
      // included, since the site then replaces the whole block: nothing is
      // sent, and what the service worker recorded before stays.
      const totals = readCatalogueTotals(root);
      if (totals === null || (sentTotals !== null && areSameTotals(sentTotals, totals))) {
        return;
      }
      // The reader accepts any safe whole number while the service worker caps
      // each total: a reading above that bound would be refused for good and
      // sent again every minute, so it is dropped here, exactly as a title the
      // service worker would refuse never leaves the other recorder.
      if (!isCatalogueTotals(totals)) {
        return;
      }
      sendTotals(totals);
    },
  };
}
