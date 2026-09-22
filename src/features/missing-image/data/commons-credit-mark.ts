import { isCommonsFileName } from '../domain/card-image';
import { commonsFilePageUrl } from '../domain/commons-url';
import { IMAGE_CREDIT_MARK_ATTRIBUTE } from './image-selectors';

/**
 * The credit of a picture drawn on a card the extension builds ITSELF, on the
 * page of the trades.
 *
 * On a card of the site the same picture carries a plain `C` saying where it
 * comes from, and its author and its licence are one click away, in the
 * credit line of the detail modal that card opens. A card of a trade offer
 * opens nothing of the sort: it stands inside a button that opens the detail
 * of the OFFER, so that line is out of reach and the attribution the free
 * licences of Commons ask for led nowhere. The very same mark is therefore an
 * anchor here, on the file page, which is where the author and the licence
 * are named.
 *
 * An anchor and never a `div`, for the reasons the two other marks of a drawn
 * card are ones: keyboard activation, middle click, the context menu and the
 * status bar preview all come for free, and an anchor is neither an `h3` nor
 * a `p`, so the card scanner can never read it as a card.
 */

const MARK_TAG = 'a';

const MARK_CLASS = 'wme-credit-mark';

/**
 * What the mark reads: the initial of Commons, exactly as the mark of a card
 * of the site spells it, so one letter means one thing across the extension.
 *
 * Drawn as a FILLED disc and never as a letter in a thin ring: a ringed C is
 * the copyright glyph, and these files are under a free licence, so that
 * shape would say the opposite of the truth.
 */
const MARK_TEXT = 'C';

/**
 * What a hover names. The anchor is kept out of the accessibility tree, see
 * below, so the tooltip is what spells out a destination the letter alone
 * cannot.
 */
const MARK_TITLE = 'Image de Wikimedia Commons : auteur et licence';

const LINK_TARGET = '_blank';

/** No opener and no referrer, as the site does on its own outgoing links. */
const LINK_REL = 'noopener noreferrer';

const NOT_IN_TAB_ORDER = -1;

const ARIA_HIDDEN_ATTRIBUTE = 'aria-hidden';
const TITLE_ATTRIBUTE = 'title';
const CLICK_EVENT = 'click';

/**
 * The mark of one picture, or null when the name could never reach an
 * address. Checked here whatever the caller believes it holds: the name comes
 * from Wikidata and this is the last step before an `href`.
 *
 * Hidden from assistive technology and kept out of the tab order, like the
 * two other marks of a drawn card and for a reason that is stronger here: our
 * card stands inside a button of the site, and that button takes its name
 * from the text it holds. A labelled link of ours would not merely be read
 * out in the middle of that name, it would become PART of it.
 */
export function commonsCreditMark(document: Document, fileName: string): HTMLAnchorElement | null {
  if (!isCommonsFileName(fileName)) {
    return null;
  }
  const mark = document.createElement(MARK_TAG);

  mark.className = MARK_CLASS;
  mark.setAttribute(IMAGE_CREDIT_MARK_ATTRIBUTE, '');
  mark.href = commonsFilePageUrl(fileName);
  mark.target = LINK_TARGET;
  mark.rel = LINK_REL;
  mark.setAttribute(TITLE_ATTRIBUTE, MARK_TITLE);
  mark.setAttribute(ARIA_HIDDEN_ATTRIBUTE, 'true');
  mark.tabIndex = NOT_IN_TAB_ORDER;
  mark.textContent = MARK_TEXT;

  mark.addEventListener(CLICK_EVENT, (event) => {
    // Guards against a script dispatching a synthetic click on our own node:
    // only a click the user actually made may act on the page.
    if (!event.isTrusted) {
      return;
    }
    // The third node of the extension that takes a click on a card, and for
    // the very reason the first two do: the whole offer is one button of the
    // site, so a click aimed at the file page would open the detail of the
    // offer behind it. Nothing of the site is removed, replaced or disabled
    // by stopping it here, and `preventDefault` is never called, so the
    // anchor keeps its native navigation. See
    // letterboxd/data/card-button.ts for the whole reasoning.
    event.stopPropagation();
  });

  return mark;
}
