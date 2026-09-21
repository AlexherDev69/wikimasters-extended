import { findChildWithAttribute } from '../../../core/dom/find-child-with-attribute';
import { findTextArea } from '../../card-detection/data/find-text-area';
import { frwikiArticleUrl, isFrwikiArticleUrl } from '../domain/article-url';
import {
  WIKIPEDIA_BUTTON_ATTRIBUTE,
  WIKIPEDIA_BUTTON_SELECTOR,
} from './wikipedia-button-selectors';

/**
 * The button that opens the article of a card, in the bottom right corner of
 * the card itself. Until now the article was one modal away, while the title
 * the card shows IS the title of that article.
 *
 * An anchor, never a `div`, for the same reasons as the Letterboxd button of
 * data/card-button.ts: keyboard activation, middle click, the context menu
 * and the status bar preview all come for free, and an anchor is neither an
 * `h3` nor a `p`, so the scanner can never read it as a card nor let it
 * change what a real card reads as.
 */

const BUTTON_TAG = 'a';

const BUTTON_CLASS = 'wme-wikipedia-button';
const MARK_CLASS = 'wme-wikipedia-mark';

/**
 * The mark is the W of the encyclopaedia, set in a serif face by the style
 * sheet, and not its globe: the globe is a sphere of lettered puzzle pieces
 * that no handful of paths draws honestly, and a rough one would read as a
 * generic web icon rather than as Wikipedia. A single letter states the same
 * thing at the size this mark is drawn at, which is twelve pixels.
 */
const MARK_TAG = 'span';
const MARK_TEXT = 'W';

const LINK_TARGET = '_blank';

/** No opener and no referrer, as the site does on its own outgoing links. */
const LINK_REL = 'noopener noreferrer';

/**
 * How the button reads for assistive technology and for the keyboard.
 *
 * `named` is the button of a card OF THE SITE: it carries the label of its
 * destination and takes a focus stop, like any other link of the page.
 *
 * `silent` is the button of a card the extension draws ITSELF, on the page of
 * the trades, inside a button of the site. That button takes its name from
 * the text it holds, so a labelled link of ours would be read out in the
 * middle of it, and its focus stop would be added to the ones the site laid
 * out. The mark is therefore hidden from assistive technology and kept out of
 * the tab order: the mouse reaches it, the control of the site keeps exactly
 * the name and the stops the site gave it, and a reader who never uses a
 * mouse loses nothing, the same article being one click away in the detail
 * the control opens.
 */
type ButtonVoice = 'named' | 'silent';

const NOT_IN_TAB_ORDER = -1;

const HREF_ATTRIBUTE = 'href';
const ARIA_LABEL_ATTRIBUTE = 'aria-label';
const ARIA_HIDDEN_ATTRIBUTE = 'aria-hidden';
const CLICK_EVENT = 'click';

function ariaLabel(title: string): string {
  return `Lire l'article ${title} sur Wikipédia`;
}

function buildMark(document: Document): HTMLElement {
  const mark = document.createElement(MARK_TAG);

  mark.className = MARK_CLASS;
  // The anchor already carries the whole label: the letter would only be
  // read out a second time, as a letter.
  mark.setAttribute(ARIA_HIDDEN_ATTRIBUTE, 'true');
  mark.textContent = MARK_TEXT;

  return mark;
}

function speak(button: HTMLAnchorElement, title: string, voice: ButtonVoice): void {
  if (voice === 'named') {
    button.setAttribute(ARIA_LABEL_ATTRIBUTE, ariaLabel(title));
    return;
  }
  button.setAttribute(ARIA_HIDDEN_ATTRIBUTE, 'true');
  button.tabIndex = NOT_IN_TAB_ORDER;
}

function buildButton(
  document: Document,
  title: string,
  url: string,
  voice: ButtonVoice,
): HTMLAnchorElement {
  const button = document.createElement(BUTTON_TAG);

  button.className = BUTTON_CLASS;
  button.setAttribute(WIKIPEDIA_BUTTON_ATTRIBUTE, '');
  button.href = url;
  button.target = LINK_TARGET;
  button.rel = LINK_REL;
  speak(button, title, voice);

  button.appendChild(buildMark(document));

  button.addEventListener(CLICK_EVENT, (event) => {
    // Guards against a script dispatching a synthetic click on our own node:
    // only a click the user actually made may act on the page.
    if (!event.isTrusted) {
      return;
    }
    // The second node of the extension that takes a click on a card, and for
    // the very reason the first one does: the whole card opens the detail
    // modal on a click anywhere on it, so a click aimed at the article would
    // open that modal behind it as well. Nothing of the site is removed,
    // replaced or disabled by stopping it here, and `preventDefault` is never
    // called, so the anchor keeps its native navigation. See
    // letterboxd/data/card-button.ts for the whole reasoning.
    event.stopPropagation();
  });

  return button;
}

/** True while the button already points at `url`. The address is the whole state. */
function showsButton(existing: Element, url: string): boolean {
  return existing.getAttribute(HREF_ATTRIBUTE) === url;
}

/**
 * Shows the Wikipedia button of one card, and writes NOTHING when it already
 * shows it. The content script observes document.body, so every write of ours
 * schedules another scan, which syncs again: a sync that always wrote would
 * never stop.
 *
 * The button is appended as the last child of the text area of the card, in
 * the same corner and for the same reason as the Letterboxd button: the text
 * area is already a positioning context, so nothing of the site would have to
 * be restyled for our node to stand in it. The only node touched is ours: the
 * card itself is read, never modified.
 */
export function applyWikipediaButton(cardRoot: HTMLElement, title: string): void {
  // Last check before the DOM, whatever the caller believes it holds: this is
  // the last step before an `href`.
  const url = frwikiArticleUrl(title);
  const safeUrl = isFrwikiArticleUrl(url) ? url : null;
  const textArea = findTextArea(cardRoot);

  if (textArea === null) {
    return;
  }
  // The button is a child of the text area, so only its children are looked
  // at: this runs for every card on screen, on every scan.
  const existing = findChildWithAttribute(textArea, WIKIPEDIA_BUTTON_ATTRIBUTE);

  if (safeUrl === null) {
    // A card whose title cannot be read any more, which is what a node the
    // site is in the middle of reusing looks like: its button goes rather
    // than pointing at the article of the card it showed before.
    existing?.remove();
    return;
  }
  if (existing !== null && showsButton(existing, safeUrl)) {
    return;
  }
  // Another card in a node the site reused: the button is built again rather
  // than patched, exactly as the Letterboxd one is.
  existing?.remove();
  textArea.appendChild(buildButton(cardRoot.ownerDocument, title, safeUrl, 'named'));
}

/**
 * The same button for a card the extension draws itself, silent for a screen
 * reader and out of the tab order, or null when no address of the article
 * space of frwiki can be built from `title`.
 *
 * The address is built here rather than taken from the caller: it is a
 * function of the title alone, and this is the last step before an `href`.
 */
export function silentWikipediaButton(document: Document, title: string): HTMLAnchorElement | null {
  const url = frwikiArticleUrl(title);

  return isFrwikiArticleUrl(url) ? buildButton(document, title, url, 'silent') : null;
}

/**
 * Takes back every button under `root`. Called when the setting is switched
 * off and when the content script context is invalidated, so reloading the
 * extension does not leave a button behind that nothing keeps in line with
 * the cards on screen any more.
 */
export function removeWikipediaButtons(root: ParentNode): void {
  for (const button of root.querySelectorAll(WIKIPEDIA_BUTTON_SELECTOR)) {
    button.remove();
  }
}
