import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from './scan-cards';

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

describe('scanCards', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return 4 observed cards whose element is the card root when all four fixtures are concatenated', () => {
    document.body.innerHTML =
      FIXTURE_CARD_GRID +
      FIXTURE_CARD_LARGE +
      FIXTURE_CARD_LARGE_NO_DESC +
      FIXTURE_CARD_MODAL;

    const results = scanCards(document);
    expect(results).toHaveLength(4);

    for (const { element, card } of results) {
      expect(element).toBeInstanceOf(HTMLElement);
      expect(element.className).toMatch(/glow-/);
      expect(card.title.length).toBeGreaterThan(0);
    }
  });

  it('should return an empty array when there are no card elements', () => {
    document.body.innerHTML = '<p>Nothing here</p>';
    expect(scanCards(document)).toHaveLength(0);
  });
});
