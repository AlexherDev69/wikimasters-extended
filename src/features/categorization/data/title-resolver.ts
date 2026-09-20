import {
  API_USER_AGENT,
  API_USER_AGENT_HEADER,
  FRWIKI_API_URL,
  FRWIKI_TITLE_SEPARATOR,
  TITLE_BATCH_SIZE,
} from '../../../core/config/wikimedia';
import { chunk } from '../../../core/array/chunk';
import { fetchJson, type FetchJsonOptions } from '../../../core/http/fetch-json';
import { parseTitleMappings } from '../../../core/mediawiki/title-mappings';
import { isRecord } from '../../../core/types/guards';
import type { TitleResolver } from '../domain/ports';
import { isQid } from './wikidata-uri';

const JSON_MEDIA_TYPE = 'application/json';

/** Upper bound on the redirect chain of a single title, also guards cycles. */
const MAX_REDIRECT_HOPS = 5;

const INVALID_RESPONSE_MESSAGE = 'Unexpected frwiki response shape';

const QUERY_PARAMETERS = {
  action: 'query',
  prop: 'pageprops',
  ppprop: 'wikibase_item',
  redirects: '1',
  format: 'json',
  formatversion: '2',
  // Forces the anonymous CORS mode of the MediaWiki API.
  origin: '*',
} as const;

interface ParsedPages {
  /** Title normalization applied by the API, for example "albert" to "Albert". */
  normalized: Map<string, string>;
  redirects: Map<string, string>;
  /** Final title to QID, null for a missing page or a page without a Wikidata item. */
  qidByTitle: Map<string, string | null>;
}

function parsePages(raw: unknown): Map<string, string | null> {
  const qidByTitle = new Map<string, string | null>();
  if (!Array.isArray(raw)) {
    return qidByTitle;
  }

  for (const page of raw) {
    if (!isRecord(page) || typeof page['title'] !== 'string') {
      continue;
    }
    const pageProps = page['pageprops'];
    const item = isRecord(pageProps) ? pageProps['wikibase_item'] : undefined;
    // A malformed id is dropped here so it never reaches a query builder.
    const qid = typeof item === 'string' && isQid(item) ? item : null;
    qidByTitle.set(page['title'], qid);
  }
  return qidByTitle;
}

function parseResponse(payload: unknown): ParsedPages {
  if (!isRecord(payload) || !isRecord(payload['query'])) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }
  const query = payload['query'];

  return {
    normalized: parseTitleMappings(query['normalized']),
    redirects: parseTitleMappings(query['redirects']),
    qidByTitle: parsePages(query['pages']),
  };
}

/** Applies the normalization then follows the redirect chain of one title. */
function resolveFinalTitle(requestedTitle: string, pages: ParsedPages): string {
  let title = pages.normalized.get(requestedTitle) ?? requestedTitle;

  const visited = new Set<string>([title]);
  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop += 1) {
    const next = pages.redirects.get(title);
    if (next === undefined || visited.has(next)) {
      break;
    }
    visited.add(next);
    title = next;
  }

  return title;
}

async function requestBatch(
  titles: readonly string[],
  httpOptions: FetchJsonOptions,
): Promise<ParsedPages> {
  const parameters = new URLSearchParams({
    ...QUERY_PARAMETERS,
    titles: titles.join(FRWIKI_TITLE_SEPARATOR),
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
 * A title carrying the batch separator would split into two bogus titles and
 * silently corrupt the answers of the whole batch. The message guard already
 * refuses it, this is the second line of defence.
 */
function isSendableTitle(title: string): boolean {
  return !title.includes(FRWIKI_TITLE_SEPARATOR) && title.trim() !== '';
}

/**
 * Resolves exact frwiki article titles to Wikidata QIDs, by batches of
 * TITLE_BATCH_SIZE. Returned pages are not in request order, so each requested
 * title is mapped through the normalizations and redirects of the response.
 */
export function createTitleResolver(httpOptions: FetchJsonOptions): TitleResolver {
  return {
    async resolveTitles(titles: readonly string[]): Promise<Map<string, string | null>> {
      const resolved = new Map<string, string | null>();
      const sendableTitles: string[] = [];

      for (const title of titles) {
        if (isSendableTitle(title)) {
          sendableTitles.push(title);
        } else {
          resolved.set(title, null);
        }
      }

      for (const batch of chunk(sendableTitles, TITLE_BATCH_SIZE)) {
        const pages = await requestBatch(batch, httpOptions);
        for (const requestedTitle of batch) {
          const finalTitle = resolveFinalTitle(requestedTitle, pages);
          resolved.set(requestedTitle, pages.qidByTitle.get(finalTitle) ?? null);
        }
      }

      return resolved;
    },
  };
}
