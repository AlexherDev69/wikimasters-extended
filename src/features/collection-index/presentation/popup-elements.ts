import { createBlock, createButton, createText } from '../../../core/dom/create-elements';
import type { Rarity } from '../../card-detection/domain/rarity';
import type { CategoryId } from '../../categorization/domain/category';
import { CATEGORY_ACCENT_COLORS } from '../../category-badge/domain/category-display';

/**
 * The builders every view of the popup shares, on top of the ones the pages of
 * the extension have in common. Nodes are always created and filled through
 * `textContent`, never through `innerHTML`: the popup displays card titles,
 * which come from a page of the site.
 */

const LINK_TAG = 'a';

const DOT_CLASS = 'wme-dot';
export const LABEL_CLASS = 'wme-label';
export const COUNT_CLASS = 'wme-count';

const OPTIONS_BAR_CLASS = 'wme-options-bar';
const OPTIONS_CLASS = 'wme-options';
const OPTIONS_LABEL = 'Options';

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

/**
 * The way to the options page. It sits under every screen rather than in one
 * of them: an index that is still empty must not be the only place from which
 * the settings cannot be reached.
 */
export function createOptionsBar(onOpen: () => void): HTMLElement {
  const bar = createBlock(OPTIONS_BAR_CLASS);
  const button = createButton(OPTIONS_CLASS, onOpen);
  button.textContent = OPTIONS_LABEL;
  bar.appendChild(button);
  return bar;
}
