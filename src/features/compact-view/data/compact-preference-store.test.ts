import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createCompactPreferenceStore } from './compact-preference-store';

const KEY = 'local:wme:compact:v1';

describe('createCompactPreferenceStore', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should read back the view it wrote', async () => {
    const store = createCompactPreferenceStore();
    await store.write(true);

    expect(await store.read()).toBe(true);
  });

  it('should read the view as off when nothing was ever written', async () => {
    expect(await createCompactPreferenceStore().read()).toBe(false);
  });

  it('should read the view as off when the stored value is not a boolean', async () => {
    await storage.setItem(KEY, 'compact');

    expect(await createCompactPreferenceStore().read()).toBe(false);
  });

  it('should read the view as off when the storage cannot be read', async () => {
    vi.spyOn(storage, 'getItem').mockRejectedValue(new Error('storage unavailable'));

    expect(await createCompactPreferenceStore().read()).toBe(false);
  });

  it('should reject when the storage cannot be written, so the caller can log it', async () => {
    vi.spyOn(storage, 'setItem').mockRejectedValue(new Error('storage unavailable'));

    await expect(createCompactPreferenceStore().write(true)).rejects.toThrow('storage unavailable');
  });

  it('should write under one versioned key of its own', async () => {
    await createCompactPreferenceStore().write(true);

    expect(await storage.getItem(KEY)).toBe(true);
  });
});
