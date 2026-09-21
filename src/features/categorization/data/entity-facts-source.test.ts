import { describe, it, expect } from 'vitest';
import {
  createReplayFetch,
  recordedEntityIds,
  type ReplayCall,
} from '../../../../tests/helpers/wikidata-replay';
import { ENTITY_BATCH_SIZE } from '../../../core/config/wikimedia';
import { createMemoryCooldownStore, type FetchLike } from '../../../core/http/fetch-json';
import { HUMAN_CLASS_ID } from '../domain/category-roots';
import type { EntityFactsSource } from '../domain/ports';
import { createEntityFactsSource } from './entity-facts-source';

const EINSTEIN_QID = 'Q937';
const PULP_FICTION_QID = 'Q104123';
/** Q780 is a taxon in the recording: its occupations cell is an empty string. */
const TAXON_QID = 'Q780';
/** A deleted entity: the service answers 200 with no row at all for it. */
const ABSENT_QID = 'Q999999999';

const HTTP_OK = 200;
const JSON_MEDIA_TYPE = 'application/json';

/**
 * The replay refuses an entity it has no row for, because the real query always
 * answers one row per requested item. This hand made empty answer is the only
 * way left to exercise the deleted entity branch.
 */
const emptyResultFetch: FetchLike = () =>
  Promise.resolve(
    new Response(JSON.stringify({ head: { vars: [] }, results: { bindings: [] } }), {
      status: HTTP_OK,
      headers: { 'Content-Type': JSON_MEDIA_TYPE },
    }),
  );

const ENTITY_URI_PREFIX = 'http://www.wikidata.org/entity/';
const FILE_PATH_URI_PREFIX = 'http://commons.wikimedia.org/wiki/Special:FilePath/';

/**
 * Answers one row for Einstein with the given cells. The recording predates
 * the image properties, so the values of those are written here by hand.
 */
function bindingFetch(cells: Readonly<Record<string, string>>): FetchLike {
  const binding = Object.fromEntries(
    Object.entries({ item: `${ENTITY_URI_PREFIX}${EINSTEIN_QID}`, ...cells }).map(
      ([variable, value]) => [variable, { value }],
    ),
  );

  return () =>
    Promise.resolve(
      new Response(JSON.stringify({ head: { vars: [] }, results: { bindings: [binding] } }), {
        status: HTTP_OK,
        headers: { 'Content-Type': JSON_MEDIA_TYPE },
      }),
    );
}

/** A private cooldown store per source: no rate limit leaks between tests. */
function makeSource(fetchImpl: FetchLike): EntityFactsSource {
  return createEntityFactsSource({ fetchImpl, cooldownStore: createMemoryCooldownStore() });
}

function sparqlCall(calls: readonly ReplayCall[]): ReplayCall {
  const call = calls.find((candidate) => candidate.kind === 'entity-facts');
  if (call === undefined) {
    throw new Error('No entity facts request was performed');
  }
  return call;
}

describe('createEntityFactsSource', () => {
  it('should parse the classes and occupations of a human from the real recording', async () => {
    const replay = createReplayFetch();

    const facts = await makeSource(replay.fetchImpl).fetchFacts([EINSTEIN_QID]);

    const einstein = facts.get(EINSTEIN_QID);
    expect(einstein?.classIds).toContain(HUMAN_CLASS_ID);
    expect(einstein?.occupationIds.length).toBeGreaterThan(0);
    for (const occupationId of einstein?.occupationIds ?? []) {
      expect(occupationId).toMatch(/^Q\d+$/);
    }
  });

  it('should return an empty array when a grouped cell is an empty string', async () => {
    const replay = createReplayFetch();

    const facts = await makeSource(replay.fetchImpl).fetchFacts([TAXON_QID]);

    expect(facts.get(TAXON_QID)?.occupationIds).toEqual([]);
    expect(facts.get(TAXON_QID)?.classIds.length).toBeGreaterThan(0);
  });

  it('should parse the external ids of Pulp Fiction', async () => {
    const replay = createReplayFetch();

    const facts = await makeSource(replay.fetchImpl).fetchFacts([PULP_FICTION_QID]);

    expect(facts.get(PULP_FICTION_QID)?.externalIds).toMatchObject({
      letterboxdFilm: 'pulp-fiction',
      tmdbMovieId: '680',
    });
  });

  it('should return empty facts for a QID that the service did not return', async () => {
    const facts = await makeSource(emptyResultFetch).fetchFacts([ABSENT_QID]);

    expect(facts.get(ABSENT_QID)).toEqual({
      qid: ABSENT_QID,
      classIds: [],
      parentClassIds: [],
      occupationIds: [],
      externalIds: expect.objectContaining({ tmdbMovieId: null }) as unknown,
      image: null,
      seriesImage: null,
    });
  });

  it('should keep the first image property of the table that the item holds', async () => {
    const source = makeSource(
      bindingFetch({
        imageLogo: `${FILE_PATH_URI_PREFIX}Logo.svg`,
        imagePicture: `${FILE_PATH_URI_PREFIX}Einstein%201921.jpg`,
      }),
    );

    const facts = await source.fetchFacts([EINSTEIN_QID]);

    expect(facts.get(EINSTEIN_QID)?.image).toEqual({
      fileName: 'Einstein 1921.jpg',
      kind: 'picture',
    });
  });

  it('should try the next property when the first value yields no usable name', async () => {
    const source = makeSource(
      bindingFetch({
        imagePicture: 'https://evil.example/wiki/Special:FilePath/Einstein.jpg',
        imageLogo: `${FILE_PATH_URI_PREFIX}Logo%20-%20R%C3%A9publique%20fran%C3%A7aise.svg`,
      }),
    );

    const facts = await source.fetchFacts([EINSTEIN_QID]);

    expect(facts.get(EINSTEIN_QID)?.image).toEqual({
      fileName: 'Logo - République française.svg',
      kind: 'emblem',
    });
  });

  it('should give no image when the item holds none and when none is usable', async () => {
    const withoutImage = await makeSource(bindingFetch({})).fetchFacts([EINSTEIN_QID]);
    const withUnusableImage = await makeSource(
      bindingFetch({ imagePicture: `${FILE_PATH_URI_PREFIX}Einstein.ogv` }),
    ).fetchFacts([EINSTEIN_QID]);

    expect(withoutImage.get(EINSTEIN_QID)?.image).toBeNull();
    expect(withUnusableImage.get(EINSTEIN_QID)?.image).toBeNull();
  });

  it('should read the picture of the whole the item is one edition of apart from its own', async () => {
    // Both measured on the live service 2026-09-21: the trophy of the
    // competition answers for the card of its 2005 edition.
    const source = makeSource(
      bindingFetch({
        imagePicture: `${FILE_PATH_URI_PREFIX}Einstein%201921.jpg`,
        seriesImagePicture: `${FILE_PATH_URI_PREFIX}Troph%C3%A9e%20des%20champions.jpeg`,
      }),
    );

    const facts = await source.fetchFacts([EINSTEIN_QID]);

    expect(facts.get(EINSTEIN_QID)?.image).toEqual({
      fileName: 'Einstein 1921.jpg',
      kind: 'picture',
    });
    expect(facts.get(EINSTEIN_QID)?.seriesImage).toEqual({
      fileName: 'Trophée des champions.jpeg',
      kind: 'picture',
    });
  });

  it('should read the logo of a series as an emblem, and none when the item is part of nothing', async () => {
    const withLogo = await makeSource(
      bindingFetch({ seriesImageLogo: `${FILE_PATH_URI_PREFIX}Grown-ish%20logo.png` }),
    ).fetchFacts([EINSTEIN_QID]);
    const withoutSeries = await makeSource(bindingFetch({})).fetchFacts([EINSTEIN_QID]);

    expect(withLogo.get(EINSTEIN_QID)?.seriesImage).toEqual({
      fileName: 'Grown-ish logo.png',
      kind: 'emblem',
    });
    expect(withoutSeries.get(EINSTEIN_QID)?.seriesImage).toBeNull();
  });

  it('should read the image of a flag as an emblem', async () => {
    const source = makeSource(
      bindingFetch({ imageFlag: `${FILE_PATH_URI_PREFIX}Flag%20of%20the%20Azores.svg` }),
    );

    const facts = await source.fetchFacts([EINSTEIN_QID]);

    expect(facts.get(EINSTEIN_QID)?.image).toEqual({
      fileName: 'Flag of the Azores.svg',
      kind: 'emblem',
    });
  });

  it('should split the QIDs of the real recording into batches of 50', async () => {
    const replay = createReplayFetch();
    const qids = recordedEntityIds();

    const facts = await makeSource(replay.fetchImpl).fetchFacts(qids);

    expect(facts.size).toBe(qids.length);
    expect(replay.countOf('entity-facts')).toBe(Math.ceil(qids.length / ENTITY_BATCH_SIZE));
  });

  it('should perform no request when there is no QID', async () => {
    const replay = createReplayFetch();

    await makeSource(replay.fetchImpl).fetchFacts([]);

    expect(replay.calls).toHaveLength(0);
  });

  it('should POST the query with the SPARQL headers and no credentials', async () => {
    const replay = createReplayFetch();

    await makeSource(replay.fetchImpl).fetchFacts([EINSTEIN_QID]);

    const call = sparqlCall(replay.calls);
    expect(call.method).toBe('POST');
    expect(call.url).toBe('https://query.wikidata.org/sparql');
    expect(call.headers.get('Accept')).toBe('application/sparql-results+json');
    expect(call.headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');
    expect(call.headers.get('Api-User-Agent')).toContain('WikiMastersExtended/');
    expect(call.credentials).toBe('omit');
    expect(call.query).toContain(`wd:${EINSTEIN_QID}`);
  });
});
