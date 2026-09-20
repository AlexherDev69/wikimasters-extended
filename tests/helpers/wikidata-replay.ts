import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRWIKI_API_URL, WIKIDATA_SPARQL_URL } from '../../src/core/config/wikimedia';
import type { FetchLike } from '../../src/core/http/fetch-json';
import { isRecord } from '../../src/core/types/guards';

/**
 * Replays the real API recordings of tests/fixtures/wikidata so that no test
 * ever reaches the network.
 *
 * The replay is deliberately strict: it checks the host, parses the ids the
 * production code actually asked for, and answers with those rows only. A
 * malformed VALUES clause, a wrong host or a forgotten batch therefore fails
 * the test instead of silently receiving the whole recording.
 */

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/wikidata');

const HTTP_OK = 200;
const JSON_MEDIA_TYPE = 'application/json';

/** Distinctive markers of each query, taken from the production query builders. */
const ENTITY_FACTS_MARKER = 'wdt:P31';
const LABELS_MARKER = 'rdfs:label';
const ROOTS_MARKER = 'FILTER(?root IN';
/** Q11424 is "film", the first category root, and never an occupation root. */
const CATEGORY_ROOT_MARKER = 'wd:Q11424';

const VALUES_ENTITY_PATTERN = /wd:(Q[1-9]\d*)/g;
const VALUES_KEYWORD = 'VALUES';
const VALUES_CLOSING_BRACE = '}';
const ENTITY_URI_PREFIX = 'http://www.wikidata.org/entity/';

/** Titles present in the edge case recording (a redirect, a normalization, a missing page). */
export const REDIRECTED_TITLE = 'Einstein';
export const UNNORMALIZED_TITLE = 'albert Einstein';
export const MISSING_TITLE = 'Zzzz article inexistant 8472615';

const EDGE_CASE_TITLES: readonly string[] = [REDIRECTED_TITLE, UNNORMALIZED_TITLE, MISSING_TITLE];

export function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf-8'));
}

const FRWIKI_TITLES = readFixture('frwiki-titles.json');
const FRWIKI_TITLES_EDGE_CASES = readFixture('frwiki-titles-edge-cases.json');
const ENTITY_FACTS = readFixture('entity-facts.json');
const CLASS_ROOTS = readFixture('class-roots.json');
const OCCUPATION_ROOTS = readFixture('occupation-roots.json');
const OCCUPATION_LABELS = readFixture('occupation-labels.json');

export type ReplayCallKind =
  | 'frwiki'
  | 'entity-facts'
  | 'class-roots'
  | 'occupation-roots'
  | 'class-labels';

type SparqlCallKind = Exclude<ReplayCallKind, 'frwiki'>;

export interface ReplayCall {
  kind: ReplayCallKind;
  url: string;
  method: string;
  headers: Headers;
  credentials: RequestCredentials | undefined;
  /** Decoded SPARQL query, null for a frwiki call. */
  query: string | null;
  /** Requested titles, empty for a SPARQL call. */
  titles: string[];
}

export interface ReplayFetch {
  fetchImpl: FetchLike;
  calls: ReplayCall[];
  countOf(kind: ReplayCallKind): number;
}

interface SparqlRow {
  [variable: string]: { value: string } | undefined;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: HTTP_OK,
    headers: { 'Content-Type': JSON_MEDIA_TYPE },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Unexpected fixture shape');
  }
  return value;
}

function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error('Unexpected fixture shape');
  }
  return value;
}

function sparqlRows(fixture: unknown): SparqlRow[] {
  const results = asRecord(asRecord(fixture)['results']);
  return asArray(results['bindings']).map((binding) => {
    const row: SparqlRow = {};
    for (const [variable, cell] of Object.entries(asRecord(binding))) {
      const value = asRecord(cell)['value'];
      if (typeof value !== 'string') {
        throw new Error('Unexpected fixture shape');
      }
      row[variable] = { value };
    }
    return row;
  });
}

function sparqlHead(fixture: unknown): unknown {
  return asRecord(fixture)['head'];
}

function rowEntityId(row: SparqlRow, variable: string): string | null {
  const uri = row[variable]?.value;
  if (uri === undefined || !uri.startsWith(ENTITY_URI_PREFIX)) {
    return null;
  }
  return uri.slice(ENTITY_URI_PREFIX.length);
}

/** The ids bound by the VALUES clause only, never those of the FILTER clause. */
function requestedEntityIds(query: string): string[] {
  const valuesStart = query.indexOf(VALUES_KEYWORD);
  const valuesEnd = query.indexOf(VALUES_CLOSING_BRACE, valuesStart);
  if (valuesStart === -1 || valuesEnd === -1) {
    throw new Error(`The query has no VALUES clause: ${query}`);
  }

  const segment = query.slice(valuesStart, valuesEnd);
  const ids = [...segment.matchAll(VALUES_ENTITY_PATTERN)]
    .map((match) => match[1])
    .filter((id) => id !== undefined);

  if (ids.length === 0) {
    throw new Error(`The query binds no entity in its VALUES clause: ${query}`);
  }
  return ids;
}

function servedRows(
  fixture: unknown,
  variable: string,
  requestedIds: readonly string[],
): SparqlRow[] {
  const wanted = new Set(requestedIds);
  return sparqlRows(fixture).filter((row) => {
    const id = rowEntityId(row, variable);
    return id !== null && wanted.has(id);
  });
}

/** The real entity facts query returns exactly one row per VALUES item. */
function assertEveryEntityHasARow(
  requestedIds: readonly string[],
  rows: readonly SparqlRow[],
  variable: string,
): void {
  const returned = new Set(rows.map((row) => rowEntityId(row, variable)));
  const missing = requestedIds.filter((id) => !returned.has(id));
  if (missing.length > 0) {
    throw new Error(`No entity facts recording for: ${missing.join(', ')}`);
  }
}

function classifySparqlQuery(query: string): SparqlCallKind {
  if (query.includes(ENTITY_FACTS_MARKER)) {
    return 'entity-facts';
  }
  if (query.includes(LABELS_MARKER)) {
    return 'class-labels';
  }
  if (query.includes(ROOTS_MARKER)) {
    const filterSegment = query.slice(query.indexOf(ROOTS_MARKER));
    return filterSegment.includes(CATEGORY_ROOT_MARKER) ? 'class-roots' : 'occupation-roots';
  }
  throw new Error(`No recording for this query: ${query}`);
}

const FIXTURE_BY_KIND: Record<SparqlCallKind, unknown> = {
  'entity-facts': ENTITY_FACTS,
  'class-roots': CLASS_ROOTS,
  'occupation-roots': OCCUPATION_ROOTS,
  'class-labels': OCCUPATION_LABELS,
};

const VARIABLE_BY_KIND: Record<SparqlCallKind, string> = {
  'entity-facts': 'item',
  'class-roots': 'class',
  'occupation-roots': 'class',
  'class-labels': 'class',
};

/** Every entity of the facts recording, in the order the service returned them. */
export function recordedEntityIds(): string[] {
  const ids: string[] = [];
  for (const row of sparqlRows(ENTITY_FACTS)) {
    const id = rowEntityId(row, VARIABLE_BY_KIND['entity-facts']);
    if (id !== null) {
      ids.push(id);
    }
  }
  return ids;
}

function requestedTitles(url: string): string[] {
  const titles = new URL(url).searchParams.get('titles');
  return titles === null || titles === '' ? [] : titles.split('|');
}

/** Serves only the pages that were asked for, as the real API does. */
function serveFrwikiPages(titles: readonly string[]): unknown {
  const query = asRecord(asRecord(FRWIKI_TITLES)['query']);
  const wanted = new Set(titles);
  const pages = asArray(query['pages']).filter((page) => {
    const title = asRecord(page)['title'];
    return typeof title === 'string' && wanted.has(title);
  });
  return { batchcomplete: true, query: { pages } };
}

function decodeQuery(body: BodyInit | null | undefined): string {
  return typeof body === 'string' ? (new URLSearchParams(body).get('query') ?? '') : '';
}

export function createReplayFetch(): ReplayFetch {
  const calls: ReplayCall[] = [];

  const fetchImpl: FetchLike = (url: string, init: RequestInit): Promise<Response> => {
    const headers = new Headers(init.headers);
    const method = init.method ?? 'GET';

    if (method === 'GET') {
      if (!url.startsWith(FRWIKI_API_URL)) {
        throw new Error(`Unexpected frwiki host: ${url}`);
      }
      const titles = requestedTitles(url);
      calls.push({
        kind: 'frwiki',
        url,
        method,
        headers,
        credentials: init.credentials,
        query: null,
        titles,
      });
      const useEdgeCases = titles.some((title) => EDGE_CASE_TITLES.includes(title));
      return Promise.resolve(
        jsonResponse(useEdgeCases ? FRWIKI_TITLES_EDGE_CASES : serveFrwikiPages(titles)),
      );
    }

    if (url !== WIKIDATA_SPARQL_URL) {
      throw new Error(`Unexpected SPARQL host: ${url}`);
    }
    const query = decodeQuery(init.body);
    const kind = classifySparqlQuery(query);
    const requestedIds = requestedEntityIds(query);
    calls.push({
      kind,
      url,
      method,
      headers,
      credentials: init.credentials,
      query,
      titles: [],
    });

    const fixture = FIXTURE_BY_KIND[kind];
    const variable = VARIABLE_BY_KIND[kind];
    const rows = servedRows(fixture, variable, requestedIds);
    if (kind === 'entity-facts') {
      assertEveryEntityHasARow(requestedIds, rows, variable);
    }
    return Promise.resolve(jsonResponse({ head: sparqlHead(fixture), results: { bindings: rows } }));
  };

  return {
    fetchImpl,
    calls,
    countOf(kind: ReplayCallKind): number {
      return calls.filter((call) => call.kind === kind).length;
    },
  };
}
