import type { Logger } from '../../../core/logger/logger';
import {
  buildPongView,
  drawGame,
  readTargetY,
  removePongPanels,
  type PongView,
} from '../data/pong-panel';
import { advance, createGame, FIELD_HEIGHT, type PongGame } from '../domain/pong-game';

/**
 * A game of Pong over the loading screen, when the site keeps the reader
 * waiting. It appears over a page showing nothing but a spinner, and it goes
 * away the moment the page has something to show.
 *
 * Reading only: the panel is ours, the game is painted inside a canvas, and
 * the only thing this feature ever reads of the site is whether a spinner is
 * on the page.
 */

/** How long the site may keep the reader waiting before the game appears. */
export const LOADING_PATIENCE_MS = 3_000;

const MILLISECONDS_PER_SECOND = 1_000;

const POINTER_EVENT = 'pointermove';

/** One game on screen: what it draws in, and how to stop it. */
interface PongSession {
  view: PongView;
  stop: () => void;
}

export interface LoadingPongState {
  /** True once the page has been loading for the whole patience. */
  hasWaited: boolean;
  /** True while a look back at the page is already armed. */
  isCheckArmed: boolean;
  /** The game on screen, null when there is none. */
  session: PongSession | null;
}

export interface LoadingPongDeps {
  /**
   * Arms the look back at the page, on the context of the content script so
   * it is cleared with it rather than firing after the teardown.
   */
  scheduleCheck: (callback: () => void, delayMs: number) => void;
  /** Asks for the next frame, on that same context. */
  requestFrame: (callback: (timeMs: number) => void) => void;
  /**
   * Runs a whole scan: a page that shows nothing mutates nothing, so nothing
   * else would ever notice that the wait has gone on long enough.
   */
  requestSync: () => void;
  logger: Logger;
}

export function createLoadingPongState(): LoadingPongState {
  return { hasWaited: false, isCheckArmed: false, session: null };
}

/**
 * Starts a game in `root`, or nothing at all on a browser that gives no
 * canvas to play it in.
 */
function startSession(root: HTMLElement, deps: LoadingPongDeps): PongSession | null {
  const view = buildPongView(root.ownerDocument);
  if (view === null) {
    deps.logger.warn('Pong needs a 2d canvas, which this page did not give');
    return null;
  }
  return runGame(root, view, deps);
}

/**
 * Puts the panel on the page and paints the game in it, frame after frame.
 * The loop asks for its frames through the context of the content script, so
 * it stops with the extension; `stop` cuts it as well, for every other way a
 * game can end.
 */
function runGame(root: HTMLElement, view: PongView, deps: LoadingPongDeps): PongSession {
  let game: PongGame = createGame();
  let targetY = FIELD_HEIGHT / 2;
  let lastTimeMs: number | null = null;
  let isRunning = true;

  view.canvas.addEventListener(POINTER_EVENT, (event: PointerEvent) => {
    targetY = readTargetY(view, event.clientY);
  });

  function frame(timeMs: number): void {
    if (!isRunning) {
      return;
    }
    // The first frame moves nothing: there is no previous one to measure it
    // against, and a step read off an absolute clock would be enormous.
    const seconds = lastTimeMs === null ? 0 : (timeMs - lastTimeMs) / MILLISECONDS_PER_SECOND;
    lastTimeMs = timeMs;
    game = advance(game, targetY, seconds);
    drawGame(view, game);
    deps.requestFrame(frame);
  }

  root.appendChild(view.panel);
  drawGame(view, game);
  deps.requestFrame(frame);

  return {
    view,
    stop: (): void => {
      isRunning = false;
      view.panel.remove();
    },
  };
}

/**
 * Ends the game on screen, if there is one, and takes back any panel left
 * behind. Called when the page finally shows something, when the setting goes
 * off and when the content script is torn down: a loop left running over a
 * page nobody is waiting for is exactly what this must never become.
 */
export function stopLoadingPong(root: ParentNode, state: LoadingPongState): void {
  state.session?.stop();
  state.session = null;
  state.hasWaited = false;
  removePongPanels(root);
}

/**
 * One pass. `isLoading` is what the page says right now; the game is offered
 * only on the second pass that says so, the one a check armed a whole
 * patience earlier, so a page that loads normally never sees it.
 */
export function syncLoadingPong(
  root: HTMLElement,
  isLoading: boolean,
  state: LoadingPongState,
  deps: LoadingPongDeps,
): void {
  if (!isLoading) {
    // Writes nothing at all when there was no game, which is every sync of
    // every page that loaded in time.
    if (state.session !== null) {
      stopLoadingPong(root, state);
      return;
    }
    state.hasWaited = false;
    return;
  }

  // A game already on screen keeps playing: the sync leaves it alone, so the
  // page mutating under it costs nothing and the ball never jumps.
  if (state.session !== null) {
    return;
  }

  if (!state.hasWaited) {
    armCheck(state, deps);
    return;
  }
  state.session = startSession(root, deps);
}

/**
 * Arms one look back at the page, and only one: a page that is loading still
 * mutates, and each of its mutations raises a sync of its own.
 */
function armCheck(state: LoadingPongState, deps: LoadingPongDeps): void {
  if (state.isCheckArmed) {
    return;
  }
  state.isCheckArmed = true;
  deps.scheduleCheck(() => {
    state.isCheckArmed = false;
    state.hasWaited = true;
    // The page may well have finished in the meantime, which the scan this
    // asks for is exactly what tells.
    deps.requestSync();
  }, LOADING_PATIENCE_MS);
}
