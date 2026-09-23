import { browser, defineContentScript } from '#imports';
import { SITE_MATCH_PATTERNS } from '../core/config/site';
import { createLogger } from '../core/logger/logger';
import { observeCards } from '../features/card-detection/data/card-observer';
import { scanCards, type ObservedCard } from '../features/card-detection/data/scan-cards';
import type { ScheduleRetry } from '../features/card-detection/presentation/handle-scan';
import type { CardCategory } from '../features/categorization/domain/category';
import type {
  CardToCategorize,
  CategorizeCardsOptions,
} from '../features/categorization/domain/categorize-cards';
import {
  CATEGORIZE_CARDS_MESSAGE,
  isCategorizeCardsResponse,
  type CategorizeCardsRequest,
} from '../features/categorization/presentation/messages';
import { createCompactPreferenceStore } from '../features/compact-view/data/compact-preference-store';
import { mountDevPongButton } from '../features/loading-pong/data/dev-pong-button';
import { createChimePlayer } from '../features/notification-sound/data/chime';
import { createPullTallyStore } from '../features/pull-stats/data/pull-tally-store';
import { createSettingsRepository } from '../features/settings/data/settings-repository';
import type { Settings } from '../features/settings/domain/settings';
import { createOverlay } from '../features/settings/presentation/overlay';
import '../features/brand-mark/presentation/brand-mark.css';
import '../features/compact-view/presentation/compact-view.css';
import '../features/card-actions/presentation/card-actions.css';
import '../features/letterboxd/presentation/letterboxd.css';
import '../features/loading-pong/presentation/loading-pong.css';
import '../features/missing-image/presentation/missing-image.css';
import '../features/pull-stats/presentation/pull-stats.css';
import '../features/trade-cards/presentation/trade-cards.css';
import '../features/wikipedia-link/presentation/wikipedia-link.css';

const INVALID_RESPONSE_MESSAGE = 'Unexpected categorization response';

/**
 * Asks the service worker for the categories. The answer crosses a process
 * boundary, so it is validated: an invalid one rejects, which lets the caller
 * schedule a retry.
 */
async function requestCategories(
  cards: readonly CardToCategorize[],
  options: CategorizeCardsOptions,
): Promise<CardCategory[]> {
  const request: CategorizeCardsRequest = {
    type: CATEGORIZE_CARDS_MESSAGE,
    cards: [...cards],
    resolveImageUrls: options.resolveImageUrls,
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
  async main(ctx): Promise<void> {
    const logger = createLogger('content-script');
    const root = document.body;
    const settingsRepository = createSettingsRepository();
    const pullTallyStore = createPullTallyStore();
    const compactStore = createCompactPreferenceStore();
    /**
     * The retry of a failed categorization is armed on the context, so it is
     * cleared with it: a timer of its own would fire long after the teardown.
     */
    const scheduleRetry: ScheduleRetry = (callback, delayMs) => {
      ctx.setTimeout(callback, delayMs);
    };
    /**
     * A change that lands while the first read is on its way is in neither of
     * them, so it is held here until there is an overlay to hand it to. An open
     * tab follows a switch flipped in the options page, without asking the user
     * to reload the site.
     */
    let latestSettings: Settings | null = null;
    let applySettings = (changed: Settings): void => {
      latestSettings = changed;
    };
    // Registered BEFORE the read, which is what makes the line above enough.
    const unwatchSettings = settingsRepository.watch((changed) => {
      applySettings(changed);
    });

    // The settings are read BEFORE the first scan: a feature switched off must
    // never show up for the instant it takes to read them back. The counted
    // cards travel with them, and in the same wait: a panel that first draws
    // an empty tally would read as a collection lost, and it is one read of
    // the same storage.
    const [settings, pullTally, isCompact] = await Promise.all([
      settingsRepository.read(),
      pullTallyStore.read(),
      compactStore.read(),
    ]);

    // The extension may have been reloaded during that read. A listener added
    // to an already aborted signal is never called, so nothing would take the
    // overlay back: it is simply never put on the page.
    if (ctx.isInvalid) {
      unwatchSettings();
      return;
    }

    /**
     * DEVELOPMENT ONLY: the button that makes the overlay believe the page is
     * stuck, so the game of the loading screen can be looked at on a site that
     * works. `import.meta.env.DEV` is replaced by `false` in a production
     * build, so this whole branch and the module it calls are dropped from the
     * package rather than shipped unreachable.
     */
    const devPong = import.meta.env.DEV
      ? mountDevPongButton(root, () => {
          // The press writes on nothing but the button itself, and the page
          // this is meant for shows nothing at all, so the scan that acts on
          // it has to be asked for.
          onScan(scanCards(root));
        })
      : null;

    const overlay = createOverlay({
      root,
      settings: latestSettings ?? settings,
      logger,
      categorize: requestCategories,
      scheduleRetry,
      pullTallyStore,
      pullTally,
      compactStore,
      isCompact,
      // Read at every sync and never captured: the site navigates from one
      // page to the next without ever reloading this script.
      readPath: () => window.location.pathname,
      // Armed on the context as well, so the game of the loading screen stops
      // with the extension rather than painting over a page nobody owns.
      requestFrame: (callback) => {
        ctx.requestAnimationFrame(callback);
      },
      // Built once for this page: a browser stops handing out audio contexts
      // after a few dozen, so one per sound would go quiet for good.
      chime: createChimePlayer(window),
      isPongForced: devPong === null ? undefined : (): boolean => devPong.isForcing(),
    });
    applySettings = (changed): void => {
      overlay.applySettings(changed);
    };

    function onScan(observedCards: ObservedCard[]): void {
      // Reading `isInvalid` is what makes WXT notice that the extension was
      // disabled, updated or uninstalled: it then runs the teardown below.
      // Nothing else would, so the overlay would stay on the page for good.
      if (ctx.isInvalid) {
        return;
      }
      overlay.onScan(observedCards);
    }

    onScan(scanCards(root));

    const disconnect = observeCards({ root, onScan });

    ctx.onInvalidated(() => {
      disconnect();
      unwatchSettings();
      overlay.destroy();
      devPong?.remove();
    });
  },
});
