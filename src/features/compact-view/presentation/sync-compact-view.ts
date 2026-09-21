import type { Logger } from '../../../core/logger/logger';
import { applyCompactStyle, removeCompactStyle } from '../data/compact-style';
import {
  applyCompactToggle,
  findCompactToggleTarget,
  removeCompactToggles,
} from '../data/compact-toggle';
import { isCompactPage } from '../domain/compact-page';
import type { CompactPreferenceStore } from '../domain/compact-preference-store';

/**
 * The compact view of the card grids: a button at the end of the row of
 * rarity filters, and a style sheet that draws the cards of the page at about
 * two thirds of their size while it is on.
 *
 * Reading only: the button is ours, the style sheet lives in `document.head`,
 * and the site keeps exactly the document it built.
 */

/** What survives between two syncs of one page. */
export interface CompactViewState {
  isCompact: boolean;
}

export interface CompactViewDeps {
  store: CompactPreferenceStore;
  logger: Logger;
  /** The path of the page right now, read again at every sync. */
  readPath: () => string;
  /**
   * Runs a whole scan at once, so a press shows its effect immediately: the
   * press writes no node of the page, so nothing would make the page mutate
   * and ask for a sync of its own.
   */
  requestSync: () => void;
}

export function createCompactViewState(isCompact: boolean): CompactViewState {
  return { isCompact };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A failed write costs the memory of the view, nothing more: the page the
 * user is on follows the press, and the next press writes the whole
 * preference again.
 */
function persist(isCompact: boolean, deps: CompactViewDeps): void {
  deps.store.write(isCompact).catch((error: unknown) => {
    deps.logger.warn('Compact view write failed', { error: toErrorMessage(error) });
  });
}

/**
 * One pass over the page. The button is offered on the two pages that show a
 * grid of cards and nothing else; everywhere else what this feature added is
 * taken back, which matters on a site that navigates without ever reloading.
 */
export function syncCompactView(
  root: HTMLElement,
  state: CompactViewState,
  deps: CompactViewDeps,
): void {
  const { ownerDocument } = root;

  if (!isCompactPage(deps.readPath())) {
    // Both calls write nothing at all when there is nothing to take back,
    // which is every sync of every other page of the site.
    removeCompactToggles(root);
    removeCompactStyle(ownerDocument);
    return;
  }

  const target = findCompactToggleTarget(root);
  if (target !== null) {
    applyCompactToggle(target, state.isCompact, () => {
      state.isCompact = !state.isCompact;
      persist(state.isCompact, deps);
      deps.requestSync();
    });
  }

  // Kept apart from the button on purpose: the grid is drawn before the
  // filters on a page that is still loading, and a compact view already asked
  // for must not wait for a row of buttons to take effect.
  if (state.isCompact) {
    applyCompactStyle(ownerDocument);
    return;
  }
  removeCompactStyle(ownerDocument);
}
