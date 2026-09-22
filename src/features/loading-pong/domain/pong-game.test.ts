import { describe, it, expect } from 'vitest';
import {
  advance,
  createGame,
  BALL_RADIUS,
  BAT_HEIGHT,
  BAT_INSET,
  BAT_WIDTH,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  MAX_SPEED,
  SERVE_SPEED,
  type PongGame,
} from './pong-game';

/** The x each bat meets the ball at, the radius of the ball included. */
const PLAYER_FACE = BAT_INSET + BAT_WIDTH + BALL_RADIUS;
const RIVAL_FACE = FIELD_WIDTH - BAT_INSET - BAT_WIDTH - BALL_RADIUS;

const CENTRE_Y = FIELD_HEIGHT / 2;
/** One frame of a screen at 20 images per second: the longest step allowed. */
const LONG_STEP = 0.05;

function makeGame(overrides: Partial<PongGame> = {}): PongGame {
  return { ...createGame(), ...overrides };
}

describe('createGame', () => {
  it('should serve toward the rival so the ball comes to the player', () => {
    const game = createGame();

    expect(game.ball.dx).toBeGreaterThan(0);
    expect(game.ball.dy).toBe(0);
  });

  it('should start both players at nothing', () => {
    const game = createGame();

    expect(game.playerScore).toBe(0);
    expect(game.rivalScore).toBe(0);
  });
});

describe('advance', () => {
  it('should leave the game it was given untouched', () => {
    const game = createGame();
    const before = structuredClone(game);

    advance(game, 10, LONG_STEP);

    expect(game).toEqual(before);
  });

  it('should carry the ball along its speed when nothing is in the way', () => {
    const game = makeGame({ ball: { x: 50, y: CENTRE_Y, dx: 40, dy: 0 } });

    const next = advance(game, CENTRE_Y, 0.5 * LONG_STEP);

    expect(next.ball.x).toBeCloseTo(50 + 40 * 0.5 * LONG_STEP);
  });

  it('should move no further than one long frame when a whole second went by', () => {
    const game = makeGame({ ball: { x: 50, y: CENTRE_Y, dx: 40, dy: 0 } });

    const next = advance(game, CENTRE_Y, 1);

    // A tab left in the background must never teleport the ball past a bat.
    expect(next.ball.x).toBeCloseTo(50 + 40 * LONG_STEP);
  });

  it('should send the ball back down when it reaches the top wall', () => {
    const game = makeGame({ ball: { x: 50, y: BALL_RADIUS + 0.2, dx: 0, dy: -46 } });

    const next = advance(game, CENTRE_Y, LONG_STEP);

    expect(next.ball.dy).toBeGreaterThan(0);
    expect(next.ball.y).toBeGreaterThanOrEqual(BALL_RADIUS);
  });

  it('should send the ball back up when it reaches the bottom wall', () => {
    const game = makeGame({
      ball: { x: 50, y: FIELD_HEIGHT - BALL_RADIUS - 0.2, dx: 0, dy: 46 },
    });

    const next = advance(game, CENTRE_Y, LONG_STEP);

    expect(next.ball.dy).toBeLessThan(0);
    expect(next.ball.y).toBeLessThanOrEqual(FIELD_HEIGHT - BALL_RADIUS);
  });

  it('should return the ball when it meets the bat of the player', () => {
    const game = makeGame({
      ball: { x: PLAYER_FACE + 1, y: CENTRE_Y, dx: -46, dy: 0 },
      playerY: CENTRE_Y,
    });

    const next = advance(game, CENTRE_Y, LONG_STEP);

    expect(next.ball.dx).toBeGreaterThan(0);
    expect(next.rivalScore).toBe(0);
  });

  it('should return the ball when it meets the bat of the rival', () => {
    const game = makeGame({
      ball: { x: RIVAL_FACE - 1, y: CENTRE_Y, dx: 46, dy: 0 },
      rivalY: CENTRE_Y,
    });

    const next = advance(game, CENTRE_Y, LONG_STEP);

    expect(next.ball.dx).toBeLessThan(0);
    expect(next.playerScore).toBe(0);
  });

  it('should send the ball downward when it hits the lower end of a bat', () => {
    const game = makeGame({
      ball: { x: PLAYER_FACE + 1, y: CENTRE_Y + BAT_HEIGHT / 2, dx: -46, dy: 0 },
      playerY: CENTRE_Y,
    });

    const next = advance(game, CENTRE_Y, LONG_STEP);

    expect(next.ball.dy).toBeGreaterThan(0);
  });

  it('should make the ball faster at every return', () => {
    const game = makeGame({
      ball: { x: PLAYER_FACE + 1, y: CENTRE_Y, dx: -46, dy: 0 },
      playerY: CENTRE_Y,
    });

    const next = advance(game, CENTRE_Y, LONG_STEP);

    expect(next.speed).toBeGreaterThan(game.speed);
  });

  it('should give the rival a point when the ball leaves behind a missing bat', () => {
    const game = makeGame({
      ball: { x: 0.5, y: CENTRE_Y, dx: -46, dy: 0 },
      // Far enough from the ball that the bat cannot reach it in one frame.
      playerY: BAT_HEIGHT / 2,
    });

    const next = advance(game, BAT_HEIGHT / 2, LONG_STEP);

    expect(next.rivalScore).toBe(1);
    expect(next.ball.dx).toBeGreaterThan(0);
  });

  it('should give the player a point when the ball leaves behind the rival', () => {
    const game = makeGame({
      ball: { x: FIELD_WIDTH - 0.5, y: FIELD_HEIGHT - BAT_HEIGHT / 2, dx: 46, dy: 0 },
      rivalY: BAT_HEIGHT / 2,
    });

    const next = advance(game, CENTRE_Y, LONG_STEP);

    expect(next.playerScore).toBe(1);
    expect(next.ball.dx).toBeLessThan(0);
  });

  it('should serve from the middle again after a point', () => {
    const game = makeGame({
      ball: { x: 0.5, y: FIELD_HEIGHT - BALL_RADIUS - 1, dx: -46, dy: 0 },
      playerY: BAT_HEIGHT / 2,
      // A rally well under way, so the speed of the next serve is a reset and
      // not simply the speed this game already had.
      speed: MAX_SPEED,
    });

    const next = advance(game, BAT_HEIGHT / 2, LONG_STEP);

    // Exactly the middle, which is also what says the frame ended on the
    // point: the steps left in it would have carried the new ball away.
    expect(next.ball.x).toBe(FIELD_WIDTH / 2);
    expect(next.ball.y).toBe(CENTRE_Y);
    // The rule itself rather than a proxy for it: what a rally gathered is
    // forgotten, and the next point starts at the speed of a serve.
    expect(next.speed).toBe(SERVE_SPEED);
  });

  it('should still catch the ball at its highest speed', () => {
    // Read from the rules rather than copied, so raising the ceiling raises
    // what this test proves instead of quietly leaving it behind.
    const fastest = MAX_SPEED;
    const game = makeGame({
      // One long frame away from the bat, at the speed a long rally reaches.
      ball: { x: PLAYER_FACE + fastest * LONG_STEP, y: CENTRE_Y, dx: -fastest, dy: 0 },
      playerY: CENTRE_Y,
      speed: fastest,
    });

    const next = advance(advance(game, CENTRE_Y, LONG_STEP), CENTRE_Y, LONG_STEP);

    // A ball that crossed its own bat between two frames would score against
    // a player who did everything right.
    expect(next.ball.dx).toBeGreaterThan(0);
    expect(next.rivalScore).toBe(0);
  });

  it('should judge a return the same way whatever speed the ball arrives at', () => {
    // A ball grazing the very end of the bat, one whole frame away from it,
    // at three speeds. The frame is cut into steps short enough that the ball
    // moves less than its own width in each, so it is level with the bat on
    // some step whatever its speed.
    //
    // The last speed is one the game never reaches. It is here on purpose:
    // it is what shows that the ceiling is a choice about how the game plays
    // and not a bound the rules need to stay right.
    const graze = BAT_HEIGHT / 2 + BALL_RADIUS - 0.1;

    for (const speed of [SERVE_SPEED, MAX_SPEED, MAX_SPEED * 4]) {
      const game = makeGame({
        ball: { x: PLAYER_FACE + speed * LONG_STEP, y: CENTRE_Y + graze, dx: -speed, dy: 0 },
        playerY: CENTRE_Y,
        speed,
      });

      // Two frames, as the test above needs them: a ball placed exactly one
      // frame from the face lands a hair in front of it, on the residue of
      // the arithmetic, and is returned on the frame after.
      const next = advance(advance(game, CENTRE_Y, LONG_STEP), CENTRE_Y, LONG_STEP);

      expect(next.ball.dx).toBeGreaterThan(0);
      expect(next.rivalScore).toBe(0);
    }
  });

  it('should move the bat of the player toward the pointer', () => {
    const game = makeGame({ playerY: CENTRE_Y });

    const next = advance(game, CENTRE_Y + 20, LONG_STEP);

    expect(next.playerY).toBeGreaterThan(CENTRE_Y);
  });

  it('should keep the bat whole on the field when the pointer leaves it', () => {
    const game = makeGame({ playerY: FIELD_HEIGHT - BAT_HEIGHT / 2 });

    const next = advance(game, FIELD_HEIGHT * 10, LONG_STEP);

    expect(next.playerY).toBe(FIELD_HEIGHT - BAT_HEIGHT / 2);
  });

  it('should keep the rival slow enough to be beaten', () => {
    const game = makeGame({
      ball: { x: 50, y: FIELD_HEIGHT - BALL_RADIUS, dx: 46, dy: 0 },
      rivalY: BAT_HEIGHT / 2,
    });

    const next = advance(game, CENTRE_Y, LONG_STEP);

    // It follows the ball, but never jumps to it: a ball returned at a sharp
    // angle from the far side is out of its reach, which is what makes the
    // game winnable at all.
    expect(next.rivalY).toBeLessThan(game.ball.y);
  });
});
