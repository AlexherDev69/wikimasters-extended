import { chunk } from '../../../core/array/chunk';
import {
  API_USER_AGENT,
  API_USER_AGENT_HEADER,
  FRWIKI_API_URL,
  FRWIKI_TITLE_SEPARATOR,
  TITLE_BATCH_SIZE,
} from '../../../core/config/wikimedia';
import { fetchJson, type FetchJsonOptions } from '../../../core/http/fetch-json';
import { parseTitleMappings } from '../../../core/mediawiki/title-mappings';
import { isRecord } from '../../../core/types/guards';
import type { ArticleImageSource } from '../../categorization/domain/ports';
import { findArticleImageFile, stripTrailingParenthetical } from '../domain/article-image-match';
import type { CommonsFile } from '../domain/card-image';

/**
 * The article's own picture, for a card Wikidata's image properties leave
 * empty: a Commons file named exactly after the article and actually used in
 * it (rules 2 to 6 of the phase 7d specification). Rule 1, "Wikidata gave no
 * image at all", is decided by the caller: only the titles of cards that
 * qualify for it are ever passed to this source.
 *
 * Two requests to fr.wikipedia.org per batch, never more: the first lists the
 * files an article uses and says whether the article is a disambiguation
 * page, the second confirms that the one candidate file it produced is
 * hosted on Commons rather than on frwiki itself. No new host: both travel
 * through the same fetchJson plumbing, with its timeout, its retries, its
 * cooldowns and no credentials, as every other frwiki request.
 */

const JSON_MEDIA_TYPE = 'application/json';

/** The namespace a Commons file is asked for under, which frwiki normalizes. */
const FILE_NAMESPACE_PREFIX = 'File:';
/** The namespace name the French wiki normalizes it to in every answer. */
const NORMALIZED_FILE_NAMESPACE_PREFIX = 'Fichier:';

/** Upper bound on the redirect chain of a single title, also guards cycles. */
const MAX_REDIRECT_HOPS = 5;

const DISAMBIGUATION_PROPERTY = 'disambiguation';

/** What `imagerepository` reads for a Commons file. A local frwiki file reads "local". */
const SHARED_REPOSITORY = 'shared';

const INVALID_ARTICLE_RESPONSE_MESSAGE = 'Unexpected frwiki images response shape';
const INVALID_REPOSITORY_RESPONSE_MESSAGE = 'Unexpected frwiki imageinfo response shape';

const ARTICLE_QUERY_PARAMETERS = {
  action: 'query',
  prop: 'images|pageprops',
  ppprop: DISAMBIGUATION_PROPERTY,
  imlimit: 'max',
  redirects: '1',
  format: 'json',
  formatversion: '2',
  // Forces the anonymous CORS mode of the MediaWiki API, as the titles do.
  origin: '*',
} as const;

const REPOSITORY_QUERY_PARAMETERS = {
  action: 'query',
  prop: 'imageinfo',
  format: 'json',
  formatversion: '2',
  origin: '*',
} as const;

interface ParsedArticlePages {
  normalized: Map<string, string>;
  redirects: Map<string, string>;
  disambiguationTitles: Set<string>;
  /** Bare Commons file names (no namespace prefix), by the title the API answered under. */
  fileNamesByTitle: Map<string, string[]>;
}

/** The bare file names of one page's `images`, in the order the API lists them. */
function parseUsedFileNames(rawImages: unknown): string[] {
  const fileNames: string[] = [];
  if (!Array.isArray(rawImages)) {
    return fileNames;
  }

  for (const image of rawImages) {
    const title = isRecord(image) ? image['title'] : undefined;
    if (typeof title === 'string' && title.startsWith(NORMALIZED_FILE_NAMESPACE_PREFIX)) {
      fileNames.push(title.slice(NORMALIZED_FILE_NAMESPACE_PREFIX.length));
    }
  }
  return fileNames;
}

function parseArticlePages(raw: unknown): {
  disambiguationTitles: Set<string>;
  fileNamesByTitle: Map<string, string[]>;
} {
  const disambiguationTitles = new Set<string>();
  const fileNamesByTitle = new Map<string, string[]>();
  if (!Array.isArray(raw)) {
    return { disambiguationTitles, fileNamesByTitle };
  }

  for (const page of raw) {
    if (!isRecord(page) || typeof page['title'] !== 'string') {
      continue;
    }
    const pageProps = page['pageprops'];
    // The value is an empty string on every disambiguation page: presence is
    // the signal, not truthiness.
    if (isRecord(pageProps) && DISAMBIGUATION_PROPERTY in pageProps) {
      disambiguationTitles.add(page['title']);
    }
    fileNamesByTitle.set(page['title'], parseUsedFileNames(page['images']));
  }
  return { disambiguationTitles, fileNamesByTitle };
}

function parseArticleResponse(payload: unknown): ParsedArticlePages {
  if (!isRecord(payload) || !isRecord(payload['query'])) {
    throw new Error(INVALID_ARTICLE_RESPONSE_MESSAGE);
  }
  const query = payload['query'];
  const { disambiguationTitles, fileNamesByTitle } = parseArticlePages(query['pages']);

  return {
    normalized: parseTitleMappings(query['normalized']),
    redirects: parseTitleMappings(query['redirects']),
    disambiguationTitles,
    fileNamesByTitle,
  };
}

/** Applies the normalization then follows the redirect chain of one title. */
function resolveFinalTitle(requestedTitle: string, pages: ParsedArticlePages): string {
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

/**
 * MediaWiki may CONTINUE this answer (`continue.imcontinue`) when an article
 * uses more files than fit in one page. It is deliberately not followed: the
 * file this source looks for is the one named after the article itself, which
 * sits in the article's own file list wherever the API happens to cut it, so a
 * truncated list only costs an occasional miss, never a wrong match, and never
 * a second request per article.
 */
async function requestArticleBatch(
  titles: readonly string[],
  httpOptions: FetchJsonOptions,
): Promise<ParsedArticlePages> {
  const parameters = new URLSearchParams({
    ...ARTICLE_QUERY_PARAMETERS,
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

  return parseArticleResponse(payload);
}

interface ParsedRepositoryPages {
  normalized: Map<string, string>;
  /** `imagerepository` of each file, by the title the API answered under. */
  repositoryByTitle: Map<string, string>;
}

function parseRepositoryPages(raw: unknown): Map<string, string> {
  const repositoryByTitle = new Map<string, string>();
  if (!Array.isArray(raw)) {
    return repositoryByTitle;
  }

  for (const page of raw) {
    const repository = isRecord(page) ? page['imagerepository'] : undefined;
    if (isRecord(page) && typeof page['title'] === 'string' && typeof repository === 'string') {
      repositoryByTitle.set(page['title'], repository);
    }
  }
  return repositoryByTitle;
}

function parseRepositoryResponse(payload: unknown): ParsedRepositoryPages {
  if (!isRecord(payload) || !isRecord(payload['query'])) {
    throw new Error(INVALID_REPOSITORY_RESPONSE_MESSAGE);
  }
  const query = payload['query'];

  return {
    normalized: parseTitleMappings(query['normalized']),
    repositoryByTitle: parseRepositoryPages(query['pages']),
  };
}

async function requestRepositoryBatch(
  fileNames: readonly string[],
  httpOptions: FetchJsonOptions,
): Promise<ParsedRepositoryPages> {
  const parameters = new URLSearchParams({
    ...REPOSITORY_QUERY_PARAMETERS,
    titles: fileNames
      .map((fileName) => `${FILE_NAMESPACE_PREFIX}${fileName}`)
      .join(FRWIKI_TITLE_SEPARATOR),
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

  return parseRepositoryResponse(payload);
}

/**
 * Confirms which of `candidatesByTitle` are hosted on Commons: `imagerepository`
 * reads "shared" for those and "local" for a file frwiki hosts itself under its
 * non free exception (logos, posters). This is a licensing requirement, not a
 * preference, so a file this call cannot confirm as "shared" is dropped, never
 * kept by default: accepting "local" here is exactly the mistake this guard
 * exists to prevent.
 */
async function keepCommonsHostedFiles(
  candidatesByTitle: ReadonlyMap<string, CommonsFile>,
  httpOptions: FetchJsonOptions,
): Promise<Map<string, CommonsFile>> {
  const confirmed = new Map<string, CommonsFile>();
  // A Commons file name can never carry the batch separator, isCommonsFileName
  // already forbids it, so every one of these names is safe to join as is.
  const fileNames = [...new Set([...candidatesByTitle.values()].map((file) => file.fileName))];
  if (fileNames.length === 0) {
    return confirmed;
  }

  const repositoryByFileName = new Map<string, string>();
  for (const batch of chunk(fileNames, TITLE_BATCH_SIZE)) {
    const pages = await requestRepositoryBatch(batch, httpOptions);
    for (const fileName of batch) {
      const requestedTitle = `${FILE_NAMESPACE_PREFIX}${fileName}`;
      const answeredTitle = pages.normalized.get(requestedTitle) ?? requestedTitle;
      const repository = pages.repositoryByTitle.get(answeredTitle);
      if (repository !== undefined) {
        repositoryByFileName.set(fileName, repository);
      }
    }
  }

  for (const [title, file] of candidatesByTitle) {
    if (repositoryByFileName.get(file.fileName) === SHARED_REPOSITORY) {
      confirmed.set(title, file);
    }
  }
  return confirmed;
}

/**
 * Finds, for each of `titles`, the image the article itself uses in place of
 * one Wikidata could not give, by batches of TITLE_BATCH_SIZE. A title with no
 * qualifying file maps to null, which the caller remembers as such.
 *
 * The pages of an answer come back in an ARBITRARY order, exactly like the
 * other frwiki sources, so each requested title is mapped through the
 * normalization and the redirects of the response and matched by title, never
 * by index.
 */
export function createArticleImageSource(httpOptions: FetchJsonOptions): ArticleImageSource {
  return {
    async findArticleImages(titles: readonly string[]): Promise<Map<string, CommonsFile | null>> {
      const resolved = new Map<string, CommonsFile | null>();
      const sendableTitles: string[] = [];

      for (const title of titles) {
        // Second line of defence: a title carrying the batch separator would
        // split into two bogus titles and corrupt the answers of the whole
        // batch.
        if (!title.includes(FRWIKI_TITLE_SEPARATOR) && title.trim() !== '') {
          sendableTitles.push(title);
        } else {
          resolved.set(title, null);
        }
      }

      const candidatesByTitle = new Map<string, CommonsFile>();
      for (const batch of chunk(sendableTitles, TITLE_BATCH_SIZE)) {
        const pages = await requestArticleBatch(batch, httpOptions);
        for (const requestedTitle of batch) {
          const finalTitle = resolveFinalTitle(requestedTitle, pages);
          if (pages.disambiguationTitles.has(finalTitle)) {
            resolved.set(requestedTitle, null);
            continue;
          }

          const usedFileNames = pages.fileNamesByTitle.get(finalTitle) ?? [];
          const candidate = findArticleImageFile(stripTrailingParenthetical(finalTitle), usedFileNames);
          if (candidate === null) {
            resolved.set(requestedTitle, null);
          } else {
            candidatesByTitle.set(requestedTitle, candidate);
          }
        }
      }

      const confirmed = await keepCommonsHostedFiles(candidatesByTitle, httpOptions);
      for (const title of candidatesByTitle.keys()) {
        resolved.set(title, confirmed.get(title) ?? null);
      }

      return resolved;
    },
  };
}
