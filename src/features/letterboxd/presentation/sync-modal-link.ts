import type { DetailModal } from '../../card-detection/data/detail-modal';
import type { CardCategory } from '../../categorization/domain/category';
import { applyModalLink, findModalLinkTarget } from '../data/modal-link';

/**
 * Puts the Letterboxd link of the card shown in the detail modal in line with
 * what is known of it. A card opened before its category came back simply gets
 * its link on the next sync, and a card that has no link never gets one.
 *
 * `modal` is null when no detail modal is open, and the extension then does
 * nothing at all. It is found once per sync pass and shared with the other
 * features writing in the modal.
 *
 * Called after every scan and every batch of results. It is free to run often:
 * it writes only when the modal does not already show the right link.
 */
export function syncModalLink(
  modal: DetailModal | null,
  categoriesByTitle: ReadonlyMap<string, CardCategory>,
): void {
  if (modal === null) {
    return;
  }
  const target = findModalLinkTarget(modal);

  // An unreadable card gets no URL at all, so a link left by the card shown
  // before is removed instead of pointing at the wrong page.
  const url =
    target.title === null ? null : (categoriesByTitle.get(target.title)?.letterboxdUrl ?? null);

  applyModalLink(target, url);
}
