import type { Rarity } from '../../card-detection/domain/rarity';
import {
  isPersonSubtypeId,
  type CategoryId,
  type PersonSubtypeId,
} from '../../categorization/domain/category';

/**
 * What the popup shows of the collection. Everything here is computed from the
 * index and the local caches, never from the network, and travels as plain
 * JSON: arrays only, no map and no date object.
 */

/**
 * A subtype the popup can name. `other` is the absence of a trade rather than
 * one, and has no label, so a person carrying it counts in their category and
 * in no subtype.
 */
export type NamedPersonSubtype = Exclude<PersonSubtypeId, 'other'>;

export function isNamedPersonSubtype(value: unknown): value is NamedPersonSubtype {
  return isPersonSubtypeId(value) && value !== 'other';
}

/** One card of the index, as the popup lists it under its category. */
export interface SummaryCard {
  title: string;
  rarity: Rarity;
  /** Non-null only for a person whose main trade is known. */
  primarySubtype: NamedPersonSubtype | null;
}

export interface SubtypeCount {
  subtype: NamedPersonSubtype;
  count: number;
}

export interface RarityCount {
  rarity: Rarity;
  count: number;
}

/** One category present in the index, with the cards it holds. */
export interface CategorySummary {
  categoryId: CategoryId;
  count: number;
  /** Counts of the main subtypes, filled for `person` only. */
  subtypes: SubtypeCount[];
  cards: SummaryCard[];
}

export interface CollectionSummary {
  totalCards: number;
  /** Cards whose category cannot be told from the caches right now. */
  uncategorizedCount: number;
  /** Most recent time a card of the index was seen, null when it is empty. */
  lastSeenAt: number | null;
  categories: CategorySummary[];
  rarities: RarityCount[];
}
