import { describe, it, expect } from 'vitest';
import {
  createReplayFetch,
  MISSING_TITLE,
  readFixture,
  REDIRECTED_TITLE,
  UNNORMALIZED_TITLE,
  type ReplayCall,
} from '../../../../tests/helpers/wikidata-replay';
import { createMemoryCooldownStore, type FetchLike } from '../../../core/http/fetch-json';
import { isRecord } from '../../../core/types/guards';
import type { TitleResolver } from '../domain/ports';
import { createTitleResolver } from './title-resolver';

const EINSTEIN_QID = 'Q937';
const PULP_FICTION_QID = 'Q104123';

/** The only frwiki endpoint the extension is allowed to reach. */
const FRWIKI_API_ENDPOINT = 'https://fr.wikipedia.org/w/api.php';

/** Every title of the main recording, in the order the API returned them. */
function recordedTitles(): string[] {
  const payload = readFixture('frwiki-titles.json');
  if (!isRecord(payload) || !isRecord(payload['query'])) {
    throw new Error('Unexpected fixture shape');
  }
  const pages = payload['query']['pages'];
  if (!Array.isArray(pages)) {
    throw new Error('Unexpected fixture shape');
  }
  return pages.map((page) => {
    if (!isRecord(page) || typeof page['title'] !== 'string') {
      throw new Error('Unexpected fixture shape');
    }
    return page['title'];
  });
}

/** A private cooldown store per resolver: no rate limit leaks between tests. */
function makeResolver(fetchImpl: FetchLike): TitleResolver {
  return createTitleResolver({ fetchImpl, cooldownStore: createMemoryCooldownStore() });
}

function firstCall(calls: readonly ReplayCall[]): ReplayCall {
  const call = calls[0];
  if (call === undefined) {
    throw new Error('No request was performed');
  }
  return call;
}

describe('createTitleResolver', () => {
  it('should map every title of the real recording to a QID', async () => {
    const replay = createReplayFetch();
    const titles = recordedTitles();

    const resolved = await makeResolver(replay.fetchImpl).resolveTitles(
      titles,
    );

    expect(resolved.size).toBe(titles.length);
    for (const title of titles) {
      expect(resolved.get(title)).toMatch(/^Q\d+$/);
    }
    expect(resolved.get('Pulp Fiction')).toBe(PULP_FICTION_QID);
  });

  it('should follow a redirect and a normalization to the same QID', async () => {
    const replay = createReplayFetch();

    const resolved = await makeResolver(replay.fetchImpl).resolveTitles([
      REDIRECTED_TITLE,
      UNNORMALIZED_TITLE,
    ]);

    expect(resolved.get(REDIRECTED_TITLE)).toBe(EINSTEIN_QID);
    expect(resolved.get(UNNORMALIZED_TITLE)).toBe(EINSTEIN_QID);
  });

  it('should map a title containing the batch separator to null without sending it', async () => {
    const replay = createReplayFetch();
    const corruptingTitle = 'Alpha|Beta';

    const resolved = await makeResolver(replay.fetchImpl).resolveTitles([
      corruptingTitle,
      'Pulp Fiction',
    ]);

    expect(resolved.get(corruptingTitle)).toBeNull();
    expect(resolved.get('Pulp Fiction')).toBe(PULP_FICTION_QID);
    expect(firstCall(replay.calls).titles).toEqual(['Pulp Fiction']);
  });

  it('should map a missing page to null', async () => {
    const replay = createReplayFetch();

    const resolved = await makeResolver(replay.fetchImpl).resolveTitles([
      MISSING_TITLE,
    ]);

    expect(resolved.get(MISSING_TITLE)).toBeNull();
  });

  it('should perform three requests when 120 titles are resolved', async () => {
    const replay = createReplayFetch();
    const titles = Array.from({ length: 120 }, (_unused, index) => `Titre ${String(index)}`);

    await makeResolver(replay.fetchImpl).resolveTitles(titles);

    expect(replay.countOf('frwiki')).toBe(3);
  });

  it('should send every request to the frwiki API endpoint', async () => {
    const replay = createReplayFetch();
    const titles = recordedTitles();

    await makeResolver(replay.fetchImpl).resolveTitles(titles);

    expect(replay.calls.length).toBeGreaterThan(0);
    for (const call of replay.calls) {
      expect(call.url.startsWith(`${FRWIKI_API_ENDPOINT}?`)).toBe(true);
    }
  });

  it('should perform no request when there is no title', async () => {
    const replay = createReplayFetch();

    const resolved = await makeResolver(replay.fetchImpl).resolveTitles([]);

    expect(resolved.size).toBe(0);
    expect(replay.calls).toHaveLength(0);
  });

  it('should send the anonymous CORS parameters, the user agent and no credentials', async () => {
    const replay = createReplayFetch();

    await makeResolver(replay.fetchImpl).resolveTitles(['Pulp Fiction']);

    const call = firstCall(replay.calls);
    expect(call.url).toContain('origin=*');
    expect(call.url).toContain('redirects=1');
    expect(call.url).toContain('ppprop=wikibase_item');
    expect(call.url).toContain('formatversion=2');
    expect(call.headers.get('Api-User-Agent')).toContain('WikiMastersExtended/');
    expect(call.credentials).toBe('omit');
  });
});
