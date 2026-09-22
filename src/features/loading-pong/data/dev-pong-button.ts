/**
 * DEVELOPMENT ONLY. A button on the page that makes the extension believe the
 * site is stuck loading, so the game can be looked at without waiting for the
 * site to actually hang.
 *
 * It tells no lie to the page: it only answers the one question the overlay
 * asks it, and the machinery that follows is the real one. The patience of
 * three seconds still runs, the game still starts through the same scan, and
 * a second press ends it through the same teardown. A shortcut straight to a
 * running game would show something the extension never does.
 *
 * Nothing of this reaches a release. It is mounted from the content script
 * behind `import.meta.env.DEV`, which Vite replaces by `false` in a
 * production build, so the branch goes and this module goes with it.
 *
 * Styled inline rather than from a style sheet, which is the one place this
 * file departs from the rest of the extension: a style sheet is copied into
 * the package whether its rules match anything or not, and a release has no
 * business carrying the look of a button it does not have. The values below
 * are constants of this file, never anything read from the page.
 */

const BUTTON_TAG = 'button';
const BUTTON_TYPE = 'button';

/** Marks the button, so a reload of the extension finds the one it left. */
const BUTTON_ATTRIBUTE = 'data-wme-dev-pong';
const BUTTON_SELECTOR = `[${BUTTON_ATTRIBUTE}]`;

const PRESSED_ATTRIBUTE = 'aria-pressed';
const TITLE_ATTRIBUTE = 'title';
const CLICK_EVENT = 'click';

const LABELS = { on: 'Pong : arrêter', off: 'Pong : lancer' } as const;

const TITLE =
  "Build de développement. Fait croire à l'extension que la page charge : la " +
  'partie arrive après la patience de trois secondes, et seulement si le ' +
  'réglage Pong est activé.';

/**
 * The look of the button, built INSIDE the function below and not beside it.
 * A joined array at the top level of a module is a call, and a call is not
 * something a bundler may assume does nothing: Rollup kept this very list in
 * the production package, 364 bytes of a button that is not there, while
 * dropping everything else of this file. Measured on the built script, which
 * is the only place a claim like this one can be checked.
 */
function styleOfTheButton(): string {
  return [
    'position: fixed',
    'left: 12px',
    'bottom: 12px',
    // Above the panel of the game, which sits at 40: a game already running
    // must never cover the button that stops it.
    'z-index: 41',
    'margin: 0',
    'padding: 6px 10px',
    'border: 1px solid rgba(52, 211, 153, 0.55)',
    'border-radius: 8px',
    'background-color: rgba(9, 12, 17, 0.92)',
    'color: rgba(255, 255, 255, 0.92)',
    'font: 500 12px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    'line-height: 1',
    'cursor: pointer',
  ].join('; ');
}

/** The button, once it is on the page. */
export interface DevPongSwitch {
  /**
   * True while the button is asking for a game, whatever the page shows. Read
   * by the overlay at every sync, beside what it reads off the page itself.
   */
  isForcing: () => boolean;
  /** Takes the button back, on the teardown of the content script. */
  remove: () => void;
}

/**
 * Puts the button on the page and returns the switch it drives. `requestSync`
 * is asked for on every press: the button writes on nothing but itself, and a
 * page that shows nothing at all is exactly the page this is for, so nothing
 * else would ever notice the press.
 */
export function mountDevPongButton(root: HTMLElement, requestSync: () => void): DevPongSwitch {
  // Reloading the extension leaves the page open, and the button of the run
  // before it standing on it.
  root.querySelector(BUTTON_SELECTOR)?.remove();

  let isForcing = false;
  const button = root.ownerDocument.createElement(BUTTON_TAG);

  button.type = BUTTON_TYPE;
  button.setAttribute(BUTTON_ATTRIBUTE, '');
  button.setAttribute(TITLE_ATTRIBUTE, TITLE);
  button.setAttribute(PRESSED_ATTRIBUTE, String(isForcing));
  button.style.cssText = styleOfTheButton();
  button.textContent = LABELS.off;

  button.addEventListener(CLICK_EVENT, (event) => {
    // Guards against a script dispatching a synthetic click on our own node:
    // only a click the user actually made may act on the page.
    if (!event.isTrusted) {
      return;
    }
    isForcing = !isForcing;
    button.setAttribute(PRESSED_ATTRIBUTE, String(isForcing));
    button.textContent = isForcing ? LABELS.on : LABELS.off;
    requestSync();
  });

  root.appendChild(button);

  return {
    isForcing: (): boolean => isForcing,
    remove: (): void => {
      button.remove();
    },
  };
}
