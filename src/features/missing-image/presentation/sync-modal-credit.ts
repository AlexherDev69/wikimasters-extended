import type { DetailModal } from '../../card-detection/data/detail-modal';
import type { CardCategory } from '../../categorization/domain/category';
import { findPictureArea } from '../data/find-placeholder';
import { applyModalCreditLine, findModalCreditTarget } from '../data/modal-credit-line';

/**
 * Puts the credit of the image shown on the card of the detail modal in line
 * with what is known of it. A card opened before its facts came back simply
 * gets its credit on the next sync, and a card with no image never gets one.
 *
 * `modal` is null when no detail modal is open, and the extension then does
 * nothing at all. It is found once per sync pass and shared with the other
 * features writing in the modal.
 *
 * Called after every scan and every batch of results. It is free to run often:
 * it writes only when the modal does not already show the right credit.
 */
export function syncModalCredit(
  modal: DetailModal | null,
  categoriesByTitle: ReadonlyMap<string, CardCategory>,
): void {
  if (modal === null) {
    return;
  }
  const target = findModalCreditTarget(modal);

  // An unreadable card gets no credit at all, so a line left by the card shown
  // before is removed instead of naming the author of another picture. A card
  // the site shows a real picture for gets none either: our image is not on
  // screen, so there is nothing to credit.
  // Known divergence, accepted: the line appears as soon as an image is known,
  // while the image itself stays invisible until it has loaded. When Commons
  // does not answer, the credit is therefore read under the placeholder of the
  // site. Waiting for the loaded mark would cost one more sync round trip for
  // every modal opened, to cover the case of a file that is gone.
  const showsPlaceholder = modal.cardRoot !== null && findPictureArea(modal.cardRoot) !== null;
  const image =
    target.title === null || !showsPlaceholder
      ? null
      : (categoriesByTitle.get(target.title)?.image ?? null);

  applyModalCreditLine(target, image?.fileName ?? null);
}
