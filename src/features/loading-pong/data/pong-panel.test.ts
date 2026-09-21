import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  hasPainted,
  stubCanvasContext,
  type CanvasStub,
} from '../../../../tests/helpers/canvas-context';
import { createGame, FIELD_HEIGHT } from '../domain/pong-game';
import { buildPongView, drawGame, PONG_SELECTOR, readTargetY, removePongPanels } from './pong-panel';

/** A canvas as the browser would lay it out, which happy-dom never does. */
const CANVAS_TOP = 100;
const CANVAS_HEIGHT = 200;

function layOutCanvas(canvas: HTMLCanvasElement): void {
  canvas.getBoundingClientRect = (): DOMRect =>
    ({ top: CANVAS_TOP, height: CANVAS_HEIGHT }) as DOMRect;
}

describe('buildPongView', () => {
  let stub: CanvasStub;

  beforeEach(() => {
    document.body.innerHTML = '';
    stub = stubCanvasContext();
  });

  afterEach(() => {
    stub.restore();
  });

  it('should build a panel holding a canvas, added to nothing yet', () => {
    const view = buildPongView(document);

    expect(view?.panel.querySelector('canvas')).not.toBeNull();
    expect(document.body.querySelector(PONG_SELECTOR)).toBeNull();
  });

  it('should mark the panel so a later sync finds the one already there', () => {
    const view = buildPongView(document);
    document.body.appendChild(view?.panel as HTMLElement);

    expect(document.body.querySelector(PONG_SELECTOR)).not.toBeNull();
  });

  it('should build nothing when the browser gives no 2d context', () => {
    stub.restore();

    expect(buildPongView(document)).toBeNull();
  });
});

describe('drawGame', () => {
  let stub: CanvasStub;

  beforeEach(() => {
    stub = stubCanvasContext();
  });

  afterEach(() => {
    stub.restore();
  });

  it('should clear the canvas before painting the frame', () => {
    const view = buildPongView(document);
    if (view === null) {
      throw new Error('The stubbed canvas gave no context');
    }

    drawGame(view, createGame());

    expect(stub.calls[0]?.name).toBe('clearRect');
  });

  it('should paint the bats, the scores and the ball', () => {
    const view = buildPongView(document);
    if (view === null) {
      throw new Error('The stubbed canvas gave no context');
    }

    drawGame(view, createGame());

    expect(hasPainted(stub, 'fillRect')).toBe(true);
    expect(hasPainted(stub, 'fillText')).toBe(true);
    expect(hasPainted(stub, 'arc')).toBe(true);
  });

  it('should write nothing in the page itself', () => {
    document.body.innerHTML = '';
    const view = buildPongView(document);
    if (view === null) {
      throw new Error('The stubbed canvas gave no context');
    }
    document.body.appendChild(view.panel);
    const observer = new MutationObserver(() => undefined);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    drawGame(view, createGame());

    // The whole feature rests on this: a game painted in a canvas costs the
    // observer of the content script not one mutation.
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});

describe('readTargetY', () => {
  let stub: CanvasStub;

  beforeEach(() => {
    stub = stubCanvasContext();
  });

  afterEach(() => {
    stub.restore();
  });

  it('should read the middle of the field when the pointer is halfway down', () => {
    const view = buildPongView(document);
    if (view === null) {
      throw new Error('The stubbed canvas gave no context');
    }
    layOutCanvas(view.canvas);

    expect(readTargetY(view, CANVAS_TOP + CANVAS_HEIGHT / 2)).toBeCloseTo(FIELD_HEIGHT / 2);
  });

  it('should read the top of the field when the pointer is at the top edge', () => {
    const view = buildPongView(document);
    if (view === null) {
      throw new Error('The stubbed canvas gave no context');
    }
    layOutCanvas(view.canvas);

    expect(readTargetY(view, CANVAS_TOP)).toBeCloseTo(0);
  });

  it('should aim at the middle when the canvas has no height to read', () => {
    const view = buildPongView(document);
    if (view === null) {
      throw new Error('The stubbed canvas gave no context');
    }

    // A panel not laid out yet, which is what a page in the middle of a
    // navigation gives back.
    expect(readTargetY(view, 0)).toBe(FIELD_HEIGHT / 2);
  });
});

describe('removePongPanels', () => {
  let stub: CanvasStub;

  beforeEach(() => {
    document.body.innerHTML = '';
    stub = stubCanvasContext();
  });

  afterEach(() => {
    stub.restore();
  });

  it('should take back the panel it was given', () => {
    const view = buildPongView(document);
    document.body.appendChild(view?.panel as HTMLElement);

    removePongPanels(document.body);

    expect(document.body.querySelector(PONG_SELECTOR)).toBeNull();
  });

  it('should leave the nodes of the site alone', () => {
    document.body.innerHTML = '<div class="site-node"></div>';

    removePongPanels(document.body);

    expect(document.body.querySelector('.site-node')).not.toBeNull();
  });
});
