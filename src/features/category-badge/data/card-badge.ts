import { findChildWithAttribute } from '../../../core/dom/find-child-with-attribute';
import type { BadgeDescriptor } from '../domain/describe-category';
import { BADGE_ATTRIBUTE, BADGE_SELECTOR, CATEGORY_ATTRIBUTE } from './badge-selectors';

/**
 * A badge is built from `div` and `span` only. The scanner reads the title of
 * a card in its first `h3` and its description in its first `p`, and a card
 * without description has no `p` at all: either tag inside a card root would
 * be read as belonging to the card and sent to the categorization.
 */
const BADGE_TAG = 'div';
const PART_TAG = 'span';

const BADGE_CLASS = 'wme-badge';
const DOT_CLASS = 'wme-badge-dot';
const LABEL_CLASS = 'wme-badge-label';

/** The badge and the two nodes carrying what changes from one card to another. */
interface BadgeParts {
  root: Element;
  dot: HTMLElement;
  label: HTMLElement;
}

function buildBadge(document: Document, descriptor: BadgeDescriptor): BadgeParts {
  const root = document.createElement(BADGE_TAG);
  root.className = BADGE_CLASS;
  root.setAttribute(BADGE_ATTRIBUTE, '');

  const dot = document.createElement(PART_TAG);
  dot.className = DOT_CLASS;

  const label = document.createElement(PART_TAG);
  label.className = LABEL_CLASS;

  root.appendChild(dot);
  root.appendChild(label);
  const parts: BadgeParts = { root, dot, label };
  writeDescriptor(parts, descriptor);

  return parts;
}

/** The parts of a badge added by a previous sync, null when one is missing. */
function readParts(root: Element): BadgeParts | null {
  const dot = root.querySelector<HTMLElement>(`.${DOT_CLASS}`);
  const label = root.querySelector<HTMLElement>(`.${LABEL_CLASS}`);

  return dot === null || label === null ? null : { root, dot, label };
}

/** Writes what differs, and nothing else. See CATEGORY_ATTRIBUTE for the colour. */
function writeDescriptor(parts: BadgeParts, descriptor: BadgeDescriptor): void {
  if (parts.label.textContent !== descriptor.label) {
    parts.label.textContent = descriptor.label;
  }
  if (parts.root.getAttribute(CATEGORY_ATTRIBUTE) !== descriptor.categoryId) {
    parts.root.setAttribute(CATEGORY_ATTRIBUTE, descriptor.categoryId);
    parts.dot.style.backgroundColor = descriptor.accentColor;
  }
}

/**
 * Brings the badge of one card in line with `descriptor`, and writes NOTHING
 * when it already is. The content script observes document.body, so every
 * write of ours schedules another scan, which syncs again: a sync that always
 * wrote would never stop.
 *
 * The badge is the last child of the card root. The only node touched is ours:
 * the card itself is read, never modified.
 */
export function applyCardBadge(cardRoot: HTMLElement, descriptor: BadgeDescriptor | null): void {
  // The badge is a child of the card root, so only the children are looked at:
  // this runs for every card of the page on every scan.
  const existing = findChildWithAttribute(cardRoot, BADGE_ATTRIBUTE);

  if (descriptor === null) {
    existing?.remove();
    return;
  }

  const parts = existing === null ? null : readParts(existing);
  if (parts === null) {
    // No badge yet, or one left in a shape we cannot update: build a fresh one.
    existing?.remove();
    cardRoot.appendChild(buildBadge(cardRoot.ownerDocument, descriptor).root);
    return;
  }
  writeDescriptor(parts, descriptor);
}

/**
 * Takes back every badge under `root`. Called when the content script context
 * is invalidated, so reloading the extension does not leave badges behind that
 * nothing keeps in line with the cards on screen any more.
 */
export function removeCardBadges(root: ParentNode): void {
  for (const badge of root.querySelectorAll(BADGE_SELECTOR)) {
    badge.remove();
  }
}
