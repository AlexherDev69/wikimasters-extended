import type { Logger } from '../../../core/logger/logger';
import { CARD_ROOT_SELECTOR } from '../../card-detection/data/card-selectors';
import { fitZoom, type Size } from '../domain/fit-zoom';
import { CARD_ACTIONS_SELECTOR, FULLSCREEN_BUTTON_ATTRIBUTE } from './card-actions-selectors';
import { buildIcon, writeAttribute, type IconPath } from './card-action-parts';
import { removeFullscreenStyle, writeFullscreenStyle } from './fullscreen-style';

/**
 * The button of the bar that shows the card of the detail modal in full
 * screen.
 *
 * What goes in full screen is the column of the site that holds the card, and
 * not a copy of the card: a copy would be one more card on the page for the
 * scanner to read, and would lose everything the site keeps up to date on the
 * real one. The column is only handed to the Fullscreen API of the browser,
 * which writes no attribute, class, style or text on it, and our bar sits
 * inside it, so the same button is still there, in the corner of the screen,
 * to bring the card back.
 */

const BUTTON_TAG = 'button';
const BUTTON_TYPE = 'button';
const BUTTON_CLASS = 'wme-card-action';

/**
 * The two drawings of the button, four corners pointing out to enter and in
 * to leave. The style sheet shows the one that fits, from whether the bar
 * stands in the full screen: the state lives in the browser, not in a node.
 */
const ICON_PATHS: readonly IconPath[] = [
  { className: 'wme-fullscreen-enter', data: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5' },
  { className: 'wme-fullscreen-exit', data: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5' },
];

const LABELS = {
  enter: 'Afficher la carte en plein écran',
  exit: 'Quitter le plein écran',
} as const;

const ARIA_LABEL_ATTRIBUTE = 'aria-label';
const TITLE_ATTRIBUTE = 'title';
const CLICK_EVENT = 'click';
const FULLSCREEN_CHANGE_EVENT = 'fullscreenchange';

/** Says what a press does now. The observer of the page watches no attribute. */
function label(button: HTMLButtonElement, isFullscreen: boolean): void {
  const text = isFullscreen ? LABELS.exit : LABELS.enter;
  writeAttribute(button, ARIA_LABEL_ATTRIBUTE, text);
  writeAttribute(button, TITLE_ATTRIBUTE, text);
}

function sizeOf(element: HTMLElement): Size {
  return { width: element.clientWidth, height: element.clientHeight };
}

/**
 * Puts the column in full screen, and follows it until it leaves.
 *
 * The zoom is measured once the column fills the screen, from the column
 * itself: the screen of the browser, in the pixels of the page, whatever zoom
 * the reader browses at. The listener goes away with the full screen, which
 * the reader leaves by the button, by Escape, or by closing the modal, since
 * a node removed from the page takes its full screen with it.
 */
function enterFullscreen(button: HTMLButtonElement, column: HTMLElement, logger: Logger): void {
  const document = button.ownerDocument;
  const card = column.querySelector<HTMLElement>(`:scope > ${CARD_ROOT_SELECTOR}`);

  const onChange = (): void => {
    const isShown = document.fullscreenElement === column;
    label(button, isShown);
    if (isShown) {
      const cardSize: Size = card === null ? { width: 0, height: 0 } : sizeOf(card);
      writeFullscreenStyle(document, fitZoom(sizeOf(column), cardSize));
      return;
    }
    removeFullscreenStyle(document);
    document.removeEventListener(FULLSCREEN_CHANGE_EVENT, onChange);
  };

  document.addEventListener(FULLSCREEN_CHANGE_EVENT, onChange);
  column.requestFullscreen().catch((error: unknown) => {
    document.removeEventListener(FULLSCREEN_CHANGE_EVENT, onChange);
    logger.warn('The card could not be shown in full screen', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export function buildFullscreenButton(document: Document, logger: Logger): HTMLButtonElement {
  const button = document.createElement(BUTTON_TAG);
  button.type = BUTTON_TYPE;
  button.className = BUTTON_CLASS;
  button.setAttribute(FULLSCREEN_BUTTON_ATTRIBUTE, '');
  label(button, false);
  button.appendChild(buildIcon(document, ICON_PATHS));

  button.addEventListener(CLICK_EVENT, (event) => {
    // Only a click the user actually made may act on the page, and the
    // browser grants the full screen to nothing else anyway.
    if (!event.isTrusted) {
      return;
    }
    if (document.fullscreenElement !== null) {
      void document.exitFullscreen();
      return;
    }
    const column = button.closest(CARD_ACTIONS_SELECTOR)?.parentElement ?? null;
    if (column !== null) {
      enterFullscreen(button, column, logger);
    }
  });
  return button;
}

/**
 * Brings `column` out of full screen when it is in it, and does nothing
 * otherwise: the reader must never be left with a full screen that nothing of
 * ours can close any more.
 */
export function leaveFullscreen(column: Element): void {
  if (column.ownerDocument.fullscreenElement === column) {
    void column.ownerDocument.exitFullscreen();
  }
}
