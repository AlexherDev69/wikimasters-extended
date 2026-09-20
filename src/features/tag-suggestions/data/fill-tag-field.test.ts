import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fillTagField, type FillTagFieldDeps } from './fill-tag-field';

const TAG = 'Footballeur';

function trustedClick(): MouseEvent {
  const event = new MouseEvent('click');
  Object.defineProperty(event, 'isTrusted', { value: true });
  return event;
}

/** A click as a script would raise it: `isTrusted` is false, as it always is for us too. */
function untrustedClick(): MouseEvent {
  return new MouseEvent('click');
}

function enabledDeps(): FillTagFieldDeps {
  return { isAutoFillEnabled: () => true };
}

function disabledDeps(): FillTagFieldDeps {
  return { isAutoFillEnabled: () => false };
}

/** Every event the input received, in the order it received them. */
function recordDispatchedEvents(input: HTMLInputElement): Event[] {
  const events: Event[] = [];
  for (const type of ['input', 'keydown', 'keyup']) {
    input.addEventListener(type, (event) => {
      events.push(event);
    });
  }
  return events;
}

describe('fillTagField', () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement('input');
    document.body.appendChild(input);
  });

  it('should write the tag through the native value setter when the click is trusted and the setting is on', () => {
    fillTagField(trustedClick(), input, TAG, enabledDeps());

    expect(input.value).toBe(TAG);
  });

  it('should focus the field before writing the value', () => {
    const focus = vi.spyOn(input, 'focus');

    fillTagField(trustedClick(), input, TAG, enabledDeps());

    expect(focus).toHaveBeenCalledOnce();
  });

  it('should fire input, keydown and keyup in that order, all bubbling', () => {
    const events = recordDispatchedEvents(input);

    fillTagField(trustedClick(), input, TAG, enabledDeps());

    expect(events.map((event) => event.type)).toEqual(['input', 'keydown', 'keyup']);
    expect(events.every((event) => event.bubbles)).toBe(true);
  });

  it('should carry the Enter key on both keyboard events, with the legacy keyCode and which', () => {
    const events = recordDispatchedEvents(input);

    fillTagField(trustedClick(), input, TAG, enabledDeps());

    const [, keydown, keyup] = events as [Event, KeyboardEvent, KeyboardEvent];
    for (const keyEvent of [keydown, keyup]) {
      expect(keyEvent.key).toBe('Enter');
      expect(keyEvent.code).toBe('Enter');
      expect(keyEvent.keyCode).toBe(13);
      expect(keyEvent.which).toBe(13);
      expect(keyEvent.cancelable).toBe(true);
    }
  });

  it('should do nothing when the click is not trusted', () => {
    const focus = vi.spyOn(input, 'focus');
    const events = recordDispatchedEvents(input);

    fillTagField(untrustedClick(), input, TAG, enabledDeps());

    expect(input.value).toBe('');
    expect(focus).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });

  it('should do nothing when the auto-fill setting is off', () => {
    const focus = vi.spyOn(input, 'focus');
    const events = recordDispatchedEvents(input);

    fillTagField(trustedClick(), input, TAG, disabledDeps());

    expect(input.value).toBe('');
    expect(focus).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });

  it('should read the setting again at call time rather than trust a snapshot', () => {
    let enabled = false;
    const deps: FillTagFieldDeps = { isAutoFillEnabled: () => enabled };

    fillTagField(trustedClick(), input, TAG, deps);
    expect(input.value).toBe('');

    enabled = true;
    fillTagField(trustedClick(), input, TAG, deps);
    expect(input.value).toBe(TAG);
  });

  it('should do nothing and throw nothing when the native setter is missing', () => {
    const descriptorSpy = vi.spyOn(Object, 'getOwnPropertyDescriptor').mockReturnValue(undefined);
    const focus = vi.spyOn(input, 'focus');
    const events = recordDispatchedEvents(input);

    expect(() => fillTagField(trustedClick(), input, TAG, enabledDeps())).not.toThrow();

    expect(input.value).toBe('');
    expect(focus).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
    descriptorSpy.mockRestore();
  });
});
