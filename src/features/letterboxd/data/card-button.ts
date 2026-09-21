import { findChildWithAttribute } from '../../../core/dom/find-child-with-attribute';
import { findTextArea } from '../../card-detection/data/find-text-area';
import { isLetterboxdUrl } from '../domain/resolve-letterboxd-url';
import { CARD_BUTTON_ATTRIBUTE, CARD_BUTTON_SELECTOR } from './card-button-selectors';

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

const BUTTON_CLASS = 'wme-letterboxd-button';
const MARK_CLASS = 'wme-letterboxd-mark';

/**
 * The mark is drawn here rather than laid out in CSS, because the two white
 * lenses of the real logo are the INTERSECTIONS of its discs, and no stack of
 * boxes gives that shape. An earlier version stacked three spans inside a
 * 16px circle, each 60% of its width: at that size they covered one another
 * almost entirely and only the last one drawn, the blue one, was visible.
 *
 * Everything below is in the coordinates of the viewBox, so the drawing does
 * not care what size the style sheet gives it. Three discs of radius 20 on
 * one line, 30 apart: each neighbouring pair therefore overlaps by 10, a
 * quarter of a diameter.
 */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MARK_TAG = 'svg';
const DISC_TAG = 'circle';
const LENS_TAG = 'path';

const MARK_VIEW_BOX = '0 0 100 40';
const DISC_RADIUS = '20';
const DISC_CENTRE_Y = '20';
const DISCS = [
  { centreX: '20', fill: '#ff8000' },
  { centreX: '50', fill: '#00e054' },
  { centreX: '80', fill: '#40bcf4' },
] as const;

/**
 * One lens as the two arcs that close it: the right side of the disc on the
 * left, then the left side of the disc on the right. Two discs of radius 20
 * whose centres are 30 apart cross at their half way point, 13.229 above and
 * below the line (the square root of 20 squared minus 15 squared), which is
 * where 6.771 and 33.229 come from.
 */
const LENS_PATHS = [
  'M35,6.771A20,20 0 0 1 35,33.229A20,20 0 0 1 35,6.771Z',
  'M65,6.771A20,20 0 0 1 65,33.229A20,20 0 0 1 65,6.771Z',
] as const;
const LENS_FILL = '#ffffff';

const VIEW_BOX_ATTRIBUTE = 'viewBox';
const FILL_ATTRIBUTE = 'fill';
const ARIA_HIDDEN_ATTRIBUTE = 'aria-hidden';
const FOCUSABLE_ATTRIBUTE = 'focusable';
const TRUE = 'true';
const FALSE = 'false';

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

function ariaLabel(title: string): string {
  return `Voir ${title} sur Letterboxd`;
}

/**
 * The three discs, then the two lenses their overlaps cut out, on top. Order
 * is the whole drawing: each disc paints over the one before it, and the
 * lenses paint over all three. The anchor already carries the label, so the
 * drawing is hidden from assistive technology and kept out of the tab order,
 * which SVG in Internet-Explorer-era browsers is not by default.
 */
function buildMark(document: Document): SVGElement {
  const mark = document.createElementNS(SVG_NAMESPACE, MARK_TAG);
  mark.setAttribute('class', MARK_CLASS);
  mark.setAttribute(VIEW_BOX_ATTRIBUTE, MARK_VIEW_BOX);
  mark.setAttribute(ARIA_HIDDEN_ATTRIBUTE, TRUE);
  mark.setAttribute(FOCUSABLE_ATTRIBUTE, FALSE);

  for (const disc of DISCS) {
    const circle = document.createElementNS(SVG_NAMESPACE, DISC_TAG);
    circle.setAttribute('cx', disc.centreX);
    circle.setAttribute('cy', DISC_CENTRE_Y);
    circle.setAttribute('r', DISC_RADIUS);
    circle.setAttribute(FILL_ATTRIBUTE, disc.fill);
    mark.appendChild(circle);
  }
  for (const lens of LENS_PATHS) {
    const path = document.createElementNS(SVG_NAMESPACE, LENS_TAG);
    path.setAttribute('d', lens);
    path.setAttribute(FILL_ATTRIBUTE, LENS_FILL);
    mark.appendChild(path);
  }
  return mark;
}

function speak(button: HTMLAnchorElement, title: string, voice: ButtonVoice): void {
  if (voice === 'named') {
    button.setAttribute(ARIA_LABEL_ATTRIBUTE, ariaLabel(title));
    return;
  }
  button.setAttribute(ARIA_HIDDEN_ATTRIBUTE, TRUE);
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
  button.setAttribute(CARD_BUTTON_ATTRIBUTE, '');
  button.href = url;
  button.target = LINK_TARGET;
  button.rel = LINK_REL;
  speak(button, title, voice);

  button.appendChild(buildMark(document));

  button.addEventListener('click', (event) => {
    // Guards against a script dispatching a synthetic click on our own node:
    // only a click the user actually made may act on the page.
    if (!event.isTrusted) {
      return;
    }
    /*
     * The single deliberate exception to "the site owns its own events".
     * Every other node the extension adds stays `pointer-events: none`. This
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
 *
 * This choice of positioning context is worth naming rather than assuming:
 * verified on all six fixtures committed for this feature, the text area
 * carries `bottom-0 left-0 right-0`, so its padding box shares its bottom
 * edge and its width with the card root's, which is itself `position:
 * relative`. `bottom: 3px; right: 5px` in letterboxd.css therefore designates
 * the very same pixel whether it ends up read against the text area or
 * against the root, which is why the button would still land correctly even
 * if the text area ever lost `position: absolute`. That property would
 * disappear if the site moved the text area to something like `bottom-[8px]`
 * instead, which is exactly why it is called out here.
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
    // Unreachable today: the scanner never puts a card into `cards` unless it
    // holds an `h3`, and findTextArea needs that very heading to find an area
    // at all, so a card that reaches this point always has one. Kept anyway,
    // and aligned on the model of missing-image/data/card-image.ts, which
    // also removes through a branch like this one: if the site ever changed
    // shape so a card lost its text area while still carrying a stale
    // button, this takes it back instead of leaving it on screen forever.
    removeOurButton(cardRoot);
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
  textArea.appendChild(buildButton(cardRoot.ownerDocument, title, safeUrl, 'named'));
  rootsWithButton.add(cardRoot);
}

/**
 * The same button for a card the extension draws itself, silent for a screen
 * reader and out of the tab order, or null when `url` is not an address of
 * Letterboxd. Checked here, whatever the caller believes it holds: a value
 * that crossed a message boundary is untrusted, and this is the last step
 * before an `href`.
 */
export function silentCardButton(
  document: Document,
  title: string,
  url: string | null,
): HTMLAnchorElement | null {
  return isLetterboxdUrl(url) ? buildButton(document, title, url, 'silent') : null;
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
