import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { EntityFacts } from '../domain/entity-facts';
import type { CachedCardFacts, Clock } from '../domain/ports';
import { createCardFactsCache } from './card-facts-cache';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const RESOLVED_TTL_MS = 90 * MILLISECONDS_PER_DAY;
const ONE_MILLISECOND = 1;
const START_TIME = new Date('2026-01-01T00:00:00.000Z').getTime();

const FACTS: EntityFacts = {
  qid: 'Q937',
  classIds: ['Q5'],
  parentClassIds: [],
  occupationIds: ['Q901'],
  externalIds: {
    letterboxdFilm: null,
    letterboxdActor: 'albert-einstein',
    letterboxdDirector: null,
    letterboxdWriter: null,
    letterboxdProducer: null,
    letterboxdStudio: null,
    imdbId: 'tt0000001',
    tmdbMovieId: null,
    tmdbPersonId: null,
  },
};

const RESOLVED_ENTRY: CachedCardFacts = { status: 'resolved', facts: FACTS };
const NOT_FOUND_ENTRY: CachedCardFacts = { status: 'not_found', facts: null };

const systemClock: Clock = { now: (): number => Date.now() };

describe('createCardFactsCache', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers();
    vi.setSystemTime(START_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return a resolved entry that was just written', async () => {
    const cache = createCardFactsCache(systemClock);
    await cache.putMany(new Map([['Albert Einstein', RESOLVED_ENTRY]]));

    const fresh = await cache.getFresh(['Albert Einstein']);

    expect(fresh.get('Albert Einstein')).toEqual(RESOLVED_ENTRY);
  });

  it('should round-trip a title containing a colon', async () => {
    const title = 'Star Wars: Episode IV';
    const cache = createCardFactsCache(systemClock);
    await cache.putMany(new Map([[title, RESOLVED_ENTRY]]));

    const fresh = await cache.getFresh([title]);

    expect(fresh.get(title)).toEqual(RESOLVED_ENTRY);
  });

  it('should not return a title that was never written', async () => {
    const cache = createCardFactsCache(systemClock);

    const fresh = await cache.getFresh(['Inconnu']);

    expect(fresh.size).toBe(0);
  });

  it('should keep a resolved entry for 90 days and drop it afterwards', async () => {
    const cache = createCardFactsCache(systemClock);
    await cache.putMany(new Map([['Albert Einstein', RESOLVED_ENTRY]]));

    vi.setSystemTime(START_TIME + 89 * MILLISECONDS_PER_DAY);
    expect((await cache.getFresh(['Albert Einstein'])).size).toBe(1);

    vi.setSystemTime(START_TIME + 91 * MILLISECONDS_PER_DAY);
    expect((await cache.getFresh(['Albert Einstein'])).size).toBe(0);
  });

  it('should expire a resolved entry exactly at the end of its lifetime', async () => {
    const cache = createCardFactsCache(systemClock);
    await cache.putMany(new Map([['Albert Einstein', RESOLVED_ENTRY]]));

    // The last millisecond of the lifetime is still a hit...
    vi.setSystemTime(START_TIME + RESOLVED_TTL_MS - ONE_MILLISECOND);
    expect((await cache.getFresh(['Albert Einstein'])).size).toBe(1);

    // ...and the boundary instant itself is already a miss.
    vi.setSystemTime(START_TIME + RESOLVED_TTL_MS);
    expect((await cache.getFresh(['Albert Einstein'])).size).toBe(0);
  });

  it('should keep a not found entry for 7 days and drop it afterwards', async () => {
    const cache = createCardFactsCache(systemClock);
    await cache.putMany(new Map([['Inexistant', NOT_FOUND_ENTRY]]));

    vi.setSystemTime(START_TIME + 6 * MILLISECONDS_PER_DAY);
    expect((await cache.getFresh(['Inexistant'])).get('Inexistant')).toEqual(NOT_FOUND_ENTRY);

    vi.setSystemTime(START_TIME + 8 * MILLISECONDS_PER_DAY);
    expect((await cache.getFresh(['Inexistant'])).size).toBe(0);
  });

  it('should ignore an entry stored with another schema version', async () => {
    await storage.setItem('local:wme:card:Albert Einstein', {
      schemaVersion: 999,
      status: 'resolved',
      facts: FACTS,
      fetchedAt: START_TIME,
    });

    const fresh = await createCardFactsCache(systemClock).getFresh(['Albert Einstein']);

    expect(fresh.size).toBe(0);
  });

  it('should ignore an entry whose stored shape is not the expected one', async () => {
    await storage.setItem('local:wme:card:Albert Einstein', { schemaVersion: 1, status: 'oops' });

    const fresh = await createCardFactsCache(systemClock).getFresh(['Albert Einstein']);

    expect(fresh.size).toBe(0);
  });

  it('should read and write nothing when there is no entry', async () => {
    const cache = createCardFactsCache(systemClock);
    await cache.putMany(new Map());

    expect((await cache.getFresh([])).size).toBe(0);
    expect(Object.keys(await storage.snapshot('local'))).toHaveLength(0);
  });

  it('should de-duplicate the requested titles', async () => {
    const cache = createCardFactsCache(systemClock);
    await cache.putMany(new Map([['Albert Einstein', RESOLVED_ENTRY]]));

    const fresh = await cache.getFresh(['Albert Einstein', 'Albert Einstein']);

    expect(fresh.size).toBe(1);
  });

});
