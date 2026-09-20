import type { ObservedCard } from '../../card-detection/data/scan-cards';
import { scanCards } from '../../card-detection/data/scan-cards';
import type { CardCategory, CategoryId } from '../../categorization/domain/category';
import {
  applyCategoryPanel,
  removeCategoryPanels,
  type PanelCallbacks,
} from '../data/category-panel';
import { applyDimOverlay, removeDimOverlays } from '../data/dim-overlay';
import { countCategories } from '../domain/category-counts';
import { selectDimmedTitles } from '../domain/dimmed-titles';
import { listCategories } from '../domain/list-categories';

/** The panel and the veils it drives, for the lifetime of the content script. */
export interface CategoryHighlight {
  /** Called after every scan and every batch of results. */
  sync: (
    cards: readonly ObservedCard[],
    categoriesByTitle: ReadonlyMap<string, CardCategory>,
  ) => void;
  /** Takes back every node this feature added. */
  destroy: () => void;
}

/**
 * Lists the categories of the cards on screen and dims the cards the chosen
 * one leaves aside.
 *
 * The panel is collapsed and no category is chosen when the page loads: the
 * state lives here, in the memory of the content script, and nothing of it is
 * stored, so a reload starts from the page as the site renders it.
 */
export function createCategoryHighlight(host: HTMLElement): CategoryHighlight {
  let activeCategoryId: CategoryId | null = null;
  let collapsed = true;
  let categoriesByTitle: ReadonlyMap<string, CardCategory> = new Map();

  function render(cards: readonly ObservedCard[]): void {
    const titles = cards.map((observed) => observed.card.title);
    // The filter stays on while browsing a paginated collection, so a page may
    // hold no card of it and be dimmed whole. The panel says which filter does
    // it and offers the way out, so the page is never dim without a reason on
    // screen. A page with no card at all shows no panel, hence no veil either,
    // and the filter waits there for the cards to come back.
    const hasCards = titles.length > 0;
    const activeInPage = hasCards ? activeCategoryId : null;
    const lines = listCategories(countCategories(titles, categoriesByTitle), activeInPage);
    const dimmed = selectDimmedTitles(titles, categoriesByTitle, activeInPage);

    for (const { element, card } of cards) {
      applyDimOverlay(element, dimmed.has(card.title));
    }
    applyCategoryPanel(
      host,
      { counts: lines, activeCategoryId: activeInPage, collapsed },
      callbacks,
    );
  }

  /**
   * A click on the panel comes between two scans, so the cards are read again
   * rather than taken from the last one: the page may have moved on since.
   */
  function rerender(): void {
    render(scanCards(host));
  }

  const callbacks: PanelCallbacks = {
    onToggleCollapsed(): void {
      collapsed = !collapsed;
      rerender();
    },
    onSelectCategory(categoryId: CategoryId): void {
      // The same category twice means the user is done with the filter.
      activeCategoryId = activeCategoryId === categoryId ? null : categoryId;
      rerender();
    },
    onClearCategory(): void {
      activeCategoryId = null;
      rerender();
    },
  };

  return {
    sync(cards, results): void {
      categoriesByTitle = results;
      render(cards);
    },
    destroy(): void {
      removeCategoryPanels(host);
      removeDimOverlays(host);
    },
  };
}
