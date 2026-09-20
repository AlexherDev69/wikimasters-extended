import { storage, type StorageItemKey } from '#imports';
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from '../domain/settings';
import type {
  SettingsListener,
  SettingsRepository,
  UnwatchSettings,
} from '../domain/settings-repository';

/**
 * The four switches live under ONE versioned key, so reading them is a single
 * access and a change fires a single notification. The version is part of the
 * key, as for the caches and the index: a change of shape starts again from
 * the defaults instead of reading a value it cannot understand.
 */
const SETTINGS_KEY: StorageItemKey = 'local:wme:settings:v1';

export function createSettingsRepository(): SettingsRepository {
  /** The read both others are built on: it lets a failure through. */
  async function readStrict(): Promise<Settings> {
    return normalizeSettings(await storage.getItem(SETTINGS_KEY));
  }

  return {
    readStrict,

    async read(): Promise<Settings> {
      try {
        return await readStrict();
      } catch {
        // Storage failing must never keep the overlay off the page: the
        // defaults are what the extension does when nothing was ever saved.
        return { ...DEFAULT_SETTINGS };
      }
    },

    write(settings: Settings): Promise<void> {
      // A failure travels to the caller on purpose: the options page puts the
      // checkbox back rather than showing a switch that was not saved.
      return storage.setItem<Settings>(SETTINGS_KEY, settings);
    },

    watch(listener: SettingsListener): UnwatchSettings {
      return storage.watch<unknown>(SETTINGS_KEY, (value) => {
        // What comes out of storage is narrowed exactly as on a read: the
        // watcher is another way in, not another level of trust.
        listener(normalizeSettings(value));
      });
    },
  };
}
