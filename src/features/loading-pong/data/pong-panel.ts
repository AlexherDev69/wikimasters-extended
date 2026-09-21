import {
  BALL_RADIUS,
  BAT_HEIGHT,
  BAT_INSET,
  BAT_WIDTH,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  type PongGame,
} from '../domain/pong-game';

/**
 * The panel the game is played in: one node of ours holding one canvas.
 *
 * A canvas is what makes this feature possible at all. The content script
 * watches `document.body` for childList and characterData, so a score written
 * as text and a ball moved as a node would mutate the page sixty times a
 * second and the observer would never come to rest. Everything here is
 * painted INSIDE the canvas instead: the panel is added once, and from then
 * on the game costs the page not one mutation.
 */

const PANEL_TAG = 'div';
const CANVAS_TAG = 'canvas';
const CANVAS_CONTEXT = '2d';

/** Marks the panel, so a second sync finds the one already there. */
const PONG_ATTRIBUTE = 'data-wme-pong';

export const PONG_SELECTOR = `[${PONG_ATTRIBUTE}]`;

const PANEL_CLASS = 'wme-pong';
const CANVAS_CLASS = 'wme-pong-field';

/** The canvas in CSS pixels, at the proportions of the field. */
const CANVAS_WIDTH = 520;
const CANVAS_HEIGHT = 312;

const TITLE = 'Ça rame. Un Pong ?';
const HINT = 'Bouge la souris sur le terrain';

/** Ink of the game, with the accent of the site read off the page. */
const ACCENT_VARIABLE = '--color-accent';
const ACCENT_FALLBACK = '#34d399';
const FIELD_INK = 'rgba(255, 255, 255, 0.85)';
const FAINT_INK = 'rgba(255, 255, 255, 0.35)';
const GROUND = 'rgba(9, 12, 17, 0.92)';

const TITLE_FONT = 'bold 14px ui-sans-serif, system-ui, sans-serif';
const SCORE_FONT = 'bold 40px ui-monospace, monospace';
const HINT_FONT = '11px ui-sans-serif, system-ui, sans-serif';

const TITLE_BASELINE = 22;
const SCORE_BASELINE = 70;
const SCORE_OFFSET = 52;
const HINT_BASELINE = CANVAS_HEIGHT - 12;

/** The dashed line down the middle, in field units. */
const NET_DASH = 3;
const NET_GAP = 3;
const NET_WIDTH = 0.5;

/** What one game needs to draw itself, built once with the panel. */
export interface PongView {
  panel: HTMLElement;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  accent: string;
  /** CSS pixels per field unit, the same on both axes. */
  scale: number;
}

function readAccent(element: Element): string {
  const view = element.ownerDocument.defaultView;
  if (view === null) {
    return ACCENT_FALLBACK;
  }
  const accent = view.getComputedStyle(element).getPropertyValue(ACCENT_VARIABLE).trim();
  return accent === '' ? ACCENT_FALLBACK : accent;
}

/**
 * Builds the panel and its canvas, and hands back everything the game needs
 * to paint. Nothing is added to the page here: the caller decides where it
 * goes, and takes it back the same way.
 */
export function buildPongView(document: Document): PongView | null {
  const panel = document.createElement(PANEL_TAG);
  panel.className = PANEL_CLASS;
  panel.setAttribute(PONG_ATTRIBUTE, '');

  const canvas = document.createElement(CANVAS_TAG);
  canvas.className = CANVAS_CLASS;
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  panel.appendChild(canvas);

  const context = canvas.getContext(CANVAS_CONTEXT);
  if (context === null) {
    // A browser that gives no 2d context simply gets no game.
    return null;
  }
  return {
    panel,
    canvas,
    context,
    accent: readAccent(document.documentElement),
    scale: CANVAS_WIDTH / FIELD_WIDTH,
  };
}

/**
 * Where the pointer is asking the bat to go, in field units. Read off the
 * canvas itself, so a page scrolled or zoomed anywhere still answers right.
 */
export function readTargetY(view: PongView, clientY: number): number {
  const bounds = view.canvas.getBoundingClientRect();
  if (bounds.height === 0) {
    return FIELD_HEIGHT / 2;
  }
  return ((clientY - bounds.top) / bounds.height) * FIELD_HEIGHT;
}

function drawNet(context: CanvasRenderingContext2D, scale: number): void {
  context.fillStyle = FAINT_INK;
  const x = (FIELD_WIDTH / 2 - NET_WIDTH / 2) * scale;

  for (let y = 0; y < FIELD_HEIGHT; y += NET_DASH + NET_GAP) {
    context.fillRect(x, y * scale, NET_WIDTH * scale, NET_DASH * scale);
  }
}

function drawBat(
  context: CanvasRenderingContext2D,
  scale: number,
  x: number,
  centreY: number,
): void {
  context.fillRect(
    x * scale,
    (centreY - BAT_HEIGHT / 2) * scale,
    BAT_WIDTH * scale,
    BAT_HEIGHT * scale,
  );
}

function drawScores(view: PongView, game: PongGame): void {
  const { context } = view;
  const middle = view.canvas.width / 2;

  context.font = SCORE_FONT;
  context.textAlign = 'right';
  context.fillStyle = view.accent;
  context.fillText(String(game.playerScore), middle - SCORE_OFFSET, SCORE_BASELINE);
  context.textAlign = 'left';
  context.fillStyle = FAINT_INK;
  context.fillText(String(game.rivalScore), middle + SCORE_OFFSET, SCORE_BASELINE);
}

/** Paints one frame. Reads the game, writes only to the canvas. */
export function drawGame(view: PongView, game: PongGame): void {
  const { context, scale } = view;
  context.clearRect(0, 0, view.canvas.width, view.canvas.height);
  context.fillStyle = GROUND;
  context.fillRect(0, 0, view.canvas.width, view.canvas.height);

  drawNet(context, scale);
  drawScores(view, game);

  context.textAlign = 'center';
  context.fillStyle = FAINT_INK;
  context.font = TITLE_FONT;
  context.fillText(TITLE, view.canvas.width / 2, TITLE_BASELINE);
  context.font = HINT_FONT;
  context.fillText(HINT, view.canvas.width / 2, HINT_BASELINE);

  context.fillStyle = view.accent;
  drawBat(context, scale, BAT_INSET, game.playerY);
  context.fillStyle = FIELD_INK;
  drawBat(context, scale, FIELD_WIDTH - BAT_INSET - BAT_WIDTH, game.rivalY);

  context.beginPath();
  context.arc(
    game.ball.x * scale,
    game.ball.y * scale,
    BALL_RADIUS * scale,
    0,
    Math.PI * 2,
  );
  context.fill();
}

/** Takes back every panel this feature added, and nothing else. */
export function removePongPanels(root: ParentNode): void {
  for (const panel of root.querySelectorAll(PONG_SELECTOR)) {
    panel.remove();
  }
}
