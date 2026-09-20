import { isRarity, RARITIES, type Rarity } from '../../card-detection/domain/rarity';
import type { CatalogueTotals } from '../domain/catalogue-totals';

/**
 * Everything this reader knows of the DOM of the catalogue page: one selector
 * and two patterns, gathered here as every other selector of the site is.
 *
 * `card-frame` is one of the few semantic class names the site ships; every
 * other class of that block is a Tailwind utility that may change with any
 * deployment. So the block is found by that class, and its entries by their
 * TEXT rather than by their markup.
 *
 * Reading is all this does: not a single node of the site is added, moved or
 * touched, and nothing is clicked to make the numbers appear.
 */
const CATALOGUE_FRAME_SELECTOR = 'div.card-frame';

/** Every descendant of the block: its entries carry no class of their own. */
const FRAME_DESCENDANT_SELECTOR = '*';

/**
 * One entry, as its element reads once whitespace is normalized: the rarity
 * code the site prints, a colon, and the count. An ancestor holding several
 * entries does not match, and a label span carries no digit.
 */
const ENTRY_PATTERN = /^(L|UR|SR|R|PC|C)\s*:\s*(\d[\d\s]*)$/;

/** The grand total of the same block, which every entry is checked against. */
const GRAND_TOTAL_PATTERN = /^(\d[\d\s]*?)\s*cartes?\s+au total$/;

interface RarityEntry {
  rarity: Rarity;
  count: number;
}

/**
 * Collapses every run of whitespace into a single space. The site separates
 * the thousands of its numbers with narrow no-break spaces, which `\s` covers
 * along with the ordinary and the no-break ones.
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** A number of the block, once its thousand separators are taken out. */
function parseCount(digits: string): number | null {
  const value = Number(digits.replace(/\s/g, ''));
  return Number.isSafeInteger(value) ? value : null;
}

function parseEntry(text: string): RarityEntry | null {
  const [, label, digits] = ENTRY_PATTERN.exec(text) ?? [];
  if (label === undefined || digits === undefined) {
    return null;
  }
  // The labels are the rarity codes of the site in upper case, so the existing
  // guard is what decides whether one of them is a rarity we know.
  const rarity = label.toLowerCase();
  const count = parseCount(digits);

  return isRarity(rarity) && count !== null ? { rarity, count } : null;
}

function parseGrandTotal(text: string): number | null {
  const [, digits] = GRAND_TOTAL_PATTERN.exec(text) ?? [];
  return digits === undefined ? null : parseCount(digits);
}

function normalizedTexts(frame: ParentNode): string[] {
  return Array.from(frame.querySelectorAll(FRAME_DESCENDANT_SELECTOR), (element) =>
    normalizeWhitespace(element.textContent ?? ''),
  );
}

/** The counts of one block, each rarity exactly once, or null. */
function readEntries(texts: readonly string[]): Map<Rarity, number> | null {
  const counts = new Map<Rarity, number>();

  for (const text of texts) {
    const entry = parseEntry(text);
    if (entry === null) {
      continue;
    }
    // Twice is as bad as missing: the block is then not the one described here.
    if (counts.has(entry.rarity)) {
      return null;
    }
    counts.set(entry.rarity, entry.count);
  }
  return counts.size === RARITIES.length ? counts : null;
}

/**
 * The number the block prints in front of "cartes au total". The element
 * holding it and its parent read the same, so the same value twice is no
 * ambiguity; two different ones are, and the block is then refused.
 */
function readGrandTotal(texts: readonly string[]): number | null {
  let total: number | null = null;

  for (const text of texts) {
    const found = parseGrandTotal(text);
    if (found === null) {
      continue;
    }
    if (total !== null && total !== found) {
      return null;
    }
    total = found;
  }
  return total;
}

function sumOf(counts: ReadonlyMap<Rarity, number>): number {
  let sum = 0;
  for (const count of counts.values()) {
    sum += count;
  }
  return sum;
}

/** The map as the record the rest of the feature speaks in. */
function toTotals(counts: ReadonlyMap<Rarity, number>): CatalogueTotals {
  // Every rarity is in the map: a block missing one never gets here.
  return {
    c: counts.get('c') ?? 0,
    pc: counts.get('pc') ?? 0,
    r: counts.get('r') ?? 0,
    sr: counts.get('sr') ?? 0,
    ur: counts.get('ur') ?? 0,
    l: counts.get('l') ?? 0,
  };
}

function readFrame(frame: ParentNode): CatalogueTotals | null {
  const texts = normalizedTexts(frame);
  const counts = readEntries(texts);
  if (counts === null) {
    return null;
  }
  const grandTotal = readGrandTotal(texts);

  // A denominator that does not add up is worse than no denominator at all:
  // the extension shows no completion rather than a wrong one.
  if (grandTotal === null || sumOf(counts) !== grandTotal) {
    return null;
  }
  return toTotals(counts);
}

/**
 * How many cards the game holds per rarity, read from the header block of the
 * catalogue page. Null for anything this reader is not certain of: a missing
 * or repeated rarity, a sum that does not match the displayed total, a block
 * of another page, and a catalogue whose search is active, which replaces the
 * whole block with a notice.
 */
export function readCatalogueTotals(root: ParentNode): CatalogueTotals | null {
  for (const frame of Array.from(root.querySelectorAll(CATALOGUE_FRAME_SELECTOR))) {
    const totals = readFrame(frame);
    if (totals !== null) {
      return totals;
    }
  }
  return null;
}
