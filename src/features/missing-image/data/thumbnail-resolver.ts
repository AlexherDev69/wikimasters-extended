import { chunk } from '../../../core/array/chunk';
import {
  API_USER_AGENT,
  API_USER_AGENT_HEADER,
  FRWIKI_API_URL,
  FRWIKI_TITLE_SEPARATOR,
  TITLE_BATCH_SIZE,
} from '../../../core/config/wikimedia';
import { fetchJson, type FetchJsonOptions } from '../../../core/http/fetch-json';
import { parseTitleMappings } from '../../../core/mediawiki/title-mappings';
import { isRecord } from '../../../core/types/guards';
import type { ThumbnailUrlSource } from '../../categorization/domain/ports';
import { isCommonsFileName } from '../domain/card-image';
import { THUMBNAIL_WIDTH } from '../domain/commons-url';
import { isWikimediaThumbnailUrl } from '../domain/thumbnail-url';

/**
 * Asks the frwiki API for the final address of each Commons file, so that the
 * card goes straight to the picture instead of walking the two redirects of
 * `Special:FilePath` again on every display.
 *
 * No new host: fr.wikipedia.org is already the only MediaWiki host the
 * extension talks to, and this request travels through the same plumbing as the
 * titles, with its timeout, its retries, its cooldowns and no credentials.
 */

const JSON_MEDIA_TYPE = 'application/json';

/** The namespace a Commons file is asked for under, which frwiki normalizes. */
const FILE_NAMESPACE_PREFIX = 'File:';

const INVALID_RESPONSE_MESSAGE = 'Unexpected frwiki imageinfo response shape';

const QUERY_PARAMETERS = {
  action: 'query',
  prop: 'imageinfo',
  iiprop: 'url',
  iiurlwidth: String(THUMBNAIL_WIDTH),
  format: 'json',
  formatversion: '2',
  // Forces the anonymous CORS mode of the MediaWiki API, as the titles do.
  origin: '*',
} as const;

interface ParsedImageInfo {
  /** "File:X" to "Fichier:X", the normalization the API reports for each title. */
  normalized: Map<string, string>;
  /** Usable thumbnail address, by the title the API answered under. */
  urlByTitle: Map<string, string>;
}

/**
 * The thumbnail addresses of one answer. The decision is taken ONLY on the
 * presence of a usable `thumburl`: a file hosted on Commons comes back with
 * `"missing": true` AND a full `imageinfo` block, because it is missing from
 * frwiki while existing on Commons (measured against the live API on
 * 2026-09-20). Reading `missing` would throw away every single image.
 */
function parseThumbnailUrls(raw: unknown): Map<string, string> {
  const urlByTitle = new Map<string, string>();
  if (!Array.isArray(raw)) {
    return urlByTitle;
  }

  for (const page of raw) {
    if (!isRecord(page) || typeof page['title'] !== 'string') {
      continue;
    }
    const imageInfo = page['imageinfo'];
    const firstInfo = Array.isArray(imageInfo) ? imageInfo[0] : undefined;
    const thumbnailUrl = isRecord(firstInfo) ? firstInfo['thumburl'] : undefined;

    // The address is kept exactly as the API gives it, with the tracking
    // parameters it appends: it is never rebuilt, only checked against the
    // closed host allowlist, which reads the host and not the query string.
    if (isWikimediaThumbnailUrl(thumbnailUrl)) {
      urlByTitle.set(page['title'], thumbnailUrl);
    }
  }
  return urlByTitle;
}

function parseResponse(payload: unknown): ParsedImageInfo {
  if (!isRecord(payload) || !isRecord(payload['query'])) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }
  const query = payload['query'];

  return {
    normalized: parseTitleMappings(query['normalized']),
    urlByTitle: parseThumbnailUrls(query['pages']),
  };
}

async function requestBatch(
  fileNames: readonly string[],
  httpOptions: FetchJsonOptions,
): Promise<ParsedImageInfo> {
  const parameters = new URLSearchParams({
    ...QUERY_PARAMETERS,
    titles: fileNames
      .map((fileName) => `${FILE_NAMESPACE_PREFIX}${fileName}`)
      .join(FRWIKI_TITLE_SEPARATOR),
  });

  const payload = await fetchJson(
    {
      url: `${FRWIKI_API_URL}?${parameters.toString()}`,
      method: 'GET',
      headers: {
        Accept: JSON_MEDIA_TYPE,
        [API_USER_AGENT_HEADER]: API_USER_AGENT,
      },
    },
    httpOptions,
  );

  return parseResponse(payload);
}

/**
 * Resolves the final thumbnail address of Commons file names, by batches of
 * TITLE_BATCH_SIZE. A file name with no usable address maps to null, which the
 * caller remembers as such.
 *
 * The pages of an answer come back in an ARBITRARY order, so each requested
 * name is mapped through the normalization of the response and matched by
 * title, never by index.
 */
export function createThumbnailUrlResolver(httpOptions: FetchJsonOptions): ThumbnailUrlSource {
  return {
    async resolveThumbnailUrls(
      fileNames: readonly string[],
    ): Promise<Map<string, string | null>> {
      const resolved = new Map<string, string | null>();
      const sendableNames: string[] = [];

      for (const fileName of fileNames) {
        // Second line of defence: a name carrying the batch separator would
        // split into two bogus titles and corrupt the answers of the whole
        // batch, and the file name guard already refuses that character.
        if (isCommonsFileName(fileName)) {
          sendableNames.push(fileName);
        } else {
          resolved.set(fileName, null);
        }
      }

      for (const batch of chunk(sendableNames, TITLE_BATCH_SIZE)) {
        const pages = await requestBatch(batch, httpOptions);
        for (const fileName of batch) {
          const requestedTitle = `${FILE_NAMESPACE_PREFIX}${fileName}`;
          const answeredTitle = pages.normalized.get(requestedTitle) ?? requestedTitle;
          resolved.set(fileName, pages.urlByTitle.get(answeredTitle) ?? null);
        }
      }

      return resolved;
    },
  };
}
