/**
 * The parts the overlay draws beside the cards, on the page as a whole: the
 * panel of the pulls, the compact view of the collection, the game of the
 * loading screen, the word of the extension under the name of the site, and
 * the sound of an arriving notification.
 *
 * The seam: none of these is anchored on a card, so none of them ever waits
 * for an answer of Wikidata. What is drawn on a card lives in
 * `overlay.card-parts.test.ts`.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { PONG_SELECTOR } from '../../loading-pong/data/pong-panel';
import { stubCanvasContext, type CanvasStub } from '../../../../tests/helpers/canvas-context';
import {
  ALL_OFF,
  COLLECTION_FILTERS_HTML,
  GRID_HTML,
  HEADER_HTML,
  LOADING_HTML,
  PULL_IDLE_HTML,
  PULL_REVEAL_HTML,
  UNREAD_HEADER_HTML,
  brandMarks,
  compactStyle,
  compactToggle,
  makeCategorize,
  mount,
  observeBody,
  pullStatsPanel,
  scan,
} from '../../../../tests/helpers/overlay-harness';

import { DEFAULT_SETTINGS } from '../domain/settings';

/** One more than the five notifications the unread header fixture shows. */
const SIX_WAITING = 6;

function pongPanel(): Element | null {
  return document.body.querySelector(PONG_SELECTOR);
}

/** The bell of the site, whose badge the sound of the notifications reads. */
const BELL_BADGE_SELECTOR = 'button[aria-label="Notifications"] > span';

/** Writes in the badge of the bell, as the site does when the count moves. */
function setBellCount(count: number): void {
  const badge = document.body.querySelector(BELL_BADGE_SELECTOR);
  if (badge === null) {
    throw new Error('The unread header fixture has lost its badge');
  }
  badge.textContent = String(count);
}

describe('createOverlay', () => {
  /**
   * happy-dom answers null to `getContext`, so the game of the loading screen
   * could never be built at all. The stub records what is painted instead of
   * painting it, and touches nothing but the canvases of this file.
   */
  let canvas: CanvasStub;

  beforeEach(() => {
    document.body.innerHTML = '';
    canvas = stubCanvasContext();
  });

  afterEach(() => {
    canvas.restore();
  });

  it('should draw the pull panel at once when the setting is on at load, asking for no categorization', () => {
    document.body.innerHTML = PULL_IDLE_HTML;
    const { overlay, categorize } = mount({ ...ALL_OFF, pullStats: true });

    scan(overlay);

    expect(pullStatsPanel()).not.toBeNull();
    expect(categorize).not.toHaveBeenCalled();
  });

  it('should draw no pull panel when the setting is off at load', () => {
    document.body.innerHTML = PULL_IDLE_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, pullStats: false });

    scan(overlay);

    expect(pullStatsPanel()).toBeNull();
  });

  it('should write nothing on a second scan while the pull panel is already drawn', () => {
    document.body.innerHTML = PULL_IDLE_HTML;
    const { overlay } = mount({ ...ALL_OFF, pullStats: true });
    scan(overlay);
    expect(pullStatsPanel()).not.toBeNull();
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should take back the pull panel at once when the setting is turned off', () => {
    document.body.innerHTML = PULL_IDLE_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, pullStats: true });
    scan(overlay);
    expect(pullStatsPanel()).not.toBeNull();

    overlay.applySettings({ ...DEFAULT_SETTINGS, pullStats: false });

    expect(pullStatsPanel()).toBeNull();
  });

  it('should count the card a pack reveals and show it on the panel that comes back after it', () => {
    document.body.innerHTML = PULL_REVEAL_HTML;
    const { overlay } = mount({ ...ALL_OFF, pullStats: true });

    scan(overlay);
    document.body.innerHTML = PULL_IDLE_HTML;
    scan(overlay);

    expect(pullStatsPanel()?.textContent).toContain('1 carte');
  });

  it('should count nothing on the page of the packs while the setting is off', () => {
    document.body.innerHTML = PULL_REVEAL_HTML;
    const { overlay } = mount({ ...ALL_OFF, pullStats: false });

    scan(overlay);
    // Switched on once the card has left the screen: a card still shown when
    // the switch is flipped is counted, which is the card the user is
    // looking at, and that is exactly what turning the feature on asks for.
    document.body.innerHTML = PULL_IDLE_HTML;
    overlay.applySettings({ ...ALL_OFF, pullStats: true });

    expect(pullStatsPanel()?.textContent).toContain('Aucune carte comptée');
  });

  it('should offer the compact view at once when the setting is on, asking for no categorization', () => {
    document.body.innerHTML = COLLECTION_FILTERS_HTML + GRID_HTML;
    const { overlay, categorize } = mount({ ...ALL_OFF, compactView: true });

    scan(overlay);

    expect(compactToggle()).not.toBeNull();
    expect(categorize).not.toHaveBeenCalled();
  });

  it('should offer no compact view when the setting is off at load', () => {
    document.body.innerHTML = COLLECTION_FILTERS_HTML + GRID_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, compactView: false });

    scan(overlay);

    expect(compactToggle()).toBeNull();
    expect(compactStyle()).toBeNull();
  });

  it('should draw the cards small as soon as the compact button is pressed', () => {
    document.body.innerHTML = COLLECTION_FILTERS_HTML + GRID_HTML;
    const { overlay } = mount({ ...ALL_OFF, compactView: true });
    scan(overlay);
    expect(compactStyle()).toBeNull();

    (compactToggle() as HTMLElement).click();

    // The press writes no node of the page, so the scan that shows the new
    // size is the one the feature asks the overlay for.
    expect(compactStyle()).not.toBeNull();
  });

  it('should write nothing on a second scan while the compact view is on', () => {
    document.body.innerHTML = COLLECTION_FILTERS_HTML + GRID_HTML;
    const { overlay } = mount({ ...ALL_OFF, compactView: true });
    scan(overlay);
    (compactToggle() as HTMLElement).click();
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should take back the compact button and its style at once when the setting is turned off', () => {
    document.body.innerHTML = COLLECTION_FILTERS_HTML + GRID_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, compactView: true });
    scan(overlay);
    (compactToggle() as HTMLElement).click();
    expect(compactStyle()).not.toBeNull();

    overlay.applySettings({ ...DEFAULT_SETTINGS, compactView: false });

    expect(compactToggle()).toBeNull();
    expect(compactStyle()).toBeNull();
  });

  it('should play pong when the page has been loading for the whole patience', () => {
    document.body.innerHTML = LOADING_HTML;
    const { overlay, retries } = mount({ ...ALL_OFF, loadingPong: true });

    scan(overlay);
    expect(pongPanel()).toBeNull();
    // The page shows nothing, so nothing mutates: the check armed on the
    // context is what looks at it again once the patience has run out.
    retries[0]?.();

    expect(pongPanel()).not.toBeNull();
  });

  it('should play no pong while the setting is off', () => {
    document.body.innerHTML = LOADING_HTML;
    const { overlay, retries } = mount({ ...DEFAULT_SETTINGS, loadingPong: false });

    scan(overlay);
    retries[0]?.();

    expect(pongPanel()).toBeNull();
  });

  it('should take the game back when the page finally shows its cards', () => {
    document.body.innerHTML = LOADING_HTML;
    const { overlay, retries, frames } = mount({ ...ALL_OFF, loadingPong: true });
    scan(overlay);
    retries[0]?.();
    const framesWhilePlaying = frames.length;

    // Added rather than replacing the page, so the panel is taken back by the
    // overlay and not by the site overwriting its own main area.
    document.body.insertAdjacentHTML('beforeend', GRID_HTML);
    scan(overlay);

    expect(pongPanel()).toBeNull();
    // And the loop is cut: the frame already granted asks for no other.
    frames[framesWhilePlaying - 1]?.(16);
    expect(frames).toHaveLength(framesWhilePlaying);
  });

  it('should play pong on a page that loaded when the development button asks for one', () => {
    // The button of the development build answers this one question and
    // nothing else, so what follows is the machinery a stuck page goes
    // through: the patience, then the check armed on the context.
    document.body.innerHTML = GRID_HTML;
    const isForcing = true;
    const { overlay, retries } = mount(
      { ...ALL_OFF, loadingPong: true },
      makeCategorize(),
      () => isForcing,
    );

    scan(overlay);
    retries[0]?.();

    expect(pongPanel()).not.toBeNull();
  });

  it('should take the game back when the development button stops asking for one', () => {
    document.body.innerHTML = GRID_HTML;
    let isForcing = true;
    const { overlay, retries } = mount(
      { ...ALL_OFF, loadingPong: true },
      makeCategorize(),
      () => isForcing,
    );
    scan(overlay);
    retries[0]?.();
    expect(pongPanel()).not.toBeNull();

    isForcing = false;
    scan(overlay);

    expect(pongPanel()).toBeNull();
  });

  it('should play no pong on a page that loaded while nothing asks for one', () => {
    // The guard of the two tests above: without the button, a page showing
    // its cards is not a wait and never offers a game.
    document.body.innerHTML = GRID_HTML;
    const { overlay, retries } = mount({ ...ALL_OFF, loadingPong: true });

    scan(overlay);
    retries[0]?.();

    expect(pongPanel()).toBeNull();
  });

  it('should take the game back at once when the setting is turned off', () => {
    document.body.innerHTML = LOADING_HTML;
    const { overlay, retries } = mount({ ...ALL_OFF, loadingPong: true });
    scan(overlay);
    retries[0]?.();
    expect(pongPanel()).not.toBeNull();

    overlay.applySettings({ ...ALL_OFF, loadingPong: false });

    expect(pongPanel()).toBeNull();
  });

  it('should write the word of the extension under the name of the site, every switch off', () => {
    // It is the signature of the extension and not one of its features: it
    // has no switch, so it is there even when every one of them is off, and
    // it costs no request either.
    document.body.innerHTML = HEADER_HTML + GRID_HTML;
    const { overlay, categorize } = mount(ALL_OFF);

    scan(overlay);

    expect(brandMarks()).toHaveLength(1);
    expect(categorize).not.toHaveBeenCalled();
  });

  it('should write nothing on a second scan while the word is already there', () => {
    document.body.innerHTML = HEADER_HTML + GRID_HTML;
    const { overlay } = mount(ALL_OFF);
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should sound when the bell of the site goes up', () => {
    document.body.innerHTML = UNREAD_HEADER_HTML;
    const { overlay, chime } = mount({ ...ALL_OFF, notificationSound: true });
    scan(overlay);

    setBellCount(SIX_WAITING);
    scan(overlay);

    expect(chime.play).toHaveBeenCalledTimes(1);
  });

  it('should write nothing on the page when the bell goes up', () => {
    // The whole feature in one assertion: it reads a number and makes a
    // sound. A single write here would feed the observer that brought the
    // scan, and the page would loop for as long as it stayed open.
    document.body.innerHTML = UNREAD_HEADER_HTML;
    const { overlay, chime } = mount({ ...ALL_OFF, notificationSound: true });
    scan(overlay);
    const observer = observeBody();
    setBellCount(SIX_WAITING);
    // The line above is a write of the test, standing in for the site: it is
    // drained so that what is left is what the scan itself wrote.
    observer.takeRecords();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    expect(chime.play).toHaveBeenCalledTimes(1);
    observer.disconnect();
  });

  it('should stay silent when the sound is switched off', () => {
    document.body.innerHTML = UNREAD_HEADER_HTML;
    const { overlay, chime } = mount(ALL_OFF);
    scan(overlay);

    setBellCount(SIX_WAITING);
    scan(overlay);

    expect(chime.play).not.toHaveBeenCalled();
  });

  it('should listen again from the count of the moment when the sound is switched back on', () => {
    // Switching it off and back on must not sound for everything that arrived
    // in between: the sound says a notification is arriving, not that some
    // are waiting.
    document.body.innerHTML = UNREAD_HEADER_HTML;
    const { overlay, chime } = mount({ ...ALL_OFF, notificationSound: true });
    scan(overlay);
    overlay.applySettings(ALL_OFF);

    setBellCount(SIX_WAITING);
    overlay.applySettings({ ...ALL_OFF, notificationSound: true });

    expect(chime.play).not.toHaveBeenCalled();
  });
});
