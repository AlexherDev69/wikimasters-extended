import { chunk } from '../../../core/array/chunk';
import { FRWIKI_TITLE_SEPARATOR, TITLE_BATCH_SIZE } from '../../../core/config/wikimedia';
import type { FetchJsonOptions } from '../../../core/http/fetch-json';
import { fetchFrwikiQuery } from '../../../core/mediawiki/frwiki-query';
import { parseTitleMappings, resolveFinalTitle } from '../../../core/mediawiki/title-mappings';
import { isRecord } from '../../../core/types/guards';
import type { ArticleImageSource } from '../../categorization/domain/ports';
import { findArticleImageFile, stripTrailingParenthetical } from '../domain/article-image-match';
import type { CommonsFile } from '../../../core/mediawiki/card-image';

/**
 * The article's own picture, for a card Wikidata's image properties leave
 * empty: a Commons file named exactly after the article and actually used in
 * it (rules 2 to 6 of the phase 7d specification), or failing that the free
 * lead picture MediaWiki itself picked for the article (rule 7, phase 7f),
 * which the same answer carries at no extra cost. Rule 1, "Wikidata gave no
 * image at all", is decided by the caller: only the titles of cards that
 * qualify for it are ever passed to this source.
 *
 * One request to fr.wikipedia.org per batch of titles, listing the files each
 * article uses and whether it is a disambiguation page; a second, smaller
 * request follows only when at least one candidate file was found, to confirm
 * it is hosted on Commons rather than on frwiki itself. The common case is one
 * request only, since most cards produce no candidate: for N titles this is
 * at most ceil(N / ARTICLE_TITLE_BATCH_SIZE) + ceil(C / TITLE_BATCH_SIZE)
 * requests, C being the number of candidates found. No new host: every
 * request travels through the same fetchJson plumbing, with its timeout, its
 * retries, its cooldowns and no credentials, as every other frwiki request.
 */

/** The namespace a Commons file is asked for under, which frwiki normalizes. */
const FILE_NAMESPACE_PREFIX = 'File:';
/** The namespace name the French wiki normalizes it to in every answer. */
const NORMALIZED_FILE_NAMESPACE_PREFIX = 'Fichier:';

const DISAMBIGUATION_PROPERTY = 'disambiguation';

/**
 * The page property naming the FREE lead picture MediaWiki picked for an
 * article, which is the last rule of the match (phase 7f). The free variant
 * on purpose: the other one, `page_image`, also answers with the non free
 * files frwiki hosts under its own exception, which rule 5 refuses anyway.
 */
const LEAD_IMAGE_PROPERTY = 'page_image_free';

/** Underscores and spaces are the same character in a MediaWiki title, and
 * the file lists of the same answer are spelled with spaces. */
const TITLE_UNDERSCORE_PATTERN = /_/g;
const TITLE_SPACE = ' ';

/** What `imagerepository` reads for a Commons file. A local frwiki file reads "local". */
const SHARED_REPOSITORY = 'shared';

const INVALID_ARTICLE_RESPONSE_MESSAGE = 'Unexpected frwiki images response shape';
const INVALID_REPOSITORY_RESPONSE_MESSAGE = 'Unexpected frwiki imageinfo response shape';

/** Present on `query.continue` while MediaWiki still has more images to list. */
const IMAGES_CONTINUATION_PARAMETER = 'imcontinue';

/**
 * How many article titles one `findArticleImages` request asks about at once.
 * Deliberately its own constant rather than TITLE_BATCH_SIZE: `imlimit=max`
 * caps the WHOLE answer at 500 file rows shared across every title of the
 * batch, not 500 per title. Measured live on 2026-09-20: 13 realistic card
 * titles produced 194 rows (about 15 per title) and no continuation, while 50
 * titles hit the 500 row cap after only 3 of the 50 pages had received any
 * file list at all. Sizing the batch at that measured average would leave no
 * room for an article carrying more files than the mean, so this constant
 * targets 60% of the cap at that average instead: 500 * 0.6 / 15 = 20.
 */
export const ARTICLE_TITLE_BATCH_SIZE = 20;

const ARTICLE_QUERY_PARAMETERS = {
  prop: 'images|pageprops',
  ppprop: `${DISAMBIGUATION_PROPERTY}|${LEAD_IMAGE_PROPERTY}`,
  imlimit: 'max',
  redirects: '1',
} as const;

const REPOSITORY_QUERY_PARAMETERS = {
  prop: 'imageinfo',
} as const;

interface ParsedArticlePages {
  normalized: Map<string, string>;
  redirects: Map<string, string>;
  disambiguationTitles: Set<string>;
  /**
   * Bare Commons file names (no namespace prefix), by the title the API
   * answered under. Only set for a page whose own `images` key came back in
   * this answer: see `truncated` for what a missing entry means.
   */
  fileNamesByTitle: Map<string, string[]>;
  /**
   * The free lead picture of each page that has one, by the title the API
   * answered under, as a bare file name spelled the way the file lists above
   * spell it.
   */
  leadFileNameByTitle: Map<string, string>;
  /**
   * Whether MediaWiki cut this answer short (`continue.imcontinue`). A title
   * absent from `fileNamesByTitle` while this is true was never examined, not
   * confirmed fileless: see `findArticleImages`.
   */
  truncated: boolean;
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
  leadFileNameByTitle: Map<string, string>;
} {
  const disambiguationTitles = new Set<string>();
  const fileNamesByTitle = new Map<string, string[]>();
  const leadFileNameByTitle = new Map<string, string>();
  if (!Array.isArray(raw)) {
    return { disambiguationTitles, fileNamesByTitle, leadFileNameByTitle };
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
    const leadFileName = isRecord(pageProps) ? pageProps[LEAD_IMAGE_PROPERTY] : undefined;
    if (typeof leadFileName === 'string' && leadFileName !== '') {
      leadFileNameByTitle.set(
        page['title'],
        leadFileName.replace(TITLE_UNDERSCORE_PATTERN, TITLE_SPACE),
      );
    }
    // A missing `images` key is left unset here rather than defaulted to an
    // empty list: `findArticleImages` is the one place that knows whether an
    // absent list means "no file" or "not examined" (see `truncated`).
    if (Array.isArray(page['images'])) {
      fileNamesByTitle.set(page['title'], parseUsedFileNames(page['images']));
    }
  }
  return { disambiguationTitles, fileNamesByTitle, leadFileNameByTitle };
}

/** Whether MediaWiki still had more images to list for this batch. */
function hasImagesContinuation(payload: Record<string, unknown>): boolean {
  const continuation = payload['continue'];
  return isRecord(continuation) && IMAGES_CONTINUATION_PARAMETER in continuation;
}

function parseArticleResponse(payload: unknown): ParsedArticlePages {
  if (!isRecord(payload) || !isRecord(payload['query'])) {
    throw new Error(INVALID_ARTICLE_RESPONSE_MESSAGE);
  }
  const query = payload['query'];
  const { disambiguationTitles, fileNamesByTitle, leadFileNameByTitle } = parseArticlePages(
    query['pages'],
  );

  return {
    normalized: parseTitleMappings(query['normalized']),
    redirects: parseTitleMappings(query['redirects']),
    disambiguationTitles,
    fileNamesByTitle,
    leadFileNameByTitle,
    truncated: hasImagesContinuation(payload),
  };
}

/**
 * MediaWiki may CONTINUE this answer (`continue.imcontinue`) when the titles
 * of a batch together use more files than `imlimit=max` allows across all of
 * them. It is deliberately not followed: every title a truncated answer fails
 * to give a matching file for is treated by `findArticleImages` as unexamined
 * rather than fileless, so it is left unresolved for a later batch instead of
 * wrongly remembered as having no matching file. This never costs a second
 * request per article, only an occasional retry that ARTICLE_TITLE_BATCH_SIZE
 * is sized to make rare.
 */
async function requestArticleBatch(
  titles: readonly string[],
  httpOptions: FetchJsonOptions,
): Promise<ParsedArticlePages> {
  const payload = await fetchFrwikiQuery(ARTICLE_QUERY_PARAMETERS, titles, httpOptions);

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
  const payload = await fetchFrwikiQuery(
    REPOSITORY_QUERY_PARAMETERS,
    fileNames.map((fileName) => `${FILE_NAMESPACE_PREFIX}${fileName}`),
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
 * one Wikidata could not give, by batches of ARTICLE_TITLE_BATCH_SIZE. A title
 * with no qualifying file maps to null, which the caller remembers as such. A
 * title left unexamined by MediaWiki's continuation is absent from the answer
 * altogether: the caller must not remember that as a miss either.
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
      for (const batch of chunk(sendableTitles, ARTICLE_TITLE_BATCH_SIZE)) {
        const pages = await requestArticleBatch(batch, httpOptions);
        for (const requestedTitle of batch) {
          const finalTitle = resolveFinalTitle(requestedTitle, pages);
          if (pages.disambiguationTitles.has(finalTitle)) {
            resolved.set(requestedTitle, null);
            continue;
          }

          const usedFileNames = pages.fileNamesByTitle.get(finalTitle);
          if (usedFileNames === undefined) {
            if (pages.truncated) {
              // Cut off before reaching this article's own file list: unknown,
              // not fileless, so it is left out of the answer for a retry.
              continue;
            }
            resolved.set(requestedTitle, null);
            continue;
          }

          const candidate = findArticleImageFile(
            stripTrailingParenthetical(finalTitle),
            usedFileNames,
            pages.leadFileNameByTitle.get(finalTitle) ?? null,
          );
          if (candidate !== null) {
            candidatesByTitle.set(requestedTitle, candidate);
          } else if (!pages.truncated) {
            resolved.set(requestedTitle, null);
          }
          // A truncated answer also cuts ONE page's list in the MIDDLE, and
          // the pages come back in an arbitrary order, so no list of such an
          // answer is known to be complete: a title that found nothing in it
          // is left unresolved as well, never remembered as a miss.
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
