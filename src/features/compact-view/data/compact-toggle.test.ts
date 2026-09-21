import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOGGLE_SELECTOR } from './compact-selectors';
import {
  applyCompactToggle,
  findCompactToggleTarget,
  removeCompactToggles,
} from './compact-toggle';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

/** The rarity filter row of the collection: six buttons and nothing else. */
const FIXTURE_COLLECTION_FILTERS = readFixture('collection-filters.html');
/** The same row on the catalogue, where a "Liste de souhaits" button leads. */
const FIXTURE_GLOBAL_FILTERS = readFixture('global-collection-filters.html');
/** Two offers of the exchange page: rarity chips, which are not buttons. */
const FIXTURE_TRADES = readFixture('trades-list.html');

const PRESSED_ATTRIBUTE = 'aria-pressed';

function toggle(): HTMLElement | null {
  return document.querySelector<HTMLElement>(TOGGLE_SELECTOR);
}

/** Draws the toggle on the page currently loaded, and says it found its row. */
function draw(isCompact: boolean, onToggle: () => void = (): void => undefined): boolean {
  const target = findCompactToggleTarget(document);
  if (target === null) {
    return false;
  }
  applyCompactToggle(target, isCompact, onToggle);
  return true;
}

describe('findCompactToggleTarget', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should find the rarity filter row of the collection', () => {
    document.body.innerHTML = FIXTURE_COLLECTION_FILTERS;

    expect(findCompactToggleTarget(document)?.row.querySelectorAll('button')).toHaveLength(6);
  });

  it('should find the rarity filter row of the catalogue, whatever else it holds', () => {
    document.body.innerHTML = FIXTURE_GLOBAL_FILTERS;

    const row = findCompactToggleTarget(document)?.row;
    expect(row?.textContent).toContain('Liste de souhaits');
    expect(row?.textContent).toContain('UR');
  });

  it('should return null when the page shows no rarity filter at all', () => {
    document.body.innerHTML = '<div><button>Sélectionner</button></div>';

    expect(findCompactToggleTarget(document)).toBeNull();
  });

  it('should ignore the rarity chips of a trade offer, which are not buttons', () => {
    document.body.innerHTML = FIXTURE_TRADES;

    expect(findCompactToggleTarget(document)).toBeNull();
  });
});

describe('applyCompactToggle', () => {
  beforeEach(() => {
    document.body.innerHTML = FIXTURE_COLLECTION_FILTERS;
  });

  it('should add the button at the end of the row of the site', () => {
    expect(draw(false)).toBe(true);

    const row = document.querySelector('div');
    expect(toggle()?.parentElement).toBe(row);
    expect(row?.lastElementChild).toBe(toggle());
  });

  it('should say the view is off when it is off', () => {
    draw(false);

    expect(toggle()?.getAttribute(PRESSED_ATTRIBUTE)).toBe('false');
  });

  it('should say the view is on when it is on', () => {
    draw(true);

    expect(toggle()?.getAttribute(PRESSED_ATTRIBUTE)).toBe('true');
  });

  it('should call back once when the button is pressed', () => {
    const onToggle = vi.fn();
    draw(false, onToggle);

    toggle()?.click();

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should write nothing at all when the button is already there in that state', () => {
    draw(true);
    const drawn = toggle();
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    draw(true);
    observer.disconnect();

    expect(mutations).toHaveLength(0);
    expect(toggle()).toBe(drawn);
  });

  it('should keep the very same button when the view is flipped, writing no node', () => {
    draw(false);
    const drawn = toggle();
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    draw(true);
    observer.disconnect();

    // The state is carried by an attribute, which that observer does not
    // watch: the press costs the page nothing it could see.
    expect(mutations).toHaveLength(0);
    expect(toggle()).toBe(drawn);
    expect(toggle()?.getAttribute(PRESSED_ATTRIBUTE)).toBe('true');
  });

  it('should put the button back in the row when the site has left it elsewhere', () => {
    draw(true);
    const drawn = toggle();
    if (drawn !== null) {
      document.body.append(drawn);
    }

    draw(true);

    expect(document.querySelectorAll(TOGGLE_SELECTOR)).toHaveLength(1);
    expect(toggle()?.parentElement).toBe(document.querySelector('div'));
  });

  it('should keep working after the site has rebuilt its row around the button', () => {
    const onToggle = vi.fn();
    draw(false, onToggle);
    document.body.innerHTML = FIXTURE_COLLECTION_FILTERS;
    draw(false, onToggle);

    toggle()?.click();

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('removeCompactToggles', () => {
  it('should take back the button and leave the row of the site alone', () => {
    document.body.innerHTML = FIXTURE_COLLECTION_FILTERS;
    draw(true);

    removeCompactToggles(document);

    expect(document.querySelectorAll(TOGGLE_SELECTOR)).toHaveLength(0);
    expect(document.querySelectorAll('button')).toHaveLength(6);
  });
});
