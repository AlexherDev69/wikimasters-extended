import type { DetailModal } from '../../card-detection/data/detail-modal';
import type { CardCategory } from '../../categorization/domain/category';
import { findTagSection } from '../data/find-tag-section';
import {
  applyTagProposals,
  findTagProposalsTarget,
  removeTagProposals,
  type TagProposalsCallbacks,
} from './apply-tag-proposals';

/** Suggested tags the card does not already carry, case-insensitively. */
function remainingProposals(
  category: CardCategory | undefined,
  existingTags: readonly string[],
): string[] {
  if (category === undefined) {
    return [];
  }
  const existing = new Set(existingTags.map((tag) => tag.toLowerCase()));
  return category.suggestedTags.filter((tag) => !existing.has(tag.toLowerCase()));
}

/**
 * Puts the tag proposals of the card shown in the detail modal in line with
 * what is known of it. A card with no tag field at all (not owned by the
 * user) gets nothing, a card met before its category came back simply gets
 * its proposals on the next sync, and a tag already on the card is never
 * proposed again.
 *
 * `modal` is null when no detail modal is open, and the extension then does
 * nothing at all. It is found once per sync pass and shared with the other
 * features writing in the modal.
 *
 * Called after every scan and every batch of results. It is free to run
 * often: it writes only when the section does not already show the right
 * proposals for the card it now shows.
 */
export function syncTagSuggestions(
  modal: DetailModal | null,
  categoriesByTitle: ReadonlyMap<string, CardCategory>,
  callbacks: TagProposalsCallbacks,
): void {
  if (modal === null) {
    return;
  }
  const section = findTagSection(modal);
  if (section === null) {
    return;
  }

  // An unreadable card proposes nothing rather than the previous card's tags.
  if (modal.title === null) {
    removeTagProposals(section.root);
    return;
  }

  const category = categoriesByTitle.get(modal.title);
  const tags = remainingProposals(category, section.tags);
  applyTagProposals(findTagProposalsTarget(modal.title, section), tags, callbacks);
}
