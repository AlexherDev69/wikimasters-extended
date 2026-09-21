import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readUnreadCount } from './unread-count';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** The navigation of the site, bell with no badge on it. */
const HEADER_HTML = readFileSync(join(FIXTURES_DIR, 'site-header.html'), 'utf-8');
/** The same navigation, with the badge of five notifications waiting. */
const UNREAD_HEADER_HTML = readFileSync(join(FIXTURES_DIR, 'site-header-unread.html'), 'utf-8');
/** A page of the site with no navigation around it. */
const GRID_HTML = readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8');

const FIVE_WAITING = 5;
const AT_LEAST_ONE = 1;
/** What the site draws once it stops writing the exact number: "9+". */
const CAPPED = 9;

/** Writes in the badge of the bell, as the site does when the count moves. */
function setBadgeText(text: string): void {
  document.body.innerHTML = UNREAD_HEADER_HTML;
  const badge = document.body.querySelector('button[aria-label="Notifications"] > span');
  if (badge === null) {
    throw new Error('The unread header fixture has lost its badge');
  }
  badge.textContent = text;
}

describe('readUnreadCount', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should read the number the badge of the bell shows', () => {
    document.body.innerHTML = UNREAD_HEADER_HTML;

    expect(readUnreadCount(document.body)).toBe(FIVE_WAITING);
  });

  it('should read zero when the bell carries no badge', () => {
    // The site removes the badge rather than writing a zero in it.
    document.body.innerHTML = HEADER_HTML;

    expect(readUnreadCount(document.body)).toBe(0);
  });

  it('should read nothing at all when the page draws no bell', () => {
    // Not zero: nothing was read, and a page without a navigation must never
    // pass for a page where every notification was read.
    document.body.innerHTML = GRID_HTML;

    expect(readUnreadCount(document.body)).toBeNull();
  });

  it('should read one when the badge shows no number at all', () => {
    // A badge is there because something is waiting: whatever it draws, it is
    // worth at least one, and never zero.
    setBadgeText('\u2022');

    expect(readUnreadCount(document.body)).toBe(AT_LEAST_ONE);
  });

  it('should read the digits when the badge caps the count', () => {
    // A badge reading "9+" is nine or more: it is read as nine, so a tenth
    // notification arriving behind a capped badge makes no sound. Nothing on
    // the page says it arrived at all.
    setBadgeText('9+');

    expect(readUnreadCount(document.body)).toBe(CAPPED);
  });

  it('should leave the page exactly as the site drew it', () => {
    document.body.innerHTML = UNREAD_HEADER_HTML;
    const before = document.body.innerHTML;

    readUnreadCount(document.body);

    expect(document.body.innerHTML).toBe(before);
  });
});
