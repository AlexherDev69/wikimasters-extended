/**
 * The element builders every page of the extension shares: the statistics
 * window and the options page. A node is always created and filled through
 * `textContent`, never through `innerHTML`, because these pages display card
 * titles, which come from a page of the site.
 */

const BLOCK_TAG = 'div';
const TEXT_TAG = 'span';
const BUTTON_TAG = 'button';

/** Without it a button inside a form would submit it. */
const BUTTON_TYPE = 'button';

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
  button.type = BUTTON_TYPE;
  button.className = className;
  button.addEventListener('click', onClick);
  return button;
}
