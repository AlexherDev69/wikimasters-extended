import { isArrayOf, isRecord } from '../../../core/types/guards';
import { isRarity } from '../../card-detection/domain/rarity';
import { isCategoryId } from '../../categorization/domain/category';
import { isValidTitle, MAX_CARDS_PER_REQUEST } from '../../categorization/presentation/messages';
import {
  isCatalogueObservation,
  isCatalogueTotals,
  type CatalogueTotals,
} from '../domain/catalogue-totals';
import type { RecordedCard } from '../domain/collection-index';
import {
  isNamedPersonSubtype,
  type CategorySummary,
  type CollectionSummary,
  type RarityCount,
  type SubtypeCount,
  type SummaryCard,
} from '../domain/collection-summary';

/**
 * The four messages of the collection index, with a guard for BOTH
 * directions: what the content script and the popup send is untrusted input
 * for the service worker, and its answers are untrusted input for them.
 *
 * The title rule and the batch size are the ones of the categorization
 * request: every card title reaching the service worker obeys the same rule,
 * whichever message carries it.
 */

export const RECORD_COLLECTION_CARDS_MESSAGE = 'wikimasters-extended:record-collection-cards';

export const RECORD_CATALOGUE_TOTALS_MESSAGE = 'wikimasters-extended:record-catalogue-totals';

export const GET_COLLECTION_SUMMARY_MESSAGE = 'wikimasters-extended:get-collection-summary';

export const CLEAR_COLLECTION_INDEX_MESSAGE = 'wikimasters-extended:clear-collection-index';

const COLLECTION_MESSAGE_TYPES: readonly string[] = [
  RECORD_COLLECTION_CARDS_MESSAGE,
  RECORD_CATALOGUE_TOTALS_MESSAGE,
  GET_COLLECTION_SUMMARY_MESSAGE,
  CLEAR_COLLECTION_INDEX_MESSAGE,
];

/** Answer to a message of this feature that could not be honoured. */
export const INVALID_REQUEST_ERROR = 'invalid-request';

export const INDEX_UNAVAILABLE_ERROR = 'index-unavailable';

export interface RecordCollectionCardsRequest {
  type: typeof RECORD_COLLECTION_CARDS_MESSAGE;
  cards: RecordedCard[];
}

export interface RecordCollectionCardsResponse {
  recorded: number;
}

export interface RecordCatalogueTotalsRequest {
  type: typeof RECORD_CATALOGUE_TOTALS_MESSAGE;
  totals: CatalogueTotals;
}

export interface RecordCatalogueTotalsResponse {
  recorded: true;
}

export interface GetCollectionSummaryRequest {
  type: typeof GET_COLLECTION_SUMMARY_MESSAGE;
}

export interface CollectionSummaryResponse {
  summary: CollectionSummary;
}

export interface ClearCollectionIndexRequest {
  type: typeof CLEAR_COLLECTION_INDEX_MESSAGE;
}

export interface ClearCollectionIndexResponse {
  cleared: true;
}

export interface CollectionIndexErrorResponse {
  error: string;
}

/** True for any message of this feature, whatever the shape of its payload. */
export function isCollectionIndexMessage(message: unknown): boolean {
  return (
    isRecord(message) &&
    typeof message['type'] === 'string' &&
    COLLECTION_MESSAGE_TYPES.includes(message['type'])
  );
}

/** Counts and totals travel as whole numbers: nothing else is one of ours. */
function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isRecordedCard(value: unknown): value is RecordedCard {
  return isRecord(value) && isValidTitle(value['title']) && isRarity(value['rarity']);
}

export function isRecordCollectionCardsRequest(
  message: unknown,
): message is RecordCollectionCardsRequest {
  if (!isRecord(message) || message['type'] !== RECORD_COLLECTION_CARDS_MESSAGE) {
    return false;
  }
  const cards = message['cards'];

  return (
    Array.isArray(cards) && cards.length <= MAX_CARDS_PER_REQUEST && cards.every(isRecordedCard)
  );
}

/**
 * The six totals are bounded whole numbers: they end up as the denominator of
 * a completion, and anything else would make the popup print nonsense.
 */
export function isRecordCatalogueTotalsRequest(
  message: unknown,
): message is RecordCatalogueTotalsRequest {
  return (
    isRecord(message) &&
    message['type'] === RECORD_CATALOGUE_TOTALS_MESSAGE &&
    isCatalogueTotals(message['totals'])
  );
}

export function isGetCollectionSummaryRequest(
  message: unknown,
): message is GetCollectionSummaryRequest {
  return isRecord(message) && message['type'] === GET_COLLECTION_SUMMARY_MESSAGE;
}

export function isClearCollectionIndexRequest(
  message: unknown,
): message is ClearCollectionIndexRequest {
  return isRecord(message) && message['type'] === CLEAR_COLLECTION_INDEX_MESSAGE;
}

export function isRecordCollectionCardsResponse(
  message: unknown,
): message is RecordCollectionCardsResponse {
  return isRecord(message) && isCount(message['recorded']);
}

export function isRecordCatalogueTotalsResponse(
  message: unknown,
): message is RecordCatalogueTotalsResponse {
  return isRecord(message) && message['recorded'] === true;
}

function isSummaryCard(value: unknown): value is SummaryCard {
  if (!isRecord(value)) {
    return false;
  }
  const primarySubtype = value['primarySubtype'];

  return (
    typeof value['title'] === 'string' &&
    isRarity(value['rarity']) &&
    (primarySubtype === null || isNamedPersonSubtype(primarySubtype))
  );
}

function isSubtypeCount(value: unknown): value is SubtypeCount {
  return isRecord(value) && isNamedPersonSubtype(value['subtype']) && isCount(value['count']);
}

function isRarityCount(value: unknown): value is RarityCount {
  return isRecord(value) && isRarity(value['rarity']) && isCount(value['count']);
}

function isCategorySummary(value: unknown): value is CategorySummary {
  return (
    isRecord(value) &&
    isCategoryId(value['categoryId']) &&
    isCount(value['count']) &&
    isArrayOf(value['subtypes'], isSubtypeCount) &&
    isArrayOf(value['cards'], isSummaryCard)
  );
}

function isCollectionSummary(value: unknown): value is CollectionSummary {
  if (!isRecord(value)) {
    return false;
  }
  const lastSeenAt = value['lastSeenAt'];
  const catalogue = value['catalogue'];

  return (
    isCount(value['totalCards']) &&
    isCount(value['uncategorizedCount']) &&
    (lastSeenAt === null || typeof lastSeenAt === 'number') &&
    (catalogue === null || isCatalogueObservation(catalogue)) &&
    isArrayOf(value['categories'], isCategorySummary) &&
    isArrayOf(value['rarities'], isRarityCount)
  );
}

export function isCollectionSummaryResponse(
  message: unknown,
): message is CollectionSummaryResponse {
  return isRecord(message) && isCollectionSummary(message['summary']);
}

export function isClearCollectionIndexResponse(
  message: unknown,
): message is ClearCollectionIndexResponse {
  return isRecord(message) && message['cleared'] === true;
}
