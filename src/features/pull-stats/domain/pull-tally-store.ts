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
  write(tally: PullTally): Promise<void>;
}
