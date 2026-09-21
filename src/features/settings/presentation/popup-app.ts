import { DEFAULT_SETTINGS, type SettingKey, type Settings } from '../domain/settings';
import type { SaveStatus } from './features-view';
import {
  createPopupStatusRegion,
  popupSettingSelector,
  renderPopup,
  renderPopupLoading,
  renderPopupUnreadable,
  writePopupStatus,
  type PopupCallbacks,
} from './popup-view';

/**
 * The window of the toolbar button, and everything it does. The whole state
 * lives here and nothing of it is stored: the window opens on what the
 * settings say every time, which is what a window that closes at the first
 * click outside it has to do.
 *
 * A save that fails shows what the storage holds and says so, because a switch
 * shown in a position that was not written would lie about what the site does.
 */

export interface PopupPorts {
  /**
   * The strict read of the settings: a failure must reach the window. Showing
   * the defaults instead would hand the next toggle switches nobody read, and
   * write them over the ones the user had saved.
   */
  readSettings: () => Promise<Settings>;
  writeSettings: (settings: Settings) => Promise<void>;
  /** Opens the options page, which holds what this window leaves out. */
  openOptions: () => void;
}

export function mountPopup(container: HTMLElement, ports: PopupPorts): void {
  let settings: Settings = DEFAULT_SETTINGS;
  /**
   * Bumped by every change of `settings`. A read back issued after a failed
   * save can land after the user has toggled something else: its answer is
   * then older than the window, and applying it would undo that toggle.
   */
  let settingsGeneration = 0;
  /** False until the settings have been read: the window shows nothing before. */
  let loaded = false;
  /** True when they could not be read at all: no switch may then be shown. */
  let settingsUnreadable = false;
  let saveStatus: SaveStatus = 'idle';
  /**
   * Control to focus once the next render is done, null when the render comes
   * from anything else than a user action. The window is rebuilt whole on
   * every render, so without this the focus would fall back to the document
   * after each toggle and the window could not be used with a keyboard alone.
   */
  let pendingFocus: string | null = null;

  const statusRegion = createPopupStatusRegion();
  /** The subtree the renders replace, the status region staying beside it. */
  const screenHost = document.createElement('div');

  /** The one place `settings` changes, so the counter cannot be forgotten. */
  function setSettings(next: Settings): void {
    settings = next;
    settingsGeneration += 1;
  }

  function currentScreen(): HTMLElement {
    if (!loaded) {
      return renderPopupLoading();
    }
    if (settingsUnreadable) {
      return renderPopupUnreadable(callbacks);
    }
    return renderPopup(settings, callbacks);
  }

  function render(): void {
    screenHost.replaceChildren(currentScreen());
    writePopupStatus(statusRegion, saveStatus);

    if (pendingFocus === null) {
      return;
    }
    container.querySelector<HTMLElement>(pendingFocus)?.focus();
    pendingFocus = null;
  }

  /**
   * Where the focus goes after an await, during which the user has had all the
   * time to move it. It is taken back only when nothing holds it, or when the
   * control aimed at holds it: the render about to run destroys that one.
   */
  function focusAfterWait(selector: string): void {
    const active = document.activeElement;
    const movedAway = active !== document.body && active !== container.querySelector(selector);
    pendingFocus = movedAway ? null : selector;
  }

  /**
   * What the window shows after a save that did not go through. Another save
   * may have gone through in the meantime, so the previous state is not what
   * the storage holds: it is read again rather than guessed. When even that
   * fails, only the switch concerned goes back.
   */
  async function recoverSettings(key: SettingKey, previous: Settings): Promise<Settings> {
    try {
      return await ports.readSettings();
    } catch {
      return { ...settings, [key]: previous[key] };
    }
  }

  async function save(key: SettingKey, previous: Settings, next: Settings): Promise<void> {
    try {
      await ports.writeSettings(next);
      saveStatus = 'saved';
    } catch {
      const generation = settingsGeneration;
      const recovered = await recoverSettings(key, previous);

      // The user may have toggled something else while that read was on its
      // way: the answer is then older than the window and is dropped.
      if (settingsGeneration === generation) {
        setSettings(recovered);
      }
      saveStatus = 'failed';
    }
    focusAfterWait(popupSettingSelector(key));
    render();
  }

  const callbacks: PopupCallbacks = {
    onToggleSetting(key: SettingKey): void {
      const previous = settings;
      const next: Settings = { ...previous };
      next[key] = !previous[key];

      setSettings(next);
      saveStatus = 'idle';
      pendingFocus = popupSettingSelector(key);
      render();
      void save(key, previous, next);
    },
    onOpenOptions(): void {
      ports.openOptions();
    },
  };

  async function load(): Promise<void> {
    try {
      setSettings(await ports.readSettings());
    } catch {
      // Nothing is known of what is stored, so nothing of it is drawn: boxes
      // shown at their default would be written over the saved ones by the
      // very next toggle.
      settingsUnreadable = true;
    }
    loaded = true;
    render();
  }

  container.replaceChildren(screenHost, statusRegion);
  render();
  void load();
}
