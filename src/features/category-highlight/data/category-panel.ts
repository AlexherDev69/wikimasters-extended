import type { CategoryId } from '../../categorization/domain/category';
import { CATEGORY_ATTRIBUTE } from '../../category-badge/data/badge-selectors';
import type { CategoryCount } from '../domain/category-counts';
import { PANEL_ATTRIBUTE, PANEL_SELECTOR } from './highlight-selectors';

const PANEL_TAG = 'div';
const BUTTON_TAG = 'button';
const PART_TAG = 'span';

const PANEL_CLASS = 'wme-panel';
/** Carried by every button of the panel, so no rule of ours targets `button`. */
const BUTTON_CLASS = 'wme-panel-button';
const TOGGLE_CLASS = 'wme-panel-toggle';
const LIST_CLASS = 'wme-panel-list';
const ITEM_CLASS = 'wme-panel-item';
const DOT_CLASS = 'wme-panel-dot';
const LABEL_CLASS = 'wme-panel-label';
const COUNT_CLASS = 'wme-panel-count';
const CLEAR_CLASS = 'wme-panel-clear';

const TOGGLE_LABEL = 'Catégories';
const CLEAR_LABEL = 'Tout afficher';
/** Middle dot (U+00B7), between the count of lines and the active filter. */
const FILTER_SEPARATOR = ' · ';

const EXPANDED_ATTRIBUTE = 'aria-expanded';
const PRESSED_ATTRIBUTE = 'aria-pressed';
const TRUE = 'true';
const FALSE = 'false';

/** What the panel shows. It is held by the content script and never stored. */
export interface PanelState {
  counts: readonly CategoryCount[];
  activeCategoryId: CategoryId | null;
  collapsed: boolean;
}

/** What a click on our own buttons asks the content script to do. */
export interface PanelCallbacks {
  onToggleCollapsed: () => void;
  onSelectCategory: (categoryId: CategoryId) => void;
  onClearCategory: () => void;
}

interface PanelParts {
  root: HTMLElement;
  toggle: HTMLElement;
}

/** One line of the panel and the two nodes carrying what changes in it. */
interface ItemParts {
  root: HTMLElement;
  label: HTMLElement;
  count: HTMLElement;
}

function createButton(
  document: Document,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement(BUTTON_TAG);
  button.type = 'button';
  button.className = `${BUTTON_CLASS} ${className}`;
  // The click is left to bubble: the panel hangs from the body with no node of
  // the site above it, so the site sees what any click on the body gives it,
  // and stopping it would suppress a handler the site registered.
  button.addEventListener('click', onClick);
  return button;
}

function buildPanel(document: Document, callbacks: PanelCallbacks): PanelParts {
  const root = document.createElement(PANEL_TAG);
  root.className = PANEL_CLASS;
  root.setAttribute(PANEL_ATTRIBUTE, '');

  const toggle = createButton(document, TOGGLE_CLASS, callbacks.onToggleCollapsed);
  root.appendChild(toggle);

  return { root, toggle };
}

function readParts(root: HTMLElement): PanelParts | null {
  const toggle = root.querySelector<HTMLElement>(`.${TOGGLE_CLASS}`);

  return toggle === null ? null : { root, toggle };
}

function buildItem(document: Document, entry: CategoryCount, callbacks: PanelCallbacks): ItemParts {
  const root = createButton(document, ITEM_CLASS, () => {
    callbacks.onSelectCategory(entry.categoryId);
  });
  root.setAttribute(CATEGORY_ATTRIBUTE, entry.categoryId);

  const dot = document.createElement(PART_TAG);
  dot.className = DOT_CLASS;
  // The colour follows the category, and an item never changes category: it is
  // moved and updated, never handed to another one.
  dot.style.backgroundColor = entry.accentColor;

  const label = document.createElement(PART_TAG);
  label.className = LABEL_CLASS;

  const count = document.createElement(PART_TAG);
  count.className = COUNT_CLASS;

  root.appendChild(dot);
  root.appendChild(label);
  root.appendChild(count);

  return { root, label, count };
}

/** The parts of a line added by a previous render, null when one is missing. */
function readItemParts(root: HTMLElement): ItemParts | null {
  const label = root.querySelector<HTMLElement>(`.${LABEL_CLASS}`);
  const count = root.querySelector<HTMLElement>(`.${COUNT_CLASS}`);

  return label === null || count === null ? null : { root, label, count };
}

/** Writes what differs in one line of the panel, and nothing else. */
function writeItem(
  parts: ItemParts,
  entry: CategoryCount,
  activeCategoryId: CategoryId | null,
): void {
  const countText = String(entry.count);
  const pressed = entry.categoryId === activeCategoryId ? TRUE : FALSE;

  if (parts.label.textContent !== entry.label) {
    parts.label.textContent = entry.label;
  }
  if (parts.count.textContent !== countText) {
    parts.count.textContent = countText;
  }
  if (parts.root.getAttribute(PRESSED_ATTRIBUTE) !== pressed) {
    parts.root.setAttribute(PRESSED_ATTRIBUTE, pressed);
  }
}

/**
 * The lines already there, by category. A line that lost one of its parts is
 * left out, so it is replaced rather than updated: same rule as the badge and
 * the modal line.
 */
function indexItems(list: Element): Map<string, ItemParts> {
  const byCategory = new Map<string, ItemParts>();

  for (const item of list.querySelectorAll<HTMLElement>(`.${ITEM_CLASS}`)) {
    const categoryId = item.getAttribute(CATEGORY_ATTRIBUTE);
    const parts = readItemParts(item);
    if (categoryId !== null && parts !== null && !byCategory.has(categoryId)) {
      byCategory.set(categoryId, parts);
    }
  }
  return byCategory;
}

/**
 * Lays the lines out in the order of `state.counts`, moving only what is out
 * of place. Rebuilding them all would drop a click being made on one of them
 * and lose the keyboard focus, every time a batch of results lands.
 */
function writeItems(list: Element, state: PanelState, callbacks: PanelCallbacks): void {
  const existing = indexItems(list);
  let cursor = list.firstElementChild;

  for (const entry of state.counts) {
    const parts = existing.get(entry.categoryId) ?? buildItem(list.ownerDocument, entry, callbacks);

    if (cursor !== null && parts.root === cursor) {
      cursor = cursor.nextElementSibling;
    } else {
      list.insertBefore(parts.root, cursor);
    }
    writeItem(parts, entry, state.activeCategoryId);
  }

  // Whatever is left carries a category the page no longer shows, or is a line
  // that lost a part and was replaced above.
  while (cursor !== null) {
    const next = cursor.nextElementSibling;
    cursor.remove();
    cursor = next;
  }
}

function writeList(panel: HTMLElement, state: PanelState, callbacks: PanelCallbacks): void {
  const existing = panel.querySelector<HTMLElement>(`.${LIST_CLASS}`);

  if (state.collapsed) {
    existing?.remove();
    return;
  }

  let list = existing;
  if (list === null) {
    list = panel.ownerDocument.createElement(PANEL_TAG);
    list.className = LIST_CLASS;
    // The way out stays the last child, even when it was added first, which
    // happens when a filter is set while the panel is collapsed.
    panel.insertBefore(list, panel.querySelector(`.${CLEAR_CLASS}`));
  }
  writeItems(list, state, callbacks);
}

/**
 * The way out of a filter, shown whenever there is one to leave, collapsed or
 * not: collapsing hides the list of categories, never the way back to the
 * whole page.
 */
function writeClear(panel: HTMLElement, state: PanelState, callbacks: PanelCallbacks): void {
  const existing = panel.querySelector<HTMLElement>(`.${CLEAR_CLASS}`);

  if (state.activeCategoryId === null) {
    existing?.remove();
    return;
  }
  if (existing !== null) {
    return;
  }

  const clear = createButton(panel.ownerDocument, CLEAR_CLASS, callbacks.onClearCategory);
  clear.textContent = CLEAR_LABEL;
  panel.appendChild(clear);
}

function writeToggle(toggle: HTMLElement, state: PanelState): void {
  // The active filter is named even when the panel is collapsed: a page can be
  // entirely dimmed by a filter, and the reason must be readable at a glance.
  const active = state.counts.find((entry) => entry.categoryId === state.activeCategoryId);
  const count = `${TOGGLE_LABEL} (${String(state.counts.length)})`;
  const text = active === undefined ? count : `${count}${FILTER_SEPARATOR}${active.label}`;
  const expanded = state.collapsed ? FALSE : TRUE;

  if (toggle.textContent !== text) {
    toggle.textContent = text;
  }
  if (toggle.getAttribute(EXPANDED_ATTRIBUTE) !== expanded) {
    toggle.setAttribute(EXPANDED_ATTRIBUTE, expanded);
  }
}

/**
 * Brings the panel in line with `state`, and writes NOTHING when it already
 * is. The content script observes document.body, so a render that always wrote
 * would schedule a scan that renders again, forever.
 *
 * The panel is a node of ours appended to `host`. It stands beside the page
 * and no node of the site is read or touched to place it.
 */
export function applyCategoryPanel(
  host: HTMLElement,
  state: PanelState,
  callbacks: PanelCallbacks,
): void {
  const existing = host.querySelector<HTMLElement>(PANEL_SELECTOR);

  // Nothing to list, because no card is on screen or none is categorized yet:
  // no panel at all rather than an empty one.
  if (state.counts.length === 0) {
    existing?.remove();
    return;
  }

  let parts = existing === null ? null : readParts(existing);
  if (parts === null) {
    // No panel yet, or one left in a shape we cannot update: build a fresh one.
    existing?.remove();
    parts = buildPanel(host.ownerDocument, callbacks);
    host.appendChild(parts.root);
  }

  writeToggle(parts.toggle, state);
  writeList(parts.root, state, callbacks);
  writeClear(parts.root, state, callbacks);
}

/**
 * Takes back every panel under `root`. Called when the content script context
 * is invalidated, so reloading the extension does not leave a panel behind
 * that no longer answers a click.
 */
export function removeCategoryPanels(root: ParentNode): void {
  for (const panel of root.querySelectorAll(PANEL_SELECTOR)) {
    panel.remove();
  }
}
