/**
 * The composition root itself: what a scan asks of Wikidata, what it stops
 * asking once a feature goes off, what it writes on the scans that follow the
 * first, and what happens to the parts that come after one that throws.
 *
 * The seam: these are the only cases about the overlay as a whole rather than
 * about one of its parts. The parts themselves are covered by
 * `overlay.card-parts.test.ts`, `overlay.page-parts.test.ts` and
 * `overlay.teardown.test.ts`, over the shared harness of
 * `tests/helpers/overlay-harness.ts`.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { Logger } from '../../../core/logger/logger';
import { LETTERBOXD_LINK_SELECTOR } from '../../letterboxd/data/modal-selectors';
import { stubCanvasContext, type CanvasStub } from '../../../../tests/helpers/canvas-context';
import {
  ALL_OFF,
  COMPACT_PATH,
  GRID_HTML,
  LARGE_HTML,
  MODAL_HTML,
  TRADES_HTML,
  cardButtons,
  makeCategorize,
  mount,
  observeBody,
  scan,
  scanUntilDrawn,
} from '../../../../tests/helpers/overlay-harness';

import { DEFAULT_SETTINGS } from '../domain/settings';

/** What `runPart` writes when a part of a scan throws. */
const PART_FAILED_MESSAGE = 'A part of the overlay failed and was skipped';

/** The times the log named `part` as the one that gave up. */
function failuresOf(logger: Logger, part: string): Record<string, unknown>[] {
  return vi
    .mocked(logger.warn)
    .mock.calls.filter(([message]) => message === PART_FAILED_MESSAGE)
    .map(([, context]) => context ?? {})
    .filter((context) => context['part'] === part);
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

  it('should show every part of the overlay when the settings are on', async () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount();

    await scanUntilDrawn(overlay);

    expect(cardButtons().length).toBeGreaterThan(0);
    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)).not.toBeNull();
  });

  it('should keep drawing the parts that come after one that throws', async () => {
    // The compact view is the eighth part of a scan and the link of the modal
    // the eleventh. A scan used to run them in one straight line, so a site
    // that changed shape under one of them took every part after it down as
    // well, for as long as the tab stayed open. This is the risk the table of
    // the plan answers with a "mode dégradé silencieux".
    document.body.innerHTML = MODAL_HTML;
    const { overlay, logger } = mount(DEFAULT_SETTINGS, makeCategorize(), undefined, () => {
      throw new Error('the site moved');
    });

    await scanUntilDrawn(overlay);

    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)).not.toBeNull();
    expect(failuresOf(logger, 'compactView')).toHaveLength(1);
    expect(failuresOf(logger, 'compactView')[0]?.['error']).toBe('the site moved');
  });

  it('should name a failing part once and not at every scan', async () => {
    // A page that keeps mutating asks for a scan every 200 ms, so a part that
    // throws every time would write five warnings a second and bury the one
    // line worth reading.
    document.body.innerHTML = MODAL_HTML;
    const { overlay, logger } = mount(DEFAULT_SETTINGS, makeCategorize(), undefined, () => {
      throw new Error('the site moved');
    });
    await scanUntilDrawn(overlay);

    scan(overlay);
    scan(overlay);

    expect(failuresOf(logger, 'compactView')).toHaveLength(1);
  });

  it('should name a part again when it recovers and then breaks a second time', async () => {
    // Staying quiet forever after the first failure would hide a part that
    // gives up, comes back and gives up again, which is what a site being
    // deployed under an open tab looks like.
    document.body.innerHTML = MODAL_HTML;
    let isBroken = true;
    const { overlay, logger } = mount(DEFAULT_SETTINGS, makeCategorize(), undefined, () => {
      if (isBroken) {
        throw new Error('the site moved');
      }
      return COMPACT_PATH;
    });
    await scanUntilDrawn(overlay);

    isBroken = false;
    scan(overlay);
    isBroken = true;
    scan(overlay);

    expect(failuresOf(logger, 'compactView')).toHaveLength(2);
  });

  it('should ask for no categorization at all when every setting is off', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const { overlay, categorize } = mount(ALL_OFF);

    scan(overlay);

    expect(categorize).not.toHaveBeenCalled();
  });

  it('should ask for the categories again when a feature is turned back on', async () => {
    document.body.innerHTML = GRID_HTML;
    const { overlay, categorize } = mount(ALL_OFF);
    scan(overlay);

    // No scan after it: nothing would make the page mutate, so `applySettings`
    // is the only thing that can ask for the title seen while everything was
    // off, and asking for it twice would be a waste.
    overlay.applySettings(DEFAULT_SETTINGS);

    await vi.waitFor(() => {
      expect(categorize).toHaveBeenCalledOnce();
    });
  });

  it('should scan the page again when the retry of a failed batch comes due', async () => {
    document.body.innerHTML = GRID_HTML;
    const categorize = makeCategorize().mockRejectedValueOnce(new Error('Wikidata is unreachable'));
    const { overlay, retries } = mount(DEFAULT_SETTINGS, categorize);

    scan(overlay);

    await vi.waitFor(() => {
      expect(retries).toHaveLength(1);
    });
    // Nothing mutates the page in between, so no other scan can ever come:
    // without the one the retry itself raises, the card stays as it is.
    expect(cardButtons()).toHaveLength(0);

    retries[0]?.();

    await vi.waitFor(() => {
      expect(cardButtons()).toHaveLength(1);
    });
    expect(categorize).toHaveBeenCalledTimes(2);
  });

  it('should ask for the addresses of the pictures only while the images are on', async () => {
    document.body.innerHTML = GRID_HTML;
    // The trade cards are off as well: they are the other feature that draws
    // a picture of Wikimedia, and one of them being on is enough to ask.
    const { overlay, categorize } = mount({
      ...DEFAULT_SETTINGS,
      missingImages: false,
      tradeCards: false,
    });

    scan(overlay);

    await vi.waitFor(() => {
      expect(categorize).toHaveBeenCalledOnce();
    });
    // The link is on, so the batch leaves anyway: what a switched off
    // feature must cost is its own traffic, here one request to Wikipedia per
    // batch and the entries it would have stored.
    expect(categorize).toHaveBeenNthCalledWith(1, expect.anything(), {
      resolveImageUrls: false,
    });

    // Switched back on between two batches: the setting is read when a batch
    // leaves, not when the overlay was built, so the next one resolves again.
    overlay.applySettings(DEFAULT_SETTINGS);
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    scan(overlay);

    await vi.waitFor(() => {
      expect(categorize).toHaveBeenCalledTimes(2);
    });
    expect(categorize).toHaveBeenNthCalledWith(2, expect.anything(), {
      resolveImageUrls: true,
    });
  });

  it('should draw the nodes of a feature turned back on without waiting for a scan', async () => {
    document.body.innerHTML = GRID_HTML;
    const { overlay, categorize } = mount(ALL_OFF);
    scan(overlay);
    expect(categorize).not.toHaveBeenCalled();

    overlay.applySettings({ ...ALL_OFF, letterboxdLink: true });

    expect(categorize).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(cardButtons().length).toBeGreaterThan(0);
    });
  });

  it('should write nothing when the settings are applied again unchanged', async () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML + MODAL_HTML;
    const { overlay, categorize } = mount();
    await scanUntilDrawn(overlay);
    scan(overlay);
    const observer = observeBody();

    overlay.applySettings(DEFAULT_SETTINGS);

    expect(observer.takeRecords()).toHaveLength(0);
    expect(categorize).toHaveBeenCalledOnce();
    observer.disconnect();
  });

  it('should write nothing on a second scan when every feature is on', async () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML + MODAL_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a scan while every feature is off', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML + MODAL_HTML;
    const { overlay } = mount(ALL_OFF);
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should leave no node of ours behind when every feature is off', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML + MODAL_HTML + TRADES_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount(ALL_OFF);

    scan(overlay);

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});
