import type { CardCategory, CategoryId } from '../../categorization/domain/category';
import {
  CATEGORY_ACCENT_COLORS,
  CATEGORY_LABELS,
} from '../../category-badge/domain/category-display';
import { describeCategory } from '../../category-badge/domain/describe-category';

/** The labels are French, so they sort as a French reader expects them to. */
const LABEL_LOCALE = 'fr';

/** One line of the panel: a category present on the page, and how often. */
export interface CategoryCount {
  categoryId: CategoryId;
  /** The category alone, without the subtype a badge adds to a person. */
  label: string;
  accentColor: string;
  count: number;
}

/**
 * How many cards of each category the page shows, most frequent first, then
 * by label so that two categories with the same count keep a stable order.
 *
 * Titles are counted once each: the same card can be rendered twice, in the
 * grid and in the detail modal opened on it, and that is one card.
 *
 * A card whose category is unknown, whose article was not found or whose
 * categorization failed counts for nothing: the panel lists what it can
 * filter on, and those cards cannot be told apart.
 */
export function countCategories(
  titles: readonly string[],
  categoriesByTitle: ReadonlyMap<string, CardCategory>,
): CategoryCount[] {
  const countById = new Map<CategoryId, number>();

  for (const title of new Set(titles)) {
    const category = categoriesByTitle.get(title);
    const descriptor = category === undefined ? null : describeCategory(category);
    if (descriptor === null) {
      continue;
    }
    countById.set(descriptor.categoryId, (countById.get(descriptor.categoryId) ?? 0) + 1);
  }

  return [...countById]
    .map(([categoryId, count]) => ({
      categoryId,
      label: CATEGORY_LABELS[categoryId],
      accentColor: CATEGORY_ACCENT_COLORS[categoryId],
      count,
    }))
    .sort((left, right) =>
      left.count === right.count
        ? left.label.localeCompare(right.label, LABEL_LOCALE)
        : right.count - left.count,
    );
}
