import { FRWIKI_TITLE_SEPARATOR } from '../../../core/config/wikimedia';
import { isRecord } from '../../../core/types/guards';
import { isLetterboxdUrl } from '../../letterboxd/domain/resolve-letterboxd-url';
import { isCardImage } from '../../missing-image/domain/card-image';
import {
  isCategorizationStatus,
  isCategoryId,
  isPersonSubtypeId,
  type CardCategory,
} from '../domain/category';
import type { CardToCategorize } from '../domain/categorize-cards';

export const CATEGORIZE_CARDS_MESSAGE = 'wikimasters-extended:categorize-cards';

/** A scan of the biggest page observed so far stays far below this bound. */
export const MAX_CARDS_PER_REQUEST = 500;

/** The longest frwiki titles observed on cards stay far below this bound. */
export const MAX_TITLE_LENGTH = 300;

export interface CategorizeCardsRequest {
  type: typeof CATEGORIZE_CARDS_MESSAGE;
  cards: CardToCategorize[];
}

export interface CategorizeCardsResponse {
  cards: CardCategory[];
}

/**
 * A title made only of whitespace resolves to nothing, and a title containing
 * the frwiki batch separator would silently corrupt the whole batch it travels
 * in, so both are refused at the boundary. Every card title reaching the
 * service worker obeys this rule, whichever message carries it.
 */
function isValidTitle(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    value.length <= MAX_TITLE_LENGTH &&
    !value.includes(FRWIKI_TITLE_SEPARATOR)
  );
}

function isCardToCategorize(value: unknown): value is CardToCategorize {
  if (!isRecord(value)) {
    return false;
  }
  const description = value['description'];

  return isValidTitle(value['title']) && (description === null || typeof description === 'string');
}

/** Validates a message coming from the content script before it is acted on. */
export function isCategorizeCardsRequest(message: unknown): message is CategorizeCardsRequest {
  if (!isRecord(message) || message['type'] !== CATEGORIZE_CARDS_MESSAGE) {
    return false;
  }
  const cards = message['cards'];

  return (
    Array.isArray(cards) && cards.length <= MAX_CARDS_PER_REQUEST && cards.every(isCardToCategorize)
  );
}

function isCardCategory(value: unknown): value is CardCategory {
  if (!isRecord(value)) {
    return false;
  }
  const { title, status, qid, categoryId, primarySubtype, personSubtypes, letterboxdUrl, image } =
    value;

  return (
    typeof title === 'string' &&
    isCategorizationStatus(status) &&
    (qid === null || typeof qid === 'string') &&
    (categoryId === null || isCategoryId(categoryId)) &&
    (primarySubtype === null || isPersonSubtypeId(primarySubtype)) &&
    Array.isArray(personSubtypes) &&
    personSubtypes.every(isPersonSubtypeId) &&
    // The content script writes this one into an href, so nothing but the
    // Letterboxd origin is accepted, and only on a card that was categorized,
    // which is the documented invariant of the field.
    (letterboxdUrl === null || (status === 'categorized' && isLetterboxdUrl(letterboxdUrl))) &&
    // The content script builds two addresses from this file name, so it is
    // narrowed here too, and only on a card that was categorized, which is the
    // documented invariant of the field.
    (image === null || (status === 'categorized' && isCardImage(image)))
  );
}

/**
 * Validates the answer of the service worker. It crosses a process boundary,
 * so it is untrusted input like any other.
 */
export function isCategorizeCardsResponse(message: unknown): message is CategorizeCardsResponse {
  return isRecord(message) && Array.isArray(message['cards']) && message['cards'].every(isCardCategory);
}
