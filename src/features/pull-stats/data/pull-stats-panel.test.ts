import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyTally, type PullTally } from '../domain/pull-tally';
import {
  applyPullStatsPanel,
  findPullStatsTarget,
  PULL_STATS_SELECTOR,
  removePullStatsPanels,
} from './pull-stats-panel';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

/** The page between two packs, which is the only one the panel is drawn on. */
const FIXTURE_PULL_IDLE = readFixture('pull-idle.html');
/** A pack being revealed: no block of the packs left on screen. */
const FIXTURE_PULL_REVEAL = readFixture('pull-reveal.html');

const TALLY: PullTally = { c: 6, pc: 2, r: 1, sr: 1, ur: 0, l: 0 };

const ROW_SELECTOR = '.wme-pull-row';
const PERCENT_SELECTOR = '.wme-pull-percent';
const BAR_SELECTOR = '.wme-pull-bar';
const NOTE_SELECTOR = '.wme-pull-stats-note';

function panel(): HTMLElement | null {
  return document.querySelector<HTMLElement>(PULL_STATS_SELECTOR);
}

/** Draws the panel on the page currently loaded, and says it found its place. */
function draw(tally: PullTally): boolean {
  const target = findPullStatsTarget(document);
  if (target === null) {
    return false;
  }
  applyPullStatsPanel(target, tally);
  return true;
}

describe('findPullStatsTarget', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should find the block that counts the packs left when the page is between two packs', () => {
    document.body.innerHTML = FIXTURE_PULL_IDLE;

    expect(findPullStatsTarget(document)?.anchor.className).toContain('card-frame');
  });

  it('should return null when a pack is being revealed', () => {
    document.body.innerHTML = FIXTURE_PULL_REVEAL;

    expect(findPullStatsTarget(document)).toBeNull();
  });

  it('should return null when the page is not the one of the packs', () => {
    document.body.innerHTML = '<div class="card-frame">Ma collection</div>';

    expect(findPullStatsTarget(document)).toBeNull();
  });
});

describe('applyPullStatsPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = FIXTURE_PULL_IDLE;
  });

  it('should insert the panel right after the block that counts the packs left', () => {
    expect(draw(TALLY)).toBe(true);

    const anchor = document.querySelector('.card-frame');
    expect(panel()?.previousElementSibling).toBe(anchor);
  });

  it('should show one row per rarity with its share when cards were counted', () => {
    draw(TALLY);
    const rows = document.querySelectorAll(ROW_SELECTOR);

    expect(rows).toHaveLength(6);
    const percents = [...document.querySelectorAll(PERCENT_SELECTOR)].map(
      (node) => node.textContent,
    );
    expect(percents).toEqual(['0 %', '0 %', '10,0 %', '10,0 %', '20,0 %', '60,0 %']);
  });

  it('should carry the rarity of each row, so the style sheet colours it', () => {
    draw(TALLY);
    const rarities = [...document.querySelectorAll(ROW_SELECTOR)].map((row) =>
      row.getAttribute('data-wme-pull-rarity'),
    );

    expect(rarities).toEqual(['l', 'ur', 'sr', 'r', 'pc', 'c']);
  });

  it('should draw no bar at all for a rarity that never came out', () => {
    draw({ c: 3, pc: 0, r: 0, sr: 0, ur: 0, l: 0 });

    expect(document.querySelectorAll(BAR_SELECTOR)).toHaveLength(1);
  });

  it('should write the width of a bar as the share it stands for', () => {
    draw(TALLY);
    const bar = document.querySelector<HTMLElement>(BAR_SELECTOR);

    // The rarest first: the 10 % of the super rare cards.
    expect(bar?.style.width).toBe('10%');
  });

  it('should say what the panel is waiting for rather than six empty rows when nothing was counted', () => {
    draw(emptyTally());

    expect(document.querySelectorAll(ROW_SELECTOR)).toHaveLength(0);
    expect(document.querySelector(NOTE_SELECTOR)?.textContent).toContain('Aucune carte comptée');
  });

  it('should write nothing at all when the panel already shows these counts', () => {
    draw(TALLY);
    const drawn = panel();
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    draw(TALLY);
    observer.disconnect();

    expect(mutations).toHaveLength(0);
    // The very same node, never a fresh one that happens to look the same.
    expect(panel()).toBe(drawn);
  });

  it('should draw the panel again when a card has been counted since', () => {
    draw(TALLY);
    draw({ ...TALLY, l: 1 });

    expect(document.querySelectorAll(PULL_STATS_SELECTOR)).toHaveLength(1);
    expect(
      [...document.querySelectorAll(ROW_SELECTOR)][0]?.querySelector(PERCENT_SELECTOR)?.textContent,
    ).toBe('9,1 %');
  });

  it('should put the panel back in its place when the site has left it elsewhere', () => {
    draw(TALLY);
    const drawn = panel();
    if (drawn !== null) {
      document.body.append(drawn);
    }

    draw(TALLY);

    expect(document.querySelectorAll(PULL_STATS_SELECTOR)).toHaveLength(1);
    expect(panel()?.previousElementSibling).toBe(document.querySelector('.card-frame'));
  });
});

describe('removePullStatsPanels', () => {
  it('should take back the panel and leave the block of the site alone', () => {
    document.body.innerHTML = FIXTURE_PULL_IDLE;
    draw(TALLY);

    removePullStatsPanels(document);

    expect(document.querySelectorAll(PULL_STATS_SELECTOR)).toHaveLength(0);
    expect(document.querySelector('.card-frame')?.textContent).toContain('paquets disponibles');
  });
});
