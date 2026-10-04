import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from '../../../core/logger/logger';
import { scanCards } from '../../card-detection/data/scan-cards';
import { PULL_STATS_SELECTOR } from '../data/pull-stats-panel';
import { addPull, emptyTally, type PullTally } from '../domain/pull-tally';
import type { PullTallyStore } from '../domain/pull-tally-store';
import {
  countPackReveal,
  createPullStatsState,
  syncPullStats,
  type PullStatsDeps,
} from './sync-pull-stats';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

/** A pack being revealed, its first card, a common one. */
const FIXTURE_PULL_REVEAL = readFixture('pull-reveal.html');
/** The page between two packs, where the panel is drawn. */
const FIXTURE_PULL_IDLE = readFixture('pull-idle.html');
/** A page of the site that is neither: a card of a grid, under no counter. */
const FIXTURE_CARD_GRID = readFixture('card-grid-with-description.html');

const TOTAL_SELECTOR = '.wme-pull-stats-total';

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

interface Harness {
  deps: PullStatsDeps;
  written: PullTally[];
  logger: Logger;
}

/**
 * A storage held in memory, shared by every harness it is given to, as the
 * storage of the browser is shared by every tab of the site.
 */
interface FakeStorage {
  tally: PullTally;
}

function makeDeps(
  write: () => Promise<void> = () => Promise.resolve(),
  storage: FakeStorage = { tally: emptyTally() },
): Harness {
  const written: PullTally[] = [];
  const logger = makeLogger();
  const store: PullTallyStore = {
    read: () => Promise.resolve(storage.tally),
    add: async (rarity) => {
      const tally = addPull(storage.tally, rarity);
      written.push(tally);
      await write();
      storage.tally = tally;
      return tally;
    },
  };
  return { deps: { store, logger }, written, logger };
}

/** One pass of the overlay: the page is scanned, then the feature is synced. */
function sync(state: ReturnType<typeof createPullStatsState>, deps: PullStatsDeps): void {
  syncPullStats(document.body, scanCards(document), state, deps);
}

/** What a mutation of the page of the packs asks for: the count, and no drawing. */
function count(state: ReturnType<typeof createPullStatsState>, deps: PullStatsDeps): void {
  countPackReveal(document.body, scanCards(document), state, deps);
}

/** What the site does when the user walks to the next card of the pack. */
function showCard(index: number, rarity = 'c'): void {
  document.body.innerHTML = FIXTURE_PULL_REVEAL.replace(
    '>1</span><span>/ 5</span>',
    `>${String(index)}</span><span>/ 5</span>`,
  ).replace('glow-c', `glow-${rarity}`);
}

describe('syncPullStats', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should count the card a pack reveals once when the page keeps mutating around it', () => {
    const { deps, written } = makeDeps();
    const state = createPullStatsState(emptyTally());
    showCard(1);

    sync(state, deps);
    sync(state, deps);
    sync(state, deps);

    expect(state.tally.c).toBe(1);
    expect(written).toHaveLength(1);
  });

  it('should count each card of the pack when the user walks through them', () => {
    const { deps } = makeDeps();
    const state = createPullStatsState(emptyTally());

    showCard(1, 'c');
    sync(state, deps);
    showCard(2, 'pc');
    sync(state, deps);
    showCard(3, 'sr');
    sync(state, deps);

    expect(state.tally).toEqual({ c: 1, pc: 1, r: 0, sr: 1, ur: 0, l: 0 });
  });

  it('should count a card only once when the user walks back to it', () => {
    const { deps } = makeDeps();
    const state = createPullStatsState(emptyTally());

    showCard(1, 'c');
    sync(state, deps);
    showCard(2, 'pc');
    sync(state, deps);
    showCard(1, 'c');
    sync(state, deps);

    expect(state.tally).toEqual({ c: 1, pc: 1, r: 0, sr: 0, ur: 0, l: 0 });
  });

  it('should count the next pack when the page has shown the packs left in between', () => {
    const { deps } = makeDeps();
    const state = createPullStatsState(emptyTally());

    showCard(1, 'c');
    sync(state, deps);
    document.body.innerHTML = FIXTURE_PULL_IDLE;
    sync(state, deps);
    showCard(1, 'r');
    sync(state, deps);

    expect(state.tally).toEqual({ c: 1, pc: 0, r: 1, sr: 0, ur: 0, l: 0 });
  });

  it('should not count the card again when it disappears for one render between two animations', () => {
    const { deps } = makeDeps();
    const state = createPullStatsState(emptyTally());

    showCard(1, 'l');
    sync(state, deps);
    document.body.innerHTML = '<div class="flex">Ouverture...</div>';
    sync(state, deps);
    showCard(1, 'l');
    sync(state, deps);

    expect(state.tally.l).toBe(1);
  });

  it('should count nothing on a page that shows cards under no counter', () => {
    const { deps, written } = makeDeps();
    const state = createPullStatsState(emptyTally());
    document.body.innerHTML = FIXTURE_CARD_GRID;

    sync(state, deps);

    expect(state.tally).toEqual(emptyTally());
    expect(written).toHaveLength(0);
  });

  it('should draw the panel with what was counted when the page shows the packs left', () => {
    const { deps } = makeDeps();
    const state = createPullStatsState({ c: 4, pc: 1, r: 0, sr: 0, ur: 0, l: 0 });
    document.body.innerHTML = FIXTURE_PULL_IDLE;

    sync(state, deps);

    expect(document.querySelectorAll(PULL_STATS_SELECTOR)).toHaveLength(1);
    expect(document.querySelector(TOTAL_SELECTOR)?.textContent).toBe('5 cartes');
  });

  it('should draw no panel over the card while a pack is being revealed', () => {
    const { deps } = makeDeps();
    const state = createPullStatsState(emptyTally());
    showCard(1);

    sync(state, deps);

    expect(document.querySelectorAll(PULL_STATS_SELECTOR)).toHaveLength(0);
  });

  it('should show the card just counted when the page comes back to the packs left', () => {
    const { deps } = makeDeps();
    const state = createPullStatsState(emptyTally());

    showCard(1, 'ur');
    sync(state, deps);
    document.body.innerHTML = FIXTURE_PULL_IDLE;
    sync(state, deps);

    expect(document.querySelector(TOTAL_SELECTOR)?.textContent).toBe('1 carte');
  });

  it('should keep the cards another tab has counted since this one read the storage', async () => {
    const storage: FakeStorage = { tally: emptyTally() };
    // Two tabs of the site, which both read an empty storage when they loaded.
    const firstTab = makeDeps(undefined, storage);
    const secondTab = makeDeps(undefined, storage);
    const firstState = createPullStatsState(emptyTally());
    const secondState = createPullStatsState(emptyTally());

    showCard(1, 'c');
    sync(firstState, firstTab.deps);
    await vi.waitFor(() => {
      expect(storage.tally.c).toBe(1);
    });
    showCard(1, 'ur');
    sync(secondState, secondTab.deps);

    await vi.waitFor(() => {
      expect(storage.tally).toEqual({ ...emptyTally(), c: 1, ur: 1 });
    });
  });

  it('should show the cards of the other tab once a card of this one is counted', async () => {
    const storage: FakeStorage = { tally: { ...emptyTally(), c: 5 } };
    const { deps } = makeDeps(undefined, storage);
    // Read when the page loaded, before the other tab counted its five cards.
    const state = createPullStatsState(emptyTally());
    showCard(1, 'c');

    sync(state, deps);

    await vi.waitFor(() => {
      expect(state.tally.c).toBe(6);
    });
  });

  it('should keep counting in memory and log it when the storage cannot be written', async () => {
    const { deps, logger } = makeDeps(() => Promise.reject(new Error('storage unavailable')));
    const state = createPullStatsState(emptyTally());
    showCard(1, 'sr');

    sync(state, deps);
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith('Pull tally write failed', {
        error: 'storage unavailable',
      });
    });

    expect(state.tally.sr).toBe(1);
  });
});

describe('countPackReveal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should count the card the pack shows when a mutation brings it', () => {
    const { deps, written } = makeDeps();
    const state = createPullStatsState(emptyTally());
    showCard(2, 'sr');

    count(state, deps);

    expect(state.tally.sr).toBe(1);
    expect(written).toHaveLength(1);
  });

  it('should leave nothing for the scan to count again when the card is still on the page', () => {
    const { deps, written } = makeDeps();
    const state = createPullStatsState(emptyTally());
    showCard(1);

    count(state, deps);
    sync(state, deps);

    expect(state.tally.c).toBe(1);
    expect(written).toHaveLength(1);
  });

  it('should draw no panel when the page shows the packs left', () => {
    const { deps } = makeDeps();
    const state = createPullStatsState(emptyTally());
    document.body.innerHTML = FIXTURE_PULL_IDLE;

    count(state, deps);

    expect(document.body.querySelector(PULL_STATS_SELECTOR)).toBeNull();
  });

  it('should count the next pack when a mutation has shown the packs left in between', () => {
    const { deps } = makeDeps();
    const state = createPullStatsState(emptyTally());

    showCard(1);
    count(state, deps);
    document.body.innerHTML = FIXTURE_PULL_IDLE;
    count(state, deps);
    showCard(1);
    count(state, deps);

    expect(state.tally.c).toBe(2);
  });
});
