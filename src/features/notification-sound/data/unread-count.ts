import { NOTIFICATION_BELL_SELECTOR, UNREAD_BADGE_SELECTOR } from './bell-selectors';

/**
 * How many notifications the site says are waiting, read off the badge of its
 * bell. Reading only: not one attribute, class or style is written, and the
 * badge is left exactly as the site drew it.
 */

/** Every digit of the badge, which may read "9+" once the count is capped. */
const DIGITS = /\d+/;

const DECIMAL = 10;

/** A badge with no digit at all still means the bell has something to show. */
const AT_LEAST_ONE = 1;

/**
 * The number the bell shows, 0 when it shows no badge at all, and null when
 * the page draws no bell: null is not zero, it means nothing was read, so a
 * page without a header never passes for a page where everything was read.
 *
 * The first bell only. A page draws it twice, once for the wide navigation
 * and once for the narrow one, and React renders both from the same number.
 */
export function readUnreadCount(root: ParentNode): number | null {
  const bell = root.querySelector(NOTIFICATION_BELL_SELECTOR);
  if (bell === null) {
    return null;
  }
  const badge = bell.querySelector(UNREAD_BADGE_SELECTOR);
  if (badge === null) {
    return 0;
  }
  const digits = DIGITS.exec(badge.textContent ?? '');

  return digits === null ? AT_LEAST_ONE : Number.parseInt(digits[0], DECIMAL);
}
