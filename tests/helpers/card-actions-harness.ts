/**
 * The detail modal of the site with the bar of the card actions in it, and
 * the full screen of the browser, which happy-dom does not have: shared by
 * the tests of the bar and of each of its buttons.
 */

import { vi, type Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from '../../src/core/logger/logger';
import {
  findDetailModal,
  type DetailModal,
} from '../../src/features/card-detection/data/detail-modal';

export const MODAL_HTML = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../fixtures/card-detail-modal.html'),
  'utf-8',
);

export function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

export function openModal(): DetailModal {
  document.body.innerHTML = MODAL_HTML;
  const modal = findDetailModal(document.body);
  if (modal === null) {
    throw new Error('The fixture holds no detail modal');
  }
  return modal;
}

export function cardOf(modal: DetailModal): HTMLElement {
  if (modal.cardRoot === null) {
    throw new Error('The modal shows no readable card');
  }
  return modal.cardRoot;
}

/** The column of the modal holding the card, where the bar stands. */
export function columnOf(modal: DetailModal): HTMLElement {
  const column = cardOf(modal).parentElement;
  if (column === null) {
    throw new Error('The card of the modal has no column');
  }
  return column;
}

/** A click dispatched the way the user does: `isTrusted` is set by the browser. */
export function userClick(target: Element): void {
  const event = new MouseEvent('click', { bubbles: true });
  Object.defineProperty(event, 'isTrusted', { value: true });
  target.dispatchEvent(event);
}

export function queryButton(selector: string): HTMLButtonElement {
  const button = document.body.querySelector<HTMLButtonElement>(selector);
  if (button === null) {
    throw new Error(`No button matches ${selector}`);
  }
  return button;
}

/** The full screen of the browser, as each test drives it. */
export interface FullscreenStub {
  /** Sets what the document says is in full screen, and says so as the browser does. */
  become: (element: Element | null) => void;
  /** Sets it without a word, for a state the test starts from. */
  set: (element: Element | null) => void;
  exit: Mock<() => Promise<void>>;
  restore: () => void;
}

export function stubFullscreen(): FullscreenStub {
  let current: Element | null = null;
  const exit = vi.fn(() => Promise.resolve());
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => current,
  });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });

  return {
    become(element): void {
      current = element;
      document.dispatchEvent(new Event('fullscreenchange'));
    },
    set(element): void {
      current = element;
    },
    exit,
    restore(): void {
      Reflect.deleteProperty(document, 'fullscreenElement');
      Reflect.deleteProperty(document, 'exitFullscreen');
    },
  };
}
