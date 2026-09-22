import { FRWIKI_TITLE_SEPARATOR, TITLE_BATCH_SIZE } from '../../../core/config/wikimedia';
import { chunk } from '../../../core/array/chunk';
import type { FetchJsonOptions } from '../../../core/http/fetch-json';
import { fetchFrwikiQuery } from '../../../core/mediawiki/frwiki-query';
import { parseTitleMappings, resolveFinalTitle } from '../../../core/mediawiki/title-mappings';
import { isRecord } from '../../../core/types/guards';
import { leadImageFile } from '../../missing-image/domain/lead-image';
import type { ResolvedTitle, TitleResolver } from '../domain/ports';
import { isQid } from './wikidata-uri';

const INVALID_RESPONSE_MESSAGE = 'Unexpected frwiki response shape';

/**
 * The page property naming the FREE lead picture MediaWiki picked for the
 * article. The free variant on purpose, as the article image source reads it
 * too: the other one, `page_image`, also answers with the non free files
 * frwiki hosts under its own exception, which this extension never draws.
 * Measured on the golden set on 2026-09-21: the two name the same file for
 * all 43 articles that lead with a picture.
 *
 * It rides in the request that already asks for the Wikidata item of each
 * title, so the picture the site draws costs not one request more.
 */
const LEAD_IMAGE_PROPERTY = 'page_image_free';

const QUERY_PARAMETERS = {
  prop: 'pageprops',
  ppprop: `wikibase_item|${LEAD_IMAGE_PROPERTY}`,
  redirects: '1',
} as const;

interface ParsedPages {
  /** Title normalization applied by the API, for example "albert" to "Albert". */
  normalized: Map<string, string>;
  redirects: Map<string, string>;
  /** Final title to what its article answers, for every page of the batch. */
  pageByTitle: Map<string, ResolvedTitle>;
}

/** Nothing known of that title: no item, no picture. */
function unresolved(): ResolvedTitle {
  return { qid: null, leadImage: null };
}

function parsePages(raw: unknown): Map<string, ResolvedTitle> {
  const pageByTitle = new Map<string, ResolvedTitle>();
  if (!Array.isArray(raw)) {
    return pageByTitle;
  }

  for (const page of raw) {
    if (!isRecord(page) || typeof page['title'] !== 'string') {
      continue;
    }
    const pageProps = isRecord(page['pageprops']) ? page['pageprops'] : {};
    const item = pageProps['wikibase_item'];
    // A malformed id is dropped here so it never reaches a query builder, and
    // a file name that could not be drawn never reaches a URL.
    const qid = typeof item === 'string' && isQid(item) ? item : null;
    pageByTitle.set(page['title'], {
      qid,
      leadImage: leadImageFile(pageProps[LEAD_IMAGE_PROPERTY]),
    });
  }
  return pageByTitle;
}

function parseResponse(payload: unknown): ParsedPages {
  if (!isRecord(payload) || !isRecord(payload['query'])) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }
  const query = payload['query'];

  return {
    normalized: parseTitleMappings(query['normalized']),
    redirects: parseTitleMappings(query['redirects']),
    pageByTitle: parsePages(query['pages']),
  };
}

async function requestBatch(
  titles: readonly string[],
  httpOptions: FetchJsonOptions,
): Promise<ParsedPages> {
  const payload = await fetchFrwikiQuery(QUERY_PARAMETERS, titles, httpOptions);

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
 * Resolves exact frwiki article titles to their Wikidata item and to the
 * picture their article leads with, by batches of TITLE_BATCH_SIZE. Returned
 * pages are not in request order, so each requested title is mapped through
 * the normalizations and redirects of the response.
 */
export function createTitleResolver(httpOptions: FetchJsonOptions): TitleResolver {
  return {
    async resolveTitles(titles: readonly string[]): Promise<Map<string, ResolvedTitle>> {
      const resolved = new Map<string, ResolvedTitle>();
      const sendableTitles: string[] = [];

      for (const title of titles) {
        if (isSendableTitle(title)) {
          sendableTitles.push(title);
        } else {
          resolved.set(title, unresolved());
        }
      }

      for (const batch of chunk(sendableTitles, TITLE_BATCH_SIZE)) {
        const pages = await requestBatch(batch, httpOptions);
        for (const requestedTitle of batch) {
          const finalTitle = resolveFinalTitle(requestedTitle, pages);
          resolved.set(requestedTitle, pages.pageByTitle.get(finalTitle) ?? unresolved());
        }
      }

      return resolved;
    },
  };
}
