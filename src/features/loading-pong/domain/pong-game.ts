/**
 * The whole game, as numbers. No canvas, no event, no timer: a state and a
 * function that moves it forward by a slice of time, so the rules can be read
 * and tested without a browser at all.
 *
 * Everything is in the units of a field 100 wide and 60 tall, and the canvas
 * scales that field to whatever room it has. Nothing here is random: the
 * angle a ball leaves with is read off where it hit the bat, exactly as the
 * original does, so a game played twice from the same moves plays out the
 * same way twice.
 */

export const FIELD_WIDTH = 100;
export const FIELD_HEIGHT = 60;

export const BAT_HEIGHT = 13;
export const BAT_WIDTH = 2;
/** Distance from the edge to the outer side of each bat. */
export const BAT_INSET = 3;

export const BALL_RADIUS = 1.3;

/**
 * Speed of the ball when it is served, in field units per second. A field is
 * 100 wide, so the ball crosses it in well under two seconds from the very
 * first serve: this is a game to wake the reader up, not a rally to watch.
 */
export const SERVE_SPEED = 92;
/** Added at each return, so a long rally gets harder. */
const SPEED_PER_RETURN = 7;
/**
 * The ceiling of a long rally. It is set by what stays playable and not by
 * what stays accurate: the simulation is cut into steps short enough for any
 * speed, see MAX_STEP_DISTANCE below, so raising this number costs a few more
 * steps a frame and nothing else.
 */
export const MAX_SPEED = 175;

/**
 * The bat of the player follows the pointer, and fast enough to outrun the
 * steepest ball there is: a return sent at the very end of a bat carries
 * MAX_BOUNCE_RATIO of the top speed into the vertical, which is 131 units a
 * second, so a bat slower than that could be beaten by a ball the player saw
 * coming.
 */
const PLAYER_SPEED = 200;
/**
 * The rival is slower than the ball can be, which is what makes it beatable:
 * it cannot reach a ball returned at a sharp angle from the far side. Raised
 * with the ball, and by the same measure, so a faster game does not become a
 * free win: it crosses the field in 0.81 second against the 0.57 the ball
 * takes to reach it at top speed.
 */
const RIVAL_SPEED = 74;

/**
 * How far from straight a return can be sent: the fraction of the ball's
 * speed that goes into the vertical when it hits the very end of a bat.
 */
const MAX_BOUNCE_RATIO = 0.75;

/** A frame longer than this is treated as this: a tab left in the background
 * must never fast forward the game by everything it slept through. */
const MAX_FRAME_SECONDS = 0.05;

/**
 * The furthest the ball may travel inside ONE step of the simulation. A frame
 * is cut into as many steps as it takes to hold this bound, so how accurate
 * the game is no longer depends on how fast the ball goes.
 *
 * Below the diameter of the ball, which is what the bound is for: a ball that
 * moves less than its own width in a step cannot pass anything without being
 * level with it first, so the return is decided on a ball still in front of
 * the bat rather than on one already behind it.
 */
const MAX_STEP_DISTANCE = 2;

interface Ball {
  x: number;
  y: number;
  /** Speed along each axis, in field units per second. */
  dx: number;
  dy: number;
}

export interface PongGame {
  ball: Ball;
  /** Centre of each bat, in field units from the top. */
  playerY: number;
  rivalY: number;
  playerScore: number;
  rivalScore: number;
  /** Speed of the ball, kept apart so a return can raise it. */
  speed: number;
}

const CENTRE_X = FIELD_WIDTH / 2;
const CENTRE_Y = FIELD_HEIGHT / 2;

/** The x where the ball meets each bat, its own radius included. */
const PLAYER_FACE = BAT_INSET + BAT_WIDTH + BALL_RADIUS;
const RIVAL_FACE = FIELD_WIDTH - BAT_INSET - BAT_WIDTH - BALL_RADIUS;

/** Serves toward `direction`, which is -1 for the player and 1 for the rival. */
function serve(direction: number): Ball {
  return { x: CENTRE_X, y: CENTRE_Y, dx: SERVE_SPEED * direction, dy: 0 };
}

export function createGame(): PongGame {
  return {
    // The first serve goes to the rival, so the player sees the ball coming
    // rather than having to catch it on the very first frame.
    ball: serve(1),
    playerY: CENTRE_Y,
    rivalY: CENTRE_Y,
    playerScore: 0,
    rivalScore: 0,
    speed: SERVE_SPEED,
  };
}

function clamp(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest);
}

/** A bat stays whole on the field, so its centre cannot reach the edges. */
function clampBat(centreY: number): number {
  return clamp(centreY, BAT_HEIGHT / 2, FIELD_HEIGHT - BAT_HEIGHT / 2);
}

/** Moves a bat toward `targetY`, no faster than `speed` allows. */
function moveBat(centreY: number, targetY: number, speed: number, seconds: number): number {
  const step = speed * seconds;
  const distance = targetY - centreY;

  if (Math.abs(distance) <= step) {
    return clampBat(targetY);
  }
  return clampBat(centreY + Math.sign(distance) * step);
}

/** True while the ball is level with a bat whose centre is at `centreY`. */
function isFacing(ballY: number, centreY: number): boolean {
  return Math.abs(ballY - centreY) <= BAT_HEIGHT / 2 + BALL_RADIUS;
}

/**
 * The ball leaving a bat: the further from the middle of the bat it hit, the
 * steeper it goes, and it always leaves along `direction`.
 */
function bounceOff(ball: Ball, centreY: number, speed: number, direction: number): Ball {
  const offset = clamp((ball.y - centreY) / (BAT_HEIGHT / 2), -1, 1);
  const vertical = speed * MAX_BOUNCE_RATIO * offset;
  const horizontal = Math.sqrt(Math.max(speed * speed - vertical * vertical, 0));

  return {
    x: direction > 0 ? PLAYER_FACE : RIVAL_FACE,
    y: ball.y,
    dx: horizontal * direction,
    dy: vertical,
  };
}

/** The ball after `seconds`, bounced off the top and bottom walls. */
function moveBall(ball: Ball, seconds: number): Ball {
  let { y, dy } = ball;
  y += dy * seconds;

  if (y < BALL_RADIUS) {
    y = BALL_RADIUS + (BALL_RADIUS - y);
    dy = -dy;
  } else if (y > FIELD_HEIGHT - BALL_RADIUS) {
    y = FIELD_HEIGHT - BALL_RADIUS - (y - (FIELD_HEIGHT - BALL_RADIUS));
    dy = -dy;
  }
  return { x: ball.x + ball.dx * seconds, y, dx: ball.dx, dy };
}

/**
 * The game one step of the simulation later, with a step that `advance` has
 * already made short enough that nothing can be crossed inside it.
 */
function stepGame(game: PongGame, targetY: number, seconds: number): PongGame {
  const playerY = moveBat(game.playerY, targetY, PLAYER_SPEED, seconds);
  const rivalY = moveBat(game.rivalY, game.ball.y, RIVAL_SPEED, seconds);
  const moved = moveBall(game.ball, seconds);
  const next: PongGame = { ...game, ball: moved, playerY, rivalY };

  if (moved.dx < 0 && moved.x <= PLAYER_FACE) {
    if (isFacing(moved.y, playerY)) {
      const speed = Math.min(game.speed + SPEED_PER_RETURN, MAX_SPEED);
      return { ...next, speed, ball: bounceOff(moved, playerY, speed, 1) };
    }
    if (moved.x < -BALL_RADIUS) {
      return { ...next, rivalScore: game.rivalScore + 1, speed: SERVE_SPEED, ball: serve(1) };
    }
  }

  if (moved.dx > 0 && moved.x >= RIVAL_FACE) {
    if (isFacing(moved.y, rivalY)) {
      const speed = Math.min(game.speed + SPEED_PER_RETURN, MAX_SPEED);
      return { ...next, speed, ball: bounceOff(moved, rivalY, speed, -1) };
    }
    if (moved.x > FIELD_WIDTH + BALL_RADIUS) {
      return { ...next, playerScore: game.playerScore + 1, speed: SERVE_SPEED, ball: serve(-1) };
    }
  }
  return next;
}

/** True when a step just ended a point, whichever of the two won it. */
function hasScored(before: PongGame, after: PongGame): boolean {
  return after.playerScore !== before.playerScore || after.rivalScore !== before.rivalScore;
}

/**
 * The game one frame later. `targetY` is where the player is asking their bat
 * to be, which is the pointer over the canvas.
 *
 * The frame is cut into as many steps as it takes for the ball to travel less
 * than MAX_STEP_DISTANCE in each one, so how fast the ball goes and how
 * accurately the game reads a return are no longer tied together: a rally at
 * top speed is judged on exactly the same footing as a serve. The count is
 * read off the speed the ball ACTUALLY carries rather than off `game.speed`,
 * which a hand made state can disagree with.
 *
 * A step that scores ends the frame there. The serve that follows therefore
 * leaves from the middle of the field rather than from wherever the rest of
 * the frame would have carried it, and a point stays one discrete thing.
 *
 * Pure: the game handed in is never modified, so a caller can keep a state
 * as long as it likes, and a test can step the same one twice.
 */
export function advance(game: PongGame, targetY: number, seconds: number): PongGame {
  const frame = clamp(seconds, 0, MAX_FRAME_SECONDS);
  const travel = Math.hypot(game.ball.dx, game.ball.dy) * frame;
  const steps = Math.max(Math.ceil(travel / MAX_STEP_DISTANCE), 1);
  let current = game;

  for (let index = 0; index < steps; index += 1) {
    const next = stepGame(current, targetY, frame / steps);
    if (hasScored(current, next)) {
      return next;
    }
    current = next;
  }
  return current;
}
