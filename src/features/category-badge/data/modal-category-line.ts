import type { DetailModal } from '../../card-detection/data/detail-modal';
import { LETTERBOXD_LINK_SELECTOR } from '../../letterboxd/data/modal-selectors';
import type { ModalCategoryDescriptor } from '../domain/describe-modal-category';
import {
  CATEGORY_ATTRIBUTE,
  CATEGORY_LINE_ATTRIBUTE,
  CATEGORY_LINE_SELECTOR,
} from './badge-selectors';

const LINE_TAG = 'div';
const PART_TAG = 'span';

const LINE_CLASS = 'wme-category-line';
const DOT_CLASS = 'wme-line-dot';
const TEXT_CLASS = 'wme-line-text';

/** Where our line goes in the open detail modal, and what is already there. */
export interface ModalCategoryTarget {
  /**
   * Title of the card shown in the modal, as the detail modal reads it. Null
   * while the card cannot be read: the line of the previous card must then go
   * away rather than describe the wrong card.
   */
  title: string | null;
  /** The node our line is inserted after, once and never moved again. */
  anchor: Element;
  /** The line added by a previous sync, null when there is none yet. */
  ourLine: HTMLElement | null;
}

interface LineParts {
  root: HTMLElement;
  dot: HTMLElement;
  text: HTMLElement;
}

/**
 * Locates the insertion point in an open detail modal. The modal itself is
 * found once per sync pass and handed to every feature that writes in it.
 */
export function findModalCategoryTarget(modal: DetailModal): ModalCategoryTarget {
  // The line goes under the Letterboxd link of the extension when that feature
  // already added it, and under the site link otherwise. The order the two
  // features arrive in does not matter: the Letterboxd link inserts itself
  // right after the site link, which pushes it above a line already there.
  const letterboxdLink = modal.root.querySelector(LETTERBOXD_LINK_SELECTOR);

  return {
    title: modal.title,
    anchor: letterboxdLink ?? modal.wikipediaLink,
    ourLine: modal.root.querySelector<HTMLElement>(CATEGORY_LINE_SELECTOR),
  };
}

function buildLine(document: Document, descriptor: ModalCategoryDescriptor): LineParts {
  const root = document.createElement(LINE_TAG);
  root.className = LINE_CLASS;
  root.setAttribute(CATEGORY_LINE_ATTRIBUTE, '');

  const dot = document.createElement(PART_TAG);
  dot.className = DOT_CLASS;

  const text = document.createElement(PART_TAG);
  text.className = TEXT_CLASS;

  root.appendChild(dot);
  root.appendChild(text);
  const parts: LineParts = { root, dot, text };
  writeDescriptor(parts, descriptor);

  return parts;
}

/** The parts of a line added by a previous sync, null when one is missing. */
function readParts(root: HTMLElement): LineParts | null {
  const dot = root.querySelector<HTMLElement>(`.${DOT_CLASS}`);
  const text = root.querySelector<HTMLElement>(`.${TEXT_CLASS}`);

  return dot === null || text === null ? null : { root, dot, text };
}

/** Writes what differs, and nothing else. See CATEGORY_ATTRIBUTE for the colour. */
function writeDescriptor(parts: LineParts, descriptor: ModalCategoryDescriptor): void {
  if (parts.text.textContent !== descriptor.text) {
    parts.text.textContent = descriptor.text;
  }
  if (parts.root.getAttribute(CATEGORY_ATTRIBUTE) !== descriptor.categoryId) {
    parts.root.setAttribute(CATEGORY_ATTRIBUTE, descriptor.categoryId);
    parts.dot.style.backgroundColor = descriptor.accentColor;
  }
}

/**
 * Brings the category line of the modal in line with `descriptor`, and writes
 * NOTHING when it already is. The content script observes document.body, so a
 * sync that always wrote would schedule a scan that syncs again, forever.
 *
 * The only node touched is ours. The site nodes are read, never modified.
 */
export function applyModalCategoryLine(
  target: ModalCategoryTarget,
  descriptor: ModalCategoryDescriptor | null,
): void {
  const { ourLine } = target;

  if (descriptor === null) {
    ourLine?.remove();
    return;
  }

  const parts = ourLine === null ? null : readParts(ourLine);
  if (parts === null) {
    // No line yet, or one left in a shape we cannot update: build a fresh one.
    ourLine?.remove();
    const document = target.anchor.ownerDocument;
    target.anchor.insertAdjacentElement('afterend', buildLine(document, descriptor).root);
    return;
  }
  writeDescriptor(parts, descriptor);
}

/**
 * Takes back every category line under `root`. Called when the content script
 * context is invalidated, so reloading the extension does not leave a line
 * behind that nothing keeps in line with the card on screen any more.
 */
export function removeModalCategoryLines(root: ParentNode): void {
  for (const line of root.querySelectorAll(CATEGORY_LINE_SELECTOR)) {
    line.remove();
  }
}
