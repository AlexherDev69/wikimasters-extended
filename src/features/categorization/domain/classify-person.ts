import type { PersonSubtypeId } from './category';
import { PERSON_SUBTYPE_PRIORITY } from './category-roots';

/** Wikidata French labels list both grammatical genders, as in "chanteur ou chanteuse". */
const LABEL_VARIANT_SEPARATOR = ' ou ';

const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

/** Card descriptions use the typographic apostrophe, Wikidata labels the straight one. */
const TYPOGRAPHIC_APOSTROPHE = /’/g;
const STRAIGHT_APOSTROPHE = "'";

const NO_MATCH_INDEX = -1;

const DEFAULT_SUBTYPE: PersonSubtypeId = 'other';

export interface ResolvedOccupation {
  label: string | null;
  subtype: PersonSubtypeId | null;
}

export interface PersonClassification {
  primarySubtype: PersonSubtypeId;
  personSubtypes: PersonSubtypeId[];
}

function escapeForRegex(text: string): string {
  return text.replace(REGEX_SPECIAL_CHARACTERS, '\\$&');
}

/** Lower-cases and folds the apostrophes so both spellings compare equal. */
function normalizeForMatching(text: string): string {
  return text.toLowerCase().replace(TYPOGRAPHIC_APOSTROPHE, STRAIGHT_APOSTROPHE);
}

/**
 * Index of the first whole-word occurrence of `variant`, or -1. `\b` is not
 * Unicode aware in JavaScript, so the boundaries are expressed with `\p{L}`
 * lookarounds: "acteur" must not match inside "facteur".
 */
function wholeWordIndex(haystack: string, variant: string): number {
  const pattern = new RegExp(`(?<!\\p{L})${escapeForRegex(variant)}(?!\\p{L})`, 'u');
  const match = pattern.exec(haystack);
  return match === null ? NO_MATCH_INDEX : match.index;
}

/** Distinct subtypes, ordered by PERSON_SUBTYPE_PRIORITY. */
function collectSubtypes(occupations: readonly ResolvedOccupation[]): PersonSubtypeId[] {
  const present = new Set<PersonSubtypeId>();
  for (const occupation of occupations) {
    if (occupation.subtype !== null) {
      present.add(occupation.subtype);
    }
  }
  return PERSON_SUBTYPE_PRIORITY.filter((subtype) => present.has(subtype));
}

/**
 * The order of the P106 values in Wikidata is meaningless, but a card
 * description lists the main occupations first, so the occupation whose label
 * appears earliest in the description wins.
 */
function pickByDescription(
  description: string,
  occupations: readonly ResolvedOccupation[],
): PersonSubtypeId | null {
  const haystack = normalizeForMatching(description);
  let bestIndex = Number.POSITIVE_INFINITY;
  let bestSubtype: PersonSubtypeId | null = null;

  for (const occupation of occupations) {
    if (occupation.subtype === null || occupation.label === null) {
      continue;
    }
    const variants = normalizeForMatching(occupation.label).split(LABEL_VARIANT_SEPARATOR);
    for (const rawVariant of variants) {
      const variant = rawVariant.trim();
      if (variant === '') {
        continue;
      }
      const index = wholeWordIndex(haystack, variant);
      if (index !== NO_MATCH_INDEX && index < bestIndex) {
        bestIndex = index;
        bestSubtype = occupation.subtype;
      }
    }
  }

  return bestSubtype;
}

/**
 * Majority vote among `candidates`, which is never empty and is already sorted
 * by PERSON_SUBTYPE_PRIORITY, so keeping the current best on an equal count
 * breaks ties by priority.
 */
function pickByVote(
  occupations: readonly ResolvedOccupation[],
  candidates: readonly PersonSubtypeId[],
): PersonSubtypeId {
  const votes = new Map<PersonSubtypeId, number>();
  for (const occupation of occupations) {
    if (occupation.subtype !== null) {
      votes.set(occupation.subtype, (votes.get(occupation.subtype) ?? 0) + 1);
    }
  }

  return candidates.reduce((best, candidate) =>
    (votes.get(candidate) ?? 0) > (votes.get(best) ?? 0) ? candidate : best,
  );
}

export function classifyPerson(
  description: string | null,
  occupations: readonly ResolvedOccupation[],
): PersonClassification {
  const personSubtypes = collectSubtypes(occupations);
  if (personSubtypes.length === 0) {
    return { primarySubtype: DEFAULT_SUBTYPE, personSubtypes };
  }

  const fromDescription = description === null ? null : pickByDescription(description, occupations);
  const primarySubtype = fromDescription ?? pickByVote(occupations, personSubtypes);

  return { primarySubtype, personSubtypes };
}
