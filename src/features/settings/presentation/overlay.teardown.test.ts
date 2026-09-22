/**
 * What the overlay gives back when the context is invalidated: every node it
 * added, the two style sheets it wrote in `document.head`, and the audio
 * context the sound of the notifications was handed.
 *
 * The seam: an extension reloaded under an open tab runs this path and nothing
 * else, and a part that forgets to undo itself is only visible here.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { stubCanvasContext, type CanvasStub } from '../../../../tests/helpers/canvas-context';
import {
  ALL_OFF,
  COLLECTION_FILTERS_HTML,
  GRID_HTML,
  HEADER_HTML,
  LARGE_HTML,
  MODAL_HTML,
  PULL_IDLE_HTML,
  UNREAD_HEADER_HTML,
  brandMarks,
  compactStyle,
  compactToggle,
  hideStatsStyle,
  mount,
  pullStatsPanel,
  scan,
  scanUntilDrawn,
} from '../../../../tests/helpers/overlay-harness';

import { DEFAULT_SETTINGS } from '../domain/settings';

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

  it('should take back every node it added when the context is invalidated', async () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML + MODAL_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);

    overlay.destroy();

    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should take back the compact button and its style when the context is invalidated', () => {
    document.body.innerHTML = COLLECTION_FILTERS_HTML + GRID_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount({ ...ALL_OFF, compactView: true });
    scan(overlay);
    (compactToggle() as HTMLElement).click();
    expect(compactStyle()).not.toBeNull();

    overlay.destroy();

    expect(document.body.innerHTML).toBe(siteHtml);
    expect(compactStyle()).toBeNull();
  });

  it('should take back the pull panel when the context is invalidated', () => {
    document.body.innerHTML = PULL_IDLE_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount({ ...ALL_OFF, pullStats: true });
    scan(overlay);
    expect(pullStatsPanel()).not.toBeNull();

    overlay.destroy();

    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should take the word of the extension back when the context is invalidated', () => {
    document.body.innerHTML = HEADER_HTML + GRID_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount(ALL_OFF);
    scan(overlay);
    expect(brandMarks()).toHaveLength(1);

    overlay.destroy();

    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should take back the hide-stats style when the context is invalidated', async () => {
    // Its own case, and not the comparison above: the style sheet lives in
    // document.head, where comparing the body cannot see it. Without this,
    // an extension reloaded while a tab is open would leave the numbers of
    // the site hidden with nothing left on the page able to bring them back.
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, hideCardStats: true });
    await scanUntilDrawn(overlay);
    expect(hideStatsStyle()).not.toBeNull();

    overlay.destroy();

    expect(hideStatsStyle()).toBeNull();
  });

  it('should give the audio of the page back when the context is invalidated', () => {
    // The one thing this feature is given and the one thing it gives back: a
    // browser hands out a limited number of audio contexts per page.
    document.body.innerHTML = UNREAD_HEADER_HTML;
    const { overlay, chime } = mount({ ...ALL_OFF, notificationSound: true });
    scan(overlay);

    overlay.destroy();

    expect(chime.close).toHaveBeenCalledTimes(1);
  });
});
