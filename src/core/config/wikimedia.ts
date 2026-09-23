/**
 * The version Wikimedia is told about. It is written here by hand, because
 * this module is loaded at import time by both the service worker and the
 * content script, long before a manifest could be read for it.
 *
 * A comment asking the next reader to keep it in sync is not a mechanism: it
 * drifted to 0.1.0 while the package, the config and the built manifest all
 * said 0.1.1, and nothing noticed. The mechanism is in wikimedia.test.ts,
 * which fails when the three disagree.
 */
const EXTENSION_VERSION = '0.1.3';

const REPOSITORY_URL = 'https://github.com/AlexherDev69/wikimasters-extended';

export const FRWIKI_API_URL = 'https://fr.wikipedia.org/w/api.php';

export const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

/**
 * Browsers forbid extensions from setting `User-Agent`, and Wikimedia asks API
 * clients to identify themselves. Their APIs read this header instead.
 */
export const API_USER_AGENT_HEADER = 'Api-User-Agent';

export const API_USER_AGENT = `WikiMastersExtended/${EXTENSION_VERSION} (${REPOSITORY_URL})`;

/** Hard limit of the MediaWiki API for a single `titles` parameter. */
export const TITLE_BATCH_SIZE = 50;

/** The MediaWiki API separates the titles of a batch with this character. */
export const FRWIKI_TITLE_SEPARATOR = '|';

export const ENTITY_BATCH_SIZE = 50;

export const CLASS_BATCH_SIZE = 50;

export const REQUEST_TIMEOUT_MS = 30_000;

export const MAX_REQUEST_ATTEMPTS = 3;

export const INITIAL_RETRY_DELAY_MS = 1_000;

export const RETRY_DELAY_FACTOR = 2;

/** Upper bound for any retry delay, including a `Retry-After` header. */
export const MAX_RETRY_DELAY_MS = 30_000;
