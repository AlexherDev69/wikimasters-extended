import type { CategoryId } from '../../categorization/domain/category';
import {
  CATEGORY_ACCENT_COLORS,
  CATEGORY_LABELS,
} from '../../category-badge/domain/category-display';
import type { CategoryCount } from './category-counts';

/**
 * The lines the panel shows: the categories of the page, plus the active
 * filter when the page holds no card of it any more.
 *
 * The filter is kept while browsing a paginated collection, so a page can be
 * entirely dimmed by a category none of its cards belongs to. The panel then
 * has to say so and offer the way out, which it cannot do for a category it
 * does not list: the line is added with a count of zero. It comes last on its
 * own, since the lines are already sorted by decreasing count.
 */
export function listCategories(
  counts: readonly CategoryCount[],
  activeCategoryId: CategoryId | null,
): CategoryCount[] {
  if (
    activeCategoryId === null ||
    counts.some((entry) => entry.categoryId === activeCategoryId)
  ) {
    return [...counts];
  }

  return [
    ...counts,
    {
      categoryId: activeCategoryId,
      label: CATEGORY_LABELS[activeCategoryId],
      accentColor: CATEGORY_ACCENT_COLORS[activeCategoryId],
      count: 0,
    },
  ];
}
