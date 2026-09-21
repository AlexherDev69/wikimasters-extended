import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from './scan-cards';
import { findTextArea } from './find-text-area';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** Real sanitized exports: the two card formats, with and without a description. */
const FIXTURES = {
  grid: readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8'),
  large: readFileSync(join(FIXTURES_DIR, 'card-large-with-description.html'), 'utf-8'),
  largeNoDescription: readFileSync(join(FIXTURES_DIR, 'card-large-no-description.html'), 'utf-8'),
} as const;

function showFixture(html: string): HTMLElement {
  document.body.innerHTML = html;
  const [observed] = scanCards(document.body);
  if (observed === undefined) {
    throw new Error('The fixture holds no card');
  }
  return observed.element;
}

describe('findTextArea', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it.each(Object.keys(FIXTURES) as (keyof typeof FIXTURES)[])(
    'should find the text area holding the title, a direct child of the card root, when the fixture is %s',
    (fixture) => {
      const cardRoot = showFixture(FIXTURES[fixture]);

      const textArea = findTextArea(cardRoot);

      expect(textArea).not.toBeNull();
      expect(textArea?.parentElement).toBe(cardRoot);
      expect(textArea?.querySelector('h3')).not.toBeNull();
    },
  );

  it('should find an area that is already absolutely positioned by its own classes', () => {
    // The reason applyCardButton never has to restyle it, or fall back to the
    // card root: `position: absolute` on the text area, from its own Tailwind
    // `absolute` class, already makes it a positioning context of its own.
    const cardRoot = showFixture(FIXTURES.grid);

    const textArea = findTextArea(cardRoot);

    expect(textArea?.className.split(/\s+/)).toContain('absolute');
  });

  it('should find nothing when the card has no heading', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    cardRoot.querySelector('h3')?.remove();

    expect(findTextArea(cardRoot)).toBeNull();
  });

  it('should leave every node of the site untouched', () => {
    document.body.innerHTML = FIXTURES.grid + FIXTURES.large;
    const siteHtml = document.body.innerHTML;

    for (const observed of scanCards(document.body)) {
      findTextArea(observed.element);
    }

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});
