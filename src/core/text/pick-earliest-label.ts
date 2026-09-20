/**
 * Matching of French Wikidata labels inside a card description. Shared by the
 * person classification and by the Letterboxd resolver, which both arbitrate
 * between several facts of one card by the order they appear in its
 * description.
 */

/** Wikidata French labels list both grammatical genders, as in "chanteur ou chanteuse". */
const LABEL_VARIANT_SEPARATOR = ' ou ';

const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

/** Card descriptions use the typographic apostrophe, Wikidata labels the straight one. */
const TYPOGRAPHIC_APOSTROPHE = /’/g;
const STRAIGHT_APOSTROPHE = "'";

const NO_MATCH_INDEX = -1;

/** One candidate value, with the French label that may name it in a description. */
export interface LabeledValue<TValue> {
  label: string | null;
  value: TValue;
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

/**
 * Value whose label, in either grammatical gender, appears earliest in
 * `description`. Null when no label is found: the caller decides the fallback.
 * Candidates without a label never match.
 */
export function pickEarliestLabel<TValue>(
  description: string,
  candidates: readonly LabeledValue<TValue>[],
): TValue | null {
  const haystack = normalizeForMatching(description);
  let bestIndex = Number.POSITIVE_INFINITY;
  let bestValue: TValue | null = null;

  for (const candidate of candidates) {
    if (candidate.label === null) {
      continue;
    }
    for (const rawVariant of normalizeForMatching(candidate.label).split(LABEL_VARIANT_SEPARATOR)) {
      const variant = rawVariant.trim();
      if (variant === '') {
        continue;
      }
      const index = wholeWordIndex(haystack, variant);
      if (index !== NO_MATCH_INDEX && index < bestIndex) {
        bestIndex = index;
        bestValue = candidate.value;
      }
    }
  }

  return bestValue;
}
