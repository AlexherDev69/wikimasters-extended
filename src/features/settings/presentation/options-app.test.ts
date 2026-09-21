import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SETTINGS, SETTING_KEYS, type Settings } from '../domain/settings';
import type { StorageStats } from '../domain/storage-stats';
import { mountOptions, type OptionsPorts } from './options-app';
import { settingSelector } from './features-view';

const PRESENTATION_DIR = dirname(fileURLToPath(import.meta.url));

const CORE_DOM_DIR = join(PRESENTATION_DIR, '../../../core/dom');

/** An installation upgraded from the version that still had the index. */
const STATS: StorageStats = {
  cardFacts: 12,
  classTargets: 4,
  thumbnailUrls: 7,
  hasLegacyIndexData: true,
};

/** The caches emptied, the keys of the old index still there. */
const EMPTY_STATS: StorageStats = {
  cardFacts: 0,
  classTargets: 0,
  thumbnailUrls: 0,
  hasLegacyIndexData: true,
};

/** What the counts say once the old index data has been removed. */
const CLEANED_STATS: StorageStats = { ...STATS, hasLegacyIndexData: false };

const IMAGES_CHECKBOX = 'input[data-wme-setting="missingImages"]';
const LETTERBOXD_CHECKBOX = 'input[data-wme-setting="letterboxdLink"]';
const CACHE_BUTTON = 'button[data-wme-action="categorization-cache"]';
const CACHE_CONFIRM = 'button[data-wme-confirm="categorization-cache"]';
const CACHE_CANCEL = 'button[data-wme-cancel="categorization-cache"]';
const LEGACY_BUTTON = 'button[data-wme-action="legacy-index-data"]';
const LEGACY_CONFIRM = 'button[data-wme-confirm="legacy-index-data"]';

function makePorts(overrides: Partial<OptionsPorts> = {}): OptionsPorts {
  return {
    readSettings: (): Promise<Settings> => Promise.resolve(DEFAULT_SETTINGS),
    writeSettings: (): Promise<void> => Promise.resolve(),
    readStats: (): Promise<StorageStats> => Promise.resolve(STATS),
    clearCategorizationCache: (): Promise<void> => Promise.resolve(),
    removeLegacyIndexData: (): Promise<void> => Promise.resolve(),
    ...overrides,
  };
}

function makeContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

function click(container: HTMLElement, selector: string): void {
  container.querySelector<HTMLButtonElement>(selector)?.click();
}

function checkbox(container: HTMLElement, selector: string): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>(selector);
}

function statCounts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.wme-stat-count')].map((node) => node.textContent ?? '');
}

/** Mounts the page and waits for the first render that holds the switches. */
async function mount(ports: OptionsPorts = makePorts()): Promise<HTMLElement> {
  const container = makeContainer();
  mountOptions(container, ports);
  await vi.waitFor(() => {
    expect(container.querySelector(IMAGES_CHECKBOX)).not.toBeNull();
  });
  return container;
}

describe('mountOptions', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('should show one switch per setting, each matching its default', async () => {
    const container = await mount();

    expect([...container.querySelectorAll<HTMLInputElement>('input[data-wme-setting]')]).toHaveLength(
      SETTING_KEYS.length,
    );
    for (const key of SETTING_KEYS) {
      expect(checkbox(container, settingSelector(key))?.checked).toBe(DEFAULT_SETTINGS[key]);
    }
  });

  it('should show a switch off when the settings say so', async () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, missingImages: false };

    const container = await mount(makePorts({ readSettings: () => Promise.resolve(settings) }));

    expect(checkbox(container, IMAGES_CHECKBOX)?.checked).toBe(false);
  });

  it('should show no switch at all when the settings cannot be read', async () => {
    const readStats = vi.fn(() => Promise.resolve(STATS));
    const container = makeContainer();

    mountOptions(container, {
      ...makePorts({ readStats }),
      readSettings: () => Promise.reject(new Error('storage down')),
    });

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-message')?.textContent).toContain(
        "n'ont pas pu être lus",
      );
    });
    // A switch drawn at its default would be written over the saved ones by
    // the very next toggle, so none is drawn and nothing is counted either.
    expect(container.querySelector(IMAGES_CHECKBOX)).toBeNull();
    expect(container.querySelector(CACHE_BUTTON)).toBeNull();
    expect(readStats).not.toHaveBeenCalled();
  });

  it('should write the settings and confirm it when a switch is toggled', async () => {
    const writeSettings = vi.fn(() => Promise.resolve());
    const container = await mount(makePorts({ writeSettings }));

    checkbox(container, IMAGES_CHECKBOX)?.click();

    expect(writeSettings).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, missingImages: false });
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-status')?.textContent).toBe('Enregistré');
    });
    expect(checkbox(container, IMAGES_CHECKBOX)?.checked).toBe(false);
  });

  it('should announce the save in a live region', async () => {
    const container = await mount();

    checkbox(container, IMAGES_CHECKBOX)?.click();

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-status')?.getAttribute('role')).toBe('status');
    });
  });

  it('should keep the same live region node across every render', async () => {
    const container = await mount();
    const region = container.querySelector('.wme-status');
    expect(region?.textContent).toBe('');

    checkbox(container, IMAGES_CHECKBOX)?.click();
    await vi.waitFor(() => {
      expect(region?.textContent).toBe('Enregistré');
    });

    // A node inserted with its text already in it is announced by nothing, so
    // the same one has to be there before and after every render.
    click(container, CACHE_BUTTON);
    click(container, CACHE_CANCEL);
    expect(container.querySelector('.wme-status')).toBe(region);
  });

  it('should empty the live region when the next toggle starts', async () => {
    const container = await mount();
    const region = container.querySelector('.wme-status');

    checkbox(container, IMAGES_CHECKBOX)?.click();
    await vi.waitFor(() => {
      expect(region?.textContent).toBe('Enregistré');
    });
    checkbox(container, IMAGES_CHECKBOX)?.click();

    // Emptied while the write is in flight, so the next answer is a change of
    // text and gets announced even when it says the same thing.
    expect(region?.textContent).toBe('');
  });

  it('should write the failure in the same live region', async () => {
    const container = await mount(
      makePorts({ writeSettings: () => Promise.reject(new Error('storage down')) }),
    );
    const region = container.querySelector('.wme-status');

    checkbox(container, IMAGES_CHECKBOX)?.click();

    await vi.waitFor(() => {
      expect(region?.textContent).toContain("n'a pas pu être enregistré");
    });
    expect(container.querySelector('.wme-status')).toBe(region);
  });

  it('should put the switch back and show the error when the save fails', async () => {
    const container = await mount(
      makePorts({ writeSettings: () => Promise.reject(new Error('storage down')) }),
    );

    checkbox(container, IMAGES_CHECKBOX)?.click();

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-status')?.textContent).toContain(
        "n'a pas pu être enregistré",
      );
    });
    expect(checkbox(container, IMAGES_CHECKBOX)?.checked).toBe(true);
  });

  it('should show what the storage holds when a save fails after another went through', async () => {
    let stored: Settings = DEFAULT_SETTINGS;
    let rejectFirstWrite = (): void => {};
    let writes = 0;
    const writeSettings = (next: Settings): Promise<void> => {
      writes += 1;
      if (writes === 1) {
        return new Promise<void>((_resolve, reject) => {
          rejectFirstWrite = (): void => {
            reject(new Error('storage down'));
          };
        });
      }
      stored = next;
      return Promise.resolve();
    };
    const container = await mount(
      makePorts({ writeSettings, readSettings: () => Promise.resolve(stored) }),
    );

    checkbox(container, IMAGES_CHECKBOX)?.click();
    checkbox(container, LETTERBOXD_CHECKBOX)?.click();
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-status')?.textContent).toBe('Enregistré');
    });
    rejectFirstWrite();

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-status')?.textContent).toContain(
        "n'a pas pu être enregistré",
      );
    });
    // The second write held both switches and went through: going back to the
    // state from before the first one would undo it on screen only.
    expect(checkbox(container, IMAGES_CHECKBOX)?.checked).toBe(false);
    expect(checkbox(container, LETTERBOXD_CHECKBOX)?.checked).toBe(false);
    expect(stored).toEqual({
      ...DEFAULT_SETTINGS,
      missingImages: false,
      letterboxdLink: false,
    });
  });

  it('should keep a toggle made while the read back of a failed save was in flight', async () => {
    let releaseRead = (): void => {};
    let reads = 0;
    const readSettings = (): Promise<Settings> => {
      reads += 1;
      if (reads === 1) {
        return Promise.resolve(DEFAULT_SETTINGS);
      }
      return new Promise<Settings>((resolve) => {
        releaseRead = (): void => {
          resolve(DEFAULT_SETTINGS);
        };
      });
    };
    let writes = 0;
    const writeSettings = (): Promise<void> => {
      writes += 1;
      return writes === 1 ? Promise.reject(new Error('storage down')) : Promise.resolve();
    };
    const container = await mount(makePorts({ readSettings, writeSettings }));

    checkbox(container, IMAGES_CHECKBOX)?.click();
    await vi.waitFor(() => {
      expect(reads).toBe(2);
    });
    checkbox(container, LETTERBOXD_CHECKBOX)?.click();
    releaseRead();

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-status')?.textContent).toContain(
        "n'a pas pu être enregistré",
      );
    });
    // The read answers with the state from before that toggle: it is older
    // than the screen, so showing it would undo the toggle.
    expect(checkbox(container, LETTERBOXD_CHECKBOX)?.checked).toBe(false);
  });

  it('should undo only the switch concerned when the settings cannot be read back', async () => {
    let rejectFirstWrite = (): void => {};
    let writes = 0;
    const writeSettings = (): Promise<void> => {
      writes += 1;
      if (writes === 1) {
        return new Promise<void>((_resolve, reject) => {
          rejectFirstWrite = (): void => {
            reject(new Error('storage down'));
          };
        });
      }
      return Promise.resolve();
    };
    let reads = 0;
    const readSettings = (): Promise<Settings> => {
      reads += 1;
      return reads === 1
        ? Promise.resolve(DEFAULT_SETTINGS)
        : Promise.reject(new Error('storage down'));
    };
    const container = await mount(makePorts({ writeSettings, readSettings }));

    checkbox(container, IMAGES_CHECKBOX)?.click();
    checkbox(container, LETTERBOXD_CHECKBOX)?.click();
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-status')?.textContent).toBe('Enregistré');
    });
    rejectFirstWrite();

    await vi.waitFor(() => {
      expect(checkbox(container, IMAGES_CHECKBOX)?.checked).toBe(true);
    });
    // Nothing is known of the storage, so only the switch whose write failed
    // goes back: the other one was written and answered for.
    expect(checkbox(container, LETTERBOXD_CHECKBOX)?.checked).toBe(false);
  });

  it('should keep the focus on the switch that was used', async () => {
    const container = await mount();

    checkbox(container, IMAGES_CHECKBOX)?.click();

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-status')?.textContent).toBe('Enregistré');
    });
    expect(document.activeElement).toBe(checkbox(container, IMAGES_CHECKBOX));
  });

  it('should leave the focus where the user moved it while a save was in flight', async () => {
    let releaseWrite = (): void => {};
    const writeSettings = (): Promise<void> =>
      new Promise<void>((resolve) => {
        releaseWrite = resolve;
      });
    const container = await mount(makePorts({ writeSettings }));

    checkbox(container, IMAGES_CHECKBOX)?.click();
    container.querySelector<HTMLElement>(CACHE_BUTTON)?.focus();
    releaseWrite();

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-status')?.textContent).toBe('Enregistré');
    });
    // The render destroys every control, so the focus falls back to the page.
    // What matters is that it is not pulled onto the switch of that save.
    expect(document.activeElement).not.toBe(checkbox(container, IMAGES_CHECKBOX));
  });

  it('should take the answer of the last save back when a clear is asked for', async () => {
    const container = await mount();
    const region = container.querySelector('.wme-status');
    checkbox(container, IMAGES_CHECKBOX)?.click();
    await vi.waitFor(() => {
      expect(region?.textContent).toBe('Enregistré');
    });

    click(container, CACHE_BUTTON);

    // It answered a save the user has left behind: it says nothing about the
    // deletion they are now being asked to confirm.
    expect(region?.textContent).toBe('');
  });

  it('should show every count of the local data', async () => {
    const container = await mount();

    await vi.waitFor(() => {
      expect(statCounts(container)).toEqual(['12', '4', '7']);
    });
  });

  it('should offer no removal when the installation holds no old index data', async () => {
    const container = await mount(makePorts({ readStats: () => Promise.resolve(CLEANED_STATS) }));

    await vi.waitFor(() => {
      expect(statCounts(container)).toEqual(['12', '4', '7']);
    });
    // Nothing to remove, so neither the button nor anything announcing it.
    expect(container.querySelector(LEGACY_BUTTON)).toBeNull();
    expect(container.textContent).not.toContain("l'ancien index");
    expect(container.querySelector(CACHE_BUTTON)).not.toBeNull();
  });

  it('should show an error in place of the counts when the service worker does not answer', async () => {
    const container = await mount(
      makePorts({ readStats: () => Promise.reject(new Error('port closed')) }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-message')?.textContent).toContain(
        "n'ont pas pu être lues",
      );
    });
    expect(container.textContent).not.toContain('port closed');
  });

  it('should clear nothing when the confirmation of the cache is cancelled', async () => {
    const clearCategorizationCache = vi.fn(() => Promise.resolve());
    const container = await mount(makePorts({ clearCategorizationCache }));

    click(container, CACHE_BUTTON);
    expect(container.querySelector('.wme-question')).not.toBeNull();

    click(container, CACHE_CANCEL);
    expect(clearCategorizationCache).not.toHaveBeenCalled();
    expect(container.querySelector(CACHE_BUTTON)).not.toBeNull();
  });

  it('should focus the safe answer when a clear asks for its confirmation', async () => {
    const container = await mount();

    click(container, CACHE_BUTTON);
    expect(document.activeElement).toBe(container.querySelector(CACHE_CANCEL));

    click(container, CACHE_CANCEL);
    expect(document.activeElement).toBe(container.querySelector(CACHE_BUTTON));
  });

  it('should clear the cache and read the counts again when it is confirmed', async () => {
    const clearCategorizationCache = vi.fn(() => Promise.resolve());
    let stats = STATS;
    const container = await mount(
      makePorts({ clearCategorizationCache, readStats: () => Promise.resolve(stats) }),
    );
    await vi.waitFor(() => {
      expect(statCounts(container)).toEqual(['12', '4', '7']);
    });

    click(container, CACHE_BUTTON);
    stats = EMPTY_STATS;
    click(container, CACHE_CONFIRM);

    await vi.waitFor(() => {
      expect(statCounts(container)).toEqual(['0', '0', '0']);
    });
    expect(clearCategorizationCache).toHaveBeenCalledOnce();
  });

  it('should focus the cache action again once it has been emptied', async () => {
    let stats = STATS;
    const container = await mount(makePorts({ readStats: () => Promise.resolve(stats) }));
    await vi.waitFor(() => {
      expect(statCounts(container)).toEqual(['12', '4', '7']);
    });

    click(container, CACHE_BUTTON);
    stats = EMPTY_STATS;
    click(container, CACHE_CONFIRM);

    // The confirmation has left the screen: without this the focus would fall
    // back to the document and the page could not be used with a keyboard.
    expect(document.activeElement).toBe(container.querySelector(CACHE_BUTTON));
    await vi.waitFor(() => {
      expect(statCounts(container)).toEqual(['0', '0', '0']);
    });
    expect(document.activeElement).toBe(container.querySelector(CACHE_BUTTON));
  });

  it('should offer the removal of the old index data only once', async () => {
    let stats = STATS;
    const container = await mount(makePorts({ readStats: () => Promise.resolve(stats) }));
    await vi.waitFor(() => {
      expect(container.querySelector(LEGACY_BUTTON)).not.toBeNull();
    });

    click(container, LEGACY_BUTTON);
    stats = CLEANED_STATS;
    click(container, LEGACY_CONFIRM);

    // There is nothing left to remove, so the action goes for good: the counts
    // read again are what says so, not the click itself.
    await vi.waitFor(() => {
      expect(container.querySelector(LEGACY_BUTTON)).toBeNull();
    });
    expect(container.querySelector(CACHE_BUTTON)).not.toBeNull();
    // The button that was used left the screen with the action it ran, so the
    // focus goes to its neighbour: falling back to the document would leave a
    // user who has only a keyboard with nothing to carry on from.
    expect(document.activeElement).toBe(container.querySelector(CACHE_BUTTON));
  });

  it('should focus the action again when a clear fails', async () => {
    const container = await mount(
      makePorts({
        clearCategorizationCache: () => Promise.reject(new Error('storage down')),
        removeLegacyIndexData: () => Promise.reject(new Error('storage down')),
      }),
    );

    click(container, CACHE_BUTTON);
    click(container, CACHE_CONFIRM);
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-action-error')).not.toBeNull();
    });
    expect(document.activeElement).toBe(container.querySelector(CACHE_BUTTON));

    click(container, LEGACY_BUTTON);
    click(container, LEGACY_CONFIRM);

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-action-error')?.textContent).toContain(
        "Les données de l'ancien index n'ont pas pu être supprimées",
      );
    });
    expect(document.activeElement).toBe(container.querySelector(LEGACY_BUTTON));
  });

  it('should remove the old index data when its own confirmation is confirmed', async () => {
    const removeLegacyIndexData = vi.fn(() => Promise.resolve());
    const clearCategorizationCache = vi.fn(() => Promise.resolve());
    const container = await mount(makePorts({ removeLegacyIndexData, clearCategorizationCache }));

    click(container, LEGACY_BUTTON);
    click(container, LEGACY_CONFIRM);

    await vi.waitFor(() => {
      expect(removeLegacyIndexData).toHaveBeenCalledOnce();
    });
    expect(clearCategorizationCache).not.toHaveBeenCalled();
  });

  it('should ask only one confirmation at a time', async () => {
    const container = await mount();

    click(container, CACHE_BUTTON);

    expect(container.querySelector(CACHE_CONFIRM)).not.toBeNull();
    expect(container.querySelector(LEGACY_BUTTON)).not.toBeNull();
    expect(container.querySelector(LEGACY_CONFIRM)).toBeNull();
  });

  it('should call the clear once when the confirmation is clicked twice in a row', async () => {
    let releaseClear = (): void => {};
    const clearCategorizationCache = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseClear = resolve;
        }),
    );
    const container = await mount(makePorts({ clearCategorizationCache }));

    click(container, CACHE_BUTTON);
    click(container, CACHE_CONFIRM);

    // The confirmation left the screen before the request went out, so there
    // is nothing left to click while it is in flight.
    expect(container.querySelector(CACHE_CONFIRM)).toBeNull();
    click(container, CACHE_CONFIRM);
    expect(clearCategorizationCache).toHaveBeenCalledOnce();

    releaseClear();
    await vi.waitFor(() => {
      expect(container.querySelector(CACHE_BUTTON)).not.toBeNull();
    });
  });

  it('should say that the deletion failed, not the reading, when a clear fails', async () => {
    const container = await mount(
      makePorts({ removeLegacyIndexData: () => Promise.reject(new Error('storage down')) }),
    );
    await vi.waitFor(() => {
      expect(statCounts(container)).toEqual(['12', '4', '7']);
    });

    click(container, LEGACY_BUTTON);
    click(container, LEGACY_CONFIRM);

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-action-error')?.textContent).toContain(
        "n'ont pas pu être supprimées",
      );
    });
    // Nothing was erased and the counts were never in doubt: they stay.
    expect(statCounts(container)).toEqual(['12', '4', '7']);
    expect(container.textContent).not.toContain("n'ont pas pu être lues");
  });

  it('should say which of the two actions failed', async () => {
    const container = await mount(
      makePorts({ clearCategorizationCache: () => Promise.reject(new Error('storage down')) }),
    );

    click(container, CACHE_BUTTON);
    click(container, CACHE_CONFIRM);

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-action-error')?.textContent).toContain(
        "Le cache n'a pas pu être vidé",
      );
    });
    expect(container.querySelectorAll('.wme-action-error')).toHaveLength(1);
  });

  it('should keep the error of one action when the other one is confirmed', async () => {
    let stats = STATS;
    const container = await mount(
      makePorts({
        clearCategorizationCache: () => Promise.reject(new Error('storage down')),
        readStats: () => Promise.resolve(stats),
      }),
    );

    click(container, CACHE_BUTTON);
    click(container, CACHE_CONFIRM);
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-action-error')).not.toBeNull();
    });

    click(container, LEGACY_BUTTON);
    stats = CLEANED_STATS;
    click(container, LEGACY_CONFIRM);

    // Removing the old data says nothing about the cache, which still failed.
    expect(container.querySelector('.wme-action-error')?.textContent).toContain(
      "Le cache n'a pas pu être vidé",
    );
    await vi.waitFor(() => {
      expect(container.querySelector(LEGACY_BUTTON)).toBeNull();
    });
    expect(container.querySelector('.wme-action-error')?.textContent).toContain(
      "Le cache n'a pas pu être vidé",
    );
  });

  it('should take the error back when the action is run again and goes through', async () => {
    let failNext = true;
    const container = await mount(
      makePorts({
        clearCategorizationCache: (): Promise<void> => {
          if (failNext) {
            failNext = false;
            return Promise.reject(new Error('storage down'));
          }
          return Promise.resolve();
        },
      }),
    );

    click(container, CACHE_BUTTON);
    click(container, CACHE_CONFIRM);
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-action-error')).not.toBeNull();
    });

    click(container, CACHE_BUTTON);
    click(container, CACHE_CONFIRM);

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-action-error')).toBeNull();
    });
  });

  it('should say what leaves the machine and what stays on it', async () => {
    const container = await mount();

    const privacy = [...container.querySelectorAll('.wme-privacy-item')]
      .map((node) => node.textContent ?? '')
      .join(' ');

    expect(privacy).toContain('fr.wikipedia.org');
    expect(privacy).toContain('query.wikidata.org');
    expect(privacy).toContain('sans cookie');
    expect(privacy).toContain('wiki-masters.com');
    expect(privacy).toContain('Letterboxd');
  });

  it('should leave the focus alone on the first load', async () => {
    const container = await mount();

    expect(container.querySelector(IMAGES_CHECKBOX)).not.toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('should build every node of the page without assigning HTML strings', () => {
    // Reading or writing the property at all, wherever it is spelled. The page
    // shows text coming from the extension only, and it stays that way.
    const htmlProperty = /\.innerHTML|innerHTML\s*=/;
    const sources = [PRESENTATION_DIR, CORE_DOM_DIR].flatMap((directory) =>
      readdirSync(directory)
        .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
        .map((name) => join(directory, name)),
    );

    expect(sources.length).toBeGreaterThan(0);
    for (const path of sources) {
      expect(readFileSync(path, 'utf-8')).not.toMatch(htmlProperty);
    }
  });
});
