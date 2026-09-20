const ENTITY_URI_PREFIX = 'http://www.wikidata.org/entity/';

const URI_SEPARATOR = ',';

/** Shape of every Wikidata item id. Also the injection guard of the query builders. */
const QID_PATTERN = /^Q[1-9]\d*$/;

export function isQid(value: string): boolean {
  return QID_PATTERN.test(value);
}

/**
 * Returns the QID of a Wikidata entity URI, or null when the URI is not one.
 * The id is validated here, at the parse boundary: a single malformed value
 * must not make a whole batch of 50 throw later, on every scan.
 */
export function qidFromEntityUri(uri: string): string | null {
  if (!uri.startsWith(ENTITY_URI_PREFIX)) {
    return null;
  }
  const qid = uri.slice(ENTITY_URI_PREFIX.length);
  return isQid(qid) ? qid : null;
}

/**
 * Parses a GROUP_CONCAT cell, which holds entity URIs separated by commas and
 * is an empty string when the optional property is absent. Values that are not
 * entity URIs are dropped.
 */
export function qidsFromConcatenatedUris(concatenated: string | undefined): string[] {
  if (concatenated === undefined || concatenated === '') {
    return [];
  }

  const qids: string[] = [];
  for (const uri of concatenated.split(URI_SEPARATOR)) {
    const qid = qidFromEntityUri(uri);
    if (qid !== null) {
      qids.push(qid);
    }
  }
  return qids;
}
