import { findChildWithAttribute } from '../../../core/dom/find-child-with-attribute';
import { isCommonsFileName, type CardImage } from '../domain/card-image';
import { commonsThumbnailUrl } from '../domain/commons-url';
import { isWikimediaThumbnailUrl } from '../domain/thumbnail-url';
import { findPictureArea } from './find-placeholder';
import {
  CARD_IMAGE_ATTRIBUTE,
  CARD_IMAGE_SELECTOR,
  IMAGE_FAILED_ATTRIBUTE,
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
 * What the mark reads: the initial of Commons, in a small disc in the corner
 * of the picture. It says at a glance that the picture was added by the
 * extension rather than served by the site.
 *
 * A single letter rather than the word: the word was wide enough to share its
 * row with the category badge, which is drawn above ours and covered its
 * start on a narrow card. The source is spelled out in full, with its author
 * and its licence, in the credit line of the detail modal, which is the only
 * place that has the room for it.
 *
 * Drawn as a FILLED disc and never as a letter in a thin ring: a ringed C is
 * the copyright glyph, and these files are under a free licence, so that
 * shape would say the opposite of the truth.
 */
const IMAGE_SOURCE_LABEL = 'C';

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
const ERROR_EVENT = 'error';

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

  // Both listeners are added BEFORE the source, because an image the browser
  // already holds fires its `load` as soon as the source is set, and a source
  // it knows to be broken fires its `error` just as early.
  //
  // Each one marks the container once and for all: the container is built
  // again rather than patched whenever the card changes, so neither mark can
  // ever be left over from another picture, and a sync that finds the right
  // file writes nothing whatever the marks say.
  picture.addEventListener(LOAD_EVENT, () => {
    container.setAttribute(IMAGE_LOADED_ATTRIBUTE, '');
  });
  picture.addEventListener(ERROR_EVENT, () => {
    // Everything of ours goes away with this mark, the loading state included:
    // what is left on screen is the placeholder of the site, exactly as on a
    // card the extension knows no picture for.
    container.setAttribute(IMAGE_FAILED_ATTRIBUTE, '');
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
 * Address the picture is asked for at: the one resolved by the service worker
 * when there is one, and the one built from the file name otherwise. The
 * resolved address is checked again here, whatever the caller believes it
 * holds: this is the last step before an `src`.
 *
 * The fallback is not a failure, it is the path that shipped before this
 * phase: the same picture, reached through two redirects the browser is told
 * not to cache.
 */
function thumbnailAddress(image: CardImage): string {
  return isWikimediaThumbnailUrl(image.thumbnailUrl)
    ? image.thumbnailUrl
    : commonsThumbnailUrl(image.fileName);
}

/**
 * True while the container already shows exactly this image. Its `img` and its
 * mark are read back as well, the way the credit line reads its link back: a
 * container that lost either one would otherwise stay half drawn for as long
 * as the site keeps that card on screen.
 *
 * The loading marks are deliberately NOT compared. They are written by our own
 * events, after the container was built, and the content script observes
 * document.body: a sync that rebuilt the container because it had just been
 * marked as loaded would mark the new one as loading, and never come to rest.
 * The address is not compared either, for the same reason and one more: a
 * picture already on screen must not be fetched again just because a faster
 * address for it has arrived in the meantime.
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
    buildContainer(cardRoot.ownerDocument, safeImage, thumbnailAddress(safeImage)),
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
