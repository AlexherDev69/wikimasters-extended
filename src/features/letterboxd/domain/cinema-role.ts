import type { PersonSubtypeId } from '../../categorization/domain/category';

/** The person paths Letterboxd exposes, in the order that breaks a tie. */
export type CinemaRole = 'director' | 'actor' | 'writer' | 'producer';

/**
 * Root occupation identifying each role. An occupation carries its role only
 * when its resolved subtype is `cinema` too: in Wikidata "television
 * presenter" and "news presenter" are subclasses of "actor", and their subtype
 * is `media`, so a journalist must never become an actor.
 */
const ROLE_ROOT_IDS: readonly { role: CinemaRole; rootId: string }[] = [
  { role: 'director', rootId: 'Q2526255' },
  { role: 'actor', rootId: 'Q33999' },
  { role: 'writer', rootId: 'Q28389' },
  { role: 'producer', rootId: 'Q3282637' },
];

/** Order of the fallbacks between the roles a person has. */
export const CINEMA_ROLE_ORDER: readonly CinemaRole[] = ROLE_ROOT_IDS.map((entry) => entry.role);

/**
 * The roots above, alone. They repeat ids of the `cinema` occupation group, so
 * a test checks that the group still queries every one of them: dropping one
 * there would silently leave the roles empty.
 */
export const CINEMA_ROLE_ROOT_IDS: readonly string[] = ROLE_ROOT_IDS.map((entry) => entry.rootId);

/** The only person subtype that may carry a Letterboxd link. */
export const CINEMA_SUBTYPE: PersonSubtypeId = 'cinema';

/**
 * Role carried by an occupation, read from the roots it reached, or null when
 * it carries none: a cinematographer is `cinema` but has no Letterboxd path.
 * When several roots are reached, the first of ROLE_ROOT_IDS wins.
 */
export function cinemaRoleFromRoots(matchedRootIds: readonly string[]): CinemaRole | null {
  const matched = ROLE_ROOT_IDS.find((entry) => matchedRootIds.includes(entry.rootId));
  return matched?.role ?? null;
}
