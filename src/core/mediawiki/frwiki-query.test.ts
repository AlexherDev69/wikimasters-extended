import { describe, it, expect } from 'vitest';
import { API_USER_AGENT, API_USER_AGENT_HEADER, FRWIKI_API_URL } from '../config/wikimedia';
import {
  createMemoryCooldownStore,
  HttpError,
  type FetchJsonOptions,
  type FetchLike,
} from '../http/fetch-json';
import { fetchFrwikiQuery } from './frwiki-query';

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

interface RecordedCall {
  url: string;
  parameters: URLSearchParams;
  headers: Headers;
  credentials: RequestCredentials | undefined;
  method: string | undefined;
}

interface AnsweringFetch {
  fetchImpl: FetchLike;
  calls: RecordedCall[];
}

/** Answers every request with `payload` and records what was asked for. */
function answeringFetch(payload: unknown): AnsweringFetch {
  const calls: RecordedCall[] = [];

  const fetchImpl: FetchLike = (url: string, init: RequestInit): Promise<Response> => {
    calls.push({
      url,
      parameters: new URL(url).searchParams,
      headers: new Headers(init.headers),
      credentials: init.credentials,
      method: init.method,
    });
    return Promise.resolve(new Response(JSON.stringify(payload), { status: HTTP_OK }));
  };

  return { fetchImpl, calls };
}

/** A private cooldown store per call: no rate limit leaks between tests. */
function options(fetchImpl: FetchLike): FetchJsonOptions {
  return { fetchImpl, cooldownStore: createMemoryCooldownStore() };
}

function onlyCall(calls: readonly RecordedCall[]): RecordedCall {
  const call = calls[0];
  if (call === undefined) {
    throw new Error('No request was performed');
  }
  return call;
}

describe('fetchFrwikiQuery', () => {
  it('should return the parsed body of the answer as is', async () => {
    const answering = answeringFetch({ query: { pages: [] } });

    const payload = await fetchFrwikiQuery({}, ['Einstein'], options(answering.fetchImpl));

    expect(payload).toEqual({ query: { pages: [] } });
  });

  it('should send the request to the only frwiki endpoint over GET', async () => {
    const answering = answeringFetch({});

    await fetchFrwikiQuery({}, ['Einstein'], options(answering.fetchImpl));

    const call = onlyCall(answering.calls);
    expect(call.url.startsWith(`${FRWIKI_API_URL}?`)).toBe(true);
    expect(call.method).toBe('GET');
  });

  it('should ask for a query in the modern JSON shape under the anonymous CORS mode', async () => {
    const answering = answeringFetch({});

    await fetchFrwikiQuery({}, ['Einstein'], options(answering.fetchImpl));

    const call = onlyCall(answering.calls);
    expect(call.parameters.get('action')).toBe('query');
    expect(call.parameters.get('format')).toBe('json');
    expect(call.parameters.get('formatversion')).toBe('2');
    expect(call.parameters.get('origin')).toBe('*');
  });

  it('should identify the client to Wikimedia and accept JSON', async () => {
    const answering = answeringFetch({});

    await fetchFrwikiQuery({}, ['Einstein'], options(answering.fetchImpl));

    const call = onlyCall(answering.calls);
    expect(call.headers.get('Accept')).toBe('application/json');
    expect(call.headers.get(API_USER_AGENT_HEADER)).toBe(API_USER_AGENT);
  });

  it('should never attach the credentials of the user', async () => {
    const answering = answeringFetch({});

    await fetchFrwikiQuery({}, ['Einstein'], options(answering.fetchImpl));

    expect(onlyCall(answering.calls).credentials).toBe('omit');
  });

  it('should add the parameters of the caller to the shared ones', async () => {
    const answering = answeringFetch({});

    await fetchFrwikiQuery(
      { prop: 'imageinfo', iiprop: 'url' },
      ['Fichier:Adan Canto.jpg'],
      options(answering.fetchImpl),
    );

    const call = onlyCall(answering.calls);
    expect(call.parameters.get('prop')).toBe('imageinfo');
    expect(call.parameters.get('iiprop')).toBe('url');
    expect(call.parameters.get('action')).toBe('query');
  });

  it('should join the batch with the separator the API expects', async () => {
    const answering = answeringFetch({});

    await fetchFrwikiQuery({}, ['Einstein', 'Pulp Fiction'], options(answering.fetchImpl));

    expect(onlyCall(answering.calls).parameters.get('titles')).toBe('Einstein|Pulp Fiction');
  });

  it('should send an empty titles parameter when the batch is empty', async () => {
    const answering = answeringFetch({});

    await fetchFrwikiQuery({}, [], options(answering.fetchImpl));

    expect(onlyCall(answering.calls).parameters.get('titles')).toBe('');
  });

  it('should let the failure of the underlying request through', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(new Response('', { status: HTTP_NOT_FOUND }));

    await expect(fetchFrwikiQuery({}, ['Einstein'], options(fetchImpl))).rejects.toBeInstanceOf(
      HttpError,
    );
  });
});
