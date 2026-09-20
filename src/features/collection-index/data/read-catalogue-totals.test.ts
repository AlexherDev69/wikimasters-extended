import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogueTotals } from '../domain/catalogue-totals';
import { readCatalogueTotals } from './read-catalogue-totals';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const CATALOGUE_HTML = readFileSync(join(FIXTURES_DIR, 'global-collection-page.html'), 'utf-8');
const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

/** What the header block of the provided fixture displays. */
const FIXTURE_TOTALS: CatalogueTotals = {
  l: 1761,
  ur: 12_368,
  sr: 66_788,
  r: 179_657,
  pc: 516_762,
  c: 1_996_125,
};

/** The separators the site really uses in its numbers. */
const NARROW_NO_BREAK_SPACE = ' ';
const NO_BREAK_SPACE = ' ';

const ENTRIES: readonly (readonly [string, number])[] = [
  ['L', 1761],
  ['UR', 12_368],
  ['SR', 66_788],
  ['R', 179_657],
  ['PC', 516_762],
  ['C', 1_996_125],
];

const GRAND_TOTAL = 2_773_461;

/** The markup of one entry, three spans as the site renders it. */
function entryHtml(label: string, count: string): string {
  return `<div class="flex items-center gap-1.5 text-sm"><span class="w-3 h-3"></span><span class="opacity-60">${label}:</span><span class="font-bold">${count}</span></div>`;
}

interface FrameOptions {
  entries?: readonly (readonly [string, string])[];
  grandTotal?: string | null;
}

/**
 * A header block of the same shape as the real one, so a variant differs from
 * the fixture by the one thing it is about.
 */
function frameHtml(options: FrameOptions = {}): string {
  const entries = options.entries ?? ENTRIES.map(([label, count]) => [label, String(count)] as const);
  const grandTotal = options.grandTotal === undefined ? String(GRAND_TOTAL) : options.grandTotal;
  const total =
    grandTotal === null ? '' : `<div class="text-xs"><span>${grandTotal} cartes au total</span></div>`;

  return `<div class="card-frame p-4"><div class="flex flex-wrap gap-3">${entries
    .map(([label, count]) => entryHtml(label, count))
    .join('')}</div>${total}</div>`;
}

function readBody(): CatalogueTotals | null {
  return readCatalogueTotals(document.body);
}

describe('readCatalogueTotals', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should read the six totals when the catalogue page is displayed', () => {
    document.body.innerHTML = CATALOGUE_HTML;

    expect(readBody()).toEqual(FIXTURE_TOTALS);
  });

  it('should read the totals when the numbers use narrow no-break spaces', () => {
    document.body.innerHTML = frameHtml({
      entries: [
        ['L', `1${NARROW_NO_BREAK_SPACE}761`],
        ['UR', `12${NARROW_NO_BREAK_SPACE}368`],
        ['SR', `66${NARROW_NO_BREAK_SPACE}788`],
        ['R', `179${NARROW_NO_BREAK_SPACE}657`],
        ['PC', `516${NARROW_NO_BREAK_SPACE}762`],
        ['C', `1${NARROW_NO_BREAK_SPACE}996${NARROW_NO_BREAK_SPACE}125`],
      ],
      grandTotal: `2${NARROW_NO_BREAK_SPACE}773${NARROW_NO_BREAK_SPACE}461`,
    });

    expect(readBody()).toEqual(FIXTURE_TOTALS);
  });

  it('should read the totals when the numbers use no-break or plain spaces', () => {
    document.body.innerHTML = frameHtml({
      entries: [
        ['L', `1${NO_BREAK_SPACE}761`],
        ['UR', '12 368'],
        ['SR', `66${NO_BREAK_SPACE}788`],
        ['R', '179 657'],
        ['PC', `516${NO_BREAK_SPACE}762`],
        ['C', '1 996 125'],
      ],
      grandTotal: `2${NO_BREAK_SPACE}773 461`,
    });

    expect(readBody()).toEqual(FIXTURE_TOTALS);
  });

  it('should read nothing when one rarity is missing from the block', () => {
    document.body.innerHTML = frameHtml({
      entries: ENTRIES.filter(([label]) => label !== 'UR').map(
        ([label, count]) => [label, String(count)] as const,
      ),
    });

    expect(readBody()).toBeNull();
  });

  it('should read nothing when a rarity appears twice in the block', () => {
    document.body.innerHTML = frameHtml({
      entries: [
        ...ENTRIES.map(([label, count]) => [label, String(count)] as const),
        ['L', '1761'] as const,
      ],
    });

    expect(readBody()).toBeNull();
  });

  it('should read nothing when the six counts do not add up to the displayed total', () => {
    document.body.innerHTML = frameHtml({ grandTotal: String(GRAND_TOTAL + 1) });

    expect(readBody()).toBeNull();
  });

  it('should read nothing when the block announces no grand total', () => {
    document.body.innerHTML = frameHtml({ grandTotal: null });

    expect(readBody()).toBeNull();
  });

  it('should read nothing when a search replaced the block with its notice', () => {
    // The site drops the six entries and the total while a search is running.
    document.body.innerHTML =
      '<div class="card-frame p-4"><span>Recherche active : pas de décompte par rareté ni de total exact</span></div>';

    expect(readBody()).toBeNull();
  });

  it('should read nothing from a card frame of another page', () => {
    document.body.innerHTML = MODAL_HTML;

    expect(readBody()).toBeNull();
  });

  it('should read nothing when the page holds no card frame at all', () => {
    document.body.innerHTML = '<div class="p-4"><span>L:1761</span></div>';

    expect(readBody()).toBeNull();
  });

  it('should read nothing when a label carries no count', () => {
    document.body.innerHTML =
      '<div class="card-frame"><span>L:</span><span>UR:</span><span>SR:</span><span>R:</span><span>PC:</span><span>C:</span></div>';

    expect(readBody()).toBeNull();
  });

  it('should read the totals of the catalogue block when another card frame is open', () => {
    document.body.innerHTML = MODAL_HTML + CATALOGUE_HTML;

    expect(readBody()).toEqual(FIXTURE_TOTALS);
  });

  it('should read nothing and write nothing to the page', () => {
    document.body.innerHTML = CATALOGUE_HTML;
    const siteHtml = document.body.innerHTML;
    const observer = new MutationObserver(() => undefined);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    readBody();

    expect(observer.takeRecords()).toHaveLength(0);
    expect(document.body.innerHTML).toBe(siteHtml);
    observer.disconnect();
  });
});
