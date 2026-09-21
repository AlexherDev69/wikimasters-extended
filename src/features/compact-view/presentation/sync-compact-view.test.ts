import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from '../../../core/logger/logger';
import { COMPACT_STYLE_SELECTOR, TOGGLE_SELECTOR } from '../data/compact-selectors';
import type { CompactPreferenceStore } from '../domain/compact-preference-store';
import { createCompactViewState, syncCompactView, type CompactViewDeps } from './sync-compact-view';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

const FIXTURE_COLLECTION_FILTERS = readFixture('collection-filters.html');
const FIXTURE_CARD_GRID = readFixture('card-grid-with-description.html');

const COLLECTION_PATH = '/collection';
const CATALOGUE_PATH = '/global-collection';
const MARKETPLACE_PATH = '/marketplace';

const PRESSED_ATTRIBUTE = 'aria-pressed';

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

interface Harness {
  deps: CompactViewDeps;
  written: boolean[];
  logger: Logger;
  /** The path the page is on, which a test moves as the site navigates. */
  path: { value: string };
  /** The scans a press asked for, run by the test as the overlay would. */
  syncs: number;
}

function makeDeps(write: () => Promise<void> = () => Promise.resolve()): Harness {
  const written: boolean[] = [];
  const logger = makeLogger();
  const path = { value: COLLECTION_PATH };
  const harness: Harness = {
    deps: {
      store: {
        read: () => Promise.resolve(false),
        write: (isCompact: boolean): Promise<void> => {
          written.push(isCompact);
          return write();
        },
      } satisfies CompactPreferenceStore,
      logger,
      readPath: () => path.value,
      requestSync: () => {
        harness.syncs += 1;
      },
    },
    written,
    logger,
    path,
    syncs: 0,
  };
  return harness;
}

function toggle(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(TOGGLE_SELECTOR);
}

function styleElement(): Element | null {
  return document.head.querySelector(COMPACT_STYLE_SELECTOR);
}

function showFilterRow(): void {
  document.body.innerHTML = FIXTURE_COLLECTION_FILTERS + FIXTURE_CARD_GRID;
}

describe('syncCompactView', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('should add the button on the collection when the page shows its filters', () => {
    const { deps } = makeDeps();
    showFilterRow();

    syncCompactView(document.body, createCompactViewState(false), deps);

    expect(toggle()).not.toBeNull();
    expect(toggle()?.getAttribute(PRESSED_ATTRIBUTE)).toBe('false');
  });

  it('should add the button on the catalogue of every card as well', () => {
    const harness = makeDeps();
    harness.path.value = CATALOGUE_PATH;
    showFilterRow();

    syncCompactView(document.body, createCompactViewState(false), harness.deps);

    expect(toggle()).not.toBeNull();
  });

  it('should add no button on a page the view is not offered on', () => {
    const harness = makeDeps();
    harness.path.value = MARKETPLACE_PATH;
    showFilterRow();

    syncCompactView(document.body, createCompactViewState(false), harness.deps);

    expect(toggle()).toBeNull();
    expect(styleElement()).toBeNull();
  });

  it('should draw the cards small when the view was already on when the page loaded', () => {
    const { deps } = makeDeps();
    showFilterRow();

    syncCompactView(document.body, createCompactViewState(true), deps);

    expect(styleElement()).not.toBeNull();
    expect(toggle()?.getAttribute(PRESSED_ATTRIBUTE)).toBe('true');
  });

  it('should draw the cards small without waiting for the filters of the site', () => {
    // The grid is on the page before its filters are: a view already asked
    // for must not wait for a row of buttons to take effect.
    const { deps } = makeDeps();
    document.body.innerHTML = FIXTURE_CARD_GRID;

    syncCompactView(document.body, createCompactViewState(true), deps);

    expect(styleElement()).not.toBeNull();
    expect(toggle()).toBeNull();
  });

  it('should switch the view on, remember it and ask for a scan when the button is pressed', () => {
    const harness = makeDeps();
    const state = createCompactViewState(false);
    showFilterRow();
    syncCompactView(document.body, state, harness.deps);

    toggle()?.click();

    expect(state.isCompact).toBe(true);
    expect(harness.written).toEqual([true]);
    expect(harness.syncs).toBe(1);
  });

  it('should draw the cards small on the scan the press asked for', () => {
    const harness = makeDeps();
    const state = createCompactViewState(false);
    showFilterRow();
    syncCompactView(document.body, state, harness.deps);

    toggle()?.click();
    syncCompactView(document.body, state, harness.deps);

    expect(styleElement()).not.toBeNull();
    expect(toggle()?.getAttribute(PRESSED_ATTRIBUTE)).toBe('true');
  });

  it('should bring the cards back to their size when the button is pressed again', () => {
    const harness = makeDeps();
    const state = createCompactViewState(true);
    showFilterRow();
    syncCompactView(document.body, state, harness.deps);
    expect(styleElement()).not.toBeNull();

    toggle()?.click();
    syncCompactView(document.body, state, harness.deps);

    expect(styleElement()).toBeNull();
    expect(harness.written).toEqual([false]);
  });

  it('should take back what it added when the site navigates to another page', () => {
    const harness = makeDeps();
    const state = createCompactViewState(true);
    showFilterRow();
    syncCompactView(document.body, state, harness.deps);
    expect(toggle()).not.toBeNull();

    harness.path.value = MARKETPLACE_PATH;
    syncCompactView(document.body, state, harness.deps);

    expect(toggle()).toBeNull();
    expect(styleElement()).toBeNull();
  });

  it('should draw the cards small again when the site navigates back', () => {
    const harness = makeDeps();
    const state = createCompactViewState(true);
    showFilterRow();
    syncCompactView(document.body, state, harness.deps);
    harness.path.value = MARKETPLACE_PATH;
    syncCompactView(document.body, state, harness.deps);

    harness.path.value = COLLECTION_PATH;
    syncCompactView(document.body, state, harness.deps);

    expect(styleElement()).not.toBeNull();
    expect(toggle()).not.toBeNull();
  });

  it('should write nothing on a second sync while the page already shows the view', () => {
    const { deps } = makeDeps();
    const state = createCompactViewState(true);
    showFilterRow();
    syncCompactView(document.body, state, deps);
    const observer = new MutationObserver(() => undefined);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    syncCompactView(document.body, state, deps);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing at all on a page the view is not offered on', () => {
    const harness = makeDeps();
    harness.path.value = MARKETPLACE_PATH;
    document.body.innerHTML = FIXTURE_CARD_GRID;
    const observer = new MutationObserver(() => undefined);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    syncCompactView(document.body, createCompactViewState(true), harness.deps);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should keep the view of the page and log it when the storage cannot be written', async () => {
    const harness = makeDeps(() => Promise.reject(new Error('storage unavailable')));
    const state = createCompactViewState(false);
    showFilterRow();
    syncCompactView(document.body, state, harness.deps);

    toggle()?.click();
    await vi.waitFor(() => {
      expect(harness.logger.warn).toHaveBeenCalledWith('Compact view write failed', {
        error: 'storage unavailable',
      });
    });

    expect(state.isCompact).toBe(true);
  });
});
