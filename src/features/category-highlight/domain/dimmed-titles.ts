import type { CardCategory, CategoryId } from '../../categorization/domain/category';
import { describeCategory } from '../../category-badge/domain/describe-category';

/**
 * The titles to dim so only the active category stands out. Empty when no
 * filter is active: the page is then shown exactly as the site renders it.
 *
 * A card whose category is unknown is dimmed like the others: it is not a card
 * of the active category, and pretending otherwise would show cards the filter
 * says nothing about.
 */
export function selectDimmedTitles(
  titles: readonly string[],
  categoriesByTitle: ReadonlyMap<string, CardCategory>,
  activeCategoryId: CategoryId | null,
): ReadonlySet<string> {
  const dimmed = new Set<string>();
  if (activeCategoryId === null) {
    return dimmed;
  }

  for (const title of titles) {
    const category = categoriesByTitle.get(title);
    const descriptor = category === undefined ? null : describeCategory(category);
    if (descriptor?.categoryId !== activeCategoryId) {
      dimmed.add(title);
    }
  }
  return dimmed;
}
