import type { CardLinkResolver, ClassifiedCard } from '../../categorization/domain/card-link';
import { decisiveClassIds } from '../../categorization/domain/classify-entity';
import { cinemaRoleFromRoots, CINEMA_SUBTYPE } from './cinema-role';
import {
  resolveLetterboxdUrl,
  type CinemaRoleOccupation,
  type LetterboxdCard,
} from './resolve-letterboxd-url';

/**
 * The rules that turn what the categorization pipeline resolved about a card
 * into a Letterboxd address.
 *
 * They used to live inside the pipeline itself, which made the one thing every
 * feature depends on depend on this one: the pipeline could not be read, moved
 * or replaced without Letterboxd coming along. They read nothing the pipeline
 * does not already hand out, so moving them here widened nothing. The pipeline
 * now calls a function it is given, and names no feature at all.
 */

/** The category a film shares with a television series. */
const FILM_CATEGORY: string = 'film_tv';

/**
 * The two film roots of the `film_tv` group. A card that only matches the
 * television roots shares the `film_tv` category but is not a film, and
 * Letterboxd covers almost no series.
 *
 * Exported so a test checks that the group still queries both: dropping one
 * there would silently turn every film into a card without a link.
 */
export const FILM_ROOT_IDS: readonly string[] = ['Q11424', 'Q24856'];

function isFilm(card: ClassifiedCard): boolean {
  if (card.categoryId !== FILM_CATEGORY) {
    return false;
  }
  // The classes that really voted, so a parent of an already elected card
  // cannot turn a television series into a film.
  return decisiveClassIds(card.facts, card.categoryTargets).some((classId) => {
    const matchedRootIds = card.categoryResolutions.get(classId)?.matchedRootIds ?? [];
    return matchedRootIds.some((rootId) => FILM_ROOT_IDS.includes(rootId));
  });
}

/** Occupations carrying a Letterboxd role, with the label of the tie-break. */
function cinemaRolesOf(card: ClassifiedCard): CinemaRoleOccupation[] {
  const roles: CinemaRoleOccupation[] = [];

  for (const classId of card.facts.occupationIds) {
    const resolution = card.occupationResolutions.get(classId);
    if (resolution === undefined || resolution.target !== CINEMA_SUBTYPE) {
      continue;
    }
    const role = cinemaRoleFromRoots(resolution.matchedRootIds);
    if (role !== null) {
      roles.push({ role, label: resolution.label });
    }
  }
  return roles;
}

/** Everything the Letterboxd resolver needs, read off one classified card. */
function toLetterboxdCard(card: ClassifiedCard): LetterboxdCard {
  return {
    title: card.title,
    description: card.description,
    categoryId: card.categoryId,
    personSubtypes: card.personSubtypes,
    externalIds: card.facts.externalIds,
    isFilm: isFilm(card),
    cinemaRoles: cinemaRolesOf(card),
  };
}

/** The Letterboxd address of a card, or null when it has none. */
export const resolveLetterboxdCardLink: CardLinkResolver = (card) =>
  resolveLetterboxdUrl(toLetterboxdCard(card));
