import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Clock } from '../../categorization/domain/ports';
import type { CollectionIndexRepository } from '../domain/collection-index';
import { createCollectionIndexRepository } from './collection-index-repository';

const INDEX_KEY = 'local:wme:collection-index:v1';

const FIRST_TIME = new Date('2026-01-01T10:00:00.000Z').getTime();
const SECOND_TIME = new Date('2026-01-02T10:00:00.000Z').getTime();

/** A clock the test moves by hand, as the service worker would see time pass. */
function makeClock(): { clock: Clock; setTime: (value: number) => void } {
  let now = FIRST_TIME;
  return {
    clock: { now: (): number => now },
    setTime: (value: number): void => {
      now = value;
    },
  };
}

function makeRepository(clock: Clock): CollectionIndexRepository {
  return createCollectionIndexRepository(clock);
}

describe('createCollectionIndexRepository', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should return an empty index when nothing was ever recorded', async () => {
    const { clock } = makeClock();

    expect((await makeRepository(clock).read()).size).toBe(0);
  });

  it('should record the rarity and both timestamps when a card is seen for the first time', async () => {
    const { clock } = makeClock();
    const repository = makeRepository(clock);

    await repository.upsert([{ title: 'Albert Einstein', rarity: 'ur' }]);

    expect((await repository.read()).get('Albert Einstein')).toEqual({
      rarity: 'ur',
      firstSeenAt: FIRST_TIME,
      lastSeenAt: FIRST_TIME,
    });
  });

  it('should keep the first sighting and refresh the rarity when a card is seen again', async () => {
    const { clock, setTime } = makeClock();
    const repository = makeRepository(clock);
    await repository.upsert([{ title: 'Albert Einstein', rarity: 'r' }]);

    setTime(SECOND_TIME);
    await repository.upsert([{ title: 'Albert Einstein', rarity: 'l' }]);

    expect((await repository.read()).get('Albert Einstein')).toEqual({
      rarity: 'l',
      firstSeenAt: FIRST_TIME,
      lastSeenAt: SECOND_TIME,
    });
  });

  it('should keep both batches when two upserts run at the same time', async () => {
    const { clock } = makeClock();
    const repository = makeRepository(clock);

    // Neither call is awaited before the other starts: without the queue, both
    // would read the same index and the second write would drop the first.
    await Promise.all([
      repository.upsert([{ title: 'Alpha', rarity: 'c' }]),
      repository.upsert([{ title: 'Beta', rarity: 'sr' }]),
    ]);

    expect([...(await repository.read()).keys()].sort()).toEqual(['Alpha', 'Beta']);
  });

  it('should round-trip a title containing a colon', async () => {
    const { clock } = makeClock();
    const repository = makeRepository(clock);

    await repository.upsert([{ title: 'Star Wars: Episode IV', rarity: 'sr' }]);

    expect((await repository.read()).has('Star Wars: Episode IV')).toBe(true);
  });

  it('should write nothing when the batch is empty', async () => {
    const { clock } = makeClock();

    await makeRepository(clock).upsert([]);

    expect(Object.keys(await storage.snapshot('local'))).toHaveLength(0);
  });

  it('should return an empty index when the stored value is not a record', async () => {
    const { clock } = makeClock();
    await storage.setItem(INDEX_KEY, 'oops');

    expect((await makeRepository(clock).read()).size).toBe(0);
  });

  it('should return an empty index when a stored entry has an unknown shape', async () => {
    const { clock } = makeClock();
    await storage.setItem(INDEX_KEY, {
      Alpha: { rarity: 'c', firstSeenAt: FIRST_TIME, lastSeenAt: FIRST_TIME },
      Beta: { rarity: 'mythic', firstSeenAt: FIRST_TIME, lastSeenAt: FIRST_TIME },
    });

    expect((await makeRepository(clock).read()).size).toBe(0);
  });

  it('should overwrite a corrupted value on the next write', async () => {
    const { clock } = makeClock();
    const repository = makeRepository(clock);
    await storage.setItem(INDEX_KEY, 'oops');

    await repository.upsert([{ title: 'Alpha', rarity: 'c' }]);

    expect([...(await repository.read()).keys()]).toEqual(['Alpha']);
  });

  it('should empty the index when it is cleared', async () => {
    const { clock } = makeClock();
    const repository = makeRepository(clock);
    await repository.upsert([{ title: 'Alpha', rarity: 'c' }]);

    await repository.clear();

    expect((await repository.read()).size).toBe(0);
    expect(Object.keys(await storage.snapshot('local'))).toHaveLength(0);
  });

  it('should keep serving the next operations when one of them fails', async () => {
    const { clock } = makeClock();
    const repository = makeRepository(clock);
    const failure = new Error('storage down');
    const broken = vi.spyOn(storage, 'setItem').mockRejectedValueOnce(failure);

    await expect(repository.upsert([{ title: 'Alpha', rarity: 'c' }])).rejects.toThrow(failure);
    broken.mockRestore();

    await repository.upsert([{ title: 'Beta', rarity: 'c' }]);
    expect([...(await repository.read()).keys()]).toEqual(['Beta']);
  });
});
