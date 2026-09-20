/**
 * The element builders of the pages of the extension, the options page being
 * the only one left. A node is always created and filled through `textContent`
 * and never through `innerHTML`: a page of ours is built from text alone, so
 * no string can ever become markup in it.
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
