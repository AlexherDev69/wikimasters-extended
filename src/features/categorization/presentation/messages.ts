import { FRWIKI_TITLE_SEPARATOR } from '../../../core/config/wikimedia';
import { isRecord } from '../../../core/types/guards';
import { isLetterboxdUrl } from '../../letterboxd/domain/resolve-letterboxd-url';
import { isCardImage } from '../../missing-image/domain/card-image';
import { MAX_SUGGESTED_TAGS, MAX_TAG_LENGTH } from '../../tag-suggestions/domain/suggest-tags';
import {
  isCategorizationStatus,
  isCategoryId,
  isPersonSubtypeId,
  type CardCategory,
} from '../domain/category';
import type { CardToCategorize, CategorizeCardsOptions } from '../domain/categorize-cards';

export const CATEGORIZE_CARDS_MESSAGE = 'wikimasters-extended:categorize-cards';

/** A scan of the biggest page observed so far stays far below this bound. */
export const MAX_CARDS_PER_REQUEST = 500;

/** The longest frwiki titles observed on cards stay far below this bound. */
export const MAX_TITLE_LENGTH = 300;

export interface CategorizeCardsRequest {
  type: typeof CATEGORIZE_CARDS_MESSAGE;
  cards: CardToCategorize[];
  /**
   * State of the missing images setting when the batch left the content
   * script. The service worker resolves the addresses of the pictures only for
   * a page that will draw them, so a feature switched off stops its traffic at
   * once, which is what the options page promises.
   */
  resolveImageUrls: boolean;
}

/**
 * Asks the service worker for a batch, from the content script. The options
 * travel with the cards rather than being read on the other side: only the
 * page knows what it is going to draw.
 */
export type RequestCategories = (
  cards: readonly CardToCategorize[],
  options: CategorizeCardsOptions,
) => Promise<CardCategory[]>;

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

/**
 * Validates a message coming from the content script before it is acted on.
 *
 * A message that does not say whether the addresses are wanted is refused like
 * any other malformed one, rather than read as a yes or as a no: the field
 * decides whether traffic leaves for a feature that may be switched off, and a
 * state nobody stated is not a state to guess. Only our own content script
 * sends this message, and it always sets the field; one left over by an
 * extension update is torn down by its own context, which cannot reach the new
 * service worker anyway. A refusal is not a silence either: the content script
 * validates the answer it gets, logs the failure and retries the batch later.
 */
export function isCategorizeCardsRequest(message: unknown): message is CategorizeCardsRequest {
  if (!isRecord(message) || message['type'] !== CATEGORIZE_CARDS_MESSAGE) {
    return false;
  }
  const cards = message['cards'];

  return (
    typeof message['resolveImageUrls'] === 'boolean' &&
    Array.isArray(cards) &&
    cards.length <= MAX_CARDS_PER_REQUEST &&
    cards.every(isCardToCategorize)
  );
}

/**
 * A tag proposal is a non empty string short enough to fit the `maxlength` of
 * the site's own field: the content script writes it there verbatim once the
 * user clicks it, so it is narrowed here exactly as strictly as at that write.
 */
function isSuggestedTag(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_TAG_LENGTH;
}

function isCardCategory(value: unknown): value is CardCategory {
  if (!isRecord(value)) {
    return false;
  }
  const {
    title,
    status,
    qid,
    categoryId,
    primarySubtype,
    personSubtypes,
    letterboxdUrl,
    image,
    suggestedTags,
  } = value;

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
    (image === null || (status === 'categorized' && isCardImage(image))) &&
    Array.isArray(suggestedTags) &&
    suggestedTags.length <= MAX_SUGGESTED_TAGS &&
    suggestedTags.every(isSuggestedTag) &&
    // Only a categorized card ever gets a proposal: an empty list is the only
    // shape accepted on any other status, the documented invariant of the field.
    (status === 'categorized' || suggestedTags.length === 0)
  );
}

/**
 * Validates the answer of the service worker. It crosses a process boundary,
 * so it is untrusted input like any other.
 */
export function isCategorizeCardsResponse(message: unknown): message is CategorizeCardsResponse {
  return isRecord(message) && Array.isArray(message['cards']) && message['cards'].every(isCardCategory);
}
