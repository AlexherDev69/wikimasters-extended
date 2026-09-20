import { DEFAULT_SETTINGS, type SettingKey, type Settings } from '../domain/settings';
import type { StorageStats } from '../domain/storage-stats';
import {
  createStatusRegion,
  settingSelector,
  writeStatus,
  type SaveStatus,
} from './features-view';
import {
  actionSelector,
  CACHE_ACTION,
  cancelSelector,
  type MaintenanceActionId,
} from './local-data-view';
import {
  renderOptions,
  renderOptionsLoading,
  renderOptionsUnreadable,
  type OptionsCallbacks,
} from './options-view';

/**
 * Where the focus goes when the control it was aimed at is not on the screen
 * the render has just built. The button of the categorization cache is drawn
 * by every render that holds any control at all.
 */
const FOCUS_FALLBACK = actionSelector(CACHE_ACTION);

/**
 * What the options page asks of the extension. Injected so that every screen
 * is testable without the extension runtime, and so that the page itself holds
 * no knowledge of the storage keys nor of the messages.
 */
export interface OptionsPorts {
  /**
   * The strict read of the settings: a failure must reach the page. Showing
   * the defaults instead would hand the next toggle four switches nobody read,
   * and write them over the ones the user had saved.
   */
  readSettings: () => Promise<Settings>;
  writeSettings: (settings: Settings) => Promise<void>;
  readStats: () => Promise<StorageStats>;
  clearCategorizationCache: () => Promise<void>;
  /** Removes what a previous version left of the collection index. */
  removeLegacyIndexData: () => Promise<void>;
}

/**
 * Draws the options page in `container` and keeps it in line with what the
 * user does. The whole state lives here and nothing of it is stored: the page
 * opens on what the settings and the counts say every time.
 *
 * A save that fails shows what the storage holds and says so, because a switch
 * shown in a position that was not written would lie about what the site does.
 */
export function mountOptions(container: HTMLElement, ports: OptionsPorts): void {
  let settings: Settings = DEFAULT_SETTINGS;
  /**
   * Bumped by every change of `settings`. A read back issued after a failed
   * save can land after the user has toggled something else: its answer is
   * then older than the screen, and applying it would undo that toggle.
   */
  let settingsGeneration = 0;
  /** False until the settings have been read: the page shows nothing before. */
  let loaded = false;
  /** True when they could not be read at all: no switch may then be shown. */
  let settingsUnreadable = false;
  let saveStatus: SaveStatus = 'idle';
  let stats: StorageStats | null = null;
  let statsFailed = false;
  /** The maintenance action whose last run failed, null when none did. */
  let clearFailed: MaintenanceActionId | null = null;
  /** The maintenance action waiting for its confirmation, null when none is. */
  let confirming: MaintenanceActionId | null = null;
  /**
   * Control to focus once the next render is done, null when the render comes
   * from anything else than a user action. The page is rebuilt whole on every
   * render, so without this the focus would fall back to the document after
   * each click and the page could not be used with a keyboard alone.
   */
  let pendingFocus: string | null = null;

  /**
   * Built once and never replaced: it is the only node of the page that is
   * outside the subtree every render rebuilds, because a live region has to be
   * in the tree before its text changes for it to be announced.
   */
  const statusRegion = createStatusRegion();
  /** The subtree the renders replace, the status region staying beside it. */
  const screenHost = document.createElement('div');

  /** The one place `settings` changes, so the counter cannot be forgotten. */
  function setSettings(next: Settings): void {
    settings = next;
    settingsGeneration += 1;
  }

  /**
   * Where the focus goes after an await, during which the user has had all the
   * time to move it. It is taken back only when nothing holds it, or when the
   * control aimed at holds it: the render about to run destroys that one.
   */
  function focusAfterWait(selector: string | null): void {
    if (selector === null) {
      pendingFocus = null;
      return;
    }
    const active = document.activeElement;
    const movedAway = active !== document.body && active !== container.querySelector(selector);
    pendingFocus = movedAway ? null : selector;
  }

  function currentScreen(): HTMLElement {
    if (!loaded) {
      return renderOptionsLoading();
    }
    if (settingsUnreadable) {
      return renderOptionsUnreadable();
    }
    return renderOptions(
      { settings, data: { stats, failed: statsFailed, clearFailed, confirming } },
      callbacks,
    );
  }

  function render(): void {
    screenHost.replaceChildren(currentScreen());
    writeStatus(statusRegion, saveStatus);

    // Nothing to focus when the render does not follow a move of the user: the
    // page opens where the browser put the focus and leaves it there.
    if (pendingFocus === null) {
      return;
    }
    // An action that runs once leaves the screen with the render that follows
    // it, so the control aimed at may no longer exist. The focus then goes to
    // the neighbour that is always there rather than falling back to the
    // document, which would strand a user who has only a keyboard.
    const aimedAt = container.querySelector<HTMLElement>(pendingFocus);
    (aimedAt ?? container.querySelector<HTMLElement>(FOCUS_FALLBACK))?.focus();
    pendingFocus = null;
  }

  async function loadStats(focus: string | null = null): Promise<void> {
    try {
      stats = await ports.readStats();
      statsFailed = false;
    } catch {
      // The reason is of no use to the user, and a stack trace even less.
      statsFailed = true;
    }
    focusAfterWait(focus);
    render();
  }

  /**
   * What the page shows after a save that did not go through. Another save may
   * have gone through in the meantime, so the previous state is not what the
   * storage holds: it is read again rather than guessed. When even that fails,
   * only the switch concerned goes back, and the others are left as they are.
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
      // way: the answer is then older than the screen and is dropped.
      if (settingsGeneration === generation) {
        setSettings(recovered);
      }
      saveStatus = 'failed';
    }
    focusAfterWait(settingSelector(key));
    render();
  }

  async function runClear(action: MaintenanceActionId): Promise<void> {
    const clear =
      action === 'categorization-cache'
        ? ports.clearCategorizationCache
        : ports.removeLegacyIndexData;

    try {
      await clear();
    } catch {
      clearFailed = action;
      // Back to the button that failed: the user is where the retry is.
      focusAfterWait(actionSelector(action));
      render();
      return;
    }
    // Only its own error goes away: the other action may have failed too, and
    // that failure is still true.
    if (clearFailed === action) {
      clearFailed = null;
    }
    // The counts are read again rather than set to zero here: the service
    // worker stays the only place that knows what the storage holds.
    await loadStats(actionSelector(action));
  }

  const callbacks: OptionsCallbacks = {
    onToggleSetting(key: SettingKey): void {
      const previous = settings;
      const next: Settings = { ...previous };
      next[key] = !previous[key];

      setSettings(next);
      saveStatus = 'idle';
      pendingFocus = settingSelector(key);
      render();
      void save(key, previous, next);
    },
    onAskClear(action: MaintenanceActionId): void {
      confirming = action;
      // The answer to a save the user has left behind: it says nothing about
      // the deletion they are starting, so it does not stay under it.
      saveStatus = 'idle';
      // The safe answer takes the focus: erasing must be a deliberate move,
      // never the next key stroke.
      pendingFocus = cancelSelector(action);
      render();
    },
    onConfirmClear(action: MaintenanceActionId): void {
      // The confirmation leaves the screen BEFORE the request goes out, so it
      // cannot be submitted a second time while the first one is in flight.
      confirming = null;
      if (clearFailed === action) {
        clearFailed = null;
      }
      // The counts stay on screen while the deletion is in flight: they are
      // still what the storage holds until it comes back.
      pendingFocus = actionSelector(action);
      render();
      void runClear(action);
    },
    onCancelClear(action: MaintenanceActionId): void {
      confirming = null;
      pendingFocus = actionSelector(action);
      render();
    },
  };

  async function load(): Promise<void> {
    try {
      setSettings(await ports.readSettings());
    } catch {
      // Nothing is known of what is stored, so nothing of it is drawn: four
      // boxes shown at their default would be written over the saved ones by
      // the very next toggle.
      settingsUnreadable = true;
    }
    loaded = true;
    render();

    // The counts belong to a section that is not on screen in that case.
    if (!settingsUnreadable) {
      await loadStats();
    }
  }

  // The status region is put in place once, beside the subtree the renders
  // replace, and never moves again.
  container.replaceChildren(screenHost, statusRegion);
  render();
  void load();
}
