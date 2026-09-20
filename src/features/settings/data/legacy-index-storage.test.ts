import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createLegacyIndexStorage } from './legacy-index-storage';

const CARD_ENTRY = { schemaVersion: 1, status: 'resolved', facts: null, fetchedAt: 0 };

/** An installation that was upgraded: the two old keys are still there. */
async function fillStorage(): Promise<void> {
  await storage.setItems([
    { key: 'local:wme:card:Albert Einstein', value: CARD_ENTRY },
    { key: 'local:wme:class:category:Q484170', value: { target: 'place' } },
    { key: 'local:wme:collection-index:v1', value: {} },
    { key: 'local:wme:catalogue-totals:v1', value: { totals: {}, observedAt: 0 } },
    { key: 'local:wme:settings:v1', value: { categoryBadges: false } },
    { key: 'local:wme:cooldown:v1:query.wikidata.org', value: { until: 0, status: 429 } },
  ]);
}

describe('createLegacyIndexStorage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should see the old data when both keys are still stored', async () => {
    await fillStorage();

    expect(await createLegacyIndexStorage().isPresent()).toBe(true);
  });

  it('should see the old data when a single one of the two keys is left', async () => {
    await storage.setItem('local:wme:catalogue-totals:v1', { totals: {}, observedAt: 0 });

    expect(await createLegacyIndexStorage().isPresent()).toBe(true);
  });

  it('should see no old data on an installation that never held the index', async () => {
    await storage.setItem('local:wme:settings:v1', { categoryBadges: false });

    expect(await createLegacyIndexStorage().isPresent()).toBe(false);
  });

  it('should remove exactly the two old keys and leave every other one', async () => {
    await fillStorage();
    const legacyData = createLegacyIndexStorage();

    await legacyData.remove();

    expect(Object.keys(await storage.snapshot('local')).sort()).toEqual([
      'wme:card:Albert Einstein',
      'wme:class:category:Q484170',
      'wme:cooldown:v1:query.wikidata.org',
      'wme:settings:v1',
    ]);
    expect(await legacyData.isPresent()).toBe(false);
  });

  it('should write nothing when there is no old data to remove', async () => {
    await storage.setItem('local:wme:settings:v1', { categoryBadges: false });

    await createLegacyIndexStorage().remove();

    expect(Object.keys(await storage.snapshot('local'))).toEqual(['wme:settings:v1']);
  });
});
