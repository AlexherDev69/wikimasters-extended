import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MODAL_HTML,
  cardOf,
  columnOf,
  makeLogger,
  openModal,
  stubFullscreen,
  type FullscreenStub,
} from '../../../../tests/helpers/card-actions-harness';
import { findDetailModal } from '../../card-detection/data/detail-modal';
import { applyCardActions, removeCardActions, type CardActionsDeps } from './card-actions';
import {
  CARD_ACTIONS_SELECTOR,
  COPY_BUTTON_SELECTOR,
  FULLSCREEN_BUTTON_SELECTOR,
} from './card-actions-selectors';

const BOTH = { fullscreen: true, copy: true };
const NONE = { fullscreen: false, copy: false };

function makeDeps(): CardActionsDeps {
  return { logger: makeLogger(), schedule: vi.fn() };
}

function bars(): NodeListOf<Element> {
  return document.body.querySelectorAll(CARD_ACTIONS_SELECTOR);
}

function onlyBar(): Element {
  const [bar] = bars();
  if (bar === undefined || bars().length !== 1) {
    throw new Error('Expected exactly one bar on the page');
  }
  return bar;
}

describe('applyCardActions', () => {
  let fullscreen: FullscreenStub;

  beforeEach(() => {
    fullscreen = stubFullscreen();
  });

  afterEach(() => {
    fullscreen.restore();
  });

  it('should put the bar right after the card, with the buttons asked for in order', () => {
    const modal = openModal();

    applyCardActions(modal, BOTH, makeDeps());

    const bar = onlyBar();
    expect(bar.previousElementSibling).toBe(cardOf(modal));
    expect(bar.children).toHaveLength(2);
    expect(bar.children[0]?.matches(FULLSCREEN_BUTTON_SELECTOR)).toBe(true);
    expect(bar.children[1]?.matches(COPY_BUTTON_SELECTOR)).toBe(true);
  });

  it('should put only the button asked for when the other setting is off', () => {
    const modal = openModal();

    applyCardActions(modal, { fullscreen: false, copy: true }, makeDeps());

    expect(onlyBar().children).toHaveLength(1);
    expect(onlyBar().children[0]?.matches(COPY_BUTTON_SELECTOR)).toBe(true);
  });

  it('should write nothing when the bar already holds the buttons asked for', () => {
    const modal = openModal();
    applyCardActions(modal, BOTH, makeDeps());
    const observer = new MutationObserver(() => undefined);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    applyCardActions(modal, BOTH, makeDeps());

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should rebuild the bar with only the button still asked for', () => {
    const modal = openModal();
    applyCardActions(modal, BOTH, makeDeps());

    applyCardActions(modal, { fullscreen: true, copy: false }, makeDeps());

    expect(onlyBar().children).toHaveLength(1);
    expect(onlyBar().children[0]?.matches(FULLSCREEN_BUTTON_SELECTOR)).toBe(true);
  });

  it('should do nothing when no modal is open', () => {
    document.body.innerHTML = '';

    applyCardActions(null, BOTH, makeDeps());

    expect(bars()).toHaveLength(0);
  });

  it('should take the bar back when no button is asked for', () => {
    const modal = openModal();
    applyCardActions(modal, BOTH, makeDeps());

    applyCardActions(modal, NONE, makeDeps());

    expect(bars()).toHaveLength(0);
  });

  it('should take the bar back when the modal shows no readable card', () => {
    const modal = openModal();
    applyCardActions(modal, BOTH, makeDeps());

    applyCardActions({ ...modal, title: null, cardRoot: null }, BOTH, makeDeps());

    expect(bars()).toHaveLength(0);
  });

  it('should bring back beside the card a bar the site left elsewhere in the modal', () => {
    const modal = openModal();
    applyCardActions(modal, BOTH, makeDeps());
    modal.root.appendChild(onlyBar());

    applyCardActions(modal, BOTH, makeDeps());

    expect(onlyBar().parentElement).toBe(columnOf(modal));
  });

  it('should bring the card out of full screen when its button is taken away', () => {
    const modal = openModal();
    applyCardActions(modal, BOTH, makeDeps());
    fullscreen.set(columnOf(modal));

    applyCardActions(modal, { fullscreen: false, copy: true }, makeDeps());

    expect(fullscreen.exit).toHaveBeenCalledOnce();
  });
});

describe('removeCardActions', () => {
  let fullscreen: FullscreenStub;

  beforeEach(() => {
    fullscreen = stubFullscreen();
  });

  afterEach(() => {
    fullscreen.restore();
  });

  it('should take back every bar and leave the site as it was', () => {
    document.body.innerHTML = MODAL_HTML;
    const siteHtml = document.body.innerHTML;
    applyCardActions(findDetailModal(document.body), BOTH, makeDeps());

    removeCardActions(document.body);

    expect(document.body.innerHTML).toBe(siteHtml);
    expect(fullscreen.exit).not.toHaveBeenCalled();
  });

  it('should bring the card out of full screen before taking its bar back', () => {
    const modal = openModal();
    applyCardActions(modal, BOTH, makeDeps());
    fullscreen.set(columnOf(modal));

    removeCardActions(document.body);

    expect(fullscreen.exit).toHaveBeenCalledOnce();
    expect(bars()).toHaveLength(0);
  });
});
