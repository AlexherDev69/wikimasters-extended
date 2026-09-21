import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import type { SettingsRepository } from '../domain/settings-repository';
import { createSettingsRepository } from './settings-repository';

const SETTINGS_KEY = 'local:wme:settings:v1';

const IMAGES_OFF: Settings = { ...DEFAULT_SETTINGS, missingImages: false };

function makeRepository(): SettingsRepository {
  return createSettingsRepository();
}

describe('createSettingsRepository', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    storage.unwatch();
  });

  it('should return every feature on when nothing was ever written', async () => {
    expect(await makeRepository().read()).toEqual(DEFAULT_SETTINGS);
  });

  it('should read back the settings it has written', async () => {
    const repository = makeRepository();

    await repository.write(IMAGES_OFF);

    expect(await repository.read()).toEqual(IMAGES_OFF);
  });

  it('should write everything under a single key', async () => {
    await makeRepository().write(IMAGES_OFF);

    expect(Object.keys(await storage.snapshot('local'))).toEqual(['wme:settings:v1']);
  });

  it('should return the defaults when the stored value is corrupted', async () => {
    await storage.setItem(SETTINGS_KEY, 'oops');

    expect(await makeRepository().read()).toEqual(DEFAULT_SETTINGS);
  });

  it('should keep the saved switches and default the others when the record is partial', async () => {
    await storage.setItem(SETTINGS_KEY, { letterboxdLink: false });

    expect(await makeRepository().read()).toEqual({
      ...DEFAULT_SETTINGS,
      letterboxdLink: false,
    });
  });

  it('should return the defaults when storage cannot be read', async () => {
    const broken = vi.spyOn(storage, 'getItem').mockRejectedValueOnce(new Error('storage down'));

    expect(await makeRepository().read()).toEqual(DEFAULT_SETTINGS);

    broken.mockRestore();
  });

  it('should reject the strict read when storage cannot be read', async () => {
    const failure = new Error('storage down');
    const broken = vi.spyOn(storage, 'getItem').mockRejectedValueOnce(failure);

    // The options page needs the failure: showing the defaults it did not read
    // would write them over the saved switches on the next toggle.
    await expect(makeRepository().readStrict()).rejects.toThrow(failure);

    broken.mockRestore();
  });

  it('should return the defaults from the strict read when the stored value is corrupted', async () => {
    await storage.setItem(SETTINGS_KEY, 'oops');

    // A value that is there but unreadable is not a failure: the defaults are
    // exactly what the extension does with it.
    expect(await makeRepository().readStrict()).toEqual(DEFAULT_SETTINGS);
  });

  it('should read back through the strict read the settings it has written', async () => {
    const repository = makeRepository();

    await repository.write(IMAGES_OFF);

    expect(await repository.readStrict()).toEqual(IMAGES_OFF);
  });

  it('should reject when the settings cannot be written', async () => {
    const failure = new Error('storage down');
    const broken = vi.spyOn(storage, 'setItem').mockRejectedValueOnce(failure);

    await expect(makeRepository().write(IMAGES_OFF)).rejects.toThrow(failure);

    broken.mockRestore();
  });

  it('should notify the watcher with the new settings when they change', async () => {
    const repository = makeRepository();
    const listener = vi.fn();
    const unwatch = repository.watch(listener);

    await repository.write(IMAGES_OFF);

    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledWith(IMAGES_OFF);
    });
    unwatch();
  });

  it('should notify the watcher with normalized settings when a corrupted value is written', async () => {
    const repository = makeRepository();
    const listener = vi.fn();
    const unwatch = repository.watch(listener);

    await storage.setItem(SETTINGS_KEY, 'oops');

    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledWith(DEFAULT_SETTINGS);
    });
    unwatch();
  });

  it('should notify nothing more once the watch has been taken back', async () => {
    const repository = makeRepository();
    const listener = vi.fn();

    repository.watch(listener)();
    await repository.write(IMAGES_OFF);

    expect(listener).not.toHaveBeenCalled();
  });
});
