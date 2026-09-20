/** Kept in sync with the `version` field of package.json and wxt.config.ts. */
const EXTENSION_VERSION = '0.1.0';

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
