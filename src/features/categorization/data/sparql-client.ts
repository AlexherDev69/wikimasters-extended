import { API_USER_AGENT, API_USER_AGENT_HEADER, WIKIDATA_SPARQL_URL } from '../../../core/config/wikimedia';
import { fetchJson, type FetchJsonOptions } from '../../../core/http/fetch-json';
import { isRecord } from '../../../core/types/guards';

const SPARQL_JSON_MEDIA_TYPE = 'application/sparql-results+json';
const FORM_MEDIA_TYPE = 'application/x-www-form-urlencoded';
const QUERY_PARAMETER = 'query';
const INVALID_SPARQL_RESPONSE_MESSAGE = 'Unexpected SPARQL response shape';

/** One result row, flattened to the value of each bound variable. */
export type SparqlBinding = Record<string, string>;

export type RunSparqlQuery = (query: string) => Promise<SparqlBinding[]>;

function toBinding(raw: unknown): SparqlBinding {
  if (!isRecord(raw)) {
    throw new Error(INVALID_SPARQL_RESPONSE_MESSAGE);
  }

  const binding: SparqlBinding = {};
  for (const [variable, cell] of Object.entries(raw)) {
    if (!isRecord(cell) || typeof cell['value'] !== 'string') {
      throw new Error(INVALID_SPARQL_RESPONSE_MESSAGE);
    }
    binding[variable] = cell['value'];
  }
  return binding;
}

function parseSparqlBindings(payload: unknown): SparqlBinding[] {
  if (!isRecord(payload)) {
    throw new Error(INVALID_SPARQL_RESPONSE_MESSAGE);
  }
  const results = payload['results'];
  if (!isRecord(results) || !Array.isArray(results['bindings'])) {
    throw new Error(INVALID_SPARQL_RESPONSE_MESSAGE);
  }
  return results['bindings'].map(toBinding);
}

/**
 * POSTs the query to the Wikidata Query Service. POST is used because the
 * generated queries exceed what fits comfortably in a URL.
 */
export function createSparqlClient(httpOptions: FetchJsonOptions): RunSparqlQuery {
  return async function runSparqlQuery(query: string): Promise<SparqlBinding[]> {
    const payload = await fetchJson(
      {
        url: WIKIDATA_SPARQL_URL,
        method: 'POST',
        headers: {
          Accept: SPARQL_JSON_MEDIA_TYPE,
          'Content-Type': FORM_MEDIA_TYPE,
          [API_USER_AGENT_HEADER]: API_USER_AGENT,
        },
        body: new URLSearchParams({ [QUERY_PARAMETER]: query }).toString(),
      },
      httpOptions,
    );

    return parseSparqlBindings(payload);
  };
}
