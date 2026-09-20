import { describe, it, expect, vi } from 'vitest';
import {
  createMemoryCooldownStore,
  fetchJson,
  HttpError,
  InvalidJsonError,
  RateLimitedError,
  type FetchLike,
} from './fetch-json';

const TEST_REQUEST = {
  url: 'https://example.test/api',
  method: 'GET',
  headers: { Accept: 'application/json' },
} as const;

const OTHER_HOST_REQUEST = {
  url: 'https://other.test/api',
  method: 'GET',
  headers: { Accept: 'application/json' },
} as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function errorResponse(status: number, headers?: Record<string, string>): Response {
  return new Response('', { status, headers });
}

function makeSleep(): { sleep: (ms: number) => Promise<void>; delays: number[] } {
  const delays: number[] = [];
  return {
    delays,
    sleep: (ms: number): Promise<void> => {
      delays.push(ms);
      return Promise.resolve();
    },
  };
}

describe('fetchJson', () => {
  it('should return the parsed body when the response is successful', async () => {
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue(jsonResponse({ hello: 'world' }));

    const result = await fetchJson(TEST_REQUEST, { fetchImpl });

    expect(result).toEqual({ hello: 'world' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('should send credentials omit on every attempt', async () => {
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue(jsonResponse({}));

    await fetchJson(TEST_REQUEST, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      TEST_REQUEST.url,
      expect.objectContaining({ credentials: 'omit' }),
    );
  });

  it('should retry when the response is 503 and succeed on the next attempt', async () => {
    const fetchImpl: FetchLike = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const { sleep, delays } = makeSleep();

    const result = await fetchJson(TEST_REQUEST, { fetchImpl, sleep });

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([1_000]);
  });

  it('should honour a numeric Retry-After header when the response is 429', async () => {
    const fetchImpl: FetchLike = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429, { 'Retry-After': '5' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const { sleep, delays } = makeSleep();

    await fetchJson(TEST_REQUEST, { fetchImpl, sleep });

    expect(delays).toEqual([5_000]);
  });

  it('should fall back to the backoff when Retry-After is not a number', async () => {
    const fetchImpl: FetchLike = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503, { 'Retry-After': 'soon' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const { sleep, delays } = makeSleep();

    await fetchJson(TEST_REQUEST, { fetchImpl, sleep });

    expect(delays).toEqual([1_000]);
  });

  it('should fall back to the backoff when Retry-After is an HTTP date', async () => {
    const fetchImpl: FetchLike = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503, { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const { sleep, delays } = makeSleep();

    await fetchJson(TEST_REQUEST, { fetchImpl, sleep });

    expect(delays).toEqual([1_000]);
  });

  it('should give up with the HTTP status when every attempt fails', async () => {
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue(errorResponse(500));
    const { sleep, delays } = makeSleep();

    await expect(fetchJson(TEST_REQUEST, { fetchImpl, sleep })).rejects.toBeInstanceOf(HttpError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([1_000, 2_000]);
  });

  it('should expose the status on the thrown error', async () => {
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue(errorResponse(500));
    const { sleep } = makeSleep();

    const error = await fetchJson(TEST_REQUEST, { fetchImpl, sleep }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 500, message: 'HTTP 500' });
  });

  it('should not retry when the response is 400', async () => {
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue(errorResponse(400));
    const { sleep } = makeSleep();

    await expect(fetchJson(TEST_REQUEST, { fetchImpl, sleep })).rejects.toMatchObject({
      status: 400,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('should retry a network error and rethrow it after the last attempt', async () => {
    const fetchImpl: FetchLike = vi.fn().mockRejectedValue(new Error('network down'));
    const { sleep } = makeSleep();

    await expect(fetchJson(TEST_REQUEST, { fetchImpl, sleep })).rejects.toThrow('network down');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('should abort the request when the timeout elapses', async () => {
    const fetchImpl: FetchLike = vi.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    });
    const { sleep } = makeSleep();

    await expect(
      fetchJson(TEST_REQUEST, { fetchImpl, sleep, timeoutMs: 1, maxAttempts: 1 }),
    ).rejects.toThrow('aborted');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('should retry a timeout like any other network error', async () => {
    const fetchImpl: FetchLike = vi.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    });
    const { sleep, delays } = makeSleep();

    await expect(fetchJson(TEST_REQUEST, { fetchImpl, sleep, timeoutMs: 1 })).rejects.toThrow(
      'aborted',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([1_000, 2_000]);
  });

  it('should keep the timeout armed while the body is being read', async () => {
    let abortedDuringBody = false;
    const stallingBody: FetchLike = (_url: string, init: RequestInit) => {
      const response = {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: (): Promise<unknown> =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              abortedDuringBody = true;
              reject(new Error('aborted while reading the body'));
            });
          }),
      };
      // A hand made response is needed: a real one cannot stall on demand.
      return Promise.resolve(response as unknown as Response);
    };
    const { sleep } = makeSleep();

    await expect(
      fetchJson(TEST_REQUEST, { fetchImpl: stallingBody, sleep, timeoutMs: 1, maxAttempts: 1 }),
    ).rejects.toThrow('aborted while reading the body');
    expect(abortedDuringBody).toBe(true);
  });

  it('should throw a typed error without the body when a 200 is not JSON', async () => {
    const fetchImpl: FetchLike = vi
      .fn()
      .mockResolvedValue(new Response('<html>secret session token</html>', { status: 200 }));
    const { sleep } = makeSleep();

    const error = await fetchJson(TEST_REQUEST, { fetchImpl, sleep }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(InvalidJsonError);
    expect(error).toMatchObject({ status: 200, message: 'Invalid JSON body (HTTP 200)' });
    expect(String(error)).not.toContain('secret');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('should use the backoff when Retry-After asks for no delay at all', async () => {
    const fetchImpl: FetchLike = vi
      .fn()
      .mockResolvedValue(errorResponse(429, { 'Retry-After': '0' }));
    const { sleep, delays } = makeSleep();

    await expect(fetchJson(TEST_REQUEST, { fetchImpl, sleep })).rejects.toBeInstanceOf(HttpError);
    // Without this, the three attempts would go out back to back.
    expect(delays).toEqual([1_000, 2_000]);
  });

  it('should not retry and should start a cooldown when Retry-After exceeds the cap', async () => {
    const fetchImpl: FetchLike = vi
      .fn()
      .mockResolvedValue(errorResponse(429, { 'Retry-After': '120' }));
    const { sleep, delays } = makeSleep();
    const cooldownStore = createMemoryCooldownStore();

    const error = await fetchJson(TEST_REQUEST, {
      fetchImpl,
      sleep,
      now: () => 0,
      cooldownStore,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RateLimitedError);
    expect(error).toMatchObject({ status: 429, retryAfterMs: 120_000 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(delays).toEqual([]);
  });

  it('should refuse a later call to the same host without any request while cooling down', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503, { 'Retry-After': '120' }));
    const fetchImpl: FetchLike = fetchMock;
    const { sleep } = makeSleep();
    const cooldownStore = createMemoryCooldownStore();
    await fetchJson(TEST_REQUEST, { fetchImpl, sleep, now: () => 0, cooldownStore }).catch(
      () => undefined,
    );
    const callsAfterFirstFailure = fetchMock.mock.calls.length;

    const error = await fetchJson(TEST_REQUEST, {
      fetchImpl,
      sleep,
      now: () => 60_000,
      cooldownStore,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RateLimitedError);
    expect(error).toMatchObject({ status: 503, retryAfterMs: 60_000 });
    expect(fetchMock.mock.calls).toHaveLength(callsAfterFirstFailure);
  });

  it('should call the host again once the cooldown has elapsed', async () => {
    const fetchImpl: FetchLike = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429, { 'Retry-After': '120' }))
      .mockResolvedValue(jsonResponse({ ok: true }));
    const { sleep } = makeSleep();
    const cooldownStore = createMemoryCooldownStore();
    await fetchJson(TEST_REQUEST, { fetchImpl, sleep, now: () => 0, cooldownStore }).catch(
      () => undefined,
    );

    const result = await fetchJson(TEST_REQUEST, {
      fetchImpl,
      sleep,
      now: () => 120_001,
      cooldownStore,
    });

    expect(result).toEqual({ ok: true });
  });

  it('should leave the other hosts callable while one host is cooling down', async () => {
    const fetchImpl: FetchLike = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429, { 'Retry-After': '120' }))
      .mockResolvedValue(jsonResponse({ ok: true }));
    const { sleep } = makeSleep();
    const cooldownStore = createMemoryCooldownStore();
    await fetchJson(TEST_REQUEST, { fetchImpl, sleep, now: () => 0, cooldownStore }).catch(
      () => undefined,
    );

    const result = await fetchJson(OTHER_HOST_REQUEST, {
      fetchImpl,
      sleep,
      now: () => 1,
      cooldownStore,
    });

    expect(result).toEqual({ ok: true });
  });
});
