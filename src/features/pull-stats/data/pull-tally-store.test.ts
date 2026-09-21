import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { emptyTally, type PullTally } from '../domain/pull-tally';
import { createPullTallyStore } from './pull-tally-store';

const KEY = 'local:wme:pulls:v1';

const TALLY: PullTally = { c: 40, pc: 12, r: 5, sr: 2, ur: 1, l: 0 };

describe('createPullTallyStore', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should read back the tally it wrote', async () => {
    const store = createPullTallyStore();
    await store.write(TALLY);

    expect(await store.read()).toEqual(TALLY);
  });

  it('should return an empty tally when nothing was ever written', async () => {
    expect(await createPullTallyStore().read()).toEqual(emptyTally());
  });

  it('should return an empty tally when the stored value has the wrong shape', async () => {
    await storage.setItem(KEY, { c: 'lots' });

    expect(await createPullTallyStore().read()).toEqual(emptyTally());
  });

  it('should return an empty tally when the storage cannot be read', async () => {
    vi.spyOn(storage, 'getItem').mockRejectedValue(new Error('storage unavailable'));

    expect(await createPullTallyStore().read()).toEqual(emptyTally());
  });

  it('should reject when the storage cannot be written, so the caller can log it', async () => {
    vi.spyOn(storage, 'setItem').mockRejectedValue(new Error('storage unavailable'));

    await expect(createPullTallyStore().write(TALLY)).rejects.toThrow('storage unavailable');
  });

  it('should write under one versioned key of its own', async () => {
    await createPullTallyStore().write(TALLY);

    expect(await storage.getItem(KEY)).toEqual(TALLY);
  });
});
