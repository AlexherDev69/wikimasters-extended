import type { Rarity } from '../../card-detection/domain/rarity';
import type { PullTally } from './pull-tally';

/**
 * Where the tally is kept between two visits. It is its own port rather than
 * a call to the storage API inside the sync, because the sync is what the
 * tests of this feature are about: counting a card once and only once.
 *
 * A failed read gives an empty tally rather than rejecting, exactly as the
 * settings fall back to their defaults: the panel showing nothing yet is a
 * state the user can read, an overlay that never draws is not.
 */
export interface PullTallyStore {
  read(): Promise<PullTally>;
  /**
   * Adds one card of `rarity` to what is kept at that moment, and gives back
   * the result. The tally a page holds is never written back as a whole: the
   * site may be open in another tab, which counts cards of its own, and a
   * copy read when this page loaded would erase them.
   *
   * Rejects when the tally could not be read or written, and then writes
   * nothing: unlike `read`, it never takes an empty tally for the one kept.
   */
  add(rarity: Rarity): Promise<PullTally>;
}
