import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ROOTS_VERSION } from '../domain/category-roots';
import type { Clock } from '../domain/ports';
import { createClassTargetCache } from './class-target-cache';

const COMMUNE_CLASS_ID = 'Q484170';
const ACTOR_CLASS_ID = 'Q33999';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;

const systemClock: Clock = { now: (): number => Date.now() };

/** A clock stuck this far in the future, to age an entry just written. */
function clockInDays(days: number): Clock {
  const at = Date.now() + days * MILLISECONDS_PER_DAY;
  return { now: (): number => at };
}

describe('createClassTargetCache', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should return a category target that was just written', async () => {
    const cache = createClassTargetCache(systemClock);
    await cache.putCategoryTargets(
      new Map([
        [COMMUNE_CLASS_ID, { target: 'place' as const, label: null, matchedRootIds: ['Q56061'] }],
      ]),
    );

    const targets = await cache.getCategoryTargets([COMMUNE_CLASS_ID]);

    expect(targets.get(COMMUNE_CLASS_ID)).toEqual({
      target: 'place',
      label: null,
      matchedRootIds: ['Q56061'],
    });
  });

  it('should return an occupation target with its label', async () => {
    const cache = createClassTargetCache(systemClock);
    await cache.putOccupationTargets(
      new Map([
        [
          ACTOR_CLASS_ID,
          { target: 'cinema' as const, label: 'acteur ou actrice', matchedRootIds: [ACTOR_CLASS_ID] },
        ],
      ]),
    );

    const targets = await cache.getOccupationTargets([ACTOR_CLASS_ID]);

    expect(targets.get(ACTOR_CLASS_ID)).toEqual({
      target: 'cinema',
      label: 'acteur ou actrice',
      matchedRootIds: [ACTOR_CLASS_ID],
    });
  });

  it('should treat a null target as a hit and not as a miss', async () => {
    const cache = createClassTargetCache(systemClock);
    await cache.putCategoryTargets(
      new Map([['Q999', { target: null, label: null, matchedRootIds: [] }]]),
    );

    const targets = await cache.getCategoryTargets(['Q999']);

    expect(targets.has('Q999')).toBe(true);
    expect(targets.get('Q999')?.target).toBeNull();
  });

  it('should keep the two kinds in separate entries', async () => {
    const cache = createClassTargetCache(systemClock);
    await cache.putCategoryTargets(
      new Map([[ACTOR_CLASS_ID, { target: 'person' as const, label: null, matchedRootIds: [] }]]),
    );

    expect((await cache.getOccupationTargets([ACTOR_CLASS_ID])).size).toBe(0);
    expect((await cache.getCategoryTargets([ACTOR_CLASS_ID])).size).toBe(1);
  });

  it('should ignore an entry stored with another roots version', async () => {
    await storage.setItem(`local:wme:class:category:${COMMUNE_CLASS_ID}`, {
      rootsVersion: ROOTS_VERSION + 1,
      target: 'place',
      label: null,
      matchedRootIds: ['Q56061'],
      fetchedAt: Date.now(),
    });

    const targets = await createClassTargetCache(systemClock).getCategoryTargets([COMMUNE_CLASS_ID]);

    expect(targets.size).toBe(0);
  });

  it('should ignore an entry whose target is not a known category', async () => {
    await storage.setItem(`local:wme:class:category:${COMMUNE_CLASS_ID}`, {
      rootsVersion: ROOTS_VERSION,
      target: 'not_a_category',
      label: null,
      matchedRootIds: [],
      fetchedAt: Date.now(),
    });

    const targets = await createClassTargetCache(systemClock).getCategoryTargets([COMMUNE_CLASS_ID]);

    expect(targets.size).toBe(0);
  });

  it('should ignore an entry stored without its matched roots', async () => {
    await storage.setItem(`local:wme:class:category:${COMMUNE_CLASS_ID}`, {
      rootsVersion: ROOTS_VERSION,
      target: 'place',
      label: null,
      fetchedAt: Date.now(),
    });

    const targets = await createClassTargetCache(systemClock).getCategoryTargets([COMMUNE_CLASS_ID]);

    expect(targets.size).toBe(0);
  });

  it('should ignore an entry older than the lifetime of a resolved class', async () => {
    await createClassTargetCache(systemClock).putCategoryTargets(
      new Map([[COMMUNE_CLASS_ID, { target: 'place' as const, label: null, matchedRootIds: [] }]]),
    );

    const targets = await createClassTargetCache(clockInDays(91)).getCategoryTargets([
      COMMUNE_CLASS_ID,
    ]);

    expect(targets.size).toBe(0);
  });

  it('should still hold an entry written just under that lifetime', async () => {
    await createClassTargetCache(systemClock).putCategoryTargets(
      new Map([[COMMUNE_CLASS_ID, { target: 'place' as const, label: null, matchedRootIds: [] }]]),
    );

    const targets = await createClassTargetCache(clockInDays(89)).getCategoryTargets([
      COMMUNE_CLASS_ID,
    ]);

    expect(targets.get(COMMUNE_CLASS_ID)?.target).toBe('place');
  });

  it('should ignore an entry written before the lifetime was recorded at all', async () => {
    await storage.setItem(`local:wme:class:category:${COMMUNE_CLASS_ID}`, {
      rootsVersion: ROOTS_VERSION,
      target: 'place',
      label: null,
      matchedRootIds: ['Q56061'],
    });

    const targets = await createClassTargetCache(systemClock).getCategoryTargets([
      COMMUNE_CLASS_ID,
    ]);

    expect(targets.size).toBe(0);
  });

  it('should return nothing for a class that was never written', async () => {
    const targets = await createClassTargetCache(systemClock).getCategoryTargets(['Q1']);

    expect(targets.size).toBe(0);
  });

  it('should read and write nothing when there is no class', async () => {
    const cache = createClassTargetCache(systemClock);
    await cache.putCategoryTargets(new Map());

    expect((await cache.getCategoryTargets([])).size).toBe(0);
    expect(Object.keys(await storage.snapshot('local'))).toHaveLength(0);
  });

});
