import { CARD_ROOT_SELECTOR } from '../../card-detection/data/card-selectors';
import {
  CARD_ACTIONS_SELECTOR,
  FULLSCREEN_STYLE_ATTRIBUTE,
  FULLSCREEN_STYLE_SELECTOR,
} from './card-actions-selectors';

const STYLE_TAG = 'style';

/**
 * The node of the site in full screen, and only while it holds our bar of
 * buttons: the column of the detail modal that holds the card. A page that
 * puts anything else in full screen, a video for instance, is never reached.
 */
const FULLSCREEN_COLUMN_SELECTOR = `:fullscreen:has(> ${CARD_ACTIONS_SELECTOR})`;

/**
 * The third style sheet of the extension that targets nodes of the SITE,
 * after the ones of the card statistics and of the compact view, and built
 * the same way: appended to `document.head` only while the card is in full
 * screen, and taken back whole the moment it leaves.
 *
 * It is written in JavaScript rather than shipped with the manifest because
 * of its one number: the zoom depends on the screen the card is shown on,
 * which only the full screen itself can measure.
 *
 * The cascade only decides what is painted: no attribute, class or style is
 * ever written on a node of the site. The browser gives the node in full
 * screen the whole screen, and the site's own `flex justify-center` already
 * centres the card across it; this adds the vertical centring and the size.
 */
function fullscreenCss(zoom: number): string {
  return `
${FULLSCREEN_COLUMN_SELECTOR} {
  align-items: center;
}

/* The card itself, scaled whole: its text and its badges grow with it, which
   a larger width and height alone would not do. */
${FULLSCREEN_COLUMN_SELECTOR} > ${CARD_ROOT_SELECTOR} {
  zoom: ${String(zoom)};
}
`;
}

/**
 * Writes the style sheet for `zoom`, and writes NOTHING when it already says
 * exactly that. `document.head` lies outside what the content script
 * observes, so even a write here schedules no scan.
 */
export function writeFullscreenStyle(document: Document, zoom: number): void {
  const css = fullscreenCss(zoom);
  const existing = document.head.querySelector(FULLSCREEN_STYLE_SELECTOR);

  if (existing !== null) {
    if (existing.textContent !== css) {
      existing.textContent = css;
    }
    return;
  }
  const style = document.createElement(STYLE_TAG);
  style.setAttribute(FULLSCREEN_STYLE_ATTRIBUTE, '');
  style.textContent = css;
  document.head.appendChild(style);
}

/** Takes the style sheet back, and writes NOTHING when there is none. */
export function removeFullscreenStyle(document: Document): void {
  document.head.querySelector(FULLSCREEN_STYLE_SELECTOR)?.remove();
}
