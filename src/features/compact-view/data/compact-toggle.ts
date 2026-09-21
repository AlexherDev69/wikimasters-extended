import {
  RARITY_FILTER_BUTTON_SELECTOR,
  TOGGLE_ATTRIBUTE,
  TOGGLE_SELECTOR,
} from './compact-selectors';

/**
 * The button that switches the compact view on and off, added at the end of
 * the row of rarity filters the site already draws above its grid.
 *
 * Only our own node is created, and the row of the site is only ever read and
 * used as a place to stand in: not one of its attributes, classes or styles
 * is touched, and the button is taken back whole when the feature goes off.
 */

const BUTTON_TAG = 'button';
const BUTTON_TYPE = 'button';
const LABEL_TAG = 'span';
const MARK_TAG = 'span';

const BUTTON_CLASS = 'wme-compact-toggle';
const MARK_CLASS = 'wme-compact-mark';
const CELL_CLASS = 'wme-compact-cell';
const LABEL_CLASS = 'wme-compact-label';

const BUTTON_LABEL = 'Vue compacte';

/**
 * What a press does, said the way the site would say it, since the button
 * carries no word of its own for either state.
 */
const TITLES = {
  on: 'Revenir à la taille normale des cartes',
  off: 'Réduire les cartes pour en voir plus à la fois',
} as const;

/**
 * The state of a toggle, which the style sheet reads to paint it and a
 * screen reader reads to announce it. Written as an attribute and nothing
 * else: the observer of the content script does not watch attributes, so
 * flipping the view costs no mutation it can see.
 */
const PRESSED_ATTRIBUTE = 'aria-pressed';
const TITLE_ATTRIBUTE = 'title';
const CLICK_EVENT = 'click';

/** The four cells of the little grid drawn in the button. */
const MARK_CELLS = 4;

/** Where the button goes, and what a previous sync already put there. */
export interface CompactToggleTarget {
  /** The row of rarity filters of the site, never modified. */
  row: Element;
  ourToggle: HTMLElement | null;
}

/**
 * The row of rarity filters on the page, null when there is none. Reached
 * through one of its buttons rather than through its own classes, which are
 * Tailwind utilities and change at each deployment of the site.
 */
export function findCompactToggleTarget(root: ParentNode): CompactToggleTarget | null {
  const filterButton = root.querySelector(RARITY_FILTER_BUTTON_SELECTOR);
  const row = filterButton?.parentElement ?? null;

  if (row === null) {
    return null;
  }
  return { row, ourToggle: root.querySelector<HTMLElement>(TOGGLE_SELECTOR) };
}

/** The little grid of four cells that says what the button does. */
function buildMark(document: Document): HTMLElement {
  const mark = document.createElement(MARK_TAG);
  mark.className = MARK_CLASS;

  for (let cell = 0; cell < MARK_CELLS; cell += 1) {
    const square = document.createElement(MARK_TAG);
    square.className = CELL_CLASS;
    mark.appendChild(square);
  }
  return mark;
}

function buildToggle(document: Document, onToggle: () => void): HTMLElement {
  const button = document.createElement(BUTTON_TAG);
  button.type = BUTTON_TYPE;
  button.className = BUTTON_CLASS;
  button.setAttribute(TOGGLE_ATTRIBUTE, '');

  const label = document.createElement(LABEL_TAG);
  label.className = LABEL_CLASS;
  label.textContent = BUTTON_LABEL;

  button.appendChild(buildMark(document));
  button.appendChild(label);
  button.addEventListener(CLICK_EVENT, () => {
    onToggle();
  });
  return button;
}

/** Writes an attribute only when it does not already hold that value. */
function writeAttribute(element: Element, name: string, value: string): void {
  if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

/**
 * Draws the button at the end of the row, and writes strictly nothing when it
 * is already there in the right state. The state of the view is carried by an
 * attribute and painted by the style sheet, so a press changes no text and no
 * node: the observer of the content script sees nothing at all.
 */
export function applyCompactToggle(
  target: CompactToggleTarget,
  isCompact: boolean,
  onToggle: () => void,
): void {
  const { ourToggle } = target;
  const pressed = isCompact ? 'true' : 'false';

  if (ourToggle !== null && ourToggle.parentElement === target.row) {
    writeAttribute(ourToggle, PRESSED_ATTRIBUTE, pressed);
    writeAttribute(ourToggle, TITLE_ATTRIBUTE, isCompact ? TITLES.on : TITLES.off);
    return;
  }
  // No button, or one the site has left outside the row it belongs to: the
  // row is rebuilt whenever a filter is used, and a button left behind would
  // keep working from wherever it landed.
  ourToggle?.remove();
  const toggle = buildToggle(target.row.ownerDocument, onToggle);
  writeAttribute(toggle, PRESSED_ATTRIBUTE, pressed);
  writeAttribute(toggle, TITLE_ATTRIBUTE, isCompact ? TITLES.on : TITLES.off);
  target.row.appendChild(toggle);
}

/** Takes back every button this feature added, and nothing else. */
export function removeCompactToggles(root: ParentNode): void {
  for (const toggle of root.querySelectorAll(TOGGLE_SELECTOR)) {
    toggle.remove();
  }
}
