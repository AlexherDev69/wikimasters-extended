import { toBlob } from 'html-to-image';
import { CARD_BUTTON_SELECTOR } from '../../letterboxd/data/card-button-selectors';
import { WIKIPEDIA_BUTTON_SELECTOR } from '../../wikipedia-link/data/wikipedia-button-selectors';
import { buildFontEmbedCss } from './font-embed';

/**
 * The card as a PNG picture, drawn from the node the site shows.
 *
 * `html-to-image` copies the card with the styles the browser computed for
 * it, puts that copy in an SVG image and paints the image on a canvas. The
 * copy is never added to the page: the site keeps exactly the document it
 * built.
 */

/**
 * Twice the size the card is drawn at, so the picture stays sharp once pasted
 * in a conversation that shows it larger.
 */
const PIXEL_RATIO = 2;

/**
 * How the pictures of the card are read again: from the cache of the browser,
 * where the page has just put them, without a cookie. A picture of another
 * origin has to allow reading, which Wikimedia does for every file.
 */
const PICTURE_FETCH: RequestInit = { cache: 'force-cache', credentials: 'omit' };

/**
 * The buttons of the extension on the card, left out of the picture: they
 * are links of this browser, not a part of the card, and would be dead marks
 * once pasted anywhere else. The picture the extension gives a card without
 * one stays, since it is what the card shows.
 */
const LEFT_OUT_SELECTOR = [WIKIPEDIA_BUTTON_SELECTOR, CARD_BUTTON_SELECTOR].join(', ');

function isKept(node: Node): boolean {
  return !(node instanceof Element && node.matches(LEFT_OUT_SELECTOR));
}

export async function snapshotCard(card: HTMLElement): Promise<Blob> {
  const blob = await toBlob(card, {
    pixelRatio: PIXEL_RATIO,
    // Every picture of a card of the site is `/_next/image?url=...`: without
    // the query, the library would take all of them for the first one it read.
    includeQueryParams: true,
    fetchRequestInit: PICTURE_FETCH,
    // Given, so the library never looks for the fonts its own way.
    fontEmbedCSS: await buildFontEmbedCss(card),
    filter: isKept,
  });
  if (blob === null) {
    throw new Error('The card could not be drawn');
  }
  return blob;
}
