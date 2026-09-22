import { isRecord } from '../types/guards';

/**
 * The `{ from, to }` pairs the MediaWiki API reports for the titles it changed
 * before answering: `query.normalized` when it normalizes one ("albert" to
 * "Albert", "File:X" to "Fichier:X"), `query.redirects` when it follows one.
 *
 * Both arrays carry the same shape, and every caller needs them for the same
 * reason: the pages come back in an arbitrary order, so an answer is matched
 * back to the title that was asked for through these pairs and never by index.
 */
export function parseTitleMappings(raw: unknown): Map<string, string> {
  const mappings = new Map<string, string>();
  if (!Array.isArray(raw)) {
    return mappings;
  }
  for (const entry of raw) {
    if (isRecord(entry) && typeof entry['from'] === 'string' && typeof entry['to'] === 'string') {
      mappings.set(entry['from'], entry['to']);
    }
  }
  return mappings;
}

/** Upper bound on the redirect chain of a single title, also guards cycles. */
const MAX_REDIRECT_HOPS = 5;

/**
 * The two tables of one parsed answer that a title has to be walked through,
 * and nothing else: every caller parses more than this out of its own response,
 * and passes that richer shape here as is.
 */
interface TitleMappings {
  normalized: ReadonlyMap<string, string>;
  redirects: ReadonlyMap<string, string>;
}

/** Applies the normalization then follows the redirect chain of one title. */
export function resolveFinalTitle(requestedTitle: string, pages: TitleMappings): string {
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
