import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from '../../card-detection/data/scan-cards';
import { findPackReveal } from './pack-reveal';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

/** The reveal of a pack, counter included, as the site renders it. */
const FIXTURE_PULL_REVEAL = readFixture('pull-reveal.html');
/** The page between two packs: no card, no counter. */
const FIXTURE_PULL_IDLE = readFixture('pull-idle.html');
/** A card of a grid, which stands under no counter at all. */
const FIXTURE_CARD_GRID = readFixture('card-grid-with-description.html');

describe('findPackReveal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should read the position, the size of the pack and the rarity when a pack is being revealed', () => {
    document.body.innerHTML = FIXTURE_PULL_REVEAL;

    expect(findPackReveal(scanCards(document))).toEqual({ index: 1, total: 5, rarity: 'c' });
  });

  it('should return null when the page shows the packs left and no card', () => {
    document.body.innerHTML = FIXTURE_PULL_IDLE;

    expect(findPackReveal(scanCards(document))).toBeNull();
  });

  it('should return null when the card on screen stands under no counter', () => {
    document.body.innerHTML = FIXTURE_CARD_GRID;

    expect(findPackReveal(scanCards(document))).toBeNull();
  });

  it('should return null when there is no card at all', () => {
    expect(findPackReveal([])).toBeNull();
  });

  it('should read the second card of the pack when the user has walked to it', () => {
    document.body.innerHTML = FIXTURE_PULL_REVEAL.replace(
      '>1</span><span>/ 5</span>',
      '>2</span><span>/ 5</span>',
    );

    expect(findPackReveal(scanCards(document))?.index).toBe(2);
  });

  it('should ignore a counter whose position is past the size of the pack', () => {
    document.body.innerHTML = FIXTURE_PULL_REVEAL.replace(
      '>1</span><span>/ 5</span>',
      '>6</span><span>/ 5</span>',
    );

    expect(findPackReveal(scanCards(document))).toBeNull();
  });

  it('should ignore a counter whose position is zero', () => {
    document.body.innerHTML = FIXTURE_PULL_REVEAL.replace(
      '>1</span><span>/ 5</span>',
      '>0</span><span>/ 5</span>',
    );

    expect(findPackReveal(scanCards(document))).toBeNull();
  });

  it('should ignore a line that merely starts with the word the counter uses', () => {
    document.body.innerHTML = FIXTURE_PULL_REVEAL.replace(
      '<span>Carte</span>',
      '<span>Carte du jour</span>',
    );

    expect(findPackReveal(scanCards(document))).toBeNull();
  });

  it('should read the counter through a wrapper the site may add around the card', () => {
    document.body.innerHTML = FIXTURE_PULL_REVEAL;
    const flip = document.querySelector('.animate-card-flip');
    const wrapper = document.createElement('div');
    flip?.parentElement?.insertBefore(wrapper, flip);
    if (flip !== null) {
      wrapper.append(flip);
    }

    expect(findPackReveal(scanCards(document))?.index).toBe(1);
  });
});
