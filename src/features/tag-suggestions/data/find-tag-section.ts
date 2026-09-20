import type { DetailModal } from '../../card-detection/data/detail-modal';
import { LABELLED_BUTTON_SELECTOR, REMOVE_TAG_BUTTON_LABEL_PREFIX, TAG_INPUT_SELECTOR } from './tag-selectors';

const ARIA_LABEL_ATTRIBUTE = 'aria-label';

/** The tag field of the detail modal of a card the user owns, read-only. */
export interface TagSection {
  /** The section itself: the label, the chips and the input wrapper. */
  root: Element;
  /** Parent of the input: our own node of proposals is inserted right after it. */
  inputWrapper: Element;
  input: HTMLInputElement;
  /** Tags already on the card, read from the site's own remove buttons. */
  tags: string[];
}

/**
 * The tag named by one "remove tag" button. The aria-label is read first: the
 * site spells the tag out in full there, and it survives the "x" glyph and any
 * decoration the chip carries, which is why it is the rule rather than the
 * fallback below it.
 *
 * Falls back to the chip text minus the button's own text only when the label
 * does not start with the expected prefix, for a shape the site might one day
 * ship without this reader being updated for it. A tag read wrong there is
 * only ever compared against the proposals, so the worst it can do is hide a
 * proposal that would have been useful, never add one and never cause a
 * write: a card is left with one proposal fewer, and nothing else.
 */
function tagFromButton(button: Element): string | null {
  const label = button.getAttribute(ARIA_LABEL_ATTRIBUTE);
  if (label !== null && label.startsWith(REMOVE_TAG_BUTTON_LABEL_PREFIX)) {
    const tag = label.slice(REMOVE_TAG_BUTTON_LABEL_PREFIX.length).trim();
    return tag === '' ? null : tag;
  }

  const chip = button.parentElement;
  if (chip === null) {
    return null;
  }
  const chipText = chip.textContent ?? '';
  const buttonText = button.textContent ?? '';
  const tag = chipText.replace(buttonText, '').trim();
  return tag === '' ? null : tag;
}

/** Every tag the section already carries. A tag that cannot be read is skipped. */
function readTags(root: Element): string[] {
  const tags: string[] = [];

  for (const button of root.querySelectorAll(LABELLED_BUTTON_SELECTOR)) {
    const tag = tagFromButton(button);
    if (tag !== null) {
      tags.push(tag);
    }
  }
  return tags;
}

/**
 * Locates the tag section of an open detail modal. Null when the card shown
 * has no tag field at all: the site only puts one on a card the user owns, so
 * its presence IS the ownership test, and there is no other one to build.
 */
export function findTagSection(modal: DetailModal): TagSection | null {
  const input = modal.root.querySelector<HTMLInputElement>(TAG_INPUT_SELECTOR);
  if (input === null) {
    return null;
  }

  const inputWrapper = input.parentElement;
  const root = inputWrapper === null ? null : inputWrapper.parentElement;
  if (inputWrapper === null || root === null) {
    return null;
  }

  return { root, inputWrapper, input, tags: readTags(root) };
}
