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
import { createCategoryHighlight } from '../../category-highlight/presentation/category-highlight';
import { removeModalLink } from '../../letterboxd/data/modal-link';
import { syncModalLink } from '../../letterboxd/presentation/sync-modal-link';
import { removeCardImages } from '../../missing-image/data/card-image';
import { removeModalCreditLines } from '../../missing-image/data/modal-credit-line';
import { syncCardImages } from '../../missing-image/presentation/sync-card-images';
import { syncModalCredit } from '../../missing-image/presentation/sync-modal-credit';
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
  const { root, logger, scheduleRetry } = deps;
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
   * Rebuilt whenever the feature is switched off: the chosen filter and the
   * folded state live in the closure of the factory, so a fresh one comes back
   * exactly as it does when the page loads, without the previous filter.
   */
  let highlight = createCategoryHighlight(root);

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
    if (settings.categoryHighlight) {
      highlight.sync(cards, categoriesByTitle);
    }
    if (settings.missingImages) {
      syncCardImages(cards, categoriesByTitle);
    }
    if (!settings.categoryBadges && !settings.letterboxdLink && !settings.missingImages) {
      return;
    }
    // The observer of the cards also fires when the modal opens, so no
    // observer, no polling and no timer of its own is needed here. The modal
    // is looked up once and shared: the three features write in the same one.
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
    if (previous.categoryHighlight && !settings.categoryHighlight) {
      highlight.destroy();
      highlight = createCategoryHighlight(root);
    }
    if (previous.letterboxdLink && !settings.letterboxdLink) {
      removeModalLink(root);
    }
    if (previous.missingImages && !settings.missingImages) {
      removeCardImages(root);
      removeModalCreditLines(root);
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
      highlight.destroy();
      removeCardBadges(root);
      removeModalCategoryLines(root);
      removeModalLink(root);
      removeCardImages(root);
      removeModalCreditLines(root);
    },
  };
}
