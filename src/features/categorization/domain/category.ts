import type { CardImage } from '../../missing-image/domain/card-image';

/** The known categories: the source of both the type and its guard. */
const CATEGORY_IDS = [
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

/** Read the same way as CATEGORY_IDS. */
const PERSON_SUBTYPE_IDS = [
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

/**
 * One result per distinct card title, as returned to the content script.
 *
 * The classification itself never leaves the service worker: it decides what
 * a Letterboxd address may be built from, and nothing of the page has read a
 * category since the badge was removed.
 */
export interface CardCategory {
  title: string;
  status: CategorizationStatus;
  qid: string | null;
  /** Null unless `status` is `categorized` and the card has a Letterboxd page. */
  letterboxdUrl: string | null;
  /** Null unless `status` is `categorized` and Wikidata holds an image. */
  image: CardImage | null;
}
