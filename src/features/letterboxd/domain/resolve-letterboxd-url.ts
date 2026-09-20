import { pickEarliestLabel, type LabeledValue } from '../../../core/text/pick-earliest-label';
import type { CategoryId, PersonSubtypeId } from '../../categorization/domain/category';
import type { ExternalIds } from '../../categorization/domain/entity-facts';
import { CINEMA_ROLE_ORDER, CINEMA_SUBTYPE, type CinemaRole } from './cinema-role';

/**
 * The only origin this module ever produces. Every URL is assembled here from
 * this constant plus validated segments, so no input can move a link to
 * another host.
 */
const LETTERBOXD_ORIGIN = 'https://letterboxd.com';

const LETTERBOXD_URL_PREFIX = `${LETTERBOXD_ORIGIN}/`;

/**
 * Ids come from Wikidata, where anyone can write anything, so an id is used
 * only when it has the exact shape of its kind. A rejected id behaves as an
 * absent one and the next fallback applies.
 */
const LETTERBOXD_SLUG_PATTERN = /^[a-z0-9-]+$/;
const TMDB_ID_PATTERN = /^\d+$/;
const IMDB_FILM_ID_PATTERN = /^tt\d+$/;

/** "Paprika (film, 2006)" gives "Paprika", "Lost River (film)" gives "Lost River". */
const TRAILING_PARENTHETICAL_PATTERN = /\s*\([^()]*\)\s*$/;

const LETTERBOXD_ID_KEY_BY_ROLE: Record<CinemaRole, keyof ExternalIds> = {
  director: 'letterboxdDirector',
  actor: 'letterboxdActor',
  writer: 'letterboxdWriter',
  producer: 'letterboxdProducer',
};

/** One occupation of a person that carries a Letterboxd role. */
export interface CinemaRoleOccupation {
  role: CinemaRole;
  /** French label of the occupation, for the description tie-break. */
  label: string | null;
}

/** Everything the decision needs, gathered by the categorization use case. */
export interface LetterboxdCard {
  title: string;
  description: string | null;
  categoryId: CategoryId | null;
  personSubtypes: readonly PersonSubtypeId[];
  externalIds: ExternalIds;
  /** True for a film or a film series only, never for a television item. */
  isFilm: boolean;
  cinemaRoles: readonly CinemaRoleOccupation[];
}

/** A URL of the Letterboxd origin, the only value this module ever returns. */
export function isLetterboxdUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(LETTERBOXD_URL_PREFIX);
}

/** Segments must already be validated ids or encoded text. */
function letterboxdUrl(segments: readonly string[]): string {
  return `${LETTERBOXD_URL_PREFIX}${segments.join('/')}/`;
}

function validId(value: string | null, pattern: RegExp): string | null {
  return value !== null && pattern.test(value) ? value : null;
}

function searchUrl(title: string): string {
  const withoutParenthetical = title.replace(TRAILING_PARENTHETICAL_PATTERN, '').trim();
  const text = withoutParenthetical === '' ? title.trim() : withoutParenthetical;
  return letterboxdUrl(['search', encodeURIComponent(text)]);
}

function resolveFilm(card: LetterboxdCard): string {
  const { externalIds } = card;

  const film = validId(externalIds.letterboxdFilm, LETTERBOXD_SLUG_PATTERN);
  if (film !== null) {
    return letterboxdUrl(['film', film]);
  }
  // Both redirect to the film page, verified by navigation.
  const tmdb = validId(externalIds.tmdbMovieId, TMDB_ID_PATTERN);
  if (tmdb !== null) {
    return letterboxdUrl(['tmdb', tmdb]);
  }
  const imdb = validId(externalIds.imdbId, IMDB_FILM_ID_PATTERN);
  if (imdb !== null) {
    return letterboxdUrl(['imdb', imdb]);
  }
  return searchUrl(card.title);
}

function hasRole(card: LetterboxdCard, role: CinemaRole): boolean {
  return card.cinemaRoles.some((occupation) => occupation.role === role);
}

/**
 * The role named earliest in the card description, as the primary subtype is
 * decided. Without a description match, the first role the person has wins.
 */
function dominantRole(card: LetterboxdCard): CinemaRole | null {
  const candidates: LabeledValue<CinemaRole>[] = card.cinemaRoles.map((occupation) => ({
    label: occupation.label,
    value: occupation.role,
  }));
  const fromDescription =
    card.description === null ? null : pickEarliestLabel(card.description, candidates);

  return fromDescription ?? CINEMA_ROLE_ORDER.find((role) => hasRole(card, role)) ?? null;
}

/**
 * A person needs a cinema occupation, even a secondary one. Albert Einstein
 * and Emmanuel Macron both carry a Letterboxd actor id in Wikidata, from
 * archive footage, and must not get a link.
 */
function resolvePerson(card: LetterboxdCard): string | null {
  if (!card.personSubtypes.includes(CINEMA_SUBTYPE)) {
    return null;
  }

  const dominant = dominantRole(card);
  const roles =
    dominant === null
      ? CINEMA_ROLE_ORDER
      : [dominant, ...CINEMA_ROLE_ORDER.filter((role) => role !== dominant)];

  for (const role of roles) {
    if (!hasRole(card, role)) {
      continue;
    }
    const id = validId(card.externalIds[LETTERBOXD_ID_KEY_BY_ROLE[role]], LETTERBOXD_SLUG_PATTERN);
    if (id !== null) {
      return letterboxdUrl([role, id]);
    }
  }
  return searchUrl(card.title);
}

function resolveStudio(externalIds: ExternalIds): string | null {
  const studio = validId(externalIds.letterboxdStudio, LETTERBOXD_SLUG_PATTERN);
  return studio === null ? null : letterboxdUrl(['studio', studio]);
}

/**
 * The Letterboxd page of a card, or null when it has none. Pure: the extension
 * never calls letterboxd.com, it only builds the URL the user may click.
 */
export function resolveLetterboxdUrl(card: LetterboxdCard): string | null {
  switch (card.categoryId) {
    case 'film_tv':
      // A television series, season or episode is not a film: no link in v1.
      return card.isFilm ? resolveFilm(card) : null;
    case 'person':
      return resolvePerson(card);
    case 'organization':
      return resolveStudio(card.externalIds);
    default:
      return null;
  }
}
