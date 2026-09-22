import { isRecord } from '../types/guards';
import { isWikimediaThumbnailUrl } from './thumbnail-url';

/**
 * The image Wikidata knows for a card that the site leaves without one: a file
 * hosted on Wikimedia Commons, plus what kind of picture it is, which decides
 * how it is framed over the placeholder.
 *
 * Only the file name travels. The URI the SPARQL answer carries is never
 * reused: every address is rebuilt from a name that passed the guard below,
 * exactly as only a well formed QID is ever interpolated into a query.
 */

/** A picture fills the image area, an emblem is shown whole on a flat ground. */
export type CardImageKind = 'picture' | 'emblem';

const CARD_IMAGE_KINDS: readonly CardImageKind[] = ['picture', 'emblem'];

/**
 * What Wikidata knows, and nothing else. This is the shape cached with the
 * facts of a card, for ninety days: the address of the thumbnail is NOT part of
 * it, because it is resolved apart, cached apart and expires apart. Holding it
 * here would mean two entries for the same fact, each with its own lifetime.
 */
export interface CommonsFile {
  fileName: string;
  kind: CardImageKind;
}

/** The same file, plus the address resolved for it, as the card shows it. */
export interface CardImage extends CommonsFile {
  /**
   * Final address of the thumbnail on the Wikimedia servers, null while it is
   * unknown. Null is not a failure: the content script then builds the address
   * itself, which is the slower path but shows the very same picture.
   */
  thumbnailUrl: string | null;
}

/** The longest names observed on Commons stay far below this bound. */
export const MAX_COMMONS_FILE_NAME_LENGTH = 240;

/** Characters MediaWiki refuses in a file name, so a valid one never holds them. */
const FORBIDDEN_CHARACTERS: readonly string[] = [
  '#',
  '<',
  '>',
  '[',
  ']',
  '|',
  '{',
  '}',
  ':',
  '/',
  '\\',
];

/** Everything below the space, plus the delete character. */
const FIRST_PRINTABLE_CODE_POINT = 0x20;
const DELETE_CODE_POINT = 0x7f;

/**
 * The range a surrogate code unit lives in. A well formed pair is read as the
 * single code point it stands for, far above this range, so only a lone
 * surrogate falls in it: one half of a character, which `encodeURIComponent`
 * refuses to encode and throws on.
 */
const FIRST_SURROGATE_CODE_POINT = 0xd800;
const LAST_SURROGATE_CODE_POINT = 0xdfff;

const EXTENSION_SEPARATOR = '.';

/**
 * The types the Wikimedia thumbnailer renders as an image. A closed list: a
 * video or a document would answer the thumbnail request with something no
 * `img` can display, and the card would keep an invisible layer for nothing.
 */
const ALLOWED_EXTENSIONS: readonly string[] = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'svg',
  'webp',
  'tif',
  'tiff',
];

/**
 * A control character would travel into an attribute and into a URL, and a
 * lone surrogate would make the address builder throw instead of returning a
 * name the caller can drop. Both are read in the same pass, code point by code
 * point.
 */
function hasUnusableCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      codePoint < FIRST_PRINTABLE_CODE_POINT ||
      codePoint === DELETE_CODE_POINT ||
      (codePoint >= FIRST_SURROGATE_CODE_POINT && codePoint <= LAST_SURROGATE_CODE_POINT)
    ) {
      return true;
    }
  }
  return false;
}

/** Case insensitive: Commons holds "Foo.JPG" as readily as "foo.jpg". */
function hasAllowedExtension(fileName: string): boolean {
  const lastSeparator = fileName.lastIndexOf(EXTENSION_SEPARATOR);
  if (lastSeparator === -1) {
    return false;
  }
  return ALLOWED_EXTENSIONS.includes(fileName.slice(lastSeparator + 1).toLowerCase());
}

/**
 * A file name of Commons, narrowed at the boundary: it comes from Wikidata,
 * where anyone can write anything, and it ends up in a URL and in an
 * attribute. A name that does not pass is dropped and the next property of the
 * item is tried.
 */
export function isCommonsFileName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value !== '' &&
    value.trim() === value &&
    value.length <= MAX_COMMONS_FILE_NAME_LENGTH &&
    !hasUnusableCharacter(value) &&
    !FORBIDDEN_CHARACTERS.some((character) => value.includes(character)) &&
    hasAllowedExtension(value)
  );
}

function isCardImageKind(value: unknown): value is CardImageKind {
  return typeof value === 'string' && CARD_IMAGE_KINDS.some((candidate) => candidate === value);
}

/** Narrows the facts of a card read back from storage. */
export function isCommonsFile(value: unknown): value is CommonsFile {
  return (
    isRecord(value) && isCommonsFileName(value['fileName']) && isCardImageKind(value['kind'])
  );
}

/**
 * Narrows a value received in a message. The address is narrowed with it: it
 * ends up in a `src`, so it is untrusted exactly like the file name beside it.
 */
export function isCardImage(value: unknown): value is CardImage {
  if (!isRecord(value)) {
    return false;
  }
  // Read before the narrowing below, which leaves a shape this key is not in.
  const thumbnailUrl = value['thumbnailUrl'];

  return isCommonsFile(value) && (thumbnailUrl === null || isWikimediaThumbnailUrl(thumbnailUrl));
}
