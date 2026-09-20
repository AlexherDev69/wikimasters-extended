import type { DetailModal } from '../../card-detection/data/detail-modal';
import { CATEGORY_LINE_SELECTOR } from '../../category-badge/data/badge-selectors';
import { LETTERBOXD_LINK_SELECTOR } from '../../letterboxd/data/modal-selectors';
import { isCommonsFileName } from '../domain/card-image';
import { commonsFilePageUrl } from '../domain/commons-url';
import { IMAGE_CREDIT_ATTRIBUTE, IMAGE_CREDIT_SELECTOR } from './image-selectors';

/**
 * The credit of the image shown on the card of the detail modal. Files of
 * Commons are under free licences that ask for attribution, and their file
 * page is where the author and the licence are named.
 */

const LINE_TAG = 'div';
const TEXT_TAG = 'span';
const LINK_TAG = 'a';

const LINE_CLASS = 'wme-credit-line';
const TEXT_CLASS = 'wme-credit-text';
const LINK_CLASS = 'wme-credit-link';

const CREDIT_TEXT = 'Image : ';
const LINK_TEXT = 'Wikimedia Commons (auteur et licence)';

const LINK_TARGET = '_blank';

/** No opener and no referrer, as the site does on its own outgoing links. */
const LINK_REL = 'noopener noreferrer';

const HREF_ATTRIBUTE = 'href';

/** Where our line goes in the open detail modal, and what is already there. */
export interface ModalCreditTarget {
  /**
   * Title of the card shown in the modal, as the detail modal reads it. Null
   * while the card cannot be read: the credit of the previous card must then
   * go away rather than name the author of another picture.
   */
  title: string | null;
  /** The node our line is inserted after, once and never moved again. */
  anchor: Element;
  /** The line added by a previous sync, null when there is none yet. */
  ourLine: HTMLElement | null;
}

interface CreditParts {
  root: HTMLElement;
  link: HTMLAnchorElement;
}

/**
 * Locates the insertion point in an open detail modal. The modal itself is
 * found once per sync pass and handed to every feature that writes in it.
 */
export function findModalCreditTarget(modal: DetailModal): ModalCreditTarget {
  // Our line goes under the category line of the extension, under its
  // Letterboxd link otherwise, and under the site link when neither is there.
  // The order the three features arrive in does not matter: each one anchors
  // on the last of the nodes that must come before it, so a node arriving
  // later inserts itself right above the ones that must follow it, and no node
  // is ever moved afterwards.
  const categoryLine = modal.root.querySelector(CATEGORY_LINE_SELECTOR);
  const letterboxdLink = modal.root.querySelector(LETTERBOXD_LINK_SELECTOR);

  return {
    title: modal.title,
    anchor: categoryLine ?? letterboxdLink ?? modal.wikipediaLink,
    ourLine: modal.root.querySelector<HTMLElement>(IMAGE_CREDIT_SELECTOR),
  };
}

function buildLine(document: Document, fileName: string): CreditParts {
  const root = document.createElement(LINE_TAG);
  root.className = LINE_CLASS;
  root.setAttribute(IMAGE_CREDIT_ATTRIBUTE, '');

  const text = document.createElement(TEXT_TAG);
  text.className = TEXT_CLASS;
  text.textContent = CREDIT_TEXT;

  const link = document.createElement(LINK_TAG);
  link.className = LINK_CLASS;
  link.textContent = LINK_TEXT;
  link.target = LINK_TARGET;
  link.rel = LINK_REL;

  root.appendChild(text);
  root.appendChild(link);
  const parts: CreditParts = { root, link };
  writeFileName(parts, fileName);

  return parts;
}

/** The parts of a line added by a previous sync, null when one is missing. */
function readParts(root: HTMLElement): CreditParts | null {
  const link = root.querySelector<HTMLAnchorElement>(`${LINK_TAG}.${LINK_CLASS}`);

  return link === null ? null : { root, link };
}

/**
 * Writes what differs, and nothing else. The address is the whole state of the
 * line: its two texts never change, and they are written when it is built.
 */
function writeFileName(parts: CreditParts, fileName: string): void {
  const url = commonsFilePageUrl(fileName);

  if (parts.link.getAttribute(HREF_ATTRIBUTE) !== url) {
    parts.link.href = url;
  }
}

/**
 * Brings the credit line of the modal in line with `fileName`, and writes
 * NOTHING when it already is. The content script observes document.body, so a
 * sync that always wrote would schedule a scan that syncs again, forever.
 *
 * The only node touched is ours. The site nodes are read, never modified.
 */
export function applyModalCreditLine(target: ModalCreditTarget, fileName: string | null): void {
  // Last check before the DOM, whatever the caller believes it holds: the name
  // is interpolated into an href.
  const safeFileName = isCommonsFileName(fileName) ? fileName : null;
  const { ourLine } = target;

  if (safeFileName === null) {
    ourLine?.remove();
    return;
  }

  const parts = ourLine === null ? null : readParts(ourLine);
  if (parts === null) {
    // No line yet, or one left in a shape we cannot update: build a fresh one.
    ourLine?.remove();
    const document = target.anchor.ownerDocument;
    target.anchor.insertAdjacentElement('afterend', buildLine(document, safeFileName).root);
    return;
  }
  writeFileName(parts, safeFileName);
}

/**
 * Takes back every credit line under `root`. Called when the setting is
 * switched off and when the content script context is invalidated, so
 * reloading the extension does not leave a credit behind for an image that is
 * not shown any more.
 */
export function removeModalCreditLines(root: ParentNode): void {
  for (const line of root.querySelectorAll(IMAGE_CREDIT_SELECTOR)) {
    line.remove();
  }
}
