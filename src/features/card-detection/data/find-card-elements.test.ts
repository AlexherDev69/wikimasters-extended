import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findCardElements } from './find-card-elements';

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../tests/fixtures',
);

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

const FIXTURE_CARD_GRID = readFixture('card-grid-with-description.html');
const FIXTURE_CARD_LARGE = readFixture('card-large-with-description.html');
const FIXTURE_CARD_LARGE_NO_DESC = readFixture('card-large-no-description.html');
const FIXTURE_CARD_MODAL = readFixture('card-detail-modal.html');

describe('findCardElements', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should find 1 card when the document contains the card-grid-with-description fixture', () => {
    document.body.innerHTML = FIXTURE_CARD_GRID;
    expect(findCardElements(document)).toHaveLength(1);
  });

  it('should find 1 card when the document contains the card-large-with-description fixture', () => {
    document.body.innerHTML = FIXTURE_CARD_LARGE;
    expect(findCardElements(document)).toHaveLength(1);
  });

  it('should find 1 card when the document contains the card-large-no-description fixture', () => {
    document.body.innerHTML = FIXTURE_CARD_LARGE_NO_DESC;
    expect(findCardElements(document)).toHaveLength(1);
  });

  it('should find 1 card when the document contains the card-detail-modal fixture', () => {
    document.body.innerHTML = FIXTURE_CARD_MODAL;
    expect(findCardElements(document)).toHaveLength(1);
  });

  it('should find 4 cards when all four fixtures are concatenated in the document', () => {
    document.body.innerHTML =
      FIXTURE_CARD_GRID +
      FIXTURE_CARD_LARGE +
      FIXTURE_CARD_LARGE_NO_DESC +
      FIXTURE_CARD_MODAL;
    expect(findCardElements(document)).toHaveLength(4);
  });

  it('should return an empty array when the document has no card elements', () => {
    document.body.innerHTML = '<p>Nothing here</p>';
    expect(findCardElements(document)).toHaveLength(0);
  });

  it('should return an empty array when a glow-c element has no h3 descendant', () => {
    document.body.innerHTML = '<div class="glow-c"><p>No title</p></div>';
    expect(findCardElements(document)).toHaveLength(0);
  });

  it('should return an empty array when the class is hover:glow-c and not a bare glow-<rarity> token', () => {
    document.body.innerHTML = '<div class="hover:glow-c"><h3>Title</h3></div>';
    expect(findCardElements(document)).toHaveLength(0);
  });

  it('should return an empty array when the h3 text content contains only whitespace', () => {
    document.body.innerHTML = '<div class="glow-c"><h3>   </h3></div>';
    expect(findCardElements(document)).toHaveLength(0);
  });

  it('should keep only the outermost element when matching elements are nested', () => {
    document.body.innerHTML = `
      <div class="glow-c">
        <h3>Outer card</h3>
        <div class="glow-c">
          <h3>Inner card</h3>
        </div>
      </div>
    `;
    const cards = findCardElements(document);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.querySelector('h3')?.textContent.trim()).toBe('Outer card');
  });
});
