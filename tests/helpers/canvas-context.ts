import { vi } from 'vitest';

/**
 * A 2d canvas context for happy-dom, which has none: `getContext` there
 * always answers null, so nothing that paints could be tested at all.
 *
 * The stub records what was painted rather than painting it, which is exactly
 * what a test of a canvas can check: that the right shapes were asked for, in
 * the right order, at the right place.
 */

/** One call of the context, as the stub kept it. */
export interface PaintedCall {
  name: string;
  args: readonly number[];
}

export interface CanvasStub {
  /** Every call of every context the stub handed out, in order. */
  calls: PaintedCall[];
  /** Puts the real `getContext` back. */
  restore: () => void;
}

/** The methods a game needs, recorded; the rest are accepted and ignored. */
const RECORDED_METHODS = [
  'clearRect',
  'fillRect',
  'fillText',
  'beginPath',
  'arc',
  'fill',
] as const;

const NUMBER_ARGUMENTS = (args: unknown[]): number[] =>
  args.filter((value): value is number => typeof value === 'number');

function makeContext(calls: PaintedCall[]): CanvasRenderingContext2D {
  const context: Record<string, unknown> = {
    canvas: null,
    fillStyle: '',
    font: '',
    textAlign: 'start',
  };

  for (const name of RECORDED_METHODS) {
    context[name] = (...args: unknown[]): void => {
      calls.push({ name, args: NUMBER_ARGUMENTS(args) });
    };
  }
  return context as unknown as CanvasRenderingContext2D;
}

/**
 * Makes every canvas of the document answer with a recording context, until
 * `restore` is called. Meant for a `beforeEach`, with its `restore` in the
 * matching `afterEach`.
 */
export function stubCanvasContext(): CanvasStub {
  const calls: PaintedCall[] = [];
  const spy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(() => makeContext(calls));

  return {
    calls,
    restore: (): void => {
      spy.mockRestore();
    },
  };
}

/** True when a call of that name was recorded. */
export function hasPainted(stub: CanvasStub, name: string): boolean {
  return stub.calls.some((call) => call.name === name);
}
