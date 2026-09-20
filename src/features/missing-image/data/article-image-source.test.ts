import { describe, it, expect } from 'vitest';
import { createMemoryCooldownStore, type FetchLike } from '../../../core/http/fetch-json';
import type { ArticleImageSource } from '../../categorization/domain/ports';
import { ARTICLE_TITLE_BATCH_SIZE, createArticleImageSource } from './article-image-source';

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
 * Constructed for the test: none of the real disambiguation pages checked
 * against the live API names a file after itself, so the fixture above never
 * actually exercises the disambiguation guard, it never produces a candidate
 * regardless of it. "Accueil" carries a file matching its own title so that
 * removing the guard is the only thing that turns this pair red.
 */
const SELF_NAMED_DISAMBIGUATION_TITLE = 'Accueil';
const SELF_NAMED_DISAMBIGUATION_FILE = 'Accueil.jpg';

const SELF_NAMED_DISAMBIGUATION_ANSWER = {
  batchcomplete: true,
  query: {
    pages: [
      {
        pageid: 10,
        ns: 0,
        title: SELF_NAMED_DISAMBIGUATION_TITLE,
        images: [{ ns: 6, title: `Fichier:${SELF_NAMED_DISAMBIGUATION_FILE}` }],
        pageprops: { disambiguation: '' },
      },
    ],
  },
};

/** The positive control: the same page and the same matching file, not a disambiguation page. */
const SELF_NAMED_MATCH_ANSWER = {
  batchcomplete: true,
  query: {
    pages: [
      {
        pageid: 10,
        ns: 0,
        title: SELF_NAMED_DISAMBIGUATION_TITLE,
        images: [{ ns: 6, title: `Fichier:${SELF_NAMED_DISAMBIGUATION_FILE}` }],
      },
    ],
  },
};

const SELF_NAMED_MATCH_REPOSITORY_ANSWER = {
  batchcomplete: true,
  query: {
    normalized: [
      { from: `File:${SELF_NAMED_DISAMBIGUATION_FILE}`, to: `Fichier:${SELF_NAMED_DISAMBIGUATION_FILE}` },
    ],
    pages: [
      {
        ns: 6,
        title: `Fichier:${SELF_NAMED_DISAMBIGUATION_FILE}`,
        missing: true,
        known: true,
        imagerepository: 'shared',
        imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Accueil.jpg' }],
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

/**
 * Real, measured 2026-09-21 and trimmed: sixteen flags, an icon and one
 * photograph. No file is named after the article, and MediaWiki names that
 * photograph as the free lead picture of the page, underscores and all.
 */
const LEAD_PICTURE_TITLE = 'Discographie de Janet Jackson';
const LEAD_PICTURE_FILE = 'Janet Jackson Number Ones Tour 2011 (cropped).jpeg';

const LEAD_PICTURE_ARTICLE_ANSWER = {
  batchcomplete: true,
  query: {
    pages: [
      {
        pageid: 11985429,
        ns: 0,
        title: LEAD_PICTURE_TITLE,
        images: [
          { ns: 6, title: 'Fichier:Flag of Australia.svg' },
          { ns: 6, title: 'Fichier:Flag of France (lighter variant).svg' },
          { ns: 6, title: `Fichier:${LEAD_PICTURE_FILE}` },
          { ns: 6, title: 'Fichier:Musical notes.svg' },
        ],
        pageprops: {
          page_image_free: 'Janet_Jackson_Number_Ones_Tour_2011_(cropped).jpeg',
          wikibase_item: 'Q651655',
        },
      },
    ],
  },
};

/** The request asks for no image information, only where the file is hosted. */
const LEAD_PICTURE_REPOSITORY_ANSWER = {
  batchcomplete: true,
  query: {
    normalized: [
      {
        from: `File:${LEAD_PICTURE_FILE}`,
        to: `Fichier:${LEAD_PICTURE_FILE}`,
      },
    ],
    pages: [
      {
        ns: 6,
        title: `Fichier:${LEAD_PICTURE_FILE}`,
        missing: true,
        known: true,
        imagerepository: 'shared',
      },
    ],
  },
};

/** A cut answer naming a lead picture its own file list never reached. */
const LEAD_OUTSIDE_LIST_TITLE = 'Liste coupee';
const LEAD_OUTSIDE_LIST_ANSWER = {
  continue: { imcontinue: '18|Zzz', continue: '||' },
  query: {
    pages: [
      {
        pageid: 6,
        ns: 0,
        title: LEAD_OUTSIDE_LIST_TITLE,
        images: [{ ns: 6, title: 'Fichier:Sans rapport.jpg' }],
        pageprops: { page_image_free: 'Photo_de_tete.jpg' },
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

/**
 * A continuation whose OWN page carries no `images` key at all: the shape
 * MediaWiki's global `imlimit=max` cap actually produces for a page it never
 * got to, measured live on a batch of 50 titles (see ARTICLE_TITLE_BATCH_SIZE).
 */
const TRUNCATED_TITLE = 'Titre non examine';
const TRUNCATED_ANSWER = {
  continue: { imcontinue: '18|Zzz', continue: '||' },
  query: {
    pages: [{ pageid: 4, ns: 0, title: TRUNCATED_TITLE }],
  },
};

/** The same missing `images` key, but no continuation: a genuine "no file" answer. */
const NO_FILES_TITLE = 'Page sans fichier';
const NO_FILES_ANSWER = {
  batchcomplete: true,
  query: {
    pages: [{ pageid: 5, ns: 0, title: NO_FILES_TITLE }],
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
  it('should ask for the images, the disambiguation and the lead picture of every title', async () => {
    const replay = routedFetch({ 'images|pageprops': EMPTY_ARTICLE_ANSWER });

    await makeSource(replay.fetchImpl).findArticleImages([SAINT_MALO_TITLE, 'Autre titre']);

    const call = firstCall(replay.calls);
    expect(call.url.startsWith(`${FRWIKI_API_ENDPOINT}?`)).toBe(true);
    expect(requestedTitles(call)).toEqual([SAINT_MALO_TITLE, 'Autre titre']);
    expect(call.parameters.get('action')).toBe('query');
    expect(call.parameters.get('prop')).toBe('images|pageprops');
    expect(call.parameters.get('ppprop')).toBe('disambiguation|page_image_free');
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
      { length: ARTICLE_TITLE_BATCH_SIZE * 2 + 1 },
      (_unused, index) => `Titre ${String(index)}`,
    );

    await makeSource(replay.fetchImpl).findArticleImages(titles);

    expect(replay.calls).toHaveLength(3);
    expect(requestedTitles(firstCall(replay.calls))).toHaveLength(ARTICLE_TITLE_BATCH_SIZE);
  });

  it('should give the real answer of "Harry Hole (série télévisée)": its own file, confirmed on Commons', async () => {
    const replay = routedFetch({
      'images|pageprops': HARRY_HOLE_ARTICLE_ANSWER,
      imageinfo: HARRY_HOLE_REPOSITORY_ANSWER,
    });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([HARRY_HOLE_TITLE]);

    expect(resolved.get(HARRY_HOLE_TITLE)).toEqual({ fileName: HARRY_HOLE_FILE, kind: 'emblem' });
  });

  it('should give the lead picture of the article when no file carries its title', async () => {
    const replay = routedFetch({
      'images|pageprops': LEAD_PICTURE_ARTICLE_ANSWER,
      imageinfo: LEAD_PICTURE_REPOSITORY_ANSWER,
    });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([LEAD_PICTURE_TITLE]);

    expect(resolved.get(LEAD_PICTURE_TITLE)).toEqual({
      fileName: LEAD_PICTURE_FILE,
      kind: 'picture',
    });
  });

  it('should leave a title unresolved when the cut list does not hold its lead picture', async () => {
    const replay = routedFetch({ 'images|pageprops': LEAD_OUTSIDE_LIST_ANSWER });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([
      LEAD_OUTSIDE_LIST_TITLE,
    ]);

    expect(resolved.has(LEAD_OUTSIDE_LIST_TITLE)).toBe(false);
    expect(replay.calls).toHaveLength(1);
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

  it('should give nothing for a disambiguation page even when it carries a file named after itself', async () => {
    const replay = routedFetch({ 'images|pageprops': SELF_NAMED_DISAMBIGUATION_ANSWER });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([
      SELF_NAMED_DISAMBIGUATION_TITLE,
    ]);

    expect(resolved.get(SELF_NAMED_DISAMBIGUATION_TITLE)).toBeNull();
    // No repository request either: this is the disambiguation guard alone,
    // not the "no candidate" shortcut the DISAMBIGUATION_ANSWER above cannot
    // tell apart from it.
    expect(replay.calls).toHaveLength(1);
  });

  it('should give the matching file when the same page is not a disambiguation page', async () => {
    // The positive control of the test above: removing the disambiguation
    // guard in the source must turn this pair red, since both requests then
    // resolve to the same file.
    const replay = routedFetch({
      'images|pageprops': SELF_NAMED_MATCH_ANSWER,
      imageinfo: SELF_NAMED_MATCH_REPOSITORY_ANSWER,
    });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([
      SELF_NAMED_DISAMBIGUATION_TITLE,
    ]);

    expect(resolved.get(SELF_NAMED_DISAMBIGUATION_TITLE)).toEqual({
      fileName: SELF_NAMED_DISAMBIGUATION_FILE,
      kind: 'picture',
    });
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

  it('should not follow a continuation of the images list, and not trust the partial list it returned', async () => {
    const replay = routedFetch({ 'images|pageprops': CONTINUATION_ANSWER });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([CONTINUATION_TITLE]);

    // The page carries a file list, but the answer was cut short and the cut
    // falls in the MIDDLE of one page's list, which the arbitrary page order
    // makes impossible to identify: finding no match in it proves nothing.
    expect(resolved.has(CONTINUATION_TITLE)).toBe(false);
    // A second request would carry `imcontinue`: there is none at all.
    expect(replay.calls).toHaveLength(1);
  });

  it('should leave a title unresolved, rather than fileless, when its own file list was cut off by the continuation', async () => {
    const replay = routedFetch({ 'images|pageprops': TRUNCATED_ANSWER });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([TRUNCATED_TITLE]);

    // Absent, not null: a title never remembered as a miss it was never given
    // the chance to be.
    expect(resolved.has(TRUNCATED_TITLE)).toBe(false);
  });

  it('should treat a title as having no file when its page carries no images key and the answer was not cut short', async () => {
    const replay = routedFetch({ 'images|pageprops': NO_FILES_ANSWER });

    const resolved = await makeSource(replay.fetchImpl).findArticleImages([NO_FILES_TITLE]);

    expect(resolved.get(NO_FILES_TITLE)).toBeNull();
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
