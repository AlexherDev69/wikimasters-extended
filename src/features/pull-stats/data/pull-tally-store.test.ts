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

  it('should read back the tally the storage holds', async () => {
    await storage.setItem(KEY, TALLY);

    expect(await createPullTallyStore().read()).toEqual(TALLY);
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

  it('should add the card to the tally the storage holds and give the result back', async () => {
    await storage.setItem(KEY, TALLY);

    const added = await createPullTallyStore().add('sr');

    expect(added).toEqual({ ...TALLY, sr: 3 });
    expect(await storage.getItem(KEY)).toEqual({ ...TALLY, sr: 3 });
  });

  it('should start from an empty tally when nothing was ever stored', async () => {
    expect(await createPullTallyStore().add('c')).toEqual({ ...emptyTally(), c: 1 });
  });

  it('should keep the cards another tab has added in between', async () => {
    // Two tabs of the site: each has a store of its own over the one storage.
    const firstTab = createPullTallyStore();
    const secondTab = createPullTallyStore();

    await firstTab.add('c');
    await secondTab.add('ur');
    await firstTab.add('c');

    expect(await storage.getItem(KEY)).toEqual({ ...emptyTally(), c: 2, ur: 1 });
  });

  it('should count every card when several are added without waiting for one another', async () => {
    const store = createPullTallyStore();

    await Promise.all([store.add('c'), store.add('c'), store.add('pc')]);

    expect(await storage.getItem(KEY)).toEqual({ ...emptyTally(), c: 2, pc: 1 });
  });

  it('should reject and write nothing when the storage cannot be read', async () => {
    await storage.setItem(KEY, TALLY);
    vi.spyOn(storage, 'getItem').mockRejectedValue(new Error('storage unavailable'));
    const setItem = vi.spyOn(storage, 'setItem');

    await expect(createPullTallyStore().add('c')).rejects.toThrow('storage unavailable');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('should reject when the storage cannot be written, so the caller can log it', async () => {
    vi.spyOn(storage, 'setItem').mockRejectedValue(new Error('storage unavailable'));

    await expect(createPullTallyStore().add('c')).rejects.toThrow('storage unavailable');
  });

  it('should still add the next card when an addition has failed', async () => {
    const store = createPullTallyStore();
    vi.spyOn(storage, 'setItem').mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(store.add('c')).rejects.toThrow('storage unavailable');
    await store.add('pc');

    expect(await storage.getItem(KEY)).toEqual({ ...emptyTally(), pc: 1 });
  });
});
