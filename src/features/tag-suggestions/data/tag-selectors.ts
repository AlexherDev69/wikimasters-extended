/**
 * Everything this feature reads on the site's own DOM, and the marks of the
 * nodes it adds inside the tag section. The tag field carries no data
 * attribute of its own, so it is matched by its combobox role and the fixed
 * part of its placeholder: the real placeholder ends with a horizontal
 * ellipsis character rather than three dots, so only a PREFIX is ever
 * matched, never a Tailwind class.
 */

/** Fixed part of the placeholder of the tag field of a card the user owns. */
const TAG_INPUT_PLACEHOLDER_PREFIX = 'Ajouter une étiquette';

export const TAG_INPUT_SELECTOR = `input[role="combobox"][placeholder^="${TAG_INPUT_PLACEHOLDER_PREFIX}"]`;

/**
 * Fixed part of the aria-label of a button that removes an existing tag, kept
 * with its accent and its trailing space. The detail modal also carries a
 * favourite button labelled "Retirer des favoris": matching the bare word
 * "Retirer" would misread that button as naming a tag, so the prefix has to
 * be this whole phrase.
 */
export const REMOVE_TAG_BUTTON_LABEL_PREFIX = "Retirer l'étiquette ";

/**
 * Any button carrying a label, inside the tag section only. The prefix above
 * is checked in JS rather than in this selector, with a fallback to the chip
 * text when it does not match: see find-tag-section.ts.
 */
export const LABELLED_BUTTON_SELECTOR = 'button[aria-label]';

/** Marks our own node of proposals, inserted once inside the tag section. */
export const TAG_PROPOSALS_ATTRIBUTE = 'data-wme-tag-suggestions';

export const TAG_PROPOSALS_SELECTOR = `[${TAG_PROPOSALS_ATTRIBUTE}]`;

/**
 * Holds the proposals a previous sync already wrote, serialized together with
 * the title of the card. Comparing this key against the one just computed is
 * what lets a sync write nothing when the section already shows the right
 * thing, and what forces a rebuild when the site swaps in another card. It
 * cannot see a re-render that replaces the input while the title and the
 * proposals stay the same: the identity of the input is compared separately,
 * see apply-tag-proposals.ts.
 */
export const TAG_PROPOSALS_KEY_ATTRIBUTE = 'data-wme-tag-suggestions-key';

/** Marks one proposal button, its tag carried in TAG_ATTRIBUTE. */
export const TAG_PROPOSAL_BUTTON_ATTRIBUTE = 'data-wme-tag-suggestion';

export const TAG_PROPOSAL_BUTTON_SELECTOR = `button[${TAG_PROPOSAL_BUTTON_ATTRIBUTE}]`;

/** The tag one proposal button carries. */
export const TAG_ATTRIBUTE = 'data-wme-tag';
