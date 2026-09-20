import { CATEGORY_LABELS, PERSON_SUBTYPE_LABELS } from '../../category-badge/domain/category-display';
import type { CategoryId, PersonSubtypeId } from '../../categorization/domain/category';
import { topicTagFromRoots } from './root-topic';

/**
 * What a card needs to propose tags from, decoupled from the shape the
 * categorization pipeline classifies a card into: only the fields this
 * feature actually reads, the same way letterboxd/domain/resolve-letterboxd-url.ts
 * takes its own `LetterboxdCard` rather than the categorization's internals.
 */
export interface CardForTagSuggestions {
  categoryId: CategoryId;
  /** Non-null only for a person: see CardCategory.primarySubtype. */
  primarySubtype: PersonSubtypeId | null;
  /**
   * One label per occupation the card carries, in the order Wikidata lists
   * them, null where the class cache could not resolve a label. Empty for a
   * card that is not a person: fetched today only for the tie-break between
   * occupations, and otherwise thrown away.
   */
  occupationLabels: readonly (string | null)[];
  /**
   * The Wikidata roots the classes that decided the category actually reach,
   * already resolved and cached for every card. A few of them name a topic
   * the category label is too broad to name: see root-topic.ts.
   */
  matchedRootIds: readonly string[];
}

/** The `maxlength` of the tag field of the site: a proposal never overflows it. */
export const MAX_TAG_LENGTH = 48;

/**
 * The user picks from several proposals rather than receiving one precise
 * guess, so breadth beats precision here.
 */
export const MAX_SUGGESTED_TAGS = 6;

const INNER_WHITESPACE_PATTERN = /\s+/g;

/**
 * Trims, collapses inner whitespace and caps the length at MAX_TAG_LENGTH,
 * the `maxlength` of the site's own field. Only the first letter is put in
 * upper case, the rest is left exactly as Wikidata spells it: a name must
 * never be lower-cased. Null once nothing usable is left.
 *
 * The cap is applied AFTER the upper case and never before: upper casing can
 * make a string longer (the German eszett becomes two letters), so capping
 * first can hand back MAX_TAG_LENGTH + 1 characters, which the guard of the
 * message then refuses, and refusing a message costs the whole batch of
 * cards its categorization, not just one proposal. Trimmed again after the
 * cap, so the cut cannot leave a trailing space in the middle of a word.
 */
export function normalizeTag(raw: string): string | null {
  const collapsed = raw.trim().replace(INNER_WHITESPACE_PATTERN, ' ');

  if (collapsed === '') {
    return null;
  }
  const capitalized = collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
  const capped = capitalized.slice(0, MAX_TAG_LENGTH).trim();

  return capped === '' ? null : capped;
}

/**
 * The tags to propose for a categorized card, in order: the French label of
 * the category, then the topic its matched roots name when the category is
 * too broad to name it ("Voitures" under "Technique"), then the label of the
 * primary person subtype, then the French labels of the occupations the class
 * cache already resolved. Expect "Footballeur", not "Football": an occupation
 * is a profession, and guessing a topic from it is left alone.
 *
 * Deduplicated case-insensitively, keeping the first spelling, and capped at
 * MAX_SUGGESTED_TAGS: the user picks from the list, so showing several
 * imperfect proposals beats guessing one good one.
 */
export function suggestTags(card: CardForTagSuggestions): string[] {
  const candidates: string[] = [CATEGORY_LABELS[card.categoryId]];

  const topic = topicTagFromRoots(card.matchedRootIds);
  if (topic !== null) {
    candidates.push(topic);
  }
  if (card.primarySubtype !== null && card.primarySubtype !== 'other') {
    candidates.push(PERSON_SUBTYPE_LABELS[card.primarySubtype]);
  }
  for (const label of card.occupationLabels) {
    if (label !== null) {
      candidates.push(label);
    }
  }

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (tags.length >= MAX_SUGGESTED_TAGS) {
      break;
    }
    const normalized = normalizeTag(candidate);
    if (normalized === null) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    tags.push(normalized);
  }
  return tags;
}
