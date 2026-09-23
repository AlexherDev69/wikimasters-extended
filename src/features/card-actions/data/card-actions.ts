import type { Logger } from '../../../core/logger/logger';
import type { DetailModal } from '../../card-detection/data/detail-modal';
import {
  CARD_ACTIONS_ATTRIBUTE,
  CARD_ACTIONS_SELECTOR,
  COPY_BUTTON_SELECTOR,
  FULLSCREEN_BUTTON_SELECTOR,
} from './card-actions-selectors';
import { buildCopyButton } from './copy-button';
import { buildFullscreenButton, leaveFullscreen } from './fullscreen-button';

/**
 * The bar of buttons this feature adds right beside the card of the detail
 * modal: one to show the card in full screen, one to copy it as a picture.
 *
 * The column that holds the card is a flex row, so the bar stands to the
 * right of the card and stacks its buttons down from the top of it. Only our
 * own nodes are created: the column is read and used as a place to stand in,
 * and not one of its attributes, classes or styles is touched.
 */

const BAR_TAG = 'div';
const BAR_CLASS = 'wme-card-actions';

/** The buttons of the bar, in the order they are stacked. */
const ACTIONS = ['fullscreen', 'copy'] as const;

type CardAction = (typeof ACTIONS)[number];

/** Which buttons the settings ask for. */
export type CardActionsWanted = Record<CardAction, boolean>;

export interface CardActionsDeps {
  logger: Logger;
  /** Arms a timer that dies with the content script, for the feedback of a copy. */
  schedule: (callback: () => void, delayMs: number) => void;
}

const ACTION_SELECTORS: Record<CardAction, string> = {
  fullscreen: FULLSCREEN_BUTTON_SELECTOR,
  copy: COPY_BUTTON_SELECTOR,
};

function buildAction(document: Document, action: CardAction, deps: CardActionsDeps): Element {
  return action === 'fullscreen'
    ? buildFullscreenButton(document, deps.logger)
    : buildCopyButton(document, deps);
}

/** True while the bar holds exactly `actions`, in their order, and nothing else. */
function holdsExactly(bar: Element, actions: readonly CardAction[]): boolean {
  const children = [...bar.children];
  return (
    children.length === actions.length &&
    actions.every((action, index) => children[index]?.matches(ACTION_SELECTORS[action]) === true)
  );
}

/** Takes one bar back, bringing its column out of full screen first. */
function removeBar(bar: Element): void {
  const column = bar.parentElement;
  if (column !== null) {
    leaveFullscreen(column);
  }
  bar.remove();
}

/**
 * Brings the bar beside the card of the modal in line with `wanted`, and
 * writes NOTHING when it already is. The content script observes
 * document.body, so every write of ours schedules another scan, which syncs
 * again: a sync that always wrote would never stop.
 *
 * `modal` is null when no detail modal is open, and nothing is done then: the
 * bar of a modal the site has closed went away with it.
 */
export function applyCardActions(
  modal: DetailModal | null,
  wanted: CardActionsWanted,
  deps: CardActionsDeps,
): void {
  if (modal === null) {
    return;
  }
  const column = modal.cardRoot?.parentElement ?? null;
  const ourBar = modal.root.querySelector(CARD_ACTIONS_SELECTOR);
  const actions = ACTIONS.filter((action) => wanted[action]);

  // No readable card, the site reusing the modal for the next one, or no
  // button asked for: a bar left behind would act on whatever comes next.
  if (column === null || actions.length === 0) {
    if (ourBar !== null) {
      removeBar(ourBar);
    }
    return;
  }
  if (ourBar !== null && ourBar.parentElement === column && holdsExactly(ourBar, actions)) {
    return;
  }
  if (ourBar !== null) {
    removeBar(ourBar);
  }
  const document = column.ownerDocument;
  const bar = document.createElement(BAR_TAG);
  bar.className = BAR_CLASS;
  bar.setAttribute(CARD_ACTIONS_ATTRIBUTE, '');
  for (const action of actions) {
    bar.appendChild(buildAction(document, action, deps));
  }
  column.appendChild(bar);
}

/** Takes back every bar of this feature, and nothing else. */
export function removeCardActions(root: ParentNode): void {
  for (const bar of root.querySelectorAll(CARD_ACTIONS_SELECTOR)) {
    removeBar(bar);
  }
}
