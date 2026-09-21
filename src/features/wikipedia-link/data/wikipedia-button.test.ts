import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findTextArea } from '../../card-detection/data/find-text-area';
import { scanCards } from '../../card-detection/data/scan-cards';
import { applyWikipediaButton, removeWikipediaButtons } from './wikipedia-button';
import { WIKIPEDIA_BUTTON_SELECTOR } from './wikipedia-button-selectors';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** Real sanitized exports: the two card formats, with and without a description. */
const FIXTURES = {
  grid: readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8'),
  large: readFileSync(join(FIXTURES_DIR, 'card-large-with-description.html'), 'utf-8'),
  largeNoDescription: readFileSync(join(FIXTURES_DIR, 'card-large-no-description.html'), 'utf-8'),
} as const;

const TITLE = 'Pulp Fiction';
const ARTICLE_URL = 'https://fr.wikipedia.org/wiki/Pulp_Fiction';
const OTHER_TITLE = 'Saison 1 de Severance';
const OTHER_ARTICLE_URL = 'https://fr.wikipedia.org/wiki/Saison_1_de_Severance';

/** What a card node the site is in the middle of reusing reads as. */
const UNREADABLE_TITLE = '   ';

function showFixture(html: string): HTMLElement {
  document.body.innerHTML = html;
  const [observed] = scanCards(document.body);
  if (observed === undefined) {
    throw new Error('The fixture holds no card');
  }
  return observed.element;
}

function button(): HTMLAnchorElement | null {
  return document.body.querySelector<HTMLAnchorElement>(WIKIPEDIA_BUTTON_SELECTOR);
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

describe('applyWikipediaButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it.each(Object.keys(FIXTURES) as (keyof typeof FIXTURES)[])(
    'should add one button inside the text area when the fixture is %s',
    (fixture) => {
      const cardRoot = showFixture(FIXTURES[fixture]);

      applyWikipediaButton(cardRoot, TITLE);

      expect(document.body.querySelectorAll(WIKIPEDIA_BUTTON_SELECTOR)).toHaveLength(1);
      expect(findTextArea(cardRoot)?.contains(button())).toBe(true);
    },
  );

  it('should carry the address of the article, open in a new tab, without opener and with the French label', () => {
    const cardRoot = showFixture(FIXTURES.grid);

    applyWikipediaButton(cardRoot, TITLE);

    const inserted = requireButton();
    expect(inserted.getAttribute('href')).toBe(ARTICLE_URL);
    expect(inserted.getAttribute('target')).toBe('_blank');
    expect(inserted.getAttribute('rel')).toBe('noopener noreferrer');
    expect(inserted.getAttribute('aria-label')).toBe("Lire l'article Pulp Fiction sur Wikipédia");
  });

  it('should build the address from the title the card itself shows, asking nothing of anyone', () => {
    // The whole point of this button: the title of a card IS the title of its
    // article, so nothing is looked up, waited for or cached to draw it.
    const cardRoot = showFixture(FIXTURES.grid);
    const title = cardRoot.querySelector('h3')?.textContent ?? '';

    applyWikipediaButton(cardRoot, title);

    expect(requireButton().getAttribute('href')).toBe("https://fr.wikipedia.org/wiki/Jeu_d'horreur");
  });

  it('should build the button from an anchor and one letter only, so the scanner ignores it', () => {
    const cardRoot = showFixture(FIXTURES.grid);

    applyWikipediaButton(cardRoot, TITLE);

    const inserted = requireButton();
    expect(inserted.tagName).toBe('A');
    const tags = [...inserted.querySelectorAll('*')].map((node) => node.tagName);
    expect(tags).toEqual(['SPAN']);
    // The reason for the whitelist above, stated on its own so it survives a
    // change of mark: the scanner reads a title in the first `h3` of a card
    // and a description in its first `p`.
    expect(inserted.querySelector('h3')).toBeNull();
    expect(inserted.querySelector('p')).toBeNull();
  });

  it('should carry no class that the card detection could take for a card', () => {
    const cardRoot = showFixture(FIXTURES.grid);

    applyWikipediaButton(cardRoot, TITLE);

    const inserted = requireButton();
    const classNames = [inserted, ...inserted.querySelectorAll('*')].map((node) => node.className);
    expect(classNames.every((name) => !name.includes('glow-'))).toBe(true);
  });

  it('should add nothing when the card shows no title to build an address from', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    const observer = observeBody();

    applyWikipediaButton(cardRoot, UNREADABLE_TITLE);

    expect(button()).toBeNull();
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should remove the button when the card no longer shows a title', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyWikipediaButton(cardRoot, TITLE);

    applyWikipediaButton(cardRoot, UNREADABLE_TITLE);

    expect(button()).toBeNull();
  });

  it('should write nothing on a second call with the same title', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyWikipediaButton(cardRoot, TITLE);
    const observer = observeBody();

    applyWikipediaButton(cardRoot, TITLE);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a second call while the card shows no title', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyWikipediaButton(cardRoot, UNREADABLE_TITLE);
    const observer = observeBody();

    applyWikipediaButton(cardRoot, UNREADABLE_TITLE);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should rebuild the button rather than patch it when the card changes', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyWikipediaButton(cardRoot, TITLE);
    const first = button();

    applyWikipediaButton(cardRoot, OTHER_TITLE);

    expect(document.body.querySelectorAll(WIKIPEDIA_BUTTON_SELECTOR)).toHaveLength(1);
    expect(button()).not.toBe(first);
    expect(button()?.getAttribute('href')).toBe(OTHER_ARTICLE_URL);
    expect(button()?.getAttribute('aria-label')).toContain(OTHER_TITLE);
  });

  it('should stop the click from reaching a listener on the card root, and keep the native navigation', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyWikipediaButton(cardRoot, TITLE);
    const onCardClick = vi.fn();
    cardRoot.addEventListener('click', onCardClick);

    const event = dispatchTrustedClick(requireButton());

    expect(onCardClick).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('should do nothing on an untrusted click, which reaches the card root as any other click would', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyWikipediaButton(cardRoot, TITLE);
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

      applyWikipediaButton(cardRoot, TITLE);

      const after = scanCards(document.body);
      expect(after).toHaveLength(before.length);
      expect(after.map((observed) => observed.card)).toEqual(before);
    },
  );

  it('should leave every node of the site untouched', () => {
    const cardRoot = showFixture(FIXTURES.large);
    const siteHtml = document.body.innerHTML;

    applyWikipediaButton(cardRoot, TITLE);
    applyWikipediaButton(cardRoot, OTHER_TITLE);
    button()?.remove();

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});

describe('removeWikipediaButtons', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should take back every button and leave the site as it was', () => {
    document.body.innerHTML = FIXTURES.grid + FIXTURES.large;
    const siteHtml = document.body.innerHTML;
    for (const observed of scanCards(document.body)) {
      applyWikipediaButton(observed.element, observed.card.title);
    }

    removeWikipediaButtons(document.body);

    expect(document.body.querySelectorAll(WIKIPEDIA_BUTTON_SELECTOR)).toHaveLength(0);
    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should do nothing when no button was added', () => {
    showFixture(FIXTURES.grid);
    const observer = observeBody();

    removeWikipediaButtons(document.body);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
