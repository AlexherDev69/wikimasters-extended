import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from '../../../core/logger/logger';
import { CATEGORIZATION_RETRY_DELAY_MS } from '../../card-detection/presentation/handle-scan';
import { MAX_CATALOGUE_TOTAL, type CatalogueTotals } from '../domain/catalogue-totals';
import {
  createCatalogueRecorder,
  type CatalogueRecorder,
  type SendCatalogueTotals,
} from './record-catalogue-totals';

const CATALOGUE_PATH = '/global-collection';
const COLLECTION_PATH = '/collection';

/** The setting is on, which is what every test but the ones about it needs. */
const ALWAYS_ENABLED = (): boolean => true;

const TOTALS: CatalogueTotals = {
  l: 1761,
  ur: 12_368,
  sr: 66_788,
  r: 179_657,
  pc: 516_762,
  c: 1_996_125,
};

const LARGER_TOTALS: CatalogueTotals = {
  l: 1762,
  ur: 12_368,
  sr: 66_788,
  r: 179_657,
  pc: 516_762,
  c: 1_996_125,
};

const GRAND_TOTAL = 2_773_461;

/**
 * A block of another page whose six labels appear once and add up to the total
 * it displays itself: the reader accepts it, so only the path may refuse it.
 */
const PERSONAL_TOTALS: CatalogueTotals = { l: 1, ur: 2, sr: 3, r: 4, pc: 5, c: 6 };

const PERSONAL_GRAND_TOTAL = 21;

/** Above what the service worker accepts, so it would be refused for good. */
const OVERSIZED_TOTALS: CatalogueTotals = {
  l: MAX_CATALOGUE_TOTAL + 1,
  ur: 0,
  sr: 0,
  r: 0,
  pc: 0,
  c: 0,
};

/** The notice the site puts in the header block while a search is running. */
const SEARCH_NOTICE = 'Recherche active : pas de décompte par rareté ni de total exact';

interface CapturedRetries {
  scheduleRetry: (callback: () => void, delayMs: number) => void;
  delays: number[];
  runAll: () => void;
}

/** Collects the retries instead of arming a real timer. */
function captureRetries(): CapturedRetries {
  const callbacks: (() => void)[] = [];
  const delays: number[] = [];

  return {
    scheduleRetry: (callback, delayMs): void => {
      callbacks.push(callback);
      delays.push(delayMs);
    },
    delays,
    runAll: (): void => {
      for (const callback of callbacks) {
        callback();
      }
    },
  };
}

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function frameHtml(totals: CatalogueTotals, grandTotal: number): string {
  const entries = [
    ['L', totals.l],
    ['UR', totals.ur],
    ['SR', totals.sr],
    ['R', totals.r],
    ['PC', totals.pc],
    ['C', totals.c],
  ] as const;

  return `<div class="card-frame p-4"><div class="flex gap-3">${entries
    .map(([label, count]) => `<div><span>${label}:</span><span>${String(count)}</span></div>`)
    .join('')}</div><div><span>${String(grandTotal)} cartes au total</span></div></div>`;
}

/** The page the recorder reads, as the site would render it. */
function pageWith(html: string): HTMLElement {
  const page = document.createElement('div');
  page.innerHTML = html;
  return page;
}

function cataloguePage(totals: CatalogueTotals = TOTALS, grandTotal = GRAND_TOTAL): HTMLElement {
  return pageWith(frameHtml(totals, grandTotal));
}

function captureSends(): { send: SendCatalogueTotals; sent: CatalogueTotals[] } {
  const sent: CatalogueTotals[] = [];
  return {
    send: (totals): Promise<void> => {
      sent.push(totals);
      return Promise.resolve();
    },
    sent,
  };
}

describe('createCatalogueRecorder', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = makeLogger();
  });

  function makeRecorder(
    send: SendCatalogueTotals,
    scheduleRetry: CapturedRetries['scheduleRetry'] = captureRetries().scheduleRetry,
    isEnabled: () => boolean = ALWAYS_ENABLED,
  ): CatalogueRecorder {
    return createCatalogueRecorder({ send, logger, scheduleRetry, isEnabled });
  }

  it('should send the six totals when the catalogue page is displayed', () => {
    const { send, sent } = captureSends();

    makeRecorder(send).record(cataloguePage(), CATALOGUE_PATH);

    expect(sent).toEqual([TOTALS]);
  });

  it('should send nothing more when the next scans read the same totals', () => {
    const { send, sent } = captureSends();
    const recorder = makeRecorder(send);
    const page = cataloguePage();

    recorder.record(page, CATALOGUE_PATH);
    recorder.record(page, CATALOGUE_PATH);
    recorder.record(page, CATALOGUE_PATH);

    expect(sent).toHaveLength(1);
  });

  it('should send the totals again when the catalogue announces new ones', () => {
    const { send, sent } = captureSends();
    const recorder = makeRecorder(send);

    recorder.record(cataloguePage(), CATALOGUE_PATH);
    recorder.record(cataloguePage(LARGER_TOTALS, GRAND_TOTAL + 1), CATALOGUE_PATH);

    expect(sent).toEqual([TOTALS, LARGER_TOTALS]);
  });

  it('should send nothing when the page is not the catalogue', () => {
    const { send, sent } = captureSends();
    const recorder = makeRecorder(send);
    const page = cataloguePage();

    // The header block can still be in the DOM right after a client side
    // navigation: the path is what decides.
    recorder.record(page, COLLECTION_PATH);
    recorder.record(page, '/marketplace');

    expect(sent).toHaveLength(0);
  });

  it('should record nothing on the first scan after the route changed', () => {
    const { send, sent } = captureSends();
    const recorder = makeRecorder(send);

    recorder.record(cataloguePage(), COLLECTION_PATH);
    // The scan fires after the URL changed but still reads the page being
    // left, whose own card frame announces counts the reader would accept.
    recorder.record(
      cataloguePage(PERSONAL_TOTALS, PERSONAL_GRAND_TOTAL),
      CATALOGUE_PATH,
    );
    expect(sent).toHaveLength(0);

    recorder.record(cataloguePage(), CATALOGUE_PATH);
    expect(sent).toEqual([TOTALS]);
  });

  it('should record at once on the first scan of a page loaded on the catalogue', () => {
    const { send, sent } = captureSends();

    // At load the URL and the DOM agree, so there is nothing to skip.
    makeRecorder(send).record(cataloguePage(), CATALOGUE_PATH);

    expect(sent).toHaveLength(1);
  });

  it('should skip one scan again when the route changed while the setting was off', () => {
    const { send, sent } = captureSends();
    let enabled = false;
    const recorder = makeRecorder(send, captureRetries().scheduleRetry, (): boolean => enabled);

    recorder.record(cataloguePage(), CATALOGUE_PATH);
    recorder.record(cataloguePage(), COLLECTION_PATH);
    enabled = true;
    // The recorder was called on the scans it had nothing to do with, so it
    // knows the route has just changed and that this scan can still be showing
    // the block of the page being left.
    recorder.record(cataloguePage(PERSONAL_TOTALS, PERSONAL_GRAND_TOTAL), CATALOGUE_PATH);
    expect(sent).toHaveLength(0);

    recorder.record(cataloguePage(), CATALOGUE_PATH);
    expect(sent).toEqual([TOTALS]);
  });

  it('should send nothing when a total is above what the service worker accepts', () => {
    const { send, sent } = captureSends();

    // The reader takes any safe whole number: a batch the guard would refuse
    // must never leave, or it would be sent again every minute for good.
    makeRecorder(send).record(
      cataloguePage(OVERSIZED_TOTALS, MAX_CATALOGUE_TOTAL + 1),
      CATALOGUE_PATH,
    );

    expect(sent).toHaveLength(0);
  });

  it('should send nothing when the header block cannot be read with certainty', () => {
    const { send, sent } = captureSends();

    // The counts do not add up to the displayed total.
    makeRecorder(send).record(cataloguePage(TOTALS, GRAND_TOTAL + 1), CATALOGUE_PATH);

    expect(sent).toHaveLength(0);
  });

  it('should keep the recorded totals when a search hides the header numbers', () => {
    const { send, sent } = captureSends();
    const recorder = makeRecorder(send);
    recorder.record(cataloguePage(), CATALOGUE_PATH);

    // The site replaces the whole block while a search is running, so the
    // reader gives nothing: nothing is sent, and nothing is unsent either.
    recorder.record(
      pageWith(`<div class="card-frame"><span>${SEARCH_NOTICE}</span></div>`),
      CATALOGUE_PATH,
    );

    expect(sent).toEqual([TOTALS]);
  });

  it('should send nothing while the setting is off', () => {
    const { send, sent } = captureSends();

    makeRecorder(send, captureRetries().scheduleRetry, (): boolean => false).record(
      cataloguePage(),
      CATALOGUE_PATH,
    );

    expect(sent).toHaveLength(0);
  });

  it('should send the totals seen while the setting was off once it is back on', () => {
    const { send, sent } = captureSends();
    let enabled = false;
    const recorder = makeRecorder(
      send,
      captureRetries().scheduleRetry,
      (): boolean => enabled,
    );
    const page = cataloguePage();

    recorder.record(page, CATALOGUE_PATH);
    expect(sent).toHaveLength(0);

    enabled = true;
    recorder.record(page, CATALOGUE_PATH);

    expect(sent).toEqual([TOTALS]);
  });

  it('should send the same totals again after the retry delay when the send rejects', async () => {
    const retries = captureRetries();
    const sent: CatalogueTotals[] = [];
    let failNext = true;
    const send: SendCatalogueTotals = (totals) => {
      sent.push(totals);
      if (failNext) {
        failNext = false;
        return Promise.reject(new Error('port closed'));
      }
      return Promise.resolve();
    };
    const recorder = makeRecorder(send, retries.scheduleRetry);
    const page = cataloguePage();

    recorder.record(page, CATALOGUE_PATH);
    await vi.waitFor(() => {
      expect(retries.delays).toEqual([CATEGORIZATION_RETRY_DELAY_MS]);
    });

    // Until the delay expires the reading stays sent, so the scans in between
    // ask for nothing.
    recorder.record(page, CATALOGUE_PATH);
    expect(sent).toHaveLength(1);

    retries.runAll();
    recorder.record(page, CATALOGUE_PATH);
    expect(sent).toEqual([TOTALS, TOTALS]);
  });

  it('should keep the newer reading when the retry of an older one fires', async () => {
    const retries = captureRetries();
    const sent: CatalogueTotals[] = [];
    const send: SendCatalogueTotals = (totals) => {
      sent.push(totals);
      return totals.l === TOTALS.l ? Promise.reject(new Error('port closed')) : Promise.resolve();
    };
    const recorder = makeRecorder(send, retries.scheduleRetry);

    recorder.record(cataloguePage(), CATALOGUE_PATH);
    await vi.waitFor(() => {
      expect(retries.delays).toHaveLength(1);
    });
    recorder.record(cataloguePage(LARGER_TOTALS, GRAND_TOTAL + 1), CATALOGUE_PATH);

    retries.runAll();
    recorder.record(cataloguePage(LARGER_TOTALS, GRAND_TOTAL + 1), CATALOGUE_PATH);

    expect(sent).toEqual([TOTALS, LARGER_TOTALS]);
  });

  it('should log a warning when the send rejects', async () => {
    const retries = captureRetries();
    const send: SendCatalogueTotals = () => Promise.reject(new Error('port closed'));

    makeRecorder(send, retries.scheduleRetry).record(cataloguePage(), CATALOGUE_PATH);

    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledOnce();
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Catalogue totals not recorded',
      expect.objectContaining({ error: 'port closed' }),
    );
  });
});
