import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { fetchJson, RateLimitedError, type FetchLike } from '../http/fetch-json';
import { createStoredCooldownStore } from './cooldown-store';

const HOST = 'query.wikidata.org';
const COOLDOWN_KEY = 'local:wme:cooldown:v1:query.wikidata.org';
const REQUEST = {
  url: `https://${HOST}/sparql`,
  method: 'GET',
  headers: { Accept: 'application/json' },
} as const;

const LONG_RETRY_AFTER_SECONDS = 3_600;
const LONG_RETRY_AFTER_MS = LONG_RETRY_AFTER_SECONDS * 1_000;
const ONE_MINUTE_MS = 60_000;

function rateLimitedResponse(): Response {
  return new Response('', {
    status: 429,
    headers: { 'Retry-After': String(LONG_RETRY_AFTER_SECONDS) },
  });
}

function neverCalled(): FetchLike {
  return () => Promise.reject(new Error('The request should not have been sent'));
}

function noSleep(): Promise<void> {
  return Promise.resolve();
}

describe('createStoredCooldownStore', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should still block a call after the service worker has been restarted', async () => {
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue(rateLimitedResponse());
    // The worker that receives the 429 records the pause...
    await fetchJson(REQUEST, {
      fetchImpl,
      sleep: noSleep,
      now: () => 0,
      cooldownStore: createStoredCooldownStore(),
    }).catch(() => undefined);

    // ...and a brand new worker, with a brand new store, must still honour it.
    const error = await fetchJson(REQUEST, {
      fetchImpl: neverCalled(),
      sleep: noSleep,
      now: () => ONE_MINUTE_MS,
      cooldownStore: createStoredCooldownStore(),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RateLimitedError);
    expect(error).toMatchObject({ status: 429, retryAfterMs: LONG_RETRY_AFTER_MS - ONE_MINUTE_MS });
  });

  it('should remove the stored cooldown once it has elapsed', async () => {
    const store = createStoredCooldownStore();
    await store.set(HOST, { until: ONE_MINUTE_MS, status: 429 });
    const fetchImpl: FetchLike = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await fetchJson(REQUEST, {
      fetchImpl,
      sleep: noSleep,
      now: () => ONE_MINUTE_MS + 1,
      cooldownStore: store,
    });

    expect(result).toEqual({ ok: true });
    expect(await storage.getItem(COOLDOWN_KEY)).toBeNull();
  });

  it('should ignore a stored value whose shape is not the expected one', async () => {
    await storage.setItem(COOLDOWN_KEY, { until: 'later' });

    expect(await createStoredCooldownStore().get(HOST)).toBeNull();
  });

  it('should report no cooldown when reading the storage fails', async () => {
    vi.spyOn(fakeBrowser.storage.local, 'get').mockRejectedValue(new Error('storage unavailable'));

    expect(await createStoredCooldownStore().get(HOST)).toBeNull();
  });

  it('should let the request through when writing the cooldown fails', async () => {
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(new Error('quota exceeded'));
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue(rateLimitedResponse());

    const error = await fetchJson(REQUEST, {
      fetchImpl,
      sleep: noSleep,
      now: () => 0,
      cooldownStore: createStoredCooldownStore(),
    }).catch((caught: unknown) => caught);

    // The pause is lost, but the caller still gets the typed rate limit error.
    expect(error).toBeInstanceOf(RateLimitedError);
  });
});
