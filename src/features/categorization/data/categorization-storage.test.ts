import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ROOTS_VERSION } from '../domain/category-roots';
import { createCategorizationStorage } from './categorization-storage';

const CARD_ENTRY = { schemaVersion: 1, status: 'resolved', facts: null, fetchedAt: 0 };
const CLASS_ENTRY = {
  rootsVersion: ROOTS_VERSION,
  target: 'place',
  label: null,
  matchedRootIds: [],
};
const IMAGE_ENTRY = {
  schemaVersion: 1,
  url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Flag.svg/500px-Flag.svg.png',
  fetchedAt: 0,
};

/** Every key the extension may hold, of the three cache levels and of the rest. */
async function fillStorage(): Promise<void> {
  await storage.setItems([
    { key: 'local:wme:card:Albert Einstein', value: CARD_ENTRY },
    { key: 'local:wme:card:Inexistant', value: { ...CARD_ENTRY, status: 'not_found' } },
    { key: 'local:wme:class:category:Q484170', value: CLASS_ENTRY },
    { key: 'local:wme:class:occupation:Q33999', value: { ...CLASS_ENTRY, target: 'cinema' } },
    { key: 'local:wme:image:Flag of the Azores.svg', value: IMAGE_ENTRY },
    { key: 'local:wme:image:Introuvable.jpg', value: { ...IMAGE_ENTRY, url: null } },
    { key: 'local:wme:collection-index:v1', value: {} },
    // Facts the site displays about the game, neither personal data nor a
    // cache of Wikimedia: emptying the caches must leave them alone.
    { key: 'local:wme:catalogue-totals:v1', value: { totals: {}, observedAt: 0 } },
    { key: 'local:wme:settings:v1', value: { categoryBadges: false } },
    // A pause on a rate limited host must survive: losing it would send the
    // next batch straight back to the host that asked us to wait.
    { key: 'local:wme:cooldown:v1:query.wikidata.org', value: { until: 0, status: 429 } },
  ]);
}

describe('createCategorizationStorage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should count each level apart and ignore every other key', async () => {
    await fillStorage();

    expect(await createCategorizationStorage().countEntries()).toEqual({
      cardFacts: 2,
      classTargets: 2,
      thumbnailUrls: 2,
    });
  });

  it('should count nothing when nothing was ever cached', async () => {
    await storage.setItem('local:wme:settings:v1', { categoryBadges: false });

    expect(await createCategorizationStorage().countEntries()).toEqual({
      cardFacts: 0,
      classTargets: 0,
      thumbnailUrls: 0,
    });
  });

  it('should count an entry the extension can no longer read', async () => {
    await storage.setItems([
      { key: 'local:wme:card:Albert Einstein', value: { ...CARD_ENTRY, schemaVersion: 0 } },
      {
        key: 'local:wme:class:category:Q484170',
        value: { ...CLASS_ENTRY, rootsVersion: ROOTS_VERSION + 1 },
      },
      { key: 'local:wme:image:Flag.svg', value: { ...IMAGE_ENTRY, schemaVersion: 0 } },
    ]);

    // What the options page announces is what the storage holds, whether the
    // extension can still read it or not: clearing frees exactly that.
    expect(await createCategorizationStorage().countEntries()).toEqual({
      cardFacts: 1,
      classTargets: 1,
      thumbnailUrls: 1,
    });
  });

  it('should empty every level and leave every other key when it is cleared', async () => {
    await fillStorage();
    const maintenance = createCategorizationStorage();

    await maintenance.clear();

    expect(await maintenance.countEntries()).toEqual({
      cardFacts: 0,
      classTargets: 0,
      thumbnailUrls: 0,
    });
    expect(Object.keys(await storage.snapshot('local')).sort()).toEqual([
      'wme:catalogue-totals:v1',
      'wme:collection-index:v1',
      'wme:cooldown:v1:query.wikidata.org',
      'wme:settings:v1',
    ]);
  });

  it('should write nothing when a clear finds no entry', async () => {
    await storage.setItem('local:wme:settings:v1', { categoryBadges: false });

    await createCategorizationStorage().clear();

    expect(Object.keys(await storage.snapshot('local'))).toEqual(['wme:settings:v1']);
  });
});
