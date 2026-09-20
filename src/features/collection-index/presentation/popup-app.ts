import type { CategoryId } from '../../categorization/domain/category';
import type { CategorySummary, CollectionSummary } from '../domain/collection-summary';
import { BACK_SELECTOR, renderCategoryCards } from './category-cards-view';
import { createOptionsBar } from './popup-elements';
import {
  categoryRowSelector,
  renderEmptySummary,
  renderSummary,
  renderSummaryError,
  renderSummaryLoading,
  RESET_CANCEL_SELECTOR,
  RESET_SELECTOR,
  SUBTYPE_TOGGLE_SELECTOR,
  type SummaryCallbacks,
} from './summary-view';

/**
 * What the popup asks the service worker for. Injected so that every screen is
 * testable without the extension runtime, and so that the popup itself holds
 * no knowledge of the messages.
 */
export interface PopupPorts {
  loadSummary: () => Promise<CollectionSummary>;
  clearIndex: () => Promise<void>;
  /** Opens the options page of the extension. */
  openOptions: () => void;
}

/**
 * Draws the popup in `container` and keeps it in line with what the user does.
 * The whole state lives here and nothing of it is stored: the popup opens on
 * the summary every time.
 *
 * A failure of either port shows the error screen. There is nothing to retry
 * from here: closing and reopening the popup asks again.
 */
export function mountPopup(container: HTMLElement, ports: PopupPorts): void {
  let summary: CollectionSummary | null = null;
  let failed = false;
  /** Category whose cards are listed, null while the summary is shown. */
  let openCategoryId: CategoryId | null = null;
  let subtypesExpanded = false;
  let resetConfirming = false;
  /**
   * Control to focus once the next render is done, null when the render comes
   * from anything else than a user action. The screen is rebuilt whole on
   * every render, so without this the focus would fall back to the document
   * after each click and the popup could not be used with a keyboard alone.
   */
  let pendingFocus: string | null = null;

  function openCategory(): CategorySummary | null {
    if (summary === null || openCategoryId === null) {
      return null;
    }
    return summary.categories.find((entry) => entry.categoryId === openCategoryId) ?? null;
  }

  function currentScreen(): HTMLElement {
    if (failed) {
      return renderSummaryError();
    }
    if (summary === null) {
      return renderSummaryLoading();
    }
    if (summary.totalCards === 0) {
      return renderEmptySummary();
    }

    const category = openCategory();
    if (category !== null) {
      return renderCategoryCards(category, onBack);
    }
    return renderSummary({ summary, subtypesExpanded, resetConfirming }, callbacks);
  }

  function render(): void {
    // The way to the options page sits under the screen rather than in it, so
    // it is there whichever screen is shown, the empty one included.
    container.replaceChildren(currentScreen(), createOptionsBar(ports.openOptions));

    // Nothing to focus when the render does not follow a move of the user:
    // the popup opens where the browser put the focus and leaves it there.
    if (pendingFocus === null) {
      return;
    }
    container.querySelector<HTMLElement>(pendingFocus)?.focus();
    pendingFocus = null;
  }

  function onBack(): void {
    // Back to the row the list was opened from, rather than to the top.
    pendingFocus = openCategoryId === null ? null : categoryRowSelector(openCategoryId);
    openCategoryId = null;
    render();
  }

  async function load(): Promise<void> {
    try {
      summary = await ports.loadSummary();
      failed = false;
    } catch {
      // The reason is of no use to the user, and a stack trace even less.
      failed = true;
    }
    render();
  }

  async function reset(): Promise<void> {
    try {
      await ports.clearIndex();
    } catch {
      failed = true;
      render();
      return;
    }
    // The summary is read again rather than emptied here: the service worker
    // stays the only place that knows what the index holds.
    await load();
  }

  const callbacks: SummaryCallbacks = {
    onOpenCategory(categoryId: CategoryId): void {
      openCategoryId = categoryId;
      pendingFocus = BACK_SELECTOR;
      render();
    },
    onToggleSubtypes(): void {
      subtypesExpanded = !subtypesExpanded;
      pendingFocus = SUBTYPE_TOGGLE_SELECTOR;
      render();
    },
    onAskReset(): void {
      resetConfirming = true;
      // The safe answer takes the focus: confirming an erasure must be a
      // deliberate move, never the next key stroke.
      pendingFocus = RESET_CANCEL_SELECTOR;
      render();
    },
    onConfirmReset(): void {
      // The confirmation leaves the screen BEFORE the request goes out, so it
      // cannot be submitted a second time while the first one is in flight.
      resetConfirming = false;
      render();
      void reset();
    },
    onCancelReset(): void {
      resetConfirming = false;
      pendingFocus = RESET_SELECTOR;
      render();
    },
  };

  render();
  void load();
}
