/**
 * What the buttons of the bar share: the way their drawing is built, and the
 * way an attribute is written without a mutation when it already holds its
 * value.
 */

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const ICON_TAG = 'svg';
const PATH_TAG = 'path';
const ICON_VIEW_BOX = '0 0 24 24';
const VIEW_BOX_ATTRIBUTE = 'viewBox';
const PATH_DATA_ATTRIBUTE = 'd';
const CLASS_ATTRIBUTE = 'class';
const ARIA_HIDDEN_ATTRIBUTE = 'aria-hidden';

/**
 * One drawing of a button. A button may carry several, one per state, and the
 * style sheet shows the one that fits.
 */
export interface IconPath {
  className: string;
  /** A path on a 24 by 24 grid, drawn as a stroke by the style sheet. */
  data: string;
}

export function buildIcon(document: Document, paths: readonly IconPath[]): SVGSVGElement {
  const icon = document.createElementNS(SVG_NAMESPACE, ICON_TAG);
  icon.setAttribute(VIEW_BOX_ATTRIBUTE, ICON_VIEW_BOX);
  // The button carries the whole label: the drawing would add nothing to it.
  icon.setAttribute(ARIA_HIDDEN_ATTRIBUTE, 'true');

  for (const { className, data } of paths) {
    const path = document.createElementNS(SVG_NAMESPACE, PATH_TAG);
    path.setAttribute(CLASS_ATTRIBUTE, className);
    path.setAttribute(PATH_DATA_ATTRIBUTE, data);
    icon.appendChild(path);
  }
  return icon;
}

/** Writes an attribute only when it does not already hold that value. */
export function writeAttribute(element: Element, name: string, value: string): void {
  if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}
