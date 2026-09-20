import { describe, it, expect } from 'vitest';
import { TITLE_BATCH_SIZE } from '../../../core/config/wikimedia';
import { createMemoryCooldownStore, type FetchLike } from '../../../core/http/fetch-json';
import type { ThumbnailUrlSource } from '../../categorization/domain/ports';
import { createThumbnailUrlResolver } from './thumbnail-resolver';

const HTTP_OK = 200;
const JSON_MEDIA_TYPE = 'application/json';

/** The only frwiki endpoint the extension is allowed to reach. */
const FRWIKI_API_ENDPOINT = 'https://fr.wikipedia.org/w/api.php';

const KNOWN_FILE = 'Adan Canto.jpg';
const UNKNOWN_FILE = 'Nope zzz.png';

const KNOWN_THUMBNAIL_URL =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Adan_Canto.jpg/500px-Adan_Canto.jpg' +
  '?utm_source=fr.wikipedia.org&utm_campaign=imageinfo&utm_content=thumbnail';

/**
 * A real answer of the live API, measured on 2026-09-20 and trimmed. Three
 * things in it break a naive implementation, and each one has a test below:
 * the file that Commons holds is reported `missing` from frwiki, the pages come
 * back in an order that is not the order of the request (the unknown file first),
 * and the titles were normalized from `File:` to `Fichier:`.
 */
const REAL_ANSWER = {
  query: {
    normalized: [{ from: `File:${KNOWN_FILE}`, to: `Fichier:${KNOWN_FILE}` }],
    pages: [
      { title: `Fichier:${UNKNOWN_FILE}`, missing: true },
      {
        title: `Fichier:${KNOWN_FILE}`,
        missing: true,
        imageinfo: [{ thumburl: KNOWN_THUMBNAIL_URL }],
      },
    ],
  },
};

const EMPTY_ANSWER = { query: { pages: [] } };

interface RecordedCall {
  url: string;
  parameters: URLSearchParams;
  headers: Headers;
  credentials: RequestCredentials | undefined;
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
    });
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: HTTP_OK,
        headers: { 'Content-Type': JSON_MEDIA_TYPE },
      }),
    );
  };

  return { fetchImpl, calls };
}

/** A private cooldown store per resolver: no rate limit leaks between tests. */
function makeResolver(fetchImpl: FetchLike): ThumbnailUrlSource {
  return createThumbnailUrlResolver({ fetchImpl, cooldownStore: createMemoryCooldownStore() });
}

function firstCall(calls: readonly RecordedCall[]): RecordedCall {
  const call = calls[0];
  if (call === undefined) {
    throw new Error('No request was performed');
  }
  return call;
}

function requestedTitles(call: RecordedCall): string[] {
  const titles = call.parameters.get('titles');
  return titles === null || titles === '' ? [] : titles.split('|');
}

describe('createThumbnailUrlResolver', () => {
  it('should ask for every file under the File namespace, separated by the batch separator', async () => {
    const replay = answeringFetch(REAL_ANSWER);

    await makeResolver(replay.fetchImpl).resolveThumbnailUrls([KNOWN_FILE, UNKNOWN_FILE]);

    const call = firstCall(replay.calls);
    expect(call.url.startsWith(`${FRWIKI_API_ENDPOINT}?`)).toBe(true);
    expect(requestedTitles(call)).toEqual([`File:${KNOWN_FILE}`, `File:${UNKNOWN_FILE}`]);
  });

  it('should ask for the url of the thumbnail at the width the cards show', async () => {
    const replay = answeringFetch(REAL_ANSWER);

    await makeResolver(replay.fetchImpl).resolveThumbnailUrls([KNOWN_FILE]);

    const call = firstCall(replay.calls);
    expect(call.parameters.get('action')).toBe('query');
    expect(call.parameters.get('prop')).toBe('imageinfo');
    expect(call.parameters.get('iiprop')).toBe('url');
    expect(call.parameters.get('iiurlwidth')).toBe('500');
    expect(call.parameters.get('formatversion')).toBe('2');
    expect(call.parameters.get('origin')).toBe('*');
    expect(call.headers.get('Api-User-Agent')).toContain('WikiMastersExtended/');
    expect(call.credentials).toBe('omit');
  });

  it('should send one request per batch when more files than a batch are asked for', async () => {
    const replay = answeringFetch(EMPTY_ANSWER);
    const fileNames = Array.from(
      { length: TITLE_BATCH_SIZE * 2 + 1 },
      (_unused, index) => `Fichier ${String(index)}.jpg`,
    );

    await makeResolver(replay.fetchImpl).resolveThumbnailUrls(fileNames);

    expect(replay.calls).toHaveLength(3);
    expect(requestedTitles(firstCall(replay.calls))).toHaveLength(TITLE_BATCH_SIZE);
  });

  it('should resolve a file that frwiki reports as missing while Commons holds it', async () => {
    const replay = answeringFetch(REAL_ANSWER);

    const resolved = await makeResolver(replay.fetchImpl).resolveThumbnailUrls([KNOWN_FILE]);

    // The page carries `"missing": true` AND a full imageinfo block: deciding
    // on `missing` would throw away every single image.
    expect(resolved.get(KNOWN_FILE)).toBe(KNOWN_THUMBNAIL_URL);
  });

  it('should match the answer through the normalized titles and not by index', async () => {
    const replay = answeringFetch(REAL_ANSWER);

    const resolved = await makeResolver(replay.fetchImpl).resolveThumbnailUrls([
      KNOWN_FILE,
      UNKNOWN_FILE,
    ]);

    // The pages came back in the reverse order of the request: matching by
    // index would hand the address of the known file to the unknown one.
    expect(resolved.get(KNOWN_FILE)).toBe(KNOWN_THUMBNAIL_URL);
    expect(resolved.get(UNKNOWN_FILE)).toBeNull();
  });

  it('should give no address when the thumbnail is on a host outside the allowlist', async () => {
    const replay = answeringFetch({
      query: {
        normalized: [{ from: `File:${KNOWN_FILE}`, to: `Fichier:${KNOWN_FILE}` }],
        pages: [
          {
            title: `Fichier:${KNOWN_FILE}`,
            imageinfo: [
              { thumburl: 'https://upload.wikimedia.org.evil.example/500px-Adan_Canto.jpg' },
            ],
          },
        ],
      },
    });

    const resolved = await makeResolver(replay.fetchImpl).resolveThumbnailUrls([KNOWN_FILE]);

    expect(resolved.get(KNOWN_FILE)).toBeNull();
  });

  it('should give no address when the answer carries no imageinfo at all', async () => {
    const replay = answeringFetch({
      query: {
        normalized: [{ from: `File:${KNOWN_FILE}`, to: `Fichier:${KNOWN_FILE}` }],
        pages: [{ title: `Fichier:${KNOWN_FILE}`, missing: true }],
      },
    });

    const resolved = await makeResolver(replay.fetchImpl).resolveThumbnailUrls([KNOWN_FILE]);

    expect(resolved.has(KNOWN_FILE)).toBe(true);
    expect(resolved.get(KNOWN_FILE)).toBeNull();
  });

  it('should give no address when the answer carries no page for the file', async () => {
    const replay = answeringFetch(EMPTY_ANSWER);

    const resolved = await makeResolver(replay.fetchImpl).resolveThumbnailUrls([KNOWN_FILE]);

    expect(resolved.get(KNOWN_FILE)).toBeNull();
  });

  it('should map a file name the guard refuses to null without sending it', async () => {
    const replay = answeringFetch(REAL_ANSWER);
    const corruptingName = 'Alpha|Beta.jpg';

    const resolved = await makeResolver(replay.fetchImpl).resolveThumbnailUrls([
      corruptingName,
      KNOWN_FILE,
    ]);

    expect(resolved.get(corruptingName)).toBeNull();
    expect(requestedTitles(firstCall(replay.calls))).toEqual([`File:${KNOWN_FILE}`]);
  });

  it('should perform no request when there is no file name', async () => {
    const replay = answeringFetch(REAL_ANSWER);

    const resolved = await makeResolver(replay.fetchImpl).resolveThumbnailUrls([]);

    expect(resolved.size).toBe(0);
    expect(replay.calls).toHaveLength(0);
  });

  it('should reject an answer whose shape is not the expected one', async () => {
    const replay = answeringFetch({ error: { code: 'unknown_action' } });

    await expect(
      makeResolver(replay.fetchImpl).resolveThumbnailUrls([KNOWN_FILE]),
    ).rejects.toThrow('Unexpected frwiki imageinfo response shape');
  });
});
