import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from '../../card-detection/data/scan-cards';
import { applyCardButton, removeCardButtons } from './card-button';
import { CARD_BUTTON_SELECTOR } from './card-button-selectors';
import { findTextArea } from './find-text-area';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** Real sanitized exports: the two card formats, with and without a description. */
const FIXTURES = {
  grid: readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8'),
  large: readFileSync(join(FIXTURES_DIR, 'card-large-with-description.html'), 'utf-8'),
  largeNoDescription: readFileSync(join(FIXTURES_DIR, 'card-large-no-description.html'), 'utf-8'),
} as const;

const TITLE = 'Pulp Fiction';
const FILM_URL = 'https://letterboxd.com/film/pulp-fiction/';
const OTHER_URL = 'https://letterboxd.com/film/lost-river/';

function showFixture(html: string): HTMLElement {
  document.body.innerHTML = html;
  const [observed] = scanCards(document.body);
  if (observed === undefined) {
    throw new Error('The fixture holds no card');
  }
  return observed.element;
}

function button(): HTMLAnchorElement | null {
  return document.body.querySelector<HTMLAnchorElement>(CARD_BUTTON_SELECTOR);
}

function requireButton(): HTMLAnchorElement {
  const found = button();
  if (found === null) {
    throw new Error('No button was added');
  }
  return found;
}

function observeBody(): MutationObserver {
  const observer = new MutationObserver(() => undefined);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  });
  return observer;
}

/** A click dispatched the way the user does: `isTrusted` is set by the browser. */
function dispatchTrustedClick(target: EventTarget): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'isTrusted', { value: true });
  target.dispatchEvent(event);
  return event;
}

/** A click as a script would raise it: `isTrusted` is false, as it always is for us too. */
function dispatchUntrustedClick(target: EventTarget): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe('applyCardButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it.each(Object.keys(FIXTURES) as (keyof typeof FIXTURES)[])(
    'should add one button inside the text area when the fixture is %s',
    (fixture) => {
      const cardRoot = showFixture(FIXTURES[fixture]);

      applyCardButton(cardRoot, TITLE, FILM_URL);

      expect(document.body.querySelectorAll(CARD_BUTTON_SELECTOR)).toHaveLength(1);
      expect(findTextArea(cardRoot)?.contains(button())).toBe(true);
    },
  );

  it('should carry the address, open in a new tab, without opener and with the French label', () => {
    const cardRoot = showFixture(FIXTURES.grid);

    applyCardButton(cardRoot, TITLE, FILM_URL);

    const inserted = requireButton();
    expect(inserted.getAttribute('href')).toBe(FILM_URL);
    expect(inserted.getAttribute('target')).toBe('_blank');
    expect(inserted.getAttribute('rel')).toBe('noopener noreferrer');
    expect(inserted.getAttribute('aria-label')).toBe('Voir Pulp Fiction sur Letterboxd');
  });

  it('should build the button from an anchor and span only, so the scanner ignores it', () => {
    const cardRoot = showFixture(FIXTURES.grid);

    applyCardButton(cardRoot, TITLE, FILM_URL);

    const inserted = requireButton();
    expect(inserted.tagName).toBe('A');
    const tags = [...inserted.querySelectorAll('*')].map((node) => node.tagName);
    expect(new Set(tags)).toEqual(new Set(['SPAN']));
  });

  it('should carry no class that the card detection could take for a card', () => {
    const cardRoot = showFixture(FIXTURES.grid);

    applyCardButton(cardRoot, TITLE, FILM_URL);

    const inserted = requireButton();
    const classNames = [inserted, ...inserted.querySelectorAll('*')].map(
      (node) => node.className,
    );
    expect(classNames.every((name) => !name.includes('glow-'))).toBe(true);
  });

  it('should add nothing when the card has no Letterboxd address', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    const observer = observeBody();

    applyCardButton(cardRoot, TITLE, null);

    expect(button()).toBeNull();
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should remove the button when the card lost its address', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyCardButton(cardRoot, TITLE, FILM_URL);

    applyCardButton(cardRoot, TITLE, null);

    expect(button()).toBeNull();
  });

  it('should write nothing on a second call with the same address', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyCardButton(cardRoot, TITLE, FILM_URL);
    const observer = observeBody();

    applyCardButton(cardRoot, TITLE, FILM_URL);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a second call while the card has no address', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyCardButton(cardRoot, TITLE, null);
    const observer = observeBody();

    applyCardButton(cardRoot, TITLE, null);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should rebuild the button rather than patch it when the address changes', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyCardButton(cardRoot, TITLE, FILM_URL);
    const first = button();

    applyCardButton(cardRoot, 'Lost River', OTHER_URL);

    expect(document.body.querySelectorAll(CARD_BUTTON_SELECTOR)).toHaveLength(1);
    expect(button()).not.toBe(first);
    expect(button()?.getAttribute('href')).toBe(OTHER_URL);
  });

  it('should refuse an address on a foreign origin, which never reaches the href', () => {
    const cardRoot = showFixture(FIXTURES.grid);

    applyCardButton(cardRoot, TITLE, 'https://evil.example.com/film/x/');

    expect(button()).toBeNull();
  });

  it('should remove the button rather than point it to a foreign origin', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyCardButton(cardRoot, TITLE, FILM_URL);

    applyCardButton(cardRoot, TITLE, 'https://letterboxd.com.evil.example.com/film/x/');

    expect(button()).toBeNull();
  });

  it('should stop the click from reaching a listener on the card root, and keep the native navigation', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyCardButton(cardRoot, TITLE, FILM_URL);
    const onCardClick = vi.fn();
    cardRoot.addEventListener('click', onCardClick);

    const event = dispatchTrustedClick(requireButton());

    expect(onCardClick).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('should do nothing on an untrusted click, which reaches the card root as any other click would', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyCardButton(cardRoot, TITLE, FILM_URL);
    const onCardClick = vi.fn();
    cardRoot.addEventListener('click', onCardClick);

    dispatchUntrustedClick(requireButton());

    expect(onCardClick).toHaveBeenCalledOnce();
  });

  it.each(Object.keys(FIXTURES) as (keyof typeof FIXTURES)[])(
    'should leave the card readable exactly as before, and find the same number of cards, for %s',
    (fixture) => {
      const cardRoot = showFixture(FIXTURES[fixture]);
      const before = scanCards(document.body).map((observed) => observed.card);

      applyCardButton(cardRoot, TITLE, FILM_URL);

      const after = scanCards(document.body);
      expect(after).toHaveLength(before.length);
      expect(after.map((observed) => observed.card)).toEqual(before);
    },
  );

  it('should leave every node of the site untouched', () => {
    const cardRoot = showFixture(FIXTURES.large);
    const siteHtml = document.body.innerHTML;

    applyCardButton(cardRoot, TITLE, FILM_URL);
    applyCardButton(cardRoot, TITLE, OTHER_URL);
    button()?.remove();

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});

describe('removeCardButtons', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should take back every button and leave the site as it was', () => {
    document.body.innerHTML = FIXTURES.grid + FIXTURES.large;
    const siteHtml = document.body.innerHTML;
    for (const observed of scanCards(document.body)) {
      applyCardButton(observed.element, TITLE, FILM_URL);
    }

    removeCardButtons(document.body);

    expect(document.body.querySelectorAll(CARD_BUTTON_SELECTOR)).toHaveLength(0);
    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should do nothing when no button was added', () => {
    showFixture(FIXTURES.grid);
    const observer = observeBody();

    removeCardButtons(document.body);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
