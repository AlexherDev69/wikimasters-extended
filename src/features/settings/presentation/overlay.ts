import type { Logger } from '../../../core/logger/logger';
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
import { removeCardBadges } from '../../category-badge/data/card-badge';
import { removeModalCategoryLines } from '../../category-badge/data/modal-category-line';
import { syncCardBadges } from '../../category-badge/presentation/sync-card-badges';
import { syncModalCategory } from '../../category-badge/presentation/sync-modal-category';
import { applyHideCardStats, removeHideCardStats } from '../../hide-card-stats/data/hide-stats-style';
import { removeCardButtons } from '../../letterboxd/data/card-button';
import { removeModalLink } from '../../letterboxd/data/modal-link';
import { syncCardButtons } from '../../letterboxd/presentation/sync-card-buttons';
import { syncModalLink } from '../../letterboxd/presentation/sync-modal-link';
import { removeCardImages } from '../../missing-image/data/card-image';
import { removeModalCreditLines } from '../../missing-image/data/modal-credit-line';
import { syncCardImages } from '../../missing-image/presentation/sync-card-images';
import { syncModalCredit } from '../../missing-image/presentation/sync-modal-credit';
import { removeTagProposals } from '../../tag-suggestions/presentation/apply-tag-proposals';
import { syncTagSuggestions } from '../../tag-suggestions/presentation/sync-tag-suggestions';
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

  /**
   * Brings every enabled part in line with what is known of the cards given,
   * and writes strictly nothing for the others. Every sync writes only what
   * differs, so running it on every scan costs nothing once the page already
   * shows the right thing.
   */
  function sync(cards: readonly ObservedCard[]): void {
    const { categoriesByTitle } = memory;

    if (settings.categoryBadges) {
      syncCardBadges(cards, categoriesByTitle);
    }
    if (settings.letterboxdLink) {
      syncCardButtons(cards, categoriesByTitle);
    }
    if (settings.missingImages) {
      syncCardImages(cards, categoriesByTitle);
    }
    // Global to the page rather than per card, and needs nothing that came
    // from a scan: it can run before the cards are even looked at.
    if (settings.hideCardStats) {
      applyHideCardStats(root.ownerDocument);
    }
    if (
      !settings.categoryBadges &&
      !settings.letterboxdLink &&
      !settings.missingImages &&
      !settings.tagSuggestions
    ) {
      return;
    }
    // The observer of the cards also fires when the modal opens, so no
    // observer, no polling and no timer of its own is needed here. The modal
    // is looked up once and shared: the four features write in the same one.
    const modal = findDetailModal(root);
    if (settings.letterboxdLink) {
      syncModalLink(modal, categoriesByTitle);
    }
    if (settings.categoryBadges) {
      syncModalCategory(modal, categoriesByTitle);
    }
    if (settings.missingImages) {
      syncModalCredit(modal, categoriesByTitle);
    }
    if (settings.tagSuggestions) {
      syncTagSuggestions(modal, categoriesByTitle, {
        // Read again on every click, never captured here: switching the
        // setting off stops it from the very next click, not the next sync.
        isAutoFillEnabled: (): boolean => settings.tagAutoFill,
      });
    }
  }

  async function categorize(cards: readonly CardToCategorize[]): Promise<CardCategory[]> {
    // The setting is read here, when the batch leaves, and not captured when
    // the overlay was built: a user who switches the images off stops the
    // requests for their addresses from the very next batch, and switching
    // them back on resolves again.
    const results = await deps.categorize(cards, { resolveImageUrls: settings.missingImages });
    rememberCategories(memory, visibleTitles, results);
    // The page has kept mutating while the answer was on its way, so the cards
    // are read again rather than taken from the scan that asked.
    sync(scanCards(root));
    return results;
  }

  /**
   * Everything one scan does, wherever it comes from: the observer of the page
   * or a setting that has just changed. Both go through here so a feature
   * switched back on is asked for at once, exactly as a mutation of the page
   * would have asked for it.
   */
  function processScan(cards: readonly ObservedCard[]): void {
    visibleTitles = new Set(cards.map((observed) => observed.card.title));

    // Nothing at all is asked of Wikimedia while every feature is off: a user
    // who turns the whole overlay off generates no traffic.
    if (hasEnabledFeature(settings)) {
      handleScan(cards, memory.seenTitles, logger, categorize, scheduleRetry);
    }
    rememberCategories(memory, visibleTitles);
    sync(cards);
  }

  /** Takes back the nodes of the parts that `previous` had and `settings` has not. */
  function removeDisabledNodes(previous: Settings): void {
    if (previous.categoryBadges && !settings.categoryBadges) {
      removeCardBadges(root);
      removeModalCategoryLines(root);
    }
    if (previous.letterboxdLink && !settings.letterboxdLink) {
      removeModalLink(root);
      removeCardButtons(root);
    }
    if (previous.missingImages && !settings.missingImages) {
      removeCardImages(root);
      removeModalCreditLines(root);
    }
    if (previous.hideCardStats && !settings.hideCardStats) {
      removeHideCardStats(root.ownerDocument);
    }
    if (previous.tagSuggestions && !settings.tagSuggestions) {
      removeTagProposals(root);
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
      removeCardBadges(root);
      removeModalCategoryLines(root);
      removeModalLink(root);
      removeCardButtons(root);
      removeCardImages(root);
      removeModalCreditLines(root);
      removeHideCardStats(root.ownerDocument);
      removeTagProposals(root);
    },
  };
}
