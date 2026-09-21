import type { Logger } from '../../../core/logger/logger';
import { applyBrandMark, removeBrandMarks } from '../../brand-mark/data/brand-mark';
import { findDetailModal } from '../../card-detection/data/detail-modal';
import { scanCards, type ObservedCard } from '../../card-detection/data/scan-cards';
import { handleScan, type ScheduleRetry } from '../../card-detection/presentation/handle-scan';
import type { CardCategory } from '../../categorization/domain/category';
import type { CardToCategorize } from '../../categorization/domain/categorize-cards';
import type { RequestCategories } from '../../categorization/presentation/messages';
import {
  rememberCategories,
  type CategoryMemory,
} from '../../categorization/presentation/remember-categories';
import { removeCompactStyle } from '../../compact-view/data/compact-style';
import { removeCompactToggles } from '../../compact-view/data/compact-toggle';
import type { CompactPreferenceStore } from '../../compact-view/domain/compact-preference-store';
import {
  createCompactViewState,
  syncCompactView,
} from '../../compact-view/presentation/sync-compact-view';
import { applyHideCardStats, removeHideCardStats } from '../../hide-card-stats/data/hide-stats-style';
import { removeCardButtons } from '../../letterboxd/data/card-button';
import { removeModalLink } from '../../letterboxd/data/modal-link';
import { syncCardButtons } from '../../letterboxd/presentation/sync-card-buttons';
import { syncModalLink } from '../../letterboxd/presentation/sync-modal-link';
import { isPageLoading } from '../../loading-pong/data/loading-state';
import {
  createLoadingPongState,
  stopLoadingPong,
  syncLoadingPong,
  type LoadingPongDeps,
} from '../../loading-pong/presentation/sync-loading-pong';
import { removeCardImages } from '../../missing-image/data/card-image';
import { removeModalCreditLines } from '../../missing-image/data/modal-credit-line';
import { syncCardImages } from '../../missing-image/presentation/sync-card-images';
import { syncModalCredit } from '../../missing-image/presentation/sync-modal-credit';
import { removePullStatsPanels } from '../../pull-stats/data/pull-stats-panel';
import type { PullTally } from '../../pull-stats/domain/pull-tally';
import type { PullTallyStore } from '../../pull-stats/domain/pull-tally-store';
import {
  createPullStatsState,
  syncPullStats,
} from '../../pull-stats/presentation/sync-pull-stats';
import { scanTradeChips, type ObservedTradeCard } from '../../trade-cards/data/scan-trade-chips';
import { removeTradePreviews } from '../../trade-cards/data/trade-preview';
import { syncTradePreviews } from '../../trade-cards/presentation/sync-trade-previews';
import { removeWikipediaButtons } from '../../wikipedia-link/data/wikipedia-button';
import { syncWikipediaButtons } from '../../wikipedia-link/presentation/sync-wikipedia-buttons';
import { hasEnabledFeature, type Settings } from '../domain/settings';

/**
 * Everything the content script puts on a page of the site, under the control
 * of the settings. It lives with them because they are what switches each of
 * its parts on and off; the entrypoint keeps only the wiring to the extension
 * runtime, which no test can run.
 */
export interface Overlay {
  /** Called on every scan, with the cards on screen. */
  onScan: (cards: readonly ObservedCard[]) => void;
  /**
   * Brings the overlay in line with settings that have just changed, and runs
   * a whole scan at once so a feature switched back on does not wait for the
   * next mutation of the page: with everything off nothing was ever asked for,
   * so there would be nothing to draw and no reason for the page to mutate.
   */
  applySettings: (settings: Settings) => void;
  /** Takes back every node the overlay added. */
  destroy: () => void;
}

export interface OverlayDeps {
  /** The node every part writes in, `document.body` in the content script. */
  root: HTMLElement;
  /** The settings as they are when the page loads, read before the first scan. */
  settings: Settings;
  logger: Logger;
  /** Asks the service worker for the categories of a batch of cards. */
  categorize: RequestCategories;
  scheduleRetry: ScheduleRetry;
  /** Where the cards counted on the page of the packs are kept. */
  pullTallyStore: PullTallyStore;
  /** What that store held when the page loaded, read before the first scan. */
  pullTally: PullTally;
  /** Where the compact view of the card grids is remembered. */
  compactStore: CompactPreferenceStore;
  /** Whether that view was on when the page loaded, read before the first scan. */
  isCompact: boolean;
  /** The path of the page right now: the site navigates without reloading. */
  readPath: () => string;
  /** Asks for the next animation frame, for the game of the loading screen. */
  requestFrame: (callback: (timeMs: number) => void) => void;
}

export function createOverlay(deps: OverlayDeps): Overlay {
  const { root, logger } = deps;
  let settings = deps.settings;
  // Results of the cards met so far, read by every part of the overlay, and
  // the titles already asked for. Bounded together, so a title dropped from
  // one is dropped from the other and can be asked again if its card returns.
  const memory: CategoryMemory = {
    categoriesByTitle: new Map<string, CardCategory>(),
    seenTitles: new Set<string>(),
  };
  /** Titles of the last scan, the cards the page shows right now. */
  let visibleTitles: ReadonlySet<string> = new Set<string>();
  /**
   * What has been counted of the packs, and what a pack being opened has
   * already given. It outlives every scan on purpose: the site opens a pack
   * without ever reloading the page, so a counter rebuilt at each scan would
   * count the same card at every mutation of the reveal.
   */
  const pullStats = createPullStatsState(deps.pullTally);
  /**
   * Whether the cards are drawn small right now. It outlives every scan for
   * the same reason: the button that flips it is on the page, and the site
   * never reloads between two presses.
   */
  const compactView = createCompactViewState(deps.isCompact);
  /**
   * How long the page has been showing nothing, and the game that came of it.
   * It outlives every scan as well: the wait is measured across them.
   */
  const loadingPong = createLoadingPongState();

  /**
   * The retry of a batch that failed, and the scan without which it never
   * happens. `handleScan` releases the titles it could not categorize so they
   * can be asked again, but nothing asks for a title that nobody scans: a page
   * that has stopped mutating raises no scan of its own, and a detail modal
   * left open over a card that no longer moves is exactly that. Scanning here
   * is what turns the release into a second attempt.
   *
   * The cards are read again rather than taken from the scan that failed: a
   * minute has passed, and the page may show anything by now.
   */
  const scheduleRetry: ScheduleRetry = (release, delayMs) => {
    deps.scheduleRetry(() => {
      release();
      processScan(scanCards(root));
    }, delayMs);
  };

  /** Everything the game of the loading screen needs, built once. */
  const loadingPongDeps: LoadingPongDeps = {
    scheduleCheck: deps.scheduleRetry,
    requestFrame: deps.requestFrame,
    // A page showing nothing mutates nothing, so the end of the wait has to
    // ask for the scan that acts on it.
    requestSync: () => {
      processScan(scanCards(root));
    },
    logger,
  };

  /**
   * Brings every enabled part in line with what is known of the cards given,
   * and writes strictly nothing for the others. Every sync writes only what
   * differs, so running it on every scan costs nothing once the page already
   * shows the right thing.
   */
  function sync(cards: readonly ObservedCard[], trades: readonly ObservedTradeCard[]): void {
    const { categoriesByTitle } = memory;

    // The signature of the extension, under the name of the site. It has no
    // switch of its own: it says that this browser shows more than the site
    // sends, which is true of the extension itself and not of one feature.
    applyBrandMark(root);

    if (settings.letterboxdLink) {
      syncCardButtons(cards, categoriesByTitle);
    }
    // Needs nothing of what Wikidata knows: the address is built from the
    // title the scan has just read, so this one draws on the very first pass.
    if (settings.wikipediaLink) {
      syncWikipediaButtons(cards);
    }
    if (settings.missingImages) {
      syncCardImages(cards, categoriesByTitle);
    }
    // Not a part of a card of the site but a card of its own, drawn beside
    // the chip that names it, and never inside the detail modal: it is synced
    // before the modal is even looked for.
    if (settings.tradeCards) {
      syncTradePreviews(root, trades, categoriesByTitle);
    }
    // Global to the page rather than per card, and needs nothing that came
    // from a scan: it can run before the cards are even looked at.
    if (settings.hideCardStats) {
      applyHideCardStats(root.ownerDocument);
    }
    // Reads the rarity the cards already carry, and knows nothing of their
    // category: it is synced before the early return below, which only guards
    // what needs the detail modal.
    if (settings.pullStats) {
      syncPullStats(root, cards, pullStats, { store: deps.pullTallyStore, logger });
    }
    // Global to the page as well, and needs nothing of a card either: it only
    // decides the size the site's own cards are painted at.
    if (settings.compactView) {
      syncCompactView(root, compactView, {
        store: deps.compactStore,
        logger,
        readPath: deps.readPath,
        // The press writes nothing on the page, so nothing would make it
        // mutate: the scan that shows the new size has to be asked for.
        requestSync: () => {
          processScan(scanCards(root));
        },
      });
    }
    // Last of the page-wide parts, and the only one that reads no card at
    // all: it runs precisely when there is none.
    if (settings.loadingPong) {
      syncLoadingPong(root, isPageLoading(root, cards.length), loadingPong, loadingPongDeps);
    }
    if (!settings.letterboxdLink && !settings.missingImages) {
      return;
    }
    // The observer of the cards also fires when the modal opens, so no
    // observer, no polling and no timer of its own is needed here. The modal
    // is looked up once and shared: the two features write in the same one.
    const modal = findDetailModal(root);
    if (settings.letterboxdLink) {
      syncModalLink(modal, categoriesByTitle);
    }
    if (settings.missingImages) {
      syncModalCredit(modal, categoriesByTitle);
    }
  }

  /**
   * The cards the trade offers on screen name, empty while the feature is
   * off: a switch that is off must cost neither a query of the DOM nor a
   * request about the cards it would have drawn.
   */
  function scanTrades(): ObservedTradeCard[] {
    return settings.tradeCards ? scanTradeChips(root) : [];
  }

  async function categorize(cards: readonly CardToCategorize[]): Promise<CardCategory[]> {
    // The setting is read here, when the batch leaves, and not captured when
    // the overlay was built: a user who switches the images off stops the
    // requests for their addresses from the very next batch, and switching
    // them back on resolves again.
    const results = await deps.categorize(cards, {
      // Two features draw a picture of Wikimedia: the one that fills in what
      // the site left empty, and the cards of a trade offer, which the page
      // shows no picture of at all. Either one asks for the addresses.
      resolveImageUrls: settings.missingImages || settings.tradeCards,
    });
    rememberCategories(memory, visibleTitles, results);
    // The page has kept mutating while the answer was on its way, so the cards
    // are read again rather than taken from the scan that asked.
    sync(scanCards(root), scanTrades());
    return results;
  }

  /**
   * Everything one scan does, wherever it comes from: the observer of the page
   * or a setting that has just changed. Both go through here so a feature
   * switched back on is asked for at once, exactly as a mutation of the page
   * would have asked for it.
   */
  function processScan(cards: readonly ObservedCard[]): void {
    // The cards of the page and the cards its trade offers name go through
    // the same batch and the same memory: a title is a title, wherever it was
    // read, and one met in both places is asked for once.
    const trades = scanTrades();
    const scanned = [...cards, ...trades];
    visibleTitles = new Set(scanned.map((observed) => observed.card.title));

    // Nothing at all is asked of Wikimedia while every feature is off: a user
    // who turns the whole overlay off generates no traffic.
    if (hasEnabledFeature(settings)) {
      handleScan(scanned, memory.seenTitles, logger, categorize, scheduleRetry);
    }
    rememberCategories(memory, visibleTitles);
    sync(cards, trades);
  }

  /** Takes back the nodes of the parts that `previous` had and `settings` has not. */
  function removeDisabledNodes(previous: Settings): void {
    if (previous.letterboxdLink && !settings.letterboxdLink) {
      removeModalLink(root);
      removeCardButtons(root);
    }
    if (previous.wikipediaLink && !settings.wikipediaLink) {
      removeWikipediaButtons(root);
    }
    if (previous.missingImages && !settings.missingImages) {
      removeCardImages(root);
      removeModalCreditLines(root);
    }
    if (previous.hideCardStats && !settings.hideCardStats) {
      removeHideCardStats(root.ownerDocument);
    }
    if (previous.tradeCards && !settings.tradeCards) {
      removeTradePreviews(root);
    }
    if (previous.pullStats && !settings.pullStats) {
      removePullStatsPanels(root);
    }
    if (previous.compactView && !settings.compactView) {
      removeCompactToggles(root);
      removeCompactStyle(root.ownerDocument);
    }
    if (previous.loadingPong && !settings.loadingPong) {
      stopLoadingPong(root, loadingPong);
    }
  }

  return {
    onScan(cards): void {
      processScan(cards);
    },

    applySettings(next): void {
      const previous = settings;
      settings = next;
      removeDisabledNodes(previous);
      // A click in the options page comes between two scans, so the cards are
      // read again rather than taken from the last one.
      processScan(scanCards(root));
    },

    destroy(): void {
      // Reloading the extension leaves the page open: everything the overlay
      // added goes away with it, rather than staying behind with nobody to
      // keep it in line with the cards on screen.
      removeModalLink(root);
      removeCardButtons(root);
      removeWikipediaButtons(root);
      removeCardImages(root);
      removeModalCreditLines(root);
      removeHideCardStats(root.ownerDocument);
      removeTradePreviews(root);
      removePullStatsPanels(root);
      removeCompactToggles(root);
      removeCompactStyle(root.ownerDocument);
      stopLoadingPong(root, loadingPong);
      removeBrandMarks(root);
    },
  };
}
