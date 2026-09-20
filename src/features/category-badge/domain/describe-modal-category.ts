import type { CardCategory, CategoryId } from '../../categorization/domain/category';
import { PERSON_SUBTYPE_LABELS } from './category-display';
import { describeCategory } from './describe-category';

const CATEGORY_PREFIX = 'Catégorie : ';
const OTHER_SUBTYPES_PREFIX = ' (aussi : ';
const OTHER_SUBTYPES_SUFFIX = ')';
const OTHER_SUBTYPES_JOINER = ', ';

/** The one line the detail modal shows about the category of its card. */
export interface ModalCategoryDescriptor {
  categoryId: CategoryId;
  accentColor: string;
  text: string;
}

/**
 * The subtypes of a person besides the main one, in the order Wikidata gave
 * them. `other` is skipped: it is the absence of a subtype, not a trade.
 */
function listOtherSubtypes(category: CardCategory): string[] {
  const labels: string[] = [];

  for (const subtype of category.personSubtypes) {
    if (subtype === 'other' || subtype === category.primarySubtype) {
      continue;
    }
    labels.push(PERSON_SUBTYPE_LABELS[subtype]);
  }
  return labels;
}

/**
 * The category line of the detail modal, where there is room for more than a
 * badge: the label as the badge shows it, plus the other trades of a person.
 * Null when the card has nothing to show, exactly as for a badge.
 */
export function describeModalCategory(category: CardCategory): ModalCategoryDescriptor | null {
  const descriptor = describeCategory(category);
  if (descriptor === null) {
    return null;
  }

  const others = category.categoryId === 'person' ? listOtherSubtypes(category) : [];
  const suffix =
    others.length === 0
      ? ''
      : OTHER_SUBTYPES_PREFIX + others.join(OTHER_SUBTYPES_JOINER) + OTHER_SUBTYPES_SUFFIX;

  return {
    categoryId: descriptor.categoryId,
    accentColor: descriptor.accentColor,
    text: CATEGORY_PREFIX + descriptor.label + suffix,
  };
}
