import { isCommonsFileName, type CardImageKind, type CommonsFile } from './card-image';

/**
 * Whether a Commons file used by an article is a plausible lead picture of
 * that very article: rules 3, 4 and 6 of the second image source (phase 7d).
 *
 * Rules 1 (Wikidata already gave an image), 2 (the article is a
 * disambiguation page) and 5 (the file is hosted on Commons, not on frwiki
 * itself) depend on facts this module has no access to, and are enforced by
 * its caller instead.
 */

/** A trailing " (something)" with at least one character before the space. */
const TRAILING_PARENTHETICAL_PATTERN = /^(.+) \([^()]*\)$/;

const EXTENSION_SEPARATOR = '.';

/**
 * A PNG or an SVG used as the lead file of an article is nearly always a
 * logo, which must be shown whole; every other allowed extension is treated
 * as a photograph, which may be cropped. This is a heuristic read from the
 * extension alone, never from the picture itself, and it costs a photograph
 * shown whole with padding, or a logo cropped, when it is wrong.
 */
const EMBLEM_EXTENSIONS: readonly string[] = ['png', 'svg'];

/**
 * Removes a trailing disambiguation parenthetical from an article title, so
 * "Harry Hole (série télévisée)" is compared against a file name as
 * "Harry Hole", and "Lost River (film)" as "Lost River".
 *
 * A title carrying no parenthetical is returned unchanged, and so is a title
 * that IS only a parenthetical: the pattern requires a character before the
 * separating space, which a title starting with "(" never has.
 */
export function stripTrailingParenthetical(title: string): string {
  return TRAILING_PARENTHETICAL_PATTERN.exec(title)?.[1] ?? title;
}

function fileBaseName(fileName: string): string {
  const lastSeparator = fileName.lastIndexOf(EXTENSION_SEPARATOR);
  return lastSeparator === -1 ? fileName : fileName.slice(0, lastSeparator);
}

function fileExtension(fileName: string): string {
  const lastSeparator = fileName.lastIndexOf(EXTENSION_SEPARATOR);
  return lastSeparator === -1 ? '' : fileName.slice(lastSeparator + 1).toLowerCase();
}

function articleFileKind(fileName: string): CardImageKind {
  return EMBLEM_EXTENSIONS.includes(fileExtension(fileName)) ? 'emblem' : 'picture';
}

/**
 * The file among `usedFileNames` whose name, without its extension, equals
 * `strippedTitle` exactly. No fuzzy matching, no "contains", no accent
 * folding: the comparison is on the exact string, because a looser rule is
 * what puts a wrong picture on a card (measured on 2026-09-20 against the
 * live API, see the phase 7d specification).
 *
 * `usedFileNames` must already be restricted to the files the article itself
 * links to (rule 4): this function has no way to tell where a name came from,
 * it only judges the name itself.
 */
export function findArticleImageFile(
  strippedTitle: string,
  usedFileNames: readonly string[],
): CommonsFile | null {
  for (const fileName of usedFileNames) {
    if (isCommonsFileName(fileName) && fileBaseName(fileName) === strippedTitle) {
      return { fileName, kind: articleFileKind(fileName) };
    }
  }
  return null;
}
