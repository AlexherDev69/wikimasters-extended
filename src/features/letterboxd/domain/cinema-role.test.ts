import { describe, it, expect } from 'vitest';
import { OCCUPATION_ROOT_GROUPS } from '../../categorization/domain/category-roots';
import { cinemaRoleFromRoots, CINEMA_ROLE_ROOT_IDS, CINEMA_SUBTYPE } from './cinema-role';

const DIRECTOR_ROOT_ID = 'Q2526255';
const ACTOR_ROOT_ID = 'Q33999';
const WRITER_ROOT_ID = 'Q28389';
const PRODUCER_ROOT_ID = 'Q3282637';
/** Cinematographer: a cinema occupation with no Letterboxd path of its own. */
const CINEMATOGRAPHER_ROOT_ID = 'Q222344';

describe('cinemaRoleFromRoots', () => {
  it('should return the role of each root that carries one', () => {
    expect(cinemaRoleFromRoots([DIRECTOR_ROOT_ID])).toBe('director');
    expect(cinemaRoleFromRoots([ACTOR_ROOT_ID])).toBe('actor');
    expect(cinemaRoleFromRoots([WRITER_ROOT_ID])).toBe('writer');
    expect(cinemaRoleFromRoots([PRODUCER_ROOT_ID])).toBe('producer');
  });

  it('should prefer the director when the occupation reaches several role roots', () => {
    expect(cinemaRoleFromRoots([PRODUCER_ROOT_ID, ACTOR_ROOT_ID, DIRECTOR_ROOT_ID])).toBe(
      'director',
    );
    expect(cinemaRoleFromRoots([PRODUCER_ROOT_ID, ACTOR_ROOT_ID])).toBe('actor');
  });

  it('should return no role for a cinema occupation that carries none', () => {
    expect(cinemaRoleFromRoots([CINEMATOGRAPHER_ROOT_ID])).toBeNull();
    expect(cinemaRoleFromRoots([])).toBeNull();
  });
});

describe('CINEMA_ROLE_ROOT_IDS', () => {
  it('should all be queried by the cinema occupation group', () => {
    const cinemaGroups = OCCUPATION_ROOT_GROUPS.filter((group) => group.target === CINEMA_SUBTYPE);
    const queriedRootIds = new Set(cinemaGroups.flatMap((group) => [...group.rootIds]));

    expect(cinemaGroups.length).toBeGreaterThan(0);
    for (const rootId of CINEMA_ROLE_ROOT_IDS) {
      expect(queriedRootIds).toContain(rootId);
    }
  });
});
