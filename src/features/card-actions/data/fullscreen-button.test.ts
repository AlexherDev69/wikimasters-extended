import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
  cardOf,
  columnOf,
  makeLogger,
  openModal,
  queryButton,
  stubFullscreen,
  userClick,
  type FullscreenStub,
} from '../../../../tests/helpers/card-actions-harness';
import type { Logger } from '../../../core/logger/logger';
import type { DetailModal } from '../../card-detection/data/detail-modal';
import { applyCardActions } from './card-actions';
import { FULLSCREEN_BUTTON_SELECTOR, FULLSCREEN_STYLE_SELECTOR } from './card-actions-selectors';

/** A 1080p screen, and the card of the modal as the site draws it. */
const SCREEN = { width: 1920, height: 1080 };
const CARD = { width: 288, height: 420 };

const ENTER_LABEL = 'Afficher la carte en plein écran';
const EXIT_LABEL = 'Quitter le plein écran';

function mountButton(modal: DetailModal, logger: Logger = makeLogger()): HTMLButtonElement {
  applyCardActions(modal, { fullscreen: true, copy: false }, { logger, schedule: vi.fn() });
  return queryButton(FULLSCREEN_BUTTON_SELECTOR);
}

function setSize(element: Element, size: { width: number; height: number }): void {
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: size.width });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: size.height });
}

/** Lets the column answer a request for full screen the way the browser would. */
function stubRequest(column: HTMLElement, result: () => Promise<void>): Mock<() => Promise<void>> {
  const request = vi.fn(result);
  Object.defineProperty(column, 'requestFullscreen', { configurable: true, value: request });
  return request;
}

function fullscreenStyle(): Element | null {
  return document.head.querySelector(FULLSCREEN_STYLE_SELECTOR);
}

describe('the full screen button', () => {
  let fullscreen: FullscreenStub;

  beforeEach(() => {
    document.head.innerHTML = '';
    fullscreen = stubFullscreen();
  });

  afterEach(() => {
    // Leaves no listener of a test waiting for the full screen of the next.
    fullscreen.become(null);
    fullscreen.restore();
  });

  it('should say what it does before any press', () => {
    const button = mountButton(openModal());

    expect(button.getAttribute('aria-label')).toBe(ENTER_LABEL);
  });

  it('should put the column of the card in full screen when the user clicks', () => {
    const modal = openModal();
    const request = stubRequest(columnOf(modal), () => Promise.resolve());

    userClick(mountButton(modal));

    expect(request).toHaveBeenCalledOnce();
  });

  it('should ignore a click raised by a script', () => {
    const modal = openModal();
    const request = stubRequest(columnOf(modal), () => Promise.resolve());

    mountButton(modal).dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(request).not.toHaveBeenCalled();
  });

  it('should zoom the card to the screen and offer the way out once the column fills it', () => {
    const modal = openModal();
    const column = columnOf(modal);
    stubRequest(column, () => Promise.resolve());
    const button = mountButton(modal);
    userClick(button);
    setSize(column, SCREEN);
    setSize(cardOf(modal), CARD);

    fullscreen.become(column);

    // The height is the side that runs out first: 1080 * 0.9 / 420.
    expect(fullscreenStyle()?.textContent).toContain(`zoom: ${String((1080 * 0.9) / 420)};`);
    expect(button.getAttribute('aria-label')).toBe(EXIT_LABEL);
  });

  it('should take the style back and stop following once the full screen ends', () => {
    const modal = openModal();
    const column = columnOf(modal);
    stubRequest(column, () => Promise.resolve());
    const button = mountButton(modal);
    userClick(button);
    fullscreen.become(column);

    fullscreen.become(null);

    expect(fullscreenStyle()).toBeNull();
    expect(button.getAttribute('aria-label')).toBe(ENTER_LABEL);
    // Nothing listens any more: a full screen the button did not ask for
    // writes nothing of ours.
    fullscreen.become(column);
    expect(fullscreenStyle()).toBeNull();
  });

  it('should leave the full screen, and ask for none, when clicked while it lasts', () => {
    const modal = openModal();
    const column = columnOf(modal);
    const request = stubRequest(column, () => Promise.resolve());
    const button = mountButton(modal);
    fullscreen.set(column);

    userClick(button);

    expect(fullscreen.exit).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
  });

  it('should say so and stop following when the browser refuses the full screen', async () => {
    const modal = openModal();
    const column = columnOf(modal);
    const logger = makeLogger();
    stubRequest(column, () => Promise.reject(new Error('Permissions check failed')));

    userClick(mountButton(modal, logger));

    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith('The card could not be shown in full screen', {
        error: 'Permissions check failed',
      });
    });
    fullscreen.become(column);
    expect(fullscreenStyle()).toBeNull();
  });
});
