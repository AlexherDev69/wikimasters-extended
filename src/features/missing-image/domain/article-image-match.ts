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
 * The words a file name may carry AFTER the title of the article, when no
 * file carries the title on its own. An article about a series, a brand or
 * an organisation very often illustrates itself with a file named
 * "<title> Logo" and never "<title>", which the exact rule below misses
 * entirely: "Backrooms (web-série)" shows "Backrooms Logo.png" in its own
 * infobox and received no image at all.
 *
 * A closed list, deliberately, and not a free prefix: "Paris Hilton.jpg"
 * begins with the title of the article "Paris", and a prefix rule would put
 * a portrait of someone else on that card. Every word here names the picture
 * itself, so it can only ever qualify the title it follows, never introduce
 * another subject.
 */
const TITLE_QUALIFIERS: readonly string[] = [
  'logo',
  'logotype',
  'affiche',
  'poster',
  'cover',
  'couverture',
  'banner',
  'titre',
  'title',
];

const QUALIFIER_SEPARATOR = ' ';

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

/** True while `baseName` is the title followed by one of the words above. */
function isQualifiedTitle(baseName: string, strippedTitle: string): boolean {
  const prefix = `${strippedTitle}${QUALIFIER_SEPARATOR}`;

  return (
    baseName.startsWith(prefix) &&
    TITLE_QUALIFIERS.includes(baseName.slice(prefix.length).toLowerCase())
  );
}

/**
 * The file among `usedFileNames` whose name, without its extension, is
 * `strippedTitle` exactly, or failing that the title followed by one word
 * that names a picture. No fuzzy matching, no "contains", no accent folding:
 * the comparison is on the exact string, because a looser rule is what puts
 * a wrong picture on a card (measured on 2026-09-20 against the live API,
 * see the phase 7d specification).
 *
 * The exact name is searched across every file before the qualified one is
 * considered at all: a file carrying the title alone is the article saying
 * "this is me", and it outranks a logo whatever order the API listed them in.
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
  for (const fileName of usedFileNames) {
    if (isCommonsFileName(fileName) && isQualifiedTitle(fileBaseName(fileName), strippedTitle)) {
      return { fileName, kind: articleFileKind(fileName) };
    }
  }
  return null;
}
