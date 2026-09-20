import { findChildWithAttribute } from '../../../core/dom/find-child-with-attribute';
import { isCommonsFileName, type CardImage } from '../domain/card-image';
import { commonsThumbnailUrl } from '../domain/commons-url';
import { findPictureArea } from './find-placeholder';
import {
  CARD_IMAGE_ATTRIBUTE,
  CARD_IMAGE_SELECTOR,
  IMAGE_FILE_ATTRIBUTE,
  IMAGE_KIND_ATTRIBUTE,
  IMAGE_LOADED_ATTRIBUTE,
  IMAGE_SOURCE_MARK_ATTRIBUTE,
} from './image-selectors';

/**
 * Our container is a bare `div` holding an `img` and a `span`: the scanner
 * reads the title of a card in its first `h3` and its description in its first
 * `p`, and a card without description has no `p` at all, so neither tag may
 * appear inside a card root.
 */
const CONTAINER_TAG = 'div';
const IMAGE_TAG = 'img';
const MARK_TAG = 'span';

const CONTAINER_CLASS = 'wme-card-image';
const IMAGE_CLASS = 'wme-card-image-media';
const MARK_CLASS = 'wme-card-image-source';

/**
 * What the mark reads. It names the source of the picture, so it doubles as
 * the shortest attribution there is, and it tells at a glance that the picture
 * was added by the extension rather than served by the site.
 */
const IMAGE_SOURCE_LABEL = 'Commons';

/** The image is decorative: the card already carries its title as text. */
const IMAGE_ALT = '';
const LAZY_LOADING = 'lazy';
const ASYNC_DECODING = 'async';
/** Wikimedia is asked for a file, never told which page is showing it. */
const NO_REFERRER = 'no-referrer';

/**
 * Dragging our image would hand the site a drag it never expects on a card.
 * Written as an attribute, because the property of the same name is not
 * reflected by every DOM implementation this code runs on.
 */
const DRAGGABLE_ATTRIBUTE = 'draggable';
const NOT_DRAGGABLE = 'false';

const LOAD_EVENT = 'load';

/**
 * The card roots one of our containers was appended in. Three cards out of
 * four carry a picture of their own and have no placeholder at all: without
 * this set, each of them would pay a full subtree query on every scan, looking
 * for a container that was never added. A card left in `rootsWithContainer` by
 * `removeCardImages` costs one query the next time that card is synced, and is
 * dropped from the set right there.
 */
const rootsWithContainer = new WeakSet<HTMLElement>();

function buildContainer(document: Document, image: CardImage, url: string): HTMLElement {
  const container = document.createElement(CONTAINER_TAG);
  container.className = CONTAINER_CLASS;
  container.setAttribute(CARD_IMAGE_ATTRIBUTE, '');
  container.setAttribute(IMAGE_FILE_ATTRIBUTE, image.fileName);
  container.setAttribute(IMAGE_KIND_ATTRIBUTE, image.kind);

  const picture = document.createElement(IMAGE_TAG);
  picture.className = IMAGE_CLASS;
  picture.alt = IMAGE_ALT;
  picture.loading = LAZY_LOADING;
  picture.decoding = ASYNC_DECODING;
  picture.referrerPolicy = NO_REFERRER;
  picture.setAttribute(DRAGGABLE_ATTRIBUTE, NOT_DRAGGABLE);
  // No `crossorigin`: the Commons address answers with redirects that carry no
  // CORS header, and a cross origin request would simply fail.

  // The listener is added BEFORE the source, because an image the browser
  // already holds fires its `load` as soon as the source is set.
  //
  // There is no `error` listener: the container is invisible until this one
  // marks it, so a file that never arrives leaves the placeholder of the site
  // in view and there is nothing to undo. An empty listener would be dead code.
  picture.addEventListener(LOAD_EVENT, () => {
    container.setAttribute(IMAGE_LOADED_ATTRIBUTE, '');
  });
  picture.src = url;

  // The mark naming the source. It lives and dies with the container, so it
  // can never name the source of a picture that is not there any more, and the
  // style sheet keeps it hidden until the container is marked as loaded: a
  // mark over the logo of the site would name a source it does not come from.
  const mark = document.createElement(MARK_TAG);
  mark.className = MARK_CLASS;
  mark.setAttribute(IMAGE_SOURCE_MARK_ATTRIBUTE, '');
  mark.textContent = IMAGE_SOURCE_LABEL;

  container.appendChild(picture);
  container.appendChild(mark);
  return container;
}

/**
 * True while the container already shows exactly this image. Its `img` and its
 * mark are read back as well, the way the credit line reads its link back: a
 * container that lost either one would otherwise stay half drawn for as long
 * as the site keeps that card on screen.
 */
function showsImage(container: Element, image: CardImage): boolean {
  return (
    container.getAttribute(IMAGE_FILE_ATTRIBUTE) === image.fileName &&
    container.getAttribute(IMAGE_KIND_ATTRIBUTE) === image.kind &&
    container.querySelector(`${IMAGE_TAG}.${IMAGE_CLASS}`) !== null &&
    // The mark is the last child of the container, so this helper answers on
    // its first step: this runs for every card of the page on every scan.
    findChildWithAttribute(container, IMAGE_SOURCE_MARK_ATTRIBUTE) !== null
  );
}

/**
 * Takes our container back. The picture area is where it lives, but the site
 * may have replaced the placeholder with a real picture since it was added, in
 * which case there is no picture area any more and the card itself is
 * searched, which only a card known to hold a container of ours ever pays for.
 */
function removeOurContainer(cardRoot: HTMLElement, pictureArea: HTMLElement | null): void {
  if (pictureArea !== null) {
    findChildWithAttribute(pictureArea, CARD_IMAGE_ATTRIBUTE)?.remove();
    rootsWithContainer.delete(cardRoot);
    return;
  }
  if (!rootsWithContainer.has(cardRoot)) {
    return;
  }
  cardRoot.querySelector(CARD_IMAGE_SELECTOR)?.remove();
  rootsWithContainer.delete(cardRoot);
}

/**
 * Shows `image` over the placeholder of one card, and writes NOTHING when the
 * card already shows it. The content script observes document.body, so every
 * write of ours schedules another scan, which syncs again: a sync that always
 * wrote would never stop.
 *
 * The container is appended as the last child of the image area of the site,
 * so it follows that area whatever height the site gives it. The only node
 * touched is ours: the card itself is read, never modified.
 */
export function applyCardImage(cardRoot: HTMLElement, image: CardImage | null): void {
  const pictureArea = findPictureArea(cardRoot);
  // Last check before the DOM, whatever the caller believes it holds: the file
  // name reaches a URL, so an invalid one shows nothing rather than throwing.
  const safeImage = image !== null && isCommonsFileName(image.fileName) ? image : null;

  if (pictureArea === null || safeImage === null) {
    removeOurContainer(cardRoot, pictureArea);
    return;
  }

  // The container is a child of the image area, so only its children are
  // looked at: this runs for every card of the page on every scan.
  const existing = findChildWithAttribute(pictureArea, CARD_IMAGE_ATTRIBUTE);
  if (existing !== null && showsImage(existing, safeImage)) {
    return;
  }
  // Another card in a node the site reused: the container is built again
  // rather than patched, so the source and the loaded mark can never disagree.
  existing?.remove();
  pictureArea.appendChild(
    buildContainer(cardRoot.ownerDocument, safeImage, commonsThumbnailUrl(safeImage.fileName)),
  );
  rootsWithContainer.add(cardRoot);
}

/**
 * Takes back every container under `root`. Called when the setting is switched
 * off and when the content script context is invalidated, so reloading the
 * extension does not leave an image behind that nothing keeps in line with the
 * cards on screen any more.
 */
export function removeCardImages(root: ParentNode): void {
  for (const container of root.querySelectorAll(CARD_IMAGE_SELECTOR)) {
    container.remove();
  }
}
