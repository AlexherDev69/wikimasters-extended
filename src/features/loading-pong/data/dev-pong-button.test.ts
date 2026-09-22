import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { mountDevPongButton, type DevPongSwitch } from './dev-pong-button';

const BUTTON_SELECTOR = '[data-wme-dev-pong]';

function button(): HTMLButtonElement | null {
  return document.body.querySelector<HTMLButtonElement>(BUTTON_SELECTOR);
}

/** A press the user actually made, which is the only kind that acts. */
function press(): void {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'isTrusted', { value: true });
  button()?.dispatchEvent(event);
}

describe('mountDevPongButton', () => {
  let requestSync: Mock<() => void>;
  let devPong: DevPongSwitch;

  beforeEach(() => {
    document.body.innerHTML = '';
    requestSync = vi.fn<() => void>();
    devPong = mountDevPongButton(document.body, requestSync);
  });

  it('should ask for nothing until it is pressed', () => {
    expect(devPong.isForcing()).toBe(false);
    expect(button()?.getAttribute('aria-pressed')).toBe('false');
  });

  it('should ask for a game once it is pressed', () => {
    press();

    expect(devPong.isForcing()).toBe(true);
    expect(button()?.getAttribute('aria-pressed')).toBe('true');
  });

  it('should stop asking for a game on a second press', () => {
    press();

    press();

    expect(devPong.isForcing()).toBe(false);
    expect(button()?.getAttribute('aria-pressed')).toBe('false');
  });

  it('should ask for a scan at every press', () => {
    // The button writes on nothing but itself, and the page this is for shows
    // nothing at all: without this, nothing would ever act on the press.
    press();
    press();

    expect(requestSync).toHaveBeenCalledTimes(2);
  });

  it('should say which of the two a press would do', () => {
    expect(button()?.textContent).toBe('Pong : lancer');

    press();

    expect(button()?.textContent).toBe('Pong : arrêter');
  });

  it('should ignore a click no user made', () => {
    // A script of the page dispatching a click on our own node must never
    // make the extension act on its behalf.
    button()?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(devPong.isForcing()).toBe(false);
    expect(requestSync).not.toHaveBeenCalled();
  });

  it('should leave the page as it was once it is taken back', () => {
    devPong.remove();

    expect(button()).toBeNull();
    expect(document.body.innerHTML).toBe('');
  });

  it('should leave no second button behind when the extension is reloaded', () => {
    // A reload leaves the page open, and the button of the run before it
    // standing on it with nothing left to drive it.
    const reloaded = mountDevPongButton(document.body, requestSync);

    expect(document.body.querySelectorAll(BUTTON_SELECTOR)).toHaveLength(1);
    expect(reloaded.isForcing()).toBe(false);
  });
});
