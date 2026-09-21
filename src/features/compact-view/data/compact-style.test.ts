import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_BUTTON_ATTRIBUTE } from '../../letterboxd/data/card-button-selectors';
import { WIKIPEDIA_BUTTON_ATTRIBUTE } from '../../wikipedia-link/data/wikipedia-button-selectors';
import { COMPACT_STYLE_SELECTOR } from './compact-selectors';
import { applyCompactStyle, removeCompactStyle } from './compact-style';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

const FIXTURE_CARD_GRID = readFixture('card-grid-with-description.html');

const CARD_SELECTOR = 'div[class*="glow-"]';

function styleElement(): Element | null {
  return document.head.querySelector(COMPACT_STYLE_SELECTOR);
}

function gridCard(): Element {
  const card = document.body.querySelector(CARD_SELECTOR);
  if (card === null) {
    throw new Error('The fixture holds no card');
  }
  return card;
}

/** The area of a card that holds its title, where both features write. */
function textArea(): Element {
  const area = gridCard().querySelector('h3')?.parentElement ?? null;
  if (area === null) {
    throw new Error('The fixture holds no text area');
  }
  return area;
}

/**
 * The first thing the text area of a card holds beside its title: the line of
 * description on a card of a grid, the ATK/DEF block on the card the detail
 * modal shows for itself. It is what the compact card trades away.
 */
function textAreaExtra(): Element {
  const extra = textArea().querySelector(':scope > *:not(h3)');
  if (extra === null) {
    throw new Error('The fixture holds no text area');
  }
  return extra;
}

/**
 * A mark of the extension, in the corner of a card its feature writes it in.
 * An anchor carrying one attribute, which is all either feature is to this
 * sheet: see letterboxd/data/card-button.ts and
 * wikipedia-link/data/wikipedia-button.ts for the real nodes.
 */
function addOwnMark(attribute: string): HTMLElement {
  const mark = document.createElement('a');
  mark.setAttribute(attribute, '');
  textArea().appendChild(mark);
  return mark;
}

describe('applyCompactStyle', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('should add its style sheet to the head of the document, never to its body', () => {
    applyCompactStyle(document);

    expect(styleElement()).not.toBeNull();
    expect(document.body.querySelector(COMPACT_STYLE_SELECTOR)).toBeNull();
  });

  it('should add nothing a second time when the sheet is already there', () => {
    applyCompactStyle(document);
    const first = styleElement();

    applyCompactStyle(document);

    expect(document.head.querySelectorAll(COMPACT_STYLE_SELECTOR)).toHaveLength(1);
    expect(styleElement()).toBe(first);
  });

  it('should hide what a card of a grid holds beside its title, which the compact card trades away', () => {
    document.body.innerHTML = FIXTURE_CARD_GRID;
    const description = textAreaExtra();
    expect(getComputedStyle(description).display).not.toBe('none');

    applyCompactStyle(document);

    expect(getComputedStyle(description).display).toBe('none');
  });

  it('should keep every one of its rules away from the card of the detail modal', () => {
    // The modal opens over these very pages: a card looked at on purpose is
    // the one place where nothing must be made smaller or taken away.
    //
    // Read on the rules rather than on a card of the modal fixture, because
    // happy-dom does not honour a `:not()` holding a descendant selector: it
    // matches such a card where Chrome, which this extension ships to, does
    // not. Measured in a browser instead, see docs/PLAN.md.
    applyCompactStyle(document);
    const rules = (styleElement()?.textContent ?? '')
      .split('}')
      .map((rule) => rule.slice(rule.lastIndexOf('*/') + 1, rule.indexOf('{')))
      // One rule may name several selectors, and each of them has to carry
      // the negation of its own.
      .flatMap((selectors) => selectors.split(','))
      .map((selector) => selector.trim())
      .filter((selector) => selector !== '');

    expect(rules.length).toBeGreaterThan(0);
    for (const selector of rules) {
      expect(selector).toContain(':not(div.fixed.inset-0.z-50 *)');
    }
  });

  it('should keep both marks of the extension on the card it makes smaller', () => {
    // What the sheet takes away from the text area stops at the nodes the
    // site wrote itself: the button of the article and the Letterboxd one are
    // ours, and a compact card is where they are the most useful, since the
    // title is all that is left of the card to read.
    document.body.innerHTML = FIXTURE_CARD_GRID;
    const letterboxd = addOwnMark(CARD_BUTTON_ATTRIBUTE);
    const wikipedia = addOwnMark(WIKIPEDIA_BUTTON_ATTRIBUTE);

    applyCompactStyle(document);

    expect(getComputedStyle(letterboxd).display).not.toBe('none');
    expect(getComputedStyle(wikipedia).display).not.toBe('none');
  });

  it('should move both marks above the text area, the band they stood in being gone', () => {
    document.body.innerHTML = FIXTURE_CARD_GRID;
    const letterboxd = addOwnMark(CARD_BUTTON_ATTRIBUTE);
    const wikipedia = addOwnMark(WIKIPEDIA_BUTTON_ATTRIBUTE);

    applyCompactStyle(document);

    expect(getComputedStyle(letterboxd).top).toBe('-15px');
    expect(getComputedStyle(wikipedia).top).toBe('-15px');
  });

  it('should draw the card at about two thirds of the size the site gives it', () => {
    applyCompactStyle(document);

    // happy-dom resolves no layout, so the rule itself is what is read here.
    // Its effect is measured in a browser instead, see docs/PLAN.md.
    expect(styleElement()?.textContent).toContain('width: clamp(5.4rem, 27vw, 6.5rem)');
  });

  it('should write nothing on any node of the site', () => {
    document.body.innerHTML = FIXTURE_CARD_GRID;
    const siteHtml = document.body.innerHTML;

    applyCompactStyle(document);

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});

describe('removeCompactStyle', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('should take its style sheet back', () => {
    applyCompactStyle(document);

    removeCompactStyle(document);

    expect(styleElement()).toBeNull();
  });

  it('should bring back everything the compact card had taken away', () => {
    document.body.innerHTML = FIXTURE_CARD_GRID;
    const description = textAreaExtra();
    const before = getComputedStyle(description).display;
    applyCompactStyle(document);

    removeCompactStyle(document);

    expect(getComputedStyle(description).display).toBe(before);
  });

  it('should do nothing when there is no sheet of ours to take back', () => {
    const headHtml = document.head.innerHTML;

    removeCompactStyle(document);

    expect(document.head.innerHTML).toBe(headHtml);
  });
});
