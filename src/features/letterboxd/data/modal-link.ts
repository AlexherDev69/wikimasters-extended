import { scanCards } from '../../card-detection/data/scan-cards';
import { isLetterboxdUrl } from '../domain/resolve-letterboxd-url';
import {
  LETTERBOXD_LINK_ATTRIBUTE,
  LETTERBOXD_LINK_SELECTOR,
  MODAL_FRAME_SELECTOR,
  MODAL_ROOT_SELECTOR,
  WIKIPEDIA_LINK_SELECTOR,
} from './modal-selectors';

const LINK_TEXT = 'Voir sur Letterboxd →';

const LINK_TARGET = '_blank';

/** No opener and no referrer, as the site does on its own outgoing links. */
const LINK_REL = 'noopener noreferrer';

/** The copied class makes the link inline-flex, ours sits on its own line. */
const LINK_DISPLAY = 'flex';

const HREF_ATTRIBUTE = 'href';
const TARGET_ATTRIBUTE = 'target';
const REL_ATTRIBUTE = 'rel';

/** Where our link goes, and what is already there. */
export interface ModalLinkTarget {
  /**
   * Title of the card shown in the modal, read exactly as the scanner does.
   * Null while the card cannot be read, which the site does when it reuses the
   * modal for the next card: the link of the previous card must go away rather
   * than stay clickable on the wrong film.
   */
  title: string | null;
  wikipediaLink: HTMLAnchorElement;
  /** The link added by a previous sync, null when there is none yet. */
  ourLink: HTMLAnchorElement | null;
}

interface DetailModal {
  root: Element;
  wikipediaLink: HTMLAnchorElement;
}

/**
 * The detail modal among the full-screen layers: the one holding a card frame
 * and the Wikipedia link. Another layer of the site sharing the same utility
 * classes, a toast host or a dialog, is skipped instead of hiding the modal.
 */
function findDetailModal(root: ParentNode): DetailModal | null {
  for (const layer of root.querySelectorAll(MODAL_ROOT_SELECTOR)) {
    const wikipediaLink = layer.querySelector<HTMLAnchorElement>(WIKIPEDIA_LINK_SELECTOR);
    if (wikipediaLink !== null && layer.querySelector(MODAL_FRAME_SELECTOR) !== null) {
      return { root: layer, wikipediaLink };
    }
  }
  return null;
}

/**
 * Locates the insertion point in the open detail modal. Null when no detail
 * modal is open: the extension then does nothing at all.
 */
export function findModalLinkTarget(root: ParentNode): ModalLinkTarget | null {
  const modal = findDetailModal(root);
  if (modal === null) {
    return null;
  }

  // The card of the modal is an ordinary card root, so the scanner gives the
  // title in the very form the categorization was asked for.
  const [observed] = scanCards(modal.root);

  return {
    title: observed?.card.title ?? null,
    wikipediaLink: modal.wikipediaLink,
    ourLink: modal.root.querySelector<HTMLAnchorElement>(LETTERBOXD_LINK_SELECTOR),
  };
}

function createLink(target: ModalLinkTarget, url: string): HTMLAnchorElement {
  const link = target.wikipediaLink.ownerDocument.createElement('a');

  // The class of the site link is copied so ours inherits the site look.
  link.className = target.wikipediaLink.className;
  link.style.display = LINK_DISPLAY;
  link.textContent = LINK_TEXT;
  link.href = url;
  link.target = LINK_TARGET;
  link.rel = LINK_REL;
  link.setAttribute(LETTERBOXD_LINK_ATTRIBUTE, '');

  return link;
}

/**
 * Brings the modal in line with `url`, and writes NOTHING when it already is.
 * The content script observes document.body, so every write of ours schedules
 * another scan, which syncs again: a sync that always wrote would never stop.
 *
 * The only nodes touched are ours. The site nodes are read, never modified.
 */
export function applyModalLink(target: ModalLinkTarget, url: string | null): void {
  // Last check before the DOM, whatever the caller believes it holds.
  const safeUrl = isLetterboxdUrl(url) ? url : null;
  const { ourLink } = target;

  if (safeUrl === null) {
    ourLink?.remove();
    return;
  }
  if (ourLink === null) {
    target.wikipediaLink.insertAdjacentElement('afterend', createLink(target, safeUrl));
    return;
  }
  // Each attribute is compared before being written, so a link already in
  // shape costs no mutation at all. The node is never moved.
  if (ourLink.getAttribute(HREF_ATTRIBUTE) !== safeUrl) {
    ourLink.href = safeUrl;
  }
  if (ourLink.textContent !== LINK_TEXT) {
    ourLink.textContent = LINK_TEXT;
  }
  if (ourLink.getAttribute(TARGET_ATTRIBUTE) !== LINK_TARGET) {
    ourLink.target = LINK_TARGET;
  }
  if (ourLink.getAttribute(REL_ATTRIBUTE) !== LINK_REL) {
    ourLink.rel = LINK_REL;
  }
}
