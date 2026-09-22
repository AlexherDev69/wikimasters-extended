import { isCommonsFileName } from './card-image';

/**
 * The Wikimedia Commons addresses this feature reads and builds. The host and
 * the paths are constants here, and the only thing ever interpolated into them
 * is a file name that passed `isCommonsFileName`: nothing coming from Wikidata
 * can move an address to another host or another path.
 */

const COMMONS_HOST = 'commons.wikimedia.org';
const FILE_PATH = '/wiki/Special:FilePath/';
const FILE_PAGE_PATH = '/wiki/File:';

const HTTP_ORIGIN = `http://${COMMONS_HOST}`;
const HTTPS_ORIGIN = `https://${COMMONS_HOST}`;

/** SPARQL returns the file path URI on either scheme, and on nothing else. */
const FILE_PATH_URI_PREFIXES: readonly string[] = [
  `${HTTP_ORIGIN}${FILE_PATH}`,
  `${HTTPS_ORIGIN}${FILE_PATH}`,
];

/**
 * A standard Wikimedia thumbnail step, wide enough for the big card of the
 * detail modal and small enough to stay light on a page of a hundred cards.
 *
 * Exported because the request that resolves the final address asks for that
 * same width: the address we build and the address we are given must name the
 * same file, or Wikimedia would render a second thumbnail of every picture.
 *
 * The two are still two entries in the cache of the browser: the resolved
 * address carries the tracking parameters the API appends to it, which the
 * address our redirect ends on does not. A picture first shown through the
 * built address and later through the resolved one is therefore downloaded
 * once more, once per file and never again.
 */
export const THUMBNAIL_WIDTH = 500;

const WIDTH_PARAMETER = 'width';

const INVALID_FILE_NAME_MESSAGE = 'Invalid Commons file name';

/** Only a validated name may ever be interpolated: this is the injection guard. */
function assertFileName(fileName: string): string {
  if (!isCommonsFileName(fileName)) {
    throw new Error(`${INVALID_FILE_NAME_MESSAGE}: ${fileName}`);
  }
  return fileName;
}

/**
 * The file name held by a `Special:FilePath` URI, or null when the URI is not
 * one of them or does not carry a usable name. The URI itself is never reused:
 * only the name it yields travels on.
 */
export function fileNameFromFilePathUri(uri: string): string | null {
  const prefix = FILE_PATH_URI_PREFIXES.find((candidate) => uri.startsWith(candidate));
  if (prefix === undefined) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(uri.slice(prefix.length));
  } catch {
    // A malformed percent sequence throws: the value is dropped like any other
    // unusable one, and the next image property of the item is tried.
    return null;
  }
  return isCommonsFileName(decoded) ? decoded : null;
}

/** Address of the thumbnail shown over the placeholder of a card. */
export function commonsThumbnailUrl(fileName: string): string {
  const path = encodeURIComponent(assertFileName(fileName));
  return `${HTTPS_ORIGIN}${FILE_PATH}${path}?${WIDTH_PARAMETER}=${THUMBNAIL_WIDTH}`;
}

/** Address of the file page, which names the author and the licence. */
export function commonsFilePageUrl(fileName: string): string {
  return `${HTTPS_ORIGIN}${FILE_PAGE_PATH}${encodeURIComponent(assertFileName(fileName))}`;
}
