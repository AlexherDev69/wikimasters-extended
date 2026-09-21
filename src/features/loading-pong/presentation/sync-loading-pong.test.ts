import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { stubCanvasContext, type CanvasStub } from '../../../../tests/helpers/canvas-context';
import type { Logger } from '../../../core/logger/logger';
import { PONG_SELECTOR } from '../data/pong-panel';
import {
  createLoadingPongState,
  LOADING_PATIENCE_MS,
  stopLoadingPong,
  syncLoadingPong,
  type LoadingPongDeps,
  type LoadingPongState,
} from './sync-loading-pong';

const LOADING = true;
const LOADED = false;

interface Harness {
  state: LoadingPongState;
  deps: LoadingPongDeps;
  /** The checks armed on the context, held rather than run. */
  checks: { callback: () => void; delayMs: number }[];
  /** The frames the loop asked for, held for the same reason. */
  frames: ((timeMs: number) => void)[];
  syncs: number;
  logger: Logger;
}

function makeHarness(): Harness {
  const checks: Harness['checks'] = [];
  const frames: ((timeMs: number) => void)[] = [];
  const logger: Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const harness: Harness = {
    state: createLoadingPongState(),
    checks,
    frames,
    syncs: 0,
    logger,
    deps: {
      scheduleCheck: (callback, delayMs) => {
        checks.push({ callback, delayMs });
      },
      requestFrame: (callback) => {
        frames.push(callback);
      },
      requestSync: () => {
        harness.syncs += 1;
      },
      logger,
    },
  };
  return harness;
}

/** The page still loading a whole patience later, as the armed check finds it. */
function waitOutThePatience(harness: Harness): void {
  syncLoadingPong(document.body, LOADING, harness.state, harness.deps);
  harness.checks[0]?.callback();
  syncLoadingPong(document.body, LOADING, harness.state, harness.deps);
}

function panel(): Element | null {
  return document.body.querySelector(PONG_SELECTOR);
}

describe('syncLoadingPong', () => {
  let stub: CanvasStub;

  beforeEach(() => {
    document.body.innerHTML = '';
    stub = stubCanvasContext();
  });

  afterEach(() => {
    stub.restore();
  });

  it('should show no game when the page is not loading', () => {
    const harness = makeHarness();

    syncLoadingPong(document.body, LOADED, harness.state, harness.deps);

    expect(panel()).toBeNull();
    expect(harness.checks).toHaveLength(0);
  });

  it('should show no game on the first sync of a loading page', () => {
    const harness = makeHarness();

    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);

    // A page that loads in a normal time must never see the game at all.
    expect(panel()).toBeNull();
  });

  it('should arm the look back at the page for the whole patience', () => {
    const harness = makeHarness();

    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);

    expect(harness.checks[0]?.delayMs).toBe(LOADING_PATIENCE_MS);
  });

  it('should arm only one check when the loading page keeps mutating', () => {
    const harness = makeHarness();

    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);
    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);
    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);

    expect(harness.checks).toHaveLength(1);
  });

  it('should ask for a scan when the patience runs out', () => {
    const harness = makeHarness();

    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);
    harness.checks[0]?.callback();

    // A page showing nothing mutates nothing, so nothing else would notice.
    expect(harness.syncs).toBe(1);
  });

  it('should show the game when the page is still loading a patience later', () => {
    const harness = makeHarness();

    waitOutThePatience(harness);

    expect(panel()).not.toBeNull();
  });

  it('should start painting as soon as the game is shown', () => {
    const harness = makeHarness();

    waitOutThePatience(harness);

    expect(harness.frames).toHaveLength(1);
  });

  it('should keep asking for frames while the game is on screen', () => {
    const harness = makeHarness();
    waitOutThePatience(harness);

    harness.frames[0]?.(16);

    expect(harness.frames).toHaveLength(2);
  });

  it('should leave the game alone while the loading page keeps mutating', () => {
    const harness = makeHarness();
    waitOutThePatience(harness);
    const shown = panel();

    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);

    expect(panel()).toBe(shown);
    expect(harness.frames).toHaveLength(1);
  });

  it('should take the game back when the page finally shows something', () => {
    const harness = makeHarness();
    waitOutThePatience(harness);

    syncLoadingPong(document.body, LOADED, harness.state, harness.deps);

    expect(panel()).toBeNull();
  });

  it('should stop the loop when the game is taken back', () => {
    const harness = makeHarness();
    waitOutThePatience(harness);
    syncLoadingPong(document.body, LOADED, harness.state, harness.deps);
    const asked = harness.frames.length;

    // The frame the browser had already granted lands after the teardown.
    harness.frames[asked - 1]?.(16);

    expect(harness.frames).toHaveLength(asked);
  });

  it('should make the next slow page wait the whole patience again', () => {
    const harness = makeHarness();
    waitOutThePatience(harness);
    syncLoadingPong(document.body, LOADED, harness.state, harness.deps);

    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);

    expect(panel()).toBeNull();
  });

  it('should make the next page wait its own patience when the first one loaded in time', () => {
    const harness = makeHarness();
    // A page that was loading, then loaded in time: its check is still armed
    // over the page the site navigates to next, which reloads nothing.
    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);
    syncLoadingPong(document.body, LOADED, harness.state, harness.deps);
    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);

    harness.checks[0]?.callback();
    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);

    // The stale check says nothing about this wait: no game yet, and a fresh
    // check armed for it.
    expect(panel()).toBeNull();
    expect(harness.checks).toHaveLength(2);
  });

  it('should show the game when the second page waits its own patience out', () => {
    const harness = makeHarness();
    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);
    syncLoadingPong(document.body, LOADED, harness.state, harness.deps);
    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);
    harness.checks[0]?.callback();
    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);

    harness.checks[1]?.callback();
    syncLoadingPong(document.body, LOADING, harness.state, harness.deps);

    expect(panel()).not.toBeNull();
  });

  it('should write nothing on the page when it stops loading without a game', () => {
    const harness = makeHarness();
    const observer = new MutationObserver(() => undefined);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    syncLoadingPong(document.body, LOADED, harness.state, harness.deps);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should show nothing and say so when the browser gives no canvas', () => {
    const harness = makeHarness();
    stub.restore();

    waitOutThePatience(harness);

    expect(panel()).toBeNull();
    expect(harness.logger.warn).toHaveBeenCalled();
  });
});

describe('stopLoadingPong', () => {
  let stub: CanvasStub;

  beforeEach(() => {
    document.body.innerHTML = '';
    stub = stubCanvasContext();
  });

  afterEach(() => {
    stub.restore();
  });

  it('should take back a game that is running', () => {
    const harness = makeHarness();
    waitOutThePatience(harness);

    stopLoadingPong(document.body, harness.state);

    expect(panel()).toBeNull();
  });

  it('should take back a panel left behind by an older session', () => {
    const harness = makeHarness();
    waitOutThePatience(harness);
    harness.state.session = null;

    stopLoadingPong(document.body, harness.state);

    expect(panel()).toBeNull();
  });

  it('should stop listening to the pointer when the game is taken back', () => {
    const harness = makeHarness();
    waitOutThePatience(harness);
    const canvas = document.body.querySelector('canvas') as HTMLCanvasElement;
    let received = 0;
    canvas.addEventListener('pointermove', () => {
      received += 1;
    });

    stopLoadingPong(document.body, harness.state);
    canvas.dispatchEvent(new Event('pointermove'));

    // Our own listener counts: the one of the game must be gone with it.
    expect(received).toBe(1);
    expect(panel()).toBeNull();
  });

  it('should write nothing when there is no game at all', () => {
    const harness = makeHarness();
    const observer = new MutationObserver(() => undefined);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    stopLoadingPong(document.body, harness.state);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
