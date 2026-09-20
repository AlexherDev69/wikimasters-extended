import type { CardImage } from '../../missing-image/domain/card-image';

/** Exported so a view can give every category a place in a display order. */
export const CATEGORY_IDS = [
  'person',
  'film_tv',
  'music',
  'sport',
  'living',
  'food_drink',
  'monument_building',
  'religion_ideas',
  'work_culture',
  'place',
  'transport_tech',
  'event',
  'organization',
  'astronomy',
  'science_concept',
  'other',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

/** Exported for the same reason as CATEGORY_IDS. */
export const PERSON_SUBTYPE_IDS = [
  'cinema',
  'music',
  'sport',
  'politics',
  'science',
  'literature',
  'art',
  'media',
  'other',
] as const;

export type PersonSubtypeId = (typeof PERSON_SUBTYPE_IDS)[number];

export type CategorizationStatus = 'categorized' | 'not_found' | 'error';

const CATEGORIZATION_STATUSES: readonly CategorizationStatus[] = [
  'categorized',
  'not_found',
  'error',
];

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && CATEGORY_IDS.some((candidate) => candidate === value);
}

export function isPersonSubtypeId(value: unknown): value is PersonSubtypeId {
  return typeof value === 'string' && PERSON_SUBTYPE_IDS.some((candidate) => candidate === value);
}

export function isCategorizationStatus(value: unknown): value is CategorizationStatus {
  return (
    typeof value === 'string' && CATEGORIZATION_STATUSES.some((candidate) => candidate === value)
  );
}

/** One result per distinct card title, as returned to the content script. */
export interface CardCategory {
  title: string;
  status: CategorizationStatus;
  qid: string | null;
  /** Null unless `status` is `categorized`. */
  categoryId: CategoryId | null;
  /** Non-null only when `categoryId` is `person`. */
  primarySubtype: PersonSubtypeId | null;
  personSubtypes: PersonSubtypeId[];
  /** Null unless `status` is `categorized` and the card has a Letterboxd page. */
  letterboxdUrl: string | null;
  /** Null unless `status` is `categorized` and Wikidata holds an image. */
  image: CardImage | null;
}
