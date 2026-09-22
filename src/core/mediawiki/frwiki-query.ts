import {
  API_USER_AGENT,
  API_USER_AGENT_HEADER,
  FRWIKI_API_URL,
  FRWIKI_TITLE_SEPARATOR,
} from '../config/wikimedia';
import { fetchJson, type FetchJsonOptions } from '../http/fetch-json';

const JSON_MEDIA_TYPE = 'application/json';

/**
 * What every read of the French Wikipedia API asks for, whatever it reads back:
 * `action=query`, the modern answer shape, and `origin=*`, which forces the
 * anonymous CORS mode of the MediaWiki API.
 *
 * A caller only names the properties it wants, so that the day one of these
 * three has to change, it changes in one place rather than in four.
 */
const SHARED_QUERY_PARAMETERS = {
  action: 'query',
  format: 'json',
  formatversion: '2',
  origin: '*',
} as const;

/**
 * Performs one read of the French Wikipedia API and hands back the body
 * unparsed, because what a caller reads of an answer is its own business.
 *
 * Only the plumbing lives here: the single endpoint, the identification
 * Wikimedia asks API clients for, and the http options the caller was wired
 * with, so that every request of the extension keeps the same timeout, the same
 * retries and the same cooldowns. No caller reaches fetchJson directly, and no
 * caller can therefore forget one of them.
 *
 * `titles` is joined here rather than by the caller: a batch that forgets the
 * separator the API expects is a silent corruption of the whole answer.
 */
export function fetchFrwikiQuery(
  parameters: Readonly<Record<string, string>>,
  titles: readonly string[],
  httpOptions: FetchJsonOptions,
): Promise<unknown> {
  const searchParameters = new URLSearchParams({
    ...SHARED_QUERY_PARAMETERS,
    ...parameters,
    titles: titles.join(FRWIKI_TITLE_SEPARATOR),
  });

  return fetchJson(
    {
      url: `${FRWIKI_API_URL}?${searchParameters.toString()}`,
      method: 'GET',
      headers: {
        Accept: JSON_MEDIA_TYPE,
        [API_USER_AGENT_HEADER]: API_USER_AGENT,
      },
    },
    httpOptions,
  );
}
