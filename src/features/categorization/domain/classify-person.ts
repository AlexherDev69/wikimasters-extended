import { pickEarliestLabel, type LabeledValue } from '../../../core/text/pick-earliest-label';
import type { PersonSubtypeId } from './category';
import { PERSON_SUBTYPE_PRIORITY } from './category-roots';

const DEFAULT_SUBTYPE: PersonSubtypeId = 'other';

export interface ResolvedOccupation {
  label: string | null;
  subtype: PersonSubtypeId | null;
}

export interface PersonClassification {
  primarySubtype: PersonSubtypeId;
  personSubtypes: PersonSubtypeId[];
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
 * appears earliest in the description wins. Occupations without a subtype are
 * left out: they could not be the answer.
 */
function pickByDescription(
  description: string,
  occupations: readonly ResolvedOccupation[],
): PersonSubtypeId | null {
  const candidates: LabeledValue<PersonSubtypeId>[] = [];
  for (const occupation of occupations) {
    if (occupation.subtype !== null) {
      candidates.push({ label: occupation.label, value: occupation.subtype });
    }
  }
  return pickEarliestLabel(description, candidates);
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
