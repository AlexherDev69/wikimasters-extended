import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_SETTINGS, SETTING_KEYS, type Settings } from '../domain/settings';
import { mountPopup, type PopupPorts } from './popup-app';
import { popupSettingSelector, POPUP_OPTIONS_SELECTOR } from './popup-view';

const IMAGES_CHECKBOX = popupSettingSelector('missingImages');
const LETTERBOXD_CHECKBOX = popupSettingSelector('letterboxdLink');

const STATUS_SELECTOR = '.wme-popup-status';
const MESSAGE_SELECTOR = '.wme-popup-message';

function makePorts(overrides: Partial<PopupPorts> = {}): PopupPorts {
  return {
    readSettings: (): Promise<Settings> => Promise.resolve(DEFAULT_SETTINGS),
    writeSettings: (): Promise<void> => Promise.resolve(),
    openOptions: (): void => undefined,
    ...overrides,
  };
}

function makeContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

function checkbox(container: HTMLElement, selector: string): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>(selector);
}

function status(container: HTMLElement): string {
  return container.querySelector(STATUS_SELECTOR)?.textContent ?? '';
}

/** Mounts the window and waits for the first render that holds the switches. */
async function mount(ports: PopupPorts = makePorts()): Promise<HTMLElement> {
  const container = makeContainer();
  mountPopup(container, ports);
  await vi.waitFor(() => {
    expect(container.querySelector(IMAGES_CHECKBOX)).not.toBeNull();
  });
  return container;
}

describe('mountPopup', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('should show one switch per setting, each matching its default', async () => {
    const container = await mount();

    expect(container.querySelectorAll('input[data-wme-setting]')).toHaveLength(
      SETTING_KEYS.length,
    );
    for (const key of SETTING_KEYS) {
      expect(checkbox(container, popupSettingSelector(key))?.checked).toBe(DEFAULT_SETTINGS[key]);
    }
  });

  it('should show a switch off when the settings say so', async () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, missingImages: false };

    const container = await mount(makePorts({ readSettings: () => Promise.resolve(settings) }));

    expect(checkbox(container, IMAGES_CHECKBOX)?.checked).toBe(false);
  });

  it('should show no switch at all when the settings cannot be read', async () => {
    const container = makeContainer();

    mountPopup(
      container,
      makePorts({ readSettings: () => Promise.reject(new Error('storage down')) }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(MESSAGE_SELECTOR)?.textContent).toContain(
        "n'ont pas pu être lus",
      );
    });
    // A switch drawn at its default would be written over the saved ones by
    // the very next toggle, so none is drawn at all.
    expect(container.querySelector(IMAGES_CHECKBOX)).toBeNull();
  });

  it('should still offer the options page when the settings cannot be read', async () => {
    const container = makeContainer();

    mountPopup(
      container,
      makePorts({ readSettings: () => Promise.reject(new Error('storage down')) }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(MESSAGE_SELECTOR)).not.toBeNull();
    });
    expect(container.querySelector(POPUP_OPTIONS_SELECTOR)).not.toBeNull();
  });

  it('should write the settings and confirm it when a switch is toggled', async () => {
    const writeSettings = vi.fn(() => Promise.resolve());
    const container = await mount(makePorts({ writeSettings }));

    checkbox(container, IMAGES_CHECKBOX)?.click();

    expect(writeSettings).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, missingImages: false });
    await vi.waitFor(() => {
      expect(status(container)).toBe('Enregistré');
    });
    expect(checkbox(container, IMAGES_CHECKBOX)?.checked).toBe(false);
  });

  it('should announce the save in a live region that was already in the tree', async () => {
    const container = await mount();
    const region = container.querySelector(STATUS_SELECTOR);

    checkbox(container, IMAGES_CHECKBOX)?.click();
    await vi.waitFor(() => {
      expect(status(container)).toBe('Enregistré');
    });

    // The same node all along: a region inserted with its text already in it
    // is announced by nothing.
    expect(container.querySelector(STATUS_SELECTOR)).toBe(region);
  });

  it('should put the switch back and say so when the save fails', async () => {
    const container = await mount(
      makePorts({ writeSettings: () => Promise.reject(new Error('quota')) }),
    );

    checkbox(container, IMAGES_CHECKBOX)?.click();

    await vi.waitFor(() => {
      expect(status(container)).toContain("n'a pas pu être enregistré");
    });
    // What the storage holds, read again rather than guessed.
    expect(checkbox(container, IMAGES_CHECKBOX)?.checked).toBe(true);
  });

  it('should keep the other switches of the read back when a save fails', async () => {
    const stored: Settings = { ...DEFAULT_SETTINGS, letterboxdLink: false };
    const container = await mount(
      makePorts({
        readSettings: () => Promise.resolve(stored),
        writeSettings: () => Promise.reject(new Error('quota')),
      }),
    );

    checkbox(container, IMAGES_CHECKBOX)?.click();

    await vi.waitFor(() => {
      expect(status(container)).toContain("n'a pas pu être enregistré");
    });
    expect(checkbox(container, LETTERBOXD_CHECKBOX)?.checked).toBe(false);
  });

  it('should put back only the switch concerned when the read back fails too', async () => {
    let firstRead = true;
    const container = await mount(
      makePorts({
        readSettings: (): Promise<Settings> => {
          if (firstRead) {
            firstRead = false;
            return Promise.resolve(DEFAULT_SETTINGS);
          }
          return Promise.reject(new Error('storage down'));
        },
        writeSettings: () => Promise.reject(new Error('quota')),
      }),
    );

    checkbox(container, IMAGES_CHECKBOX)?.click();

    await vi.waitFor(() => {
      expect(status(container)).toContain("n'a pas pu être enregistré");
    });
    expect(checkbox(container, IMAGES_CHECKBOX)?.checked).toBe(true);
    expect(checkbox(container, LETTERBOXD_CHECKBOX)?.checked).toBe(true);
  });

  it('should keep the focus on the switch that was toggled', async () => {
    const container = await mount();

    checkbox(container, IMAGES_CHECKBOX)?.click();
    await vi.waitFor(() => {
      expect(status(container)).toBe('Enregistré');
    });

    // The window is rebuilt whole on every render, so without this the focus
    // would fall to the document and the keyboard would lose its place.
    expect(document.activeElement).toBe(checkbox(container, IMAGES_CHECKBOX));
  });

  it('should open the options page when its button is pressed', async () => {
    const openOptions = vi.fn();
    const container = await mount(makePorts({ openOptions }));

    container.querySelector<HTMLButtonElement>(POPUP_OPTIONS_SELECTOR)?.click();

    expect(openOptions).toHaveBeenCalledOnce();
  });

  it('should show nothing of the settings before they have been read', () => {
    const container = makeContainer();

    mountPopup(container, makePorts({ readSettings: () => new Promise<Settings>(() => undefined) }));

    // A switch shown at a position nobody read is a switch that lies.
    expect(container.querySelector(IMAGES_CHECKBOX)).toBeNull();
    expect(container.querySelector(MESSAGE_SELECTOR)?.textContent).toContain('Chargement');
  });
});
