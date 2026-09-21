/**
 * The address of the French Wikipedia article a card stands for, built from
 * the title the card already shows. Nothing is asked of anyone: the title of
 * a card IS the title of its article, which is how the site makes its cards
 * in the first place, and the golden set resolves every one of its titles on
 * frwiki without a redirect.
 *
 * The host and the path are constants here, and the only thing ever
 * interpolated into them is a title that went through `encodeURIComponent`:
 * no title, whatever it holds, can move the address to another host, another
 * path, or another scheme.
 */

const FRWIKI_ORIGIN = 'https://fr.wikipedia.org';
const ARTICLE_PATH = '/wiki/';

const ARTICLE_URL_PREFIX = `${FRWIKI_ORIGIN}${ARTICLE_PATH}`;

/**
 * A guard against a title no article could bear, not a faithful copy of the
 * rule MediaWiki applies: MediaWiki counts the 255 bytes of the UTF-8 form of
 * a title, where this counts characters. The two agree on what matters here,
 * since a card title of 300 characters is already far past anything the site
 * shows, and an address built from one would simply answer that the article
 * does not exist.
 */
const MAX_TITLE_LENGTH = 300;

/** MediaWiki writes the spaces of a title as underscores in its addresses. */
const SPACE = / /g;
const UNDERSCORE = '_';

/**
 * A URL of the frwiki article space, the only value this module ever returns.
 * Used as the last check before the DOM, exactly as `isLetterboxdUrl` is.
 */
export function isFrwikiArticleUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ARTICLE_URL_PREFIX);
}

/**
 * The address of the article, or null for a title no article can bear: an
 * empty one, one made of whitespace alone, or one longer than a title may be.
 * A card whose title cannot be read gets no link rather than a link to
 * nowhere.
 */
export function frwikiArticleUrl(title: string): string | null {
  const trimmed = title.trim();

  if (trimmed === '' || trimmed.length > MAX_TITLE_LENGTH) {
    return null;
  }
  return `${ARTICLE_URL_PREFIX}${encodeURIComponent(trimmed.replace(SPACE, UNDERSCORE))}`;
}
