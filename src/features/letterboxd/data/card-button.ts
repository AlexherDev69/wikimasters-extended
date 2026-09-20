import { findChildWithAttribute } from '../../../core/dom/find-child-with-attribute';
import { isLetterboxdUrl } from '../domain/resolve-letterboxd-url';
import { CARD_BUTTON_ATTRIBUTE, CARD_BUTTON_SELECTOR } from './card-button-selectors';
import { findTextArea } from './find-text-area';

/**
 * The button is an anchor, never a `div`: it gives keyboard activation,
 * middle click, the context menu and the status bar preview for free, none of
 * which a click handler on a `div` would offer. Adding an `a` inside a card
 * root is new for the extension, and it is safe: the scanner looks for a
 * card root holding an `h3` and reads a title in the first `h3` and a
 * description in the first `p` it finds, and an anchor is neither, so it can
 * never be read as a card nor change what one reads from a real card.
 */
const BUTTON_TAG = 'a';
const DOT_TAG = 'span';

const BUTTON_CLASS = 'wme-letterboxd-button';
const DOT_CLASS = 'wme-letterboxd-dot';
/** One class per disc of the mark, styled in letterboxd.css. */
const DOT_MODIFIER_CLASSES = ['wme-letterboxd-dot-1', 'wme-letterboxd-dot-2', 'wme-letterboxd-dot-3'];

const LINK_TARGET = '_blank';
/** No opener and no referrer, as the site does on its own outgoing links. */
const LINK_REL = 'noopener noreferrer';

const HREF_ATTRIBUTE = 'href';
const ARIA_LABEL_ATTRIBUTE = 'aria-label';

function ariaLabel(title: string): string {
  return `Voir ${title} sur Letterboxd`;
}

function buildButton(document: Document, title: string, url: string): HTMLAnchorElement {
  const button = document.createElement(BUTTON_TAG);
  button.className = BUTTON_CLASS;
  button.setAttribute(CARD_BUTTON_ATTRIBUTE, '');
  button.href = url;
  button.target = LINK_TARGET;
  button.rel = LINK_REL;
  button.setAttribute(ARIA_LABEL_ATTRIBUTE, ariaLabel(title));

  for (const modifierClass of DOT_MODIFIER_CLASSES) {
    const dot = document.createElement(DOT_TAG);
    dot.className = `${DOT_CLASS} ${modifierClass}`;
    button.appendChild(dot);
  }

  button.addEventListener('click', (event) => {
    // Guards against a script dispatching a synthetic click on our own node:
    // only a click the user actually made may act on the page.
    if (!event.isTrusted) {
      return;
    }
    /*
     * The single deliberate exception to "the site owns its own events".
     * Every other node the extension adds stays `pointer-events: none`, and
     * the one other place that listens for a click of its own, the category
     * panel, lets it bubble because nothing of the site sits above it. This
     * button sits INSIDE a card, and the whole card opens the detail modal on
     * a click anywhere on it: without stopping this one, a click aimed at
     * Letterboxd would also open the modal behind it, which the user never
     * asked for. Stopping it here changes nothing of the site: no listener of
     * the site is removed, replaced or disabled, and the event still runs its
     * own course on this very node. `preventDefault` is never called, so the
     * anchor keeps its native navigation.
     */
    event.stopPropagation();
  });

  return button;
}

/** True while the button already points at `url`. The address is the only comparison key. */
function showsButton(existing: Element, url: string): boolean {
  return existing.getAttribute(HREF_ATTRIBUTE) === url;
}

/**
 * Roots that carry one of our buttons. Most cards have no Letterboxd address
 * at all, so a card without one never pays the query that finds its text
 * area: without this set, checking whether such a card still carried a stale
 * button from an address it has since lost would cost that query anyway, on
 * every one of them, on every scan.
 */
const rootsWithButton = new WeakSet<HTMLElement>();

function removeOurButton(cardRoot: HTMLElement): void {
  if (!rootsWithButton.has(cardRoot)) {
    return;
  }
  cardRoot.querySelector(CARD_BUTTON_SELECTOR)?.remove();
  rootsWithButton.delete(cardRoot);
}

/**
 * Shows the Letterboxd button of one card, and writes NOTHING when it already
 * shows it. The content script observes document.body, so every write of ours
 * schedules another scan, which syncs again: a sync that always wrote would
 * never stop.
 *
 * The button is appended as the last child of the text area of the card, so
 * it is positioned against it rather than against the card root: only the
 * text area, never the button, would have to be restyled to become a
 * positioning context, and it already is one, `position: absolute` by its own
 * classes. The only node touched is ours: the card itself is read, never
 * modified.
 */
export function applyCardButton(cardRoot: HTMLElement, title: string, url: string | null): void {
  // Last check before the DOM, whatever the caller believes it holds: a value
  // that crossed a message boundary is untrusted, and this is the last step
  // before an `href`.
  const safeUrl = isLetterboxdUrl(url) ? url : null;

  if (safeUrl === null) {
    removeOurButton(cardRoot);
    return;
  }

  const textArea = findTextArea(cardRoot);
  if (textArea === null) {
    return;
  }

  // The button is a child of the text area, so only its children are looked
  // at: this runs for every card carrying an address, on every scan.
  const existing = findChildWithAttribute(textArea, CARD_BUTTON_ATTRIBUTE);
  if (existing !== null && showsButton(existing, safeUrl)) {
    return;
  }
  // Another card in a node the site reused, or an address that changed: the
  // button is built again rather than patched, as the image container is.
  existing?.remove();
  textArea.appendChild(buildButton(cardRoot.ownerDocument, title, safeUrl));
  rootsWithButton.add(cardRoot);
}

/**
 * Takes back every button under `root`. Called when the setting is switched
 * off and when the content script context is invalidated, so reloading the
 * extension does not leave a button behind that nothing keeps in line with
 * the cards on screen any more.
 */
export function removeCardButtons(root: ParentNode): void {
  for (const button of root.querySelectorAll(CARD_BUTTON_SELECTOR)) {
    button.remove();
  }
}
