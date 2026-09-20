/**
 * The only origin this module ever produces. A card title is the exact title
 * of its French Wikipedia article, so the link is built from it and from
 * nothing else.
 */
const FRWIKI_ARTICLE_PREFIX = 'https://fr.wikipedia.org/wiki/';

/** MediaWiki writes the spaces of a title as underscores in its own links. */
const SPACE_PATTERN = / /g;
const TITLE_SPACE_REPLACEMENT = '_';

/**
 * Address of the article of a card. The title is encoded as a whole, so a
 * colon, an accent or an apostrophe travels as it must and nothing in a title
 * can move the link to another path or another host.
 */
export function frwikiArticleUrl(title: string): string {
  const path = encodeURIComponent(title.replace(SPACE_PATTERN, TITLE_SPACE_REPLACEMENT));
  return `${FRWIKI_ARTICLE_PREFIX}${path}`;
}
