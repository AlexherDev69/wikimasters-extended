/**
 * The bell of the site and the badge it carries, the only two things this
 * feature ever looks at. Nothing is written on either of them, nor anywhere
 * else on the page: what this feature produces is a sound, and a sound is not
 * a node.
 */

/**
 * The bell that opens the notifications of the site. Found by its label
 * rather than by its Tailwind classes, which change at each deployment:
 * measured on the eight page exports of 2026-09-21, every page carries it and
 * nothing else on the site carries that label.
 */
export const NOTIFICATION_BELL_SELECTOR = 'button[aria-label="Notifications"]';

/**
 * The badge of the bell: the number of notifications not read yet, in a span
 * the site adds inside the button and removes when there is none left. It is
 * the only child of the bell that is not its drawing, which is an `svg`.
 */
export const UNREAD_BADGE_SELECTOR = ':scope > span';
