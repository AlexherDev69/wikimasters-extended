import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CardCategory } from '../../categorization/domain/category';
import { scanTradeChips } from '../data/scan-trade-chips';
import { CARD_BUTTON_SELECTOR } from '../../letterboxd/data/card-button-selectors';
import { WIKIPEDIA_BUTTON_SELECTOR } from '../../wikipedia-link/data/wikipedia-button-selectors';
import { TRADE_PREVIEW_SELECTOR } from '../data/trade-selectors';
import { syncTradePreviews, type TradeMarkSettings } from './sync-trade-previews';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** Two real offers of the exchange page, seven cards in all. */
const TRADES_HTML = readFileSync(join(FIXTURES_DIR, 'trades-list.html'), 'utf-8');

const SEVERANCE = 'Saison 1 de Severance';

function makeCategory(title: string, overrides: Partial<CardCategory> = {}): CardCategory {
  return {
    title,
    status: 'categorized',
    qid: 'Q1',
    letterboxdUrl: null,
    image: null,
    ...overrides,
  };
}

const KNOWN = new Map<string, CardCategory>([
  [
    SEVERANCE,
    makeCategory(SEVERANCE, {
      image: { fileName: 'Severance titlecard.jpg', kind: 'picture', thumbnailUrl: null },
    }),
  ],
]);

function previews(): NodeListOf<Element> {
  return document.body.querySelectorAll(TRADE_PREVIEW_SELECTOR);
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

/** Neither mark of the extension, which is what these tests are about. */
const NO_MARKS: TradeMarkSettings = { wikipedia: false, letterboxd: false };

function sync(
  known: ReadonlyMap<string, CardCategory> = KNOWN,
  marks: TradeMarkSettings = NO_MARKS,
): void {
  syncTradePreviews(document.body, scanTradeChips(document.body), known, marks);
}

describe('syncTradePreviews', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should draw one card per chip, whatever is known of them', () => {
    document.body.innerHTML = TRADES_HTML;

    sync();

    expect(previews()).toHaveLength(7);
  });

  it('should show the picture of the cards whose facts have come back', () => {
    document.body.innerHTML = TRADES_HTML;

    sync();

    // The fixture names that card in both offers, so both are drawn with it.
    expect(document.body.querySelectorAll(`${TRADE_PREVIEW_SELECTOR} img`)).toHaveLength(2);
  });

  it('should draw the cards nothing is known of yet, with their name and their rarity', () => {
    document.body.innerHTML = TRADES_HTML;

    sync(new Map());

    expect(previews()).toHaveLength(7);
    expect(document.body.querySelectorAll(`${TRADE_PREVIEW_SELECTOR} img`)).toHaveLength(0);
    expect([...previews()].some((preview) => preview.textContent?.includes('Monocyte'))).toBe(
      true,
    );
  });

  it('should write nothing on a second pass over the same offers', () => {
    document.body.innerHTML = TRADES_HTML;
    sync();
    const observer = observeBody();

    sync();

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should take back the cards of an offer the site has replaced', () => {
    document.body.innerHTML = TRADES_HTML;
    sync();
    const offers = document.body.querySelectorAll('div.card-frame');
    offers[1]?.remove();

    sync();

    expect(previews()).toHaveLength(2);
  });

  it('should take back every card when the page stops naming any', () => {
    document.body.innerHTML = TRADES_HTML;
    sync();

    for (const offer of document.body.querySelectorAll('div.card-frame')) {
      offer.remove();
    }
    sync();

    expect(previews()).toHaveLength(0);
  });
});

describe('the two marks of the extension on the cards of a trade offer', () => {
  const FILM_URL = 'https://letterboxd.com/film/severance/';

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function articleButtons(): NodeListOf<Element> {
    return document.body.querySelectorAll(WIKIPEDIA_BUTTON_SELECTOR);
  }

  function letterboxdButtons(): NodeListOf<Element> {
    return document.body.querySelectorAll(CARD_BUTTON_SELECTOR);
  }

  it('should draw the button of the article on every card, knowing nothing of any of them', () => {
    // The address of an article is built from the title the chip itself
    // carries, so this mark is there on the very first sync, before any
    // answer has come back.
    document.body.innerHTML = TRADES_HTML;

    sync(new Map(), { wikipedia: true, letterboxd: false });

    expect(previews().length).toBeGreaterThan(0);
    expect(articleButtons()).toHaveLength(previews().length);
    expect(letterboxdButtons()).toHaveLength(0);
  });

  it('should draw the Letterboxd button only on the cards that have an address', () => {
    document.body.innerHTML = TRADES_HTML;
    const known = new Map([[SEVERANCE, makeCategory(SEVERANCE, { letterboxdUrl: FILM_URL })]]);

    sync(known, { wikipedia: false, letterboxd: true });

    // The fixture names that card in both of its offers, so it is drawn twice.
    expect(letterboxdButtons()).toHaveLength(2);
    expect(articleButtons()).toHaveLength(0);
  });

  it('should write nothing on a second sync while both marks are drawn', () => {
    document.body.innerHTML = TRADES_HTML;
    const marks = { wikipedia: true, letterboxd: true };
    sync(KNOWN, marks);
    const observer = observeBody();

    sync(KNOWN, marks);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
