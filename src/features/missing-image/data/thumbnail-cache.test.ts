import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Clock } from '../../categorization/domain/ports';
import { createThumbnailUrlCache } from './thumbnail-cache';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const RESOLVED_TTL_MS = 90 * MILLISECONDS_PER_DAY;
const ONE_MILLISECOND = 1;
const START_TIME = new Date('2026-01-01T00:00:00.000Z').getTime();

const CURRENT_SCHEMA_VERSION = 1;

const FILE_NAME = 'Adan Canto.jpg';

const THUMBNAIL_URL =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Adan_Canto.jpg/500px-Adan_Canto.jpg' +
  '?utm_source=fr.wikipedia.org&utm_campaign=imageinfo&utm_content=thumbnail';

const systemClock: Clock = { now: (): number => Date.now() };

describe('createThumbnailUrlCache', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers();
    vi.setSystemTime(START_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return an address that was just written, tracking parameters included', async () => {
    const cache = createThumbnailUrlCache(systemClock);
    await cache.putMany(new Map([[FILE_NAME, THUMBNAIL_URL]]));

    const fresh = await cache.getFresh([FILE_NAME]);

    expect(fresh.get(FILE_NAME)).toBe(THUMBNAIL_URL);
  });

  it('should return the not resolved marker that was just written', async () => {
    const cache = createThumbnailUrlCache(systemClock);
    await cache.putMany(new Map([[FILE_NAME, null]]));

    const fresh = await cache.getFresh([FILE_NAME]);

    // Present and null: the file was asked for and has no usable thumbnail.
    expect(fresh.has(FILE_NAME)).toBe(true);
    expect(fresh.get(FILE_NAME)).toBeNull();
  });

  it('should not return a file name that was never written', async () => {
    const fresh = await createThumbnailUrlCache(systemClock).getFresh([FILE_NAME]);

    expect(fresh.size).toBe(0);
  });

  it('should keep a resolved address for 90 days and drop it afterwards', async () => {
    const cache = createThumbnailUrlCache(systemClock);
    await cache.putMany(new Map([[FILE_NAME, THUMBNAIL_URL]]));

    vi.setSystemTime(START_TIME + 89 * MILLISECONDS_PER_DAY);
    expect((await cache.getFresh([FILE_NAME])).size).toBe(1);

    vi.setSystemTime(START_TIME + 91 * MILLISECONDS_PER_DAY);
    expect((await cache.getFresh([FILE_NAME])).size).toBe(0);
  });

  it('should expire a resolved address exactly at the end of its lifetime', async () => {
    const cache = createThumbnailUrlCache(systemClock);
    await cache.putMany(new Map([[FILE_NAME, THUMBNAIL_URL]]));

    vi.setSystemTime(START_TIME + RESOLVED_TTL_MS - ONE_MILLISECOND);
    expect((await cache.getFresh([FILE_NAME])).size).toBe(1);

    vi.setSystemTime(START_TIME + RESOLVED_TTL_MS);
    expect((await cache.getFresh([FILE_NAME])).size).toBe(0);
  });

  it('should keep a not resolved marker for 7 days and drop it afterwards', async () => {
    const cache = createThumbnailUrlCache(systemClock);
    await cache.putMany(new Map([[FILE_NAME, null]]));

    vi.setSystemTime(START_TIME + 6 * MILLISECONDS_PER_DAY);
    expect((await cache.getFresh([FILE_NAME])).size).toBe(1);

    vi.setSystemTime(START_TIME + 8 * MILLISECONDS_PER_DAY);
    expect((await cache.getFresh([FILE_NAME])).size).toBe(0);
  });

  it('should ignore an entry stored with another schema version', async () => {
    await storage.setItem(`local:wme:image:${FILE_NAME}`, {
      schemaVersion: 999,
      url: THUMBNAIL_URL,
      fetchedAt: START_TIME,
    });

    const fresh = await createThumbnailUrlCache(systemClock).getFresh([FILE_NAME]);

    expect(fresh.size).toBe(0);
  });

  it('should ignore an entry whose stored address is on a refused host', async () => {
    await storage.setItem(`local:wme:image:${FILE_NAME}`, {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      url: 'https://upload.wikimedia.org.evil.example/500px-Adan_Canto.jpg',
      fetchedAt: START_TIME,
    });

    const fresh = await createThumbnailUrlCache(systemClock).getFresh([FILE_NAME]);

    expect(fresh.size).toBe(0);
  });

  it('should ignore an entry whose stored shape is not the expected one', async () => {
    await storage.setItem(`local:wme:image:${FILE_NAME}`, {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      url: THUMBNAIL_URL,
    });

    const fresh = await createThumbnailUrlCache(systemClock).getFresh([FILE_NAME]);

    expect(fresh.size).toBe(0);
  });

  it('should store the not resolved marker when the address does not pass the guard', async () => {
    const cache = createThumbnailUrlCache(systemClock);

    await cache.putMany(
      new Map([[FILE_NAME, 'https://upload.wikimedia.org.evil.example/a.jpg']]),
    );

    expect((await cache.getFresh([FILE_NAME])).get(FILE_NAME)).toBeNull();
  });

  it('should read and write nothing when there is no entry', async () => {
    const cache = createThumbnailUrlCache(systemClock);
    await cache.putMany(new Map());

    expect((await cache.getFresh([])).size).toBe(0);
    expect(Object.keys(await storage.snapshot('local'))).toHaveLength(0);
  });

  it('should write nothing for a file name the guard refuses', async () => {
    const cache = createThumbnailUrlCache(systemClock);

    await cache.putMany(new Map([['../secret.jpg', THUMBNAIL_URL]]));

    expect(Object.keys(await storage.snapshot('local'))).toHaveLength(0);
    expect((await cache.getFresh(['../secret.jpg'])).size).toBe(0);
  });

  it('should de-duplicate the requested file names', async () => {
    const cache = createThumbnailUrlCache(systemClock);
    await cache.putMany(new Map([[FILE_NAME, THUMBNAIL_URL]]));

    const fresh = await cache.getFresh([FILE_NAME, FILE_NAME]);

    expect(fresh.size).toBe(1);
  });
});
