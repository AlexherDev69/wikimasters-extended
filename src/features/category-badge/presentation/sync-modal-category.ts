import type { DetailModal } from '../../card-detection/data/detail-modal';
import type { CardCategory } from '../../categorization/domain/category';
import { applyModalCategoryLine, findModalCategoryTarget } from '../data/modal-category-line';
import { describeModalCategory } from '../domain/describe-modal-category';

/**
 * Puts the category line of the card shown in the detail modal in line with
 * what is known of it. A card opened before its category came back simply gets
 * its line on the next sync, and a card with no category never gets one.
 *
 * `modal` is null when no detail modal is open, and the extension then does
 * nothing at all. It is found once per sync pass and shared with the other
 * features writing in the modal.
 *
 * Called after every scan and every batch of results. It is free to run often:
 * it writes only when the modal does not already show the right line.
 */
export function syncModalCategory(
  modal: DetailModal | null,
  categoriesByTitle: ReadonlyMap<string, CardCategory>,
): void {
  if (modal === null) {
    return;
  }
  const target = findModalCategoryTarget(modal);

  // An unreadable card gets no line at all, so a line left by the card shown
  // before is removed instead of describing the wrong card.
  const category = target.title === null ? undefined : categoriesByTitle.get(target.title);

  applyModalCategoryLine(target, category === undefined ? null : describeModalCategory(category));
}
