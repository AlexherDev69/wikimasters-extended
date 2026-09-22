import type { DetectedCard } from '../../card-detection/domain/detected-card';
import { silentCardButton } from '../../letterboxd/data/card-button';
import { commonsCreditMark } from '../../missing-image/data/commons-credit-mark';
import { isCommonsFileName, type CardImage } from '../../../core/mediawiki/card-image';
import { thumbnailAddress } from '../../missing-image/domain/thumbnail-address';
import { silentWikipediaButton } from '../../wikipedia-link/data/wikipedia-button';
import type { ObservedTradeCard } from './scan-trade-chips';
import {
  TRADE_FAILED_ATTRIBUTE,
  TRADE_KIND_ATTRIBUTE,
  TRADE_PREVIEW_ATTRIBUTE,
  TRADE_PREVIEW_KEY_ATTRIBUTE,
  TRADE_PREVIEW_SELECTOR,
  TRADE_RARITY_ATTRIBUTE,
} from './trade-selectors';

/**
 * The preview is built from `div`, `span` and `img` only, like every other
 * node this extension adds inside the site: no heading and no paragraph, the
 * two tags the card scanner reads a card's title and description from.
 */
const PREVIEW_TAG = 'div';
const PART_TAG = 'span';
const MEDIA_TAG = 'img';

const PREVIEW_CLASS = 'wme-trade-card';
const ART_CLASS = 'wme-trade-art';
const MEDIA_CLASS = 'wme-trade-media';
const RARITY_CLASS = 'wme-trade-rarity';
const TITLE_CLASS = 'wme-trade-title';

/** The picture is decorative: the preview carries the title right below it. */
const MEDIA_ALT = '';
const LAZY_LOADING = 'lazy';
const ASYNC_DECODING = 'async';
/** Wikimedia is asked for a file, never told which page is showing it. */
const NO_REFERRER = 'no-referrer';

const DRAGGABLE_ATTRIBUTE = 'draggable';
const NOT_DRAGGABLE = 'false';

const ERROR_EVENT = 'error';

const KEY_SEPARATOR = '|';

/** What the key writes for the button of the article, when the card carries it. */
const ARTICLE_MARK = 'w';

/**
 * The two marks the extension draws on a card of a trade offer, decided by
 * the sync: each has a switch of its own, and the Letterboxd one has an
 * address only for the cards Wikidata gives one.
 */
export interface TradeCardMarks {
  /** The button of the article, which every card can carry. */
  article: boolean;
  /** The address of the card on Letterboxd, or null. */
  letterboxdUrl: string | null;
}

/**
 * Everything the preview shows, in one string. A sync compares it against the
 * key the preview already carries and writes nothing when they match, which
 * the observer of the content script makes a requirement: every write of ours
 * schedules another scan, and a sync that always wrote would never stop.
 */
function previewKey(card: DetectedCard, image: CardImage | null, marks: TradeCardMarks): string {
  return [
    card.rarity,
    card.title,
    image?.fileName ?? '',
    image?.kind ?? '',
    marks.article ? ARTICLE_MARK : '',
    marks.letterboxdUrl ?? '',
  ].join(KEY_SEPARATOR);
}

/**
 * The marks of the extension, in the bottom right corner of the picture: the
 * very buttons the cards of the site carry, in the very place they carry
 * them, so a card met in a trade offer opens the same two pages as the same
 * card met in the collection.
 *
 * Silent ones: this card of ours stands inside a button of the site, which
 * takes its name from the text it holds and lays out its own focus stops.
 * See letterboxd/data/card-button.ts for what that costs and what it saves.
 */
function appendMarks(art: HTMLElement, title: string, marks: TradeCardMarks): void {
  const document = art.ownerDocument;
  const article = marks.article ? silentWikipediaButton(document, title) : null;

  for (const mark of [article, silentCardButton(document, title, marks.letterboxdUrl)]) {
    if (mark !== null) {
      art.appendChild(mark);
    }
  }
}

/**
 * The credit of the picture, in the one corner nothing else claims. A
 * card of the site names the author and the licence of its picture in the
 * detail modal it opens; this card opens the detail of the OFFER, so the mark
 * itself is the only way to them, and the licences of Commons ask for a way.
 */
function appendCredit(art: HTMLElement, image: CardImage): void {
  const credit = commonsCreditMark(art.ownerDocument, image.fileName);

  if (credit !== null) {
    art.appendChild(credit);
  }
}

function buildPreview(
  document: Document,
  card: DetectedCard,
  image: CardImage | null,
  marks: TradeCardMarks,
  key: string,
): HTMLElement {
  const preview = document.createElement(PREVIEW_TAG);
  preview.className = PREVIEW_CLASS;
  preview.setAttribute(TRADE_PREVIEW_ATTRIBUTE, '');
  preview.setAttribute(TRADE_PREVIEW_KEY_ATTRIBUTE, key);
  preview.setAttribute(TRADE_RARITY_ATTRIBUTE, card.rarity);

  const art = document.createElement(PREVIEW_TAG);
  art.className = ART_CLASS;

  if (image !== null) {
    preview.setAttribute(TRADE_KIND_ATTRIBUTE, image.kind);
    art.appendChild(buildMedia(document, preview, image));
    appendCredit(art, image);
  }

  // The rarity, spelled as the site spells it on its own cards: the codes are
  // the very letters of `glow-<rarity>`, so upper casing one is the whole
  // rule, and no table can fall out of step with the rarities themselves.
  const rarity = document.createElement(PART_TAG);
  rarity.className = RARITY_CLASS;
  rarity.textContent = card.rarity.toUpperCase();
  art.appendChild(rarity);

  appendMarks(art, card.title, marks);

  const title = document.createElement(PART_TAG);
  title.className = TITLE_CLASS;
  // The whole title, never cut: a name the reader has to click to finish is
  // exactly what this feature exists to remove.
  title.textContent = card.title;

  preview.appendChild(art);
  preview.appendChild(title);
  return preview;
}

function buildMedia(document: Document, preview: HTMLElement, image: CardImage): HTMLImageElement {
  const media = document.createElement(MEDIA_TAG);
  media.className = MEDIA_CLASS;
  media.alt = MEDIA_ALT;
  media.loading = LAZY_LOADING;
  media.decoding = ASYNC_DECODING;
  media.referrerPolicy = NO_REFERRER;
  media.setAttribute(DRAGGABLE_ATTRIBUTE, NOT_DRAGGABLE);
  // No `crossorigin`: the Commons address answers with redirects that carry no
  // CORS header, and a cross origin request would simply fail.

  // Added BEFORE the source, because a source the browser already knows to be
  // broken fires its `error` as soon as it is set. The mark is read by the
  // style sheet alone, which then leaves the flat ground of the rarity: a
  // broken picture glyph would say less than the colour it replaced.
  media.addEventListener(ERROR_EVENT, () => {
    preview.setAttribute(TRADE_FAILED_ATTRIBUTE, '');
  });
  media.src = thumbnailAddress(image);

  return media;
}

/** The preview a previous sync left right before this chip, if it is still there. */
function previewBefore(chip: HTMLElement): Element | null {
  const previous = chip.previousElementSibling;

  return previous !== null && previous.hasAttribute(TRADE_PREVIEW_ATTRIBUTE) ? previous : null;
}

/**
 * Draws one card of a trade offer right before the chip that names it, and
 * writes NOTHING when the preview already shows exactly that card with
 * exactly that picture.
 *
 * The chip itself is never touched: it is left in the document as the site
 * built it, and the style sheet is what hides it, through a rule that matches
 * a chip only while one of our previews stands immediately before it. A card
 * we cannot draw therefore keeps showing the name the site gave it.
 *
 * Returns the preview now standing before the chip, so the sync knows which
 * of its own nodes are current, or null when the chip has left the document
 * between the scan and this call.
 */
export function applyTradePreview(
  observed: ObservedTradeCard,
  image: CardImage | null,
  marks: TradeCardMarks,
): Element | null {
  const { chip, card } = observed;
  const parent = chip.parentElement;
  if (parent === null) {
    return null;
  }
  // Last check before the DOM, whatever the caller believes it holds: the file
  // name reaches a URL, so an unusable one draws the flat ground instead.
  const safeImage = image !== null && isCommonsFileName(image.fileName) ? image : null;
  const key = previewKey(card, safeImage, marks);
  const existing = previewBefore(chip);

  if (existing !== null && existing.getAttribute(TRADE_PREVIEW_KEY_ATTRIBUTE) === key) {
    return existing;
  }
  // Built again rather than patched, so the picture, its failure mark, the
  // title and the two marks can never disagree about which card is shown.
  const preview = buildPreview(chip.ownerDocument, card, safeImage, marks, key);
  if (existing === null) {
    parent.insertBefore(preview, chip);
  } else {
    parent.replaceChild(preview, existing);
  }
  return preview;
}

/**
 * Takes back every preview under `root` that is not in `kept`. Called at the
 * end of every sync with the previews it has just confirmed: the site rebuilds
 * a trade row whenever its tab changes, and a preview whose chip went with it
 * would otherwise stand alone, naming a card the page no longer offers.
 */
export function removeStaleTradePreviews(root: ParentNode, kept: ReadonlySet<Element>): void {
  for (const preview of root.querySelectorAll(TRADE_PREVIEW_SELECTOR)) {
    if (!kept.has(preview)) {
      preview.remove();
    }
  }
}

/**
 * Takes back every preview under `root`. Called when the setting is switched
 * off and when the content script context is invalidated, so reloading the
 * extension does not leave a card behind that nothing keeps in line with the
 * offers on screen any more.
 */
export function removeTradePreviews(root: ParentNode): void {
  for (const preview of root.querySelectorAll(TRADE_PREVIEW_SELECTOR)) {
    preview.remove();
  }
}
