import { describe, it, expect } from 'vitest';
import { createReplayFetch } from '../../../../tests/helpers/wikidata-replay';
import { createMemoryCooldownStore, type FetchLike } from '../../../core/http/fetch-json';
import type { ClassRootsSource } from '../domain/ports';
import { createClassRootsSource } from './class-roots-source';

/** Q10742 is a French commune in the recording: it reaches the place roots. */
const COMMUNE_CLASS_ID = 'Q10742';
/** Q11424 "film" is itself a category root. */
const FILM_ROOT_ID = 'Q11424';
/** Q33999 "actor" is itself an occupation root. */
const ACTOR_ROOT_ID = 'Q33999';
/** Q1231865 "pédagogue" in the recording: it reaches the scientist root. */
const TEACHER_CLASS_ID = 'Q1231865';
/** Absent from every recording, so it reaches no root at all. */
const UNKNOWN_CLASS_ID = 'Q999999999';
/** Q10798782 "acteur de télévision" reaches the actor root and the artist one. */
const TELEVISION_ACTOR_CLASS_ID = 'Q10798782';
const ARTIST_ROOT_ID = 'Q483501';
/** Administrative territorial entity, geographical feature and region. */
const COMMUNE_MATCHED_ROOT_IDS = ['Q56061', 'Q618123', 'Q82794'];

/** A private cooldown store per source: no rate limit leaks between tests. */
function makeSource(fetchImpl: FetchLike): ClassRootsSource {
  return createClassRootsSource({ fetchImpl, cooldownStore: createMemoryCooldownStore() });
}

describe('createClassRootsSource', () => {
  it('should resolve a class to the target of its first matching root group', async () => {
    const replay = createReplayFetch();

    const resolutions =
      await makeSource(replay.fetchImpl).resolveCategoryClasses([COMMUNE_CLASS_ID]);

    expect(resolutions.get(COMMUNE_CLASS_ID)).toEqual({
      target: 'place',
      label: null,
      matchedRootIds: COMMUNE_MATCHED_ROOT_IDS,
    });
  });

  it('should resolve a class that is itself a root without any request', async () => {
    const replay = createReplayFetch();

    const resolutions = await makeSource(replay.fetchImpl).resolveCategoryClasses([FILM_ROOT_ID]);

    expect(resolutions.get(FILM_ROOT_ID)).toEqual({
      target: 'film_tv',
      label: null,
      matchedRootIds: [FILM_ROOT_ID],
    });
    expect(replay.calls).toHaveLength(0);
  });

  it('should resolve a class that reaches no root to a null target', async () => {
    const replay = createReplayFetch();

    const resolutions =
      await makeSource(replay.fetchImpl).resolveCategoryClasses([UNKNOWN_CLASS_ID]);

    expect(resolutions.get(UNKNOWN_CLASS_ID)).toEqual({
      target: null,
      label: null,
      matchedRootIds: [],
    });
  });

  it('should resolve an occupation to its subtype and its French label', async () => {
    const replay = createReplayFetch();

    const resolutions =
      await makeSource(replay.fetchImpl).resolveOccupationClasses([TEACHER_CLASS_ID]);

    expect(resolutions.get(TEACHER_CLASS_ID)?.target).toBe('science');
    expect(resolutions.get(TEACHER_CLASS_ID)?.label).toBe('pédagogue');
  });

  it('should still request the label of an occupation that is itself a root', async () => {
    const replay = createReplayFetch();

    const resolutions =
      await makeSource(replay.fetchImpl).resolveOccupationClasses([ACTOR_ROOT_ID]);

    expect(resolutions.get(ACTOR_ROOT_ID)).toEqual({
      target: 'cinema',
      label: 'acteur ou actrice',
      matchedRootIds: [ACTOR_ROOT_ID],
    });
    expect(replay.countOf('occupation-roots')).toBe(0);
    expect(replay.countOf('class-labels')).toBe(1);
  });

  it('should request no label when the occupation reaches no root', async () => {
    const replay = createReplayFetch();

    const resolutions =
      await makeSource(replay.fetchImpl).resolveOccupationClasses([UNKNOWN_CLASS_ID]);

    expect(resolutions.get(UNKNOWN_CLASS_ID)).toEqual({
      target: null,
      label: null,
      matchedRootIds: [],
    });
    expect(replay.countOf('class-labels')).toBe(0);
  });

  it('should split the classes into batches of 50', async () => {
    const replay = createReplayFetch();
    const classIds = Array.from({ length: 120 }, (_unused, index) => `Q${String(index + 1000)}`);

    await makeSource(replay.fetchImpl).resolveCategoryClasses(classIds);

    expect(replay.countOf('class-roots')).toBe(3);
  });

  it('should report every root a class reaches, sorted', async () => {
    const replay = createReplayFetch();

    const resolutions = await makeSource(replay.fetchImpl).resolveOccupationClasses([
      TELEVISION_ACTOR_CLASS_ID,
    ]);

    // Cinema wins the target, but the artist root is kept: the Letterboxd role
    // of an occupation is read from the roots, not from the target.
    expect(resolutions.get(TELEVISION_ACTOR_CLASS_ID)?.target).toBe('cinema');
    expect(resolutions.get(TELEVISION_ACTOR_CLASS_ID)?.matchedRootIds).toEqual([
      ACTOR_ROOT_ID,
      ARTIST_ROOT_ID,
    ]);
  });

  it('should perform no request when there is no class', async () => {
    const replay = createReplayFetch();

    await makeSource(replay.fetchImpl).resolveCategoryClasses([]);

    expect(replay.calls).toHaveLength(0);
  });
});
