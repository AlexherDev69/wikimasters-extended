import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { listLocalKeys, removeLocalKeys } from './local-keys';

async function fillStorage(): Promise<void> {
  await storage.setItems([
    { key: 'local:wme:card:Albert Einstein', value: { status: 'resolved' } },
    { key: 'local:wme:card:Saint-Malo', value: { status: 'resolved' } },
    { key: 'local:wme:class:category:Q5', value: { target: 'person' } },
    { key: 'local:wme:collection-index:v1', value: {} },
  ]);
}

describe('listLocalKeys', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should list every key of the area without its area prefix', async () => {
    await fillStorage();

    expect((await listLocalKeys()).sort()).toEqual([
      'wme:card:Albert Einstein',
      'wme:card:Saint-Malo',
      'wme:class:category:Q5',
      'wme:collection-index:v1',
    ]);
  });

  it('should list nothing when the area is empty', async () => {
    expect(await listLocalKeys()).toEqual([]);
  });
});

describe('removeLocalKeys', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should remove the keys it is given and leave every other one', async () => {
    await fillStorage();
    const keys = (await listLocalKeys()).filter((key) => key.startsWith('wme:card:'));

    await removeLocalKeys(keys);

    expect(Object.keys(await storage.snapshot('local')).sort()).toEqual([
      'wme:class:category:Q5',
      'wme:collection-index:v1',
    ]);
  });

  it('should write nothing when the list is empty', async () => {
    await storage.setItem('local:wme:collection-index:v1', {});

    await removeLocalKeys([]);

    expect(Object.keys(await storage.snapshot('local'))).toEqual(['wme:collection-index:v1']);
  });
});
