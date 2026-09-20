import type {
  CardCategory,
  CategoryId,
  PersonSubtypeId,
} from '../../categorization/domain/category';
import { CATEGORY_ACCENT_COLORS, CATEGORY_LABELS, PERSON_SUBTYPE_LABELS } from './category-display';

/** Middle dot (U+00B7), between a person and its main subtype. */
const SUBTYPE_SEPARATOR = ' · ';

/** What a card shows of its category: the same text and colour everywhere. */
export interface BadgeDescriptor {
  categoryId: CategoryId;
  label: string;
  accentColor: string;
}

function describeLabel(categoryId: CategoryId, primarySubtype: PersonSubtypeId | null): string {
  const label = CATEGORY_LABELS[categoryId];
  // Only a person carries a subtype, and `other` is the absence of one.
  if (categoryId !== 'person' || primarySubtype === null || primarySubtype === 'other') {
    return label;
  }
  return `${label}${SUBTYPE_SEPARATOR}${PERSON_SUBTYPE_LABELS[primarySubtype]}`;
}

/**
 * The text and the colour of a categorization result, or null when there is
 * nothing to show: a card that was not found, one whose categorization failed
 * and one still without a category get no badge rather than an empty one.
 */
export function describeCategory(category: CardCategory): BadgeDescriptor | null {
  if (category.status !== 'categorized' || category.categoryId === null) {
    return null;
  }
  return {
    categoryId: category.categoryId,
    label: describeLabel(category.categoryId, category.primarySubtype),
    accentColor: CATEGORY_ACCENT_COLORS[category.categoryId],
  };
}
