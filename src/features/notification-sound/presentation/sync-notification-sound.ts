import { readUnreadCount } from '../data/unread-count';
import type { ChimePlayer } from '../data/chime';

/**
 * A sound when the bell of the site goes up. The site shows the number of
 * notifications waiting and says nothing else about it: no sound, and nothing
 * on a tab left in the background.
 *
 * Reading only, and more strictly than anywhere else in the extension: this
 * feature adds no node at all, so there is nothing of ours to take back and
 * nothing of the site to write on. It counts what the badge shows, and the
 * only thing it produces is a sound.
 */

export interface NotificationSoundState {
  /**
   * What the badge showed on the last pass, null before any pass has seen a
   * bell. Null is not zero on purpose: "nothing read yet" must never pass for
   * "nothing waiting", or the first pass over a page already showing five
   * notifications would hear them all arrive at once.
   */
  unreadCount: number | null;
}

export function createNotificationSoundState(): NotificationSoundState {
  return { unreadCount: null };
}

/**
 * Forgets what the bell showed. Called when the switch goes off, so that
 * switching it back on listens again from the count of that moment rather
 * than from a count read before, which would sound for every notification
 * that arrived while the feature was off.
 */
export function forgetUnreadCount(state: NotificationSoundState): void {
  state.unreadCount = null;
}

/**
 * One pass. It sounds on a count that has risen, and on nothing else: not on
 * the first bell it sees, not on a count that falls as the user reads the
 * notifications, and not on a count that holds while the page mutates around
 * it, which is what almost every pass finds.
 *
 * A page with no bell at all is not a page where everything was read: it
 * leaves the count alone, so navigating through such a page and back does not
 * sound for notifications that were already there.
 */
export function syncNotificationSound(
  root: ParentNode,
  state: NotificationSoundState,
  chime: ChimePlayer,
): void {
  const count = readUnreadCount(root);
  if (count === null) {
    return;
  }
  const previous = state.unreadCount;
  state.unreadCount = count;

  if (previous !== null && count > previous) {
    chime.play();
  }
}
