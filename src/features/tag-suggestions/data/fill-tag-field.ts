/**
 * THIS IS THE ONLY FILE IN THE WHOLE EXTENSION THAT WRITES ON A NODE OF THE
 * SITE. Every other feature only ever adds, updates or removes a node of its
 * own; this one function instead fills the tag field the site itself renders,
 * because the user asked for a click on a proposal to add the tag. Isolating
 * every write in this single file is deliberate: it is the one place a
 * reviewer, or the user, has to read to see everything this extension ever
 * changes on wiki-masters.com itself. See README.md for the rule of the site
 * this crosses and the setting that gates it.
 *
 * It runs only from a real click of the user (`event.isTrusted`) and only
 * while the `tagAutoFill` setting is on, both re-checked here rather than
 * trusted from the caller: this function is the last line of defense before a
 * write on the site, so it enforces its own guards instead of assuming
 * whoever dispatched the click already did.
 */

const INPUT_EVENT = 'input';
const KEY_DOWN_EVENT = 'keydown';
const KEY_UP_EVENT = 'keyup';
const ENTER_KEY = 'Enter';
const ENTER_KEY_CODE = 13;

const VALUE_PROPERTY = 'value';
const KEY_CODE_PROPERTY = 'keyCode';
const WHICH_PROPERTY = 'which';

export interface FillTagFieldDeps {
  /** Read again at click time, never captured when the button was built. */
  isAutoFillEnabled: () => boolean;
}

/**
 * The native setter of `HTMLInputElement.value`, the one a React controlled
 * input still listens to: a plain `input.value = ...` assignment is
 * intercepted by React's own descriptor and never reaches the DOM the site
 * actually reads back. Undefined when the platform does not expose it, which
 * this function then degrades from silently rather than guessing another way
 * to write the value.
 */
function nativeValueSetter(): ((value: string) => void) | undefined {
  return Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, VALUE_PROPERTY)?.set;
}

/**
 * A keyboard event for the Enter key, carrying the legacy `keyCode` and
 * `which` the modern constructor has no init option for: both are read-only
 * accessors on KeyboardEvent.prototype, so they are defined on the instance
 * instead of assigned, which would throw under strict mode.
 */
function createEnterKeyEvent(type: string): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    key: ENTER_KEY,
    code: ENTER_KEY,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, KEY_CODE_PROPERTY, { value: ENTER_KEY_CODE, configurable: true });
  Object.defineProperty(event, WHICH_PROPERTY, { value: ENTER_KEY_CODE, configurable: true });
  return event;
}

/**
 * Writes `tag` into the site's own tag field and validates it exactly as
 * typing it and pressing Enter would: focuses the field, writes through the
 * native value setter so the site's controlled input notices the change,
 * then fires `input`, `keydown` and `keyup` for Enter, in that order. Nothing
 * else: no click on a site node, no synthetic mouse event, no attribute,
 * class or style changed on it, and the field is never cleared.
 *
 * The extension never reads the site's answer, so it never fakes a
 * confirmation either: the proposal this button belongs to simply disappears
 * on the next sync if the tag really landed, and stays otherwise.
 */
export function fillTagField(
  event: MouseEvent,
  input: HTMLInputElement,
  tag: string,
  deps: FillTagFieldDeps,
): void {
  if (!event.isTrusted || !deps.isAutoFillEnabled()) {
    return;
  }

  const setValue = nativeValueSetter();
  if (setValue === undefined) {
    return;
  }

  input.focus();
  setValue.call(input, tag);
  input.dispatchEvent(new Event(INPUT_EVENT, { bubbles: true }));
  input.dispatchEvent(createEnterKeyEvent(KEY_DOWN_EVENT));
  input.dispatchEvent(createEnterKeyEvent(KEY_UP_EVENT));
}
