import { describe, it, expect } from 'vitest';
import { TITLE_BATCH_SIZE } from '../../../core/config/wikimedia';
import { createMemoryCooldownStore, type FetchLike } from '../../../core/http/fetch-json';
import type { ArticleImageSource } from '../../categorization/domain/ports';
import { createArticleImageSource } from './article-image-source';

const HTTP_OK = 200;
const JSON_MEDIA_TYPE = 'application/json';

/** The only frwiki endpoint the extension is allowed to reach. */
const FRWIKI_API_ENDPOINT = 'https://fr.wikipedia.org/w/api.php';

const EMPTY_ARTICLE_ANSWER = { batchcomplete: true, query: { pages: [] } };

/**
 * A real answer of the live API, measured on 2026-09-20 and trimmed: "Harry
 * Hole (série télévisée)" uses a dozen files, one of which, "Harry Hole.png",
 * is named exactly after the article once its parenthetical is stripped.
 */
const HARRY_HOLE_TITLE = 'Harry Hole (série télévisée)';
const HARRY_HOLE_FILE = 'Harry Hole.png';

const HARRY_HOLE_ARTICLE_ANSWER = {
  batchcomplete: true,
  query: {
    pages: [
      {
        pageid: 17352049,
        ns: 0,
        title: HARRY_HOLE_TITLE,
        images: [
          { ns: 6, title: 'Fichier:BBFC 18 2019.svg' },
          { ns: 6, title: 'Fichier:Flag of Norway.svg' },
          { ns: 6, title: `Fichier:${HARRY_HOLE_FILE}` },
          { ns: 6, title: 'Fichier:Netflix icon.svg' },
        ],
      },
    ],
  },
};

/** Also real, measured the same day: the file is missing from frwiki because it lives on Commons. */
const HARRY_HOLE_REPOSITORY_ANSWER = {
  batchcomplete: true,
  query: {
    normalized: [{ from: `File:${HARRY_HOLE_FILE}`, to: `Fichier:${HARRY_HOLE_FILE}` }],
    pages: [
      {
        ns: 6,
        title: `Fichier:${HARRY_HOLE_FILE}`,
        missing: true,
        known: true,
        imagerepository: 'shared',
        imageinfo: [
          {
            url: 'https://upload.wikimedia.org/wikipedia/commons/1/14/Harry_Hole.png',
            descriptionurl: 'https://commons.wikimedia.org/wiki/File:Harry_Hole.png',
          },
        ],
      },
    ],
  },
};

/** Real, measured 2026-09-20: "AAAA" is a disambiguation page. */
const DISAMBIGUATION_TITLE = 'AAAA';
const DISAMBIGUATION_ANSWER = {
  batchcomplete: true,
  query: {
    pages: [
      {
        pageid: 1248598,
        ns: 0,
        title: DISAMBIGUATION_TITLE,
        images: [{ ns: 6, title: 'Fichier:Logo disambig.svg' }],
        pageprops: { disambiguation: '' },
      },
    ],
  },
};

/**
 * The repository answer is real, measured 2026-09-20 on a genuine frwiki-only
 * file: a small local logo, uploaded and hosted under the non free exception,
 * served from upload.wikimedia.org/wikipedia/fr/ and so passing the host
 * allowlist of phase 7c. The surrounding article is constructed for the test:
 * what matters is that its own file list names this exact file.
 */
const LOCAL_FILE_TITLE = 'Logo-01 Villers-Semeuse';
const LOCAL_FILE_NAME = 'Logo-01 Villers-Semeuse.png';

const LOCAL_FILE_ARTICLE_ANSWER = {
  batchcomplete: true,
  query: {
    pages: [
      {
        pageid: 1,
        ns: 0,
        title: LOCAL_FILE_TITLE,
        images: [{ ns: 6, title: `Fichier:${LOCAL_FILE_NAME}` }],
      },
    ],
  },
};

const LOCAL_FILE_REPOSITORY_ANSWER = {
  batchcomplete: true,
  query: {
    normalized: [{ from: `File:${LOCAL_FILE_NAME}`, to: `Fichier:${LOCAL_FILE_NAME}` }],
    pages: [
      {
        pageid: 17505566,
        ns: 6,
        title: `Fichier:${LOCAL_FILE_NAME}`,
        imagerepository: 'local',
        imageinfo: [
          { url: 'https://upload.wikimedia.org/wikipedia/fr/f/f0/Logo-01_Villers-Semeuse.png' },
        ],
      },
    ],
  },
};

/** Real, measured 2026-09-20 and trimmed: none of these files is named "Saint-Malo". */
const SAINT_MALO_TITLE = 'Saint-Malo';
const SAINT_MALO_ARTICLE_ANSWER = {
  batchcomplete: true,
  query: {
    pages: [
      {
        pageid: 2,
        ns: 0,
        title: SAINT_MALO_TITLE,
        images: [
          { ns: 6, title: 'Fichier:2007-08-17 Saint-Malo Fort.jpg' },
          { ns: 6, title: 'Fichier:2017-fr.wp-orange-source.svg' },
          { ns: 6, title: 'Fichier:35288-Saint-Malo-Hydro.jpeg' },
        ],
      },
    ],
  },
};

/** Real, measured 2026-09-20 and trimmed: a redirect and a normalization on the same batch. */
const REDIRECTED_TITLE = 'Einstein';
const UNNORMALIZED_TITLE = 'albert Einstein';
const EINSTEIN_FINAL_TITLE = 'Albert Einstein';
const EINSTEIN_FILE = 'Albert Einstein.jpg';

const EINSTEIN_ARTICLE_ANSWER = {
  batchcomplete: true,
  query: {
    normalized: [{ from: UNNORMALIZED_TITLE, to: EINSTEIN_FINAL_TITLE }],
    redirects: [{ from: REDIRECTED_TITLE, to: EINSTEIN_FINAL_TITLE }],
    pages: [
      {
        pageid: 7856,
        ns: 0,
        title: EINSTEIN_FINAL_TITLE,
        images: [
          { ns: 6, title: 'Fichier:1979 CPA 4944.jpg' },
          { ns: 6, title: `Fichier:${EINSTEIN_FILE}` },
          { ns: 6, title: 'Fichier:Blue pencil.svg' },
        ],
      },
    ],
  },
};

const EINSTEIN_REPOSITORY_ANSWER = {
  batchcomplete: true,
  query: {
    normalized: [{ from: `File:${EINSTEIN_FILE}`, to: `Fichier:${EINSTEIN_FILE}` }],
    pages: [
      {
        ns: 6,
        title: `Fichier:${EINSTEIN_FILE}`,
        missing: true,
        known: true,
        imagerepository: 'shared',
        imageinfo: [
          { url: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Albert_Einstein_Head.jpg' },
        ],
      },
    ],
  },
};

/** A batch that still carries a continuation of the images list. */
const CONTINUATION_TITLE = 'Grande liste';
const CONTINUATION_ANSWER = {
  continue: { imcontinue: '18|Zzz', continue: '||' },
  query: {
    pages: [
      {
        pageid: 3,
        ns: 0,
        title: CONTINUATION_TITLE,
        images: [{ ns: 6, title: 'Fichier:Sans rapport.jpg' }],
      },
    ],
  },
};

interface RecordedCall {
  url: string;
  parameters: URLSearchParams;
  headers: Headers;
  credentials: RequestCredentials | undefined;
}

/** Routes each call by its `prop` parameter, so a test supplies one answer per request kind. */
function routedFetch(byProp: Readonly<Record<string, unknown>>): {
  fetchImpl: FetchLike;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];

  const fetchImpl: FetchLike = (url: string, init: RequestInit): Promise<Response> => {
    const parameters = new URL(url).searchParams;
    calls.push({ url, parameters, headers: new Headers(init.headers), credentials: init.credentials });

    const prop = parameters.get('prop') ?? '';
    const payload = byProp[prop];
    if (payload === undefined) {
      throw new Error(`No canned answer for prop=${prop}`);
    }
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: HTTP_OK,
        headers: { 'Content-Type': JSON_MEDIA_TYPE },
      }),
    );
  };

  return { fetchImpl, calls };
}

function makeSource(fetchImpl: FetchLike): ArticleImageSource {
  return createArticleImageSource({ fetchImpl, cooldownStore: createMemoryCooldownStore() });
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

describe('createArticleImageSource', () => {
  it('should ask for the images and the disambiguation property of every title', async () => {
    const replay = routedFetch({ 'images|pageprops': EMPTY_ARTICLE_ANSWER });

    await makeSource(replay.fetchImpl).findArticleImages([SAINT_MALO_TITLE, 'Autre titre']);

    const call = firstCall(replay.calls);
    expect(call.url.startsWith(`${FRWIKI_API_ENDPOINT}?`)).toBe(true);
    expect(requestedTitles(call)).toEqual([SAINT_MALO_TITLE, 'Autre titre']);
    expect(call.parameters.get('action')).toBe('query');
    expect(call.parameters.get('prop')).toBe('images|pageprops');
    expect(call.parameters.get('ppprop')).toBe('disambiguation');
    expect(call.parameters.get('imlimit')).toBe('max');
    expect(call.parameters.get('redirects')).toBe('1');
    expect(call.parameters.get('formatversion')).toBe('2');
    expect(call.parameters.get('origin')).toBe('*');
    expect(call.headers.get('Api-User-Agent')).toContain('WikiMastersExtended/');
    expect(call.credentials).toBe('omit');
  });

  it('should send one request per batch when more titles than a batch are asked for', async () => {
    const replay = routedFetch({ 'images|pageprops': EMPTY_ARTICLE_ANSWER });
    const titles = Array.from(
      { length: TITLE_BATCH_SIZE * 2 + 1 },
      (_unused, index) => `Titre ${String(index)}`,
    );

    await makeSource(replay.fetchImpl).findArticleImages(titles);

    expect(replay.calls).toHaveLength(3);
    expect(requestedTitles(firstCall(replay.calls))).toHaveLength(TITLE_BATCH_SIZE);
  });

  it('should give the real answer of "Harry Hole (série télévisée)": its own file, confirmed on Commons', async () => {
    const replay = routedFetch({
      'images|pageprops': HARRY_HOLE_ARTICLE_ANSWER,
      imageinfo: HARRY_HOLE_REPOSITORY_ANSWER,
    });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([HARRY_HOLE_TITLE]);

    expect(resolved.get(HARRY_HOLE_TITLE)).toEqual({ fileName: HARRY_HOLE_FILE, kind: 'emblem' });
  });

  it('should ask for the repository of only the matched candidate, under the File namespace', async () => {
    const replay = routedFetch({
      'images|pageprops': HARRY_HOLE_ARTICLE_ANSWER,
      imageinfo: HARRY_HOLE_REPOSITORY_ANSWER,
    });

    await makeSource(replay.fetchImpl).findArticleImages([HARRY_HOLE_TITLE]);

    expect(replay.calls).toHaveLength(2);
    const repositoryCall = replay.calls[1];
    if (repositoryCall === undefined) {
      throw new Error('No repository request was performed');
    }
    expect(requestedTitles(repositoryCall)).toEqual([`File:${HARRY_HOLE_FILE}`]);
    expect(repositoryCall.parameters.get('action')).toBe('query');
    expect(repositoryCall.parameters.get('formatversion')).toBe('2');
    expect(repositoryCall.parameters.get('origin')).toBe('*');
    expect(repositoryCall.credentials).toBe('omit');
  });

  it('should give nothing for a disambiguation page, whatever its own files list', async () => {
    const replay = routedFetch({ 'images|pageprops': DISAMBIGUATION_ANSWER });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([DISAMBIGUATION_TITLE]);

    expect(resolved.get(DISAMBIGUATION_TITLE)).toBeNull();
    // No file to confirm: the repository stage is never reached.
    expect(replay.calls).toHaveLength(1);
  });

  it('should give nothing when the matching file is hosted on frwiki and not on Commons', async () => {
    const replay = routedFetch({
      'images|pageprops': LOCAL_FILE_ARTICLE_ANSWER,
      imageinfo: LOCAL_FILE_REPOSITORY_ANSWER,
    });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([LOCAL_FILE_TITLE]);

    expect(resolved.get(LOCAL_FILE_TITLE)).toBeNull();
  });

  it("should give nothing when the article's files carry no match", async () => {
    const replay = routedFetch({ 'images|pageprops': SAINT_MALO_ARTICLE_ANSWER });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([SAINT_MALO_TITLE]);

    expect(resolved.get(SAINT_MALO_TITLE)).toBeNull();
    expect(replay.calls).toHaveLength(1);
  });

  it('should match the answer through the normalized and the redirected titles', async () => {
    const replay = routedFetch({
      'images|pageprops': EINSTEIN_ARTICLE_ANSWER,
      imageinfo: EINSTEIN_REPOSITORY_ANSWER,
    });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([
      REDIRECTED_TITLE,
      UNNORMALIZED_TITLE,
    ]);

    expect(resolved.get(REDIRECTED_TITLE)).toEqual({ fileName: EINSTEIN_FILE, kind: 'picture' });
    expect(resolved.get(UNNORMALIZED_TITLE)).toEqual({ fileName: EINSTEIN_FILE, kind: 'picture' });
  });

  it('should not follow a continuation of the images list', async () => {
    const replay = routedFetch({ 'images|pageprops': CONTINUATION_ANSWER });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([CONTINUATION_TITLE]);

    expect(resolved.get(CONTINUATION_TITLE)).toBeNull();
    // A second request would carry `imcontinue`: there is none at all.
    expect(replay.calls).toHaveLength(1);
  });

  it('should map a title containing the batch separator to null without sending it', async () => {
    const replay = routedFetch({ 'images|pageprops': HARRY_HOLE_ARTICLE_ANSWER });
    const corruptingTitle = 'Alpha|Beta';

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([
      corruptingTitle,
      SAINT_MALO_TITLE,
    ]);

    expect(resolved.get(corruptingTitle)).toBeNull();
    expect(requestedTitles(firstCall(replay.calls))).toEqual([SAINT_MALO_TITLE]);
  });

  it('should perform no request when there is no title', async () => {
    const replay = routedFetch({ 'images|pageprops': EMPTY_ARTICLE_ANSWER });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([]);

    expect(resolved.size).toBe(0);
    expect(replay.calls).toHaveLength(0);
  });

  it('should reject an answer whose shape is not the expected one', async () => {
    const replay = routedFetch({ 'images|pageprops': { error: { code: 'unknown_action' } } });

    await expect(
      makeSource(replay.fetchImpl).findArticleImages([SAINT_MALO_TITLE]),
    ).rejects.toThrow('Unexpected frwiki images response shape');
  });
});
