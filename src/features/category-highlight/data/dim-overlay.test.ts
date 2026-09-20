import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from '../../card-detection/data/scan-cards';
import { applyDimOverlay, removeDimOverlays } from './dim-overlay';
import { DIM_SELECTOR } from './highlight-selectors';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const GRID_HTML = readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8');
const LARGE_HTML = readFileSync(join(FIXTURES_DIR, 'card-large-no-description.html'), 'utf-8');

function showFixture(html: string): HTMLElement {
  document.body.innerHTML = html;
  const [observed] = scanCards(document.body);
  if (observed === undefined) {
    throw new Error('The fixture holds no card');
  }
  return observed.element;
}

function overlays(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>(DIM_SELECTOR)];
}

function observeBody(): MutationObserver {
  const observer = new MutationObserver(() => undefined);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  });
  return observer;
}

describe('applyDimOverlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should cover the card with one veil when it is dimmed', () => {
    const cardRoot = showFixture(GRID_HTML);

    applyDimOverlay(cardRoot, true);

    expect(overlays()).toHaveLength(1);
    expect(cardRoot.lastElementChild).toBe(overlays()[0]);
  });

  it('should build the veil from a div only, so the scanner ignores it', () => {
    const cardRoot = showFixture(LARGE_HTML);

    applyDimOverlay(cardRoot, true);

    expect(overlays()[0]?.tagName).toBe('DIV');
    expect(overlays()[0]?.children).toHaveLength(0);
  });

  it('should leave the scanned card unchanged', () => {
    const cardRoot = showFixture(GRID_HTML);
    const before = scanCards(document.body).map((observed) => observed.card);

    applyDimOverlay(cardRoot, true);

    expect(scanCards(document.body).map((observed) => observed.card)).toEqual(before);
  });

  it('should write nothing on a second call for a card already dimmed', () => {
    const cardRoot = showFixture(GRID_HTML);
    applyDimOverlay(cardRoot, true);
    const observer = observeBody();

    applyDimOverlay(cardRoot, true);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing for a card that is not dimmed and carries no veil', () => {
    const cardRoot = showFixture(GRID_HTML);
    const observer = observeBody();

    applyDimOverlay(cardRoot, false);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should take back the veil when the card is not dimmed any more', () => {
    const cardRoot = showFixture(GRID_HTML);
    applyDimOverlay(cardRoot, true);

    applyDimOverlay(cardRoot, false);

    expect(overlays()).toHaveLength(0);
  });

  it('should leave every node of the site untouched', () => {
    const cardRoot = showFixture(LARGE_HTML);
    const siteHtml = document.body.innerHTML;

    applyDimOverlay(cardRoot, true);
    applyDimOverlay(cardRoot, false);

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});

describe('removeDimOverlays', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should take back every veil and leave the site as it was', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const siteHtml = document.body.innerHTML;
    for (const observed of scanCards(document.body)) {
      applyDimOverlay(observed.element, true);
    }

    removeDimOverlays(document.body);

    expect(overlays()).toHaveLength(0);
    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should do nothing when no card is dimmed', () => {
    showFixture(GRID_HTML);
    const observer = observeBody();

    removeDimOverlays(document.body);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
