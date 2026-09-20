import {
  INITIAL_RETRY_DELAY_MS,
  MAX_REQUEST_ATTEMPTS,
  MAX_RETRY_DELAY_MS,
  REQUEST_TIMEOUT_MS,
  RETRY_DELAY_FACTOR,
} from '../config/wikimedia';

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_MIN = 500;
const RETRY_AFTER_HEADER = 'Retry-After';
const MILLISECONDS_PER_SECOND = 1_000;
const FIRST_ATTEMPT = 1;

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

type SleepFn = (durationMs: number) => Promise<void>;

type HttpMethod = 'GET' | 'POST';

export interface FetchJsonRequest {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: string;
}

export interface FetchJsonOptions {
  fetchImpl?: FetchLike;
  sleep?: SleepFn;
  now?: () => number;
  timeoutMs?: number;
  maxAttempts?: number;
  cooldownStore?: CooldownStore;
}

/** Carries the HTTP status. The response body is deliberately never included. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message = `HTTP ${status}`) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** A successful response whose body is not JSON. The body never reaches the message. */
export class InvalidJsonError extends HttpError {
  constructor(status: number) {
    super(status, `Invalid JSON body (HTTP ${status})`);
    this.name = 'InvalidJsonError';
  }
}

/** The host asked for a pause longer than the cap, or is still inside that pause. */
export class RateLimitedError extends HttpError {
  readonly retryAfterMs: number;

  constructor(status: number, retryAfterMs: number) {
    const seconds = Math.ceil(retryAfterMs / MILLISECONDS_PER_SECOND);
    super(status, `Rate limited (HTTP ${status}), retry in ${String(seconds)} s`);
    this.name = 'RateLimitedError';
    this.retryAfterMs = retryAfterMs;
  }
}

/** A pause asked by one host, until the `until` instant. */
export interface HostCooldown {
  until: number;
  status: number;
}

/**
 * Where the cooldowns live. Wikimedia bans clients that ignore a long
 * `Retry-After`, so a host that asks for one is left alone until it expires.
 *
 * The port is asynchronous because a service worker is killed while idle: the
 * background wires a persistent implementation, so the pause survives a restart
 * instead of being forgotten within seconds. Kept as a port so this module
 * stays free of any browser API.
 */
export interface CooldownStore {
  get(host: string): Promise<HostCooldown | null>;
  set(host: string, cooldown: HostCooldown): Promise<void>;
  delete(host: string): Promise<void>;
}

/** Cooldowns held for the lifetime of the instance only. */
export function createMemoryCooldownStore(): CooldownStore {
  const cooldowns = new Map<string, HostCooldown>();

  return {
    get(host: string): Promise<HostCooldown | null> {
      return Promise.resolve(cooldowns.get(host) ?? null);
    },
    set(host: string, cooldown: HostCooldown): Promise<void> {
      cooldowns.set(host, cooldown);
      return Promise.resolve();
    },
    delete(host: string): Promise<void> {
      cooldowns.delete(host);
      return Promise.resolve();
    },
  };
}

/** Fallback for a caller that wires no store. Never shared with a test. */
const defaultCooldownStore = createMemoryCooldownStore();

function defaultFetch(input: string, init: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init);
}

function defaultSleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function hostOf(url: string): string {
  return new URL(url).host;
}

function isRetryableStatus(status: number): boolean {
  return status === HTTP_TOO_MANY_REQUESTS || status >= HTTP_SERVER_ERROR_MIN;
}

function backoffDelayMs(attempt: number): number {
  const delay = INITIAL_RETRY_DELAY_MS * RETRY_DELAY_FACTOR ** (attempt - FIRST_ATTEMPT);
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

/** Milliseconds asked by a numeric `Retry-After`, null when absent or an HTTP date. */
function parseRetryAfterMs(response: Response): number | null {
  const headerValue = response.headers.get(RETRY_AFTER_HEADER);
  if (headerValue === null || headerValue.trim() === '') {
    return null;
  }
  const seconds = Number(headerValue);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }
  return seconds * MILLISECONDS_PER_SECOND;
}

async function parseJson(response: Response, signal: AbortSignal): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (signal.aborted) {
      // The timeout fired while the body was streaming: a network error, not a
      // malformed body, so it stays retryable.
      throw error;
    }
    // The parse error message quotes the body, which must never be logged.
    throw new InvalidJsonError(response.status);
  }
}

type AttemptResult =
  | { ok: true; payload: unknown }
  | { ok: false; status: number; retryAfterMs: number | null };

/**
 * One attempt, abort timer armed until the body is fully read and parsed: a
 * response that stalls after its headers must not hang the service worker.
 */
async function attemptRequest(
  request: FetchJsonRequest,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<AttemptResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      // The user's Wikipedia cookies must never be attached to these calls.
      credentials: 'omit',
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, status: response.status, retryAfterMs: parseRetryAfterMs(response) };
    }
    return { ok: true, payload: await parseJson(response, controller.signal) };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Everything the retry decision needs besides the failure itself. */
interface RetryContext {
  host: string;
  now: () => number;
  cooldownStore: CooldownStore;
}

async function assertNotCoolingDown(context: RetryContext): Promise<void> {
  const cooldown = await context.cooldownStore.get(context.host);
  if (cooldown === null) {
    return;
  }
  const remainingMs = cooldown.until - context.now();
  if (remainingMs > 0) {
    throw new RateLimitedError(cooldown.status, remainingMs);
  }
  await context.cooldownStore.delete(context.host);
}

/** Delay before the next attempt, or throws when this failure must not be retried. */
async function delayBeforeRetryMs(
  failure: { status: number; retryAfterMs: number | null },
  attempt: number,
  isLastAttempt: boolean,
  context: RetryContext,
): Promise<number> {
  const { status, retryAfterMs } = failure;
  const retryable = isRetryableStatus(status);

  if (retryable && retryAfterMs !== null && retryAfterMs > MAX_RETRY_DELAY_MS) {
    await context.cooldownStore.set(context.host, {
      until: context.now() + retryAfterMs,
      status,
    });
    throw new RateLimitedError(status, retryAfterMs);
  }
  if (!retryable || isLastAttempt) {
    throw new HttpError(status);
  }

  const backoffMs = backoffDelayMs(attempt);
  // The larger of the two: a `Retry-After: 0` would otherwise fire every
  // attempt back to back, which is exactly what the backoff prevents.
  return retryAfterMs === null ? backoffMs : Math.max(retryAfterMs, backoffMs);
}

/**
 * Performs a JSON request with a timeout and retries on 429, 5xx and network
 * errors. Other 4xx responses and unparseable bodies fail immediately. The
 * returned value is the parsed body, left as `unknown` so that callers
 * validate what they use.
 */
export async function fetchJson(
  request: FetchJsonRequest,
  options: FetchJsonOptions = {},
): Promise<unknown> {
  const {
    fetchImpl = defaultFetch,
    sleep = defaultSleep,
    now = Date.now,
    timeoutMs = REQUEST_TIMEOUT_MS,
    maxAttempts = MAX_REQUEST_ATTEMPTS,
    cooldownStore = defaultCooldownStore,
  } = options;

  const context: RetryContext = { host: hostOf(request.url), now, cooldownStore };
  await assertNotCoolingDown(context);

  for (let attempt = FIRST_ATTEMPT; ; attempt += 1) {
    const isLastAttempt = attempt >= maxAttempts;
    let result: AttemptResult;

    try {
      result = await attemptRequest(request, fetchImpl, timeoutMs);
    } catch (error) {
      if (isLastAttempt || error instanceof InvalidJsonError) {
        throw error;
      }
      await sleep(backoffDelayMs(attempt));
      continue;
    }

    if (result.ok) {
      return result.payload;
    }
    await sleep(await delayBeforeRetryMs(result, attempt, isLastAttempt, context));
  }
}
