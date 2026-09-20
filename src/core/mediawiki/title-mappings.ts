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
