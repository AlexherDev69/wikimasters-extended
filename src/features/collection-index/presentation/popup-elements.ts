import type { Rarity } from '../../card-detection/domain/rarity';
import type { CategoryId } from '../../categorization/domain/category';
import { CATEGORY_ACCENT_COLORS } from '../../category-badge/domain/category-display';

/**
 * The few builders every view of the popup shares. Nodes are always created
 * and filled through `textContent`, never through `innerHTML`: the popup
 * displays card titles, which come from a page of the site.
 */

const BLOCK_TAG = 'div';
const TEXT_TAG = 'span';
const BUTTON_TAG = 'button';
const LINK_TAG = 'a';

const DOT_CLASS = 'wme-dot';
export const LABEL_CLASS = 'wme-label';
export const COUNT_CLASS = 'wme-count';

/** Opening a link from the popup must not hand the new page our window. */
const LINK_TARGET = '_blank';
const LINK_RELATIONSHIP = 'noopener noreferrer';

/** The rarity codes the site itself prints on a card. */
export const RARITY_LABELS: Record<Rarity, string> = {
  c: 'C',
  pc: 'PC',
  r: 'R',
  sr: 'SR',
  ur: 'UR',
  l: 'L',
};

export function createBlock(className: string): HTMLDivElement {
  const block = document.createElement(BLOCK_TAG);
  block.className = className;
  return block;
}

export function createText(className: string, text: string): HTMLSpanElement {
  const span = document.createElement(TEXT_TAG);
  span.className = className;
  span.textContent = text;
  return span;
}

export function createButton(className: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement(BUTTON_TAG);
  button.type = 'button';
  button.className = className;
  button.addEventListener('click', onClick);
  return button;
}

export function createLink(className: string, href: string, text: string): HTMLAnchorElement {
  const link = document.createElement(LINK_TAG);
  link.className = className;
  link.href = href;
  link.target = LINK_TARGET;
  link.rel = LINK_RELATIONSHIP;
  link.textContent = text;
  return link;
}

/** The coloured dot of a category, the same colour as its badge on a card. */
export function createCategoryDot(categoryId: CategoryId): HTMLSpanElement {
  const dot = createText(DOT_CLASS, '');
  dot.style.backgroundColor = CATEGORY_ACCENT_COLORS[categoryId];
  return dot;
}
