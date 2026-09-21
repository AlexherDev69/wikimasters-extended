import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChimePlayer } from '../data/chime';
import {
  createNotificationSoundState,
  forgetUnreadCount,
  syncNotificationSound,
} from './sync-notification-sound';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** The navigation of the site, bell with no badge on it. */
const HEADER_HTML = readFileSync(join(FIXTURES_DIR, 'site-header.html'), 'utf-8');
/** The same navigation, with the badge of five notifications waiting. */
const UNREAD_HEADER_HTML = readFileSync(join(FIXTURES_DIR, 'site-header-unread.html'), 'utf-8');
/** A page of the site with no navigation around it. */
const GRID_HTML = readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8');

/** The badge of the fixture reads five. */
const FIXTURE_COUNT = 5;

function makeChime(): ChimePlayer {
  return { play: vi.fn(), close: vi.fn() };
}

/** Shows the navigation with a badge reading `count`, or none at all at zero. */
function showBell(count: number): void {
  document.body.innerHTML = count === 0 ? HEADER_HTML : UNREAD_HEADER_HTML;
  const badge = document.body.querySelector('button[aria-label="Notifications"] > span');
  if (badge !== null) {
    badge.textContent = String(count);
  }
}

describe('syncNotificationSound', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should stay silent when it sees the bell for the first time', () => {
    // A page opened on five notifications must not sound five arrivals: the
    // first pass learns the count, it does not react to it.
    showBell(FIXTURE_COUNT);
    const state = createNotificationSoundState();
    const chime = makeChime();

    syncNotificationSound(document.body, state, chime);

    expect(chime.play).not.toHaveBeenCalled();
    expect(state.unreadCount).toBe(FIXTURE_COUNT);
  });

  it('should sound once when the count rises', () => {
    showBell(1);
    const state = createNotificationSoundState();
    const chime = makeChime();
    syncNotificationSound(document.body, state, chime);

    showBell(2);
    syncNotificationSound(document.body, state, chime);

    expect(chime.play).toHaveBeenCalledTimes(1);
  });

  it('should sound once only when several notifications arrive together', () => {
    // The site raises the badge from one to four in a single render: that is
    // one sound, not three.
    showBell(1);
    const state = createNotificationSoundState();
    const chime = makeChime();
    syncNotificationSound(document.body, state, chime);

    showBell(4);
    syncNotificationSound(document.body, state, chime);

    expect(chime.play).toHaveBeenCalledTimes(1);
  });

  it('should stay silent when the count holds', () => {
    // What almost every pass finds: the page mutates around a bell that has
    // not moved, and the sync must not sound at each mutation.
    showBell(FIXTURE_COUNT);
    const state = createNotificationSoundState();
    const chime = makeChime();
    syncNotificationSound(document.body, state, chime);

    syncNotificationSound(document.body, state, chime);
    syncNotificationSound(document.body, state, chime);

    expect(chime.play).not.toHaveBeenCalled();
  });

  it('should stay silent when the count falls as the notifications are read', () => {
    showBell(FIXTURE_COUNT);
    const state = createNotificationSoundState();
    const chime = makeChime();
    syncNotificationSound(document.body, state, chime);

    showBell(0);
    syncNotificationSound(document.body, state, chime);

    expect(chime.play).not.toHaveBeenCalled();
    expect(state.unreadCount).toBe(0);
  });

  it('should sound when a notification arrives after everything was read', () => {
    showBell(0);
    const state = createNotificationSoundState();
    const chime = makeChime();
    syncNotificationSound(document.body, state, chime);

    showBell(1);
    syncNotificationSound(document.body, state, chime);

    expect(chime.play).toHaveBeenCalledTimes(1);
  });

  it('should keep what it knows when the page draws no bell', () => {
    // The site navigates without reloading, and some of its pages render
    // before the navigation: a pass that reads nothing must not take it for a
    // bell that was emptied, or coming back would sound.
    showBell(FIXTURE_COUNT);
    const state = createNotificationSoundState();
    const chime = makeChime();
    syncNotificationSound(document.body, state, chime);

    document.body.innerHTML = GRID_HTML;
    syncNotificationSound(document.body, state, chime);
    showBell(FIXTURE_COUNT);
    syncNotificationSound(document.body, state, chime);

    expect(state.unreadCount).toBe(FIXTURE_COUNT);
    expect(chime.play).not.toHaveBeenCalled();
  });

  it('should write nothing at all on the page', () => {
    // The whole feature: it reads a number and makes a sound. Nothing of the
    // site is touched, and nothing of ours is added.
    showBell(1);
    const state = createNotificationSoundState();
    syncNotificationSound(document.body, state, makeChime());
    const before = document.body.innerHTML;

    showBell(2);
    const shown = document.body.innerHTML;
    syncNotificationSound(document.body, state, makeChime());

    expect(document.body.innerHTML).toBe(shown);
    expect(before).not.toBe(shown);
  });

  it('should listen again from the current count after it was forgotten', () => {
    // What switching the sound off and back on does: the notifications that
    // arrived in between are not sounded, and the next one is.
    showBell(1);
    const state = createNotificationSoundState();
    const chime = makeChime();
    syncNotificationSound(document.body, state, chime);

    forgetUnreadCount(state);
    showBell(FIXTURE_COUNT);
    syncNotificationSound(document.body, state, chime);

    expect(chime.play).not.toHaveBeenCalled();
  });
});
