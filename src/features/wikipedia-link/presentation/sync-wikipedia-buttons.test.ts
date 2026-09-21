import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from '../../card-detection/data/scan-cards';
import { WIKIPEDIA_BUTTON_SELECTOR } from '../data/wikipedia-button-selectors';
import { syncWikipediaButtons } from './sync-wikipedia-buttons';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const GRID_HTML = readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8');
const LARGE_HTML = readFileSync(join(FIXTURES_DIR, 'card-large-no-description.html'), 'utf-8');

const GRID_CARD_URL = "https://fr.wikipedia.org/wiki/Jeu_d'horreur";
const LARGE_CARD_URL = 'https://fr.wikipedia.org/wiki/Dvoricht%C3%A9';
const OTHER_CARD_TITLE = 'Pulp Fiction';
const OTHER_CARD_URL = 'https://fr.wikipedia.org/wiki/Pulp_Fiction';

/** What the content script does on every scan. */
function sync(): void {
  syncWikipediaButtons(scanCards(document.body));
}

function buttons(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>(WIKIPEDIA_BUTTON_SELECTOR)];
}

function addresses(): (string | null)[] {
  return buttons().map((found) => found.getAttribute('href'));
}

/** The site reuses a card node and renders another card in it when paginating. */
function showOtherCard(title: string): void {
  const heading = document.body.querySelector('[class*="glow-"] h3');
  if (heading === null) {
    throw new Error('The fixture card has no title');
  }
  heading.textContent = title;
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

describe('syncWikipediaButtons', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should show the button of every card on screen, on the very first pass', () => {
    // Nothing is asked of Wikimedia and nothing is waited for, so no card is
    // ever left without its button while something loads.
    document.body.innerHTML = GRID_HTML + LARGE_HTML;

    sync();

    expect(addresses()).toEqual([GRID_CARD_URL, LARGE_CARD_URL]);
  });

  it('should write nothing on a second sync', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    sync();
    const observer = observeBody();

    sync();

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should show the button of a reused node for the card it shows now, not the one it showed before', () => {
    document.body.innerHTML = LARGE_HTML;
    sync();

    showOtherCard(OTHER_CARD_TITLE);
    sync();

    expect(addresses()).toEqual([OTHER_CARD_URL]);
  });

  it('should keep the button of a node the scan reads as no card at all, until it reads as one again', () => {
    document.body.innerHTML = LARGE_HTML;
    sync();

    // Halfway through a node being reused, the card names nothing: the scan
    // drops it, so this sync is handed no card and writes nothing at all. The
    // button of the card that node showed before is what stays on screen for
    // that one frame.
    showOtherCard('   ');
    sync();
    expect(addresses()).toEqual([LARGE_CARD_URL]);

    // The very next scan, the one the site's own write schedules, hands the
    // card over and the button follows it.
    showOtherCard(OTHER_CARD_TITLE);
    sync();
    expect(addresses()).toEqual([OTHER_CARD_URL]);
  });

  it('should leave the cards of the page readable exactly as before', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const before = scanCards(document.body).map((observed) => observed.card);

    sync();

    expect(scanCards(document.body).map((observed) => observed.card)).toEqual(before);
  });
});
