import type { Logger } from '../../../core/logger/logger';
import { CARD_ROOT_SELECTOR } from '../../card-detection/data/card-selectors';
import { CARD_ACTIONS_SELECTOR, COPY_BUTTON_ATTRIBUTE } from './card-actions-selectors';
import { buildIcon, writeAttribute, type IconPath } from './card-action-parts';
import { snapshotCard } from './card-snapshot';

/**
 * The button of the bar that copies the card of the detail modal to the
 * clipboard, as a picture ready to paste in a conversation.
 *
 * It reads the card and writes to the clipboard, which the browser only
 * allows on a click the user made: nothing reaches the clipboard without one.
 */

const BUTTON_TAG = 'button';
const BUTTON_TYPE = 'button';
const BUTTON_CLASS = 'wme-card-action';
const PNG_TYPE = 'image/png';

/** A sheet over a sheet to copy, then the outcome of the last press. */
const ICON_PATHS: readonly IconPath[] = [
  { className: 'wme-copy-idle', data: 'M9 9h11v11H9zM5 15H4V4h11v1' },
  { className: 'wme-copy-done', data: 'M5 12l5 5L20 7' },
  { className: 'wme-copy-failed', data: 'M6 6l12 12M18 6L6 18' },
];

type CopyOutcome = 'done' | 'failed';

const LABELS = {
  idle: "Copier l'image de la carte",
  done: 'Carte copiée',
  failed: "La carte n'a pas pu être copiée",
} as const;

/**
 * How long the outcome of a press stays on the button before it reads as a
 * button again: long enough to be seen, short enough not to mislead a second
 * press.
 */
const OUTCOME_DISPLAY_MS = 2000;

/** The outcome, read by the style sheet to draw the matching icon. */
const OUTCOME_ATTRIBUTE = 'data-wme-copy-outcome';
const ARIA_LABEL_ATTRIBUTE = 'aria-label';
const TITLE_ATTRIBUTE = 'title';
const CLICK_EVENT = 'click';

export interface CopyButtonDeps {
  logger: Logger;
  /** Arms the return of the button to rest, on a timer that dies with the page script. */
  schedule: (callback: () => void, delayMs: number) => void;
}

function label(button: HTMLButtonElement, text: string): void {
  writeAttribute(button, ARIA_LABEL_ATTRIBUTE, text);
  writeAttribute(button, TITLE_ATTRIBUTE, text);
}

/**
 * Shows the outcome of a press for a moment. Written as attributes only: the
 * observer of the page watches none, so this costs no scan.
 */
function showOutcome(button: HTMLButtonElement, outcome: CopyOutcome, deps: CopyButtonDeps): void {
  writeAttribute(button, OUTCOME_ATTRIBUTE, outcome);
  label(button, LABELS[outcome]);
  deps.schedule(() => {
    // A later press may have written its own outcome since: that one is
    // left to its own timer.
    if (button.getAttribute(OUTCOME_ATTRIBUTE) === outcome) {
      button.removeAttribute(OUTCOME_ATTRIBUTE);
      label(button, LABELS.idle);
    }
  }, OUTCOME_DISPLAY_MS);
}

/** The card beside the bar, which is the card the button copies. */
function cardBeside(button: HTMLButtonElement): HTMLElement | null {
  const column = button.closest(CARD_ACTIONS_SELECTOR)?.parentElement ?? null;
  return column?.querySelector<HTMLElement>(`:scope > ${CARD_ROOT_SELECTOR}`) ?? null;
}

/**
 * Hands the clipboard a picture still being drawn. The write is asked for at
 * once, while the click still counts as the user's: drawing the card takes
 * longer than the browser keeps that permission, and the clipboard accepts a
 * promise of the picture for exactly this reason.
 */
function copyCard(button: HTMLButtonElement, card: HTMLElement, deps: CopyButtonDeps): void {
  const item = new ClipboardItem({ [PNG_TYPE]: snapshotCard(card) });

  navigator.clipboard.write([item]).then(
    () => {
      showOutcome(button, 'done', deps);
    },
    (error: unknown) => {
      showOutcome(button, 'failed', deps);
      deps.logger.warn('The card could not be copied', {
        error: error instanceof Error ? error.message : String(error),
      });
    },
  );
}

export function buildCopyButton(document: Document, deps: CopyButtonDeps): HTMLButtonElement {
  const button = document.createElement(BUTTON_TAG);
  button.type = BUTTON_TYPE;
  button.className = BUTTON_CLASS;
  button.setAttribute(COPY_BUTTON_ATTRIBUTE, '');
  label(button, LABELS.idle);
  button.appendChild(buildIcon(document, ICON_PATHS));

  button.addEventListener(CLICK_EVENT, (event) => {
    // Only a click the user actually made may act, and the browser opens the
    // clipboard to nothing else anyway.
    if (!event.isTrusted) {
      return;
    }
    const card = cardBeside(button);
    if (card !== null) {
      copyCard(button, card, deps);
    }
  });
  return button;
}
