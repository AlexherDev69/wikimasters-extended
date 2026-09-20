import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanTradeChips } from './scan-trade-chips';
import { TRADE_CHIP_SELECTOR } from './trade-selectors';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** Two real offers of the exchange page, one card against one and one against four. */
const TRADES_HTML = readFileSync(join(FIXTURES_DIR, 'trades-list.html'), 'utf-8');
/** A page of the site that names no card in a chip. */
const GRID_HTML = readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8');

describe('scanTradeChips', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should find every card the two offers name when the page is the exchange list', () => {
    document.body.innerHTML = TRADES_HTML;

    const found = scanTradeChips(document.body);

    expect(found.map((observed) => observed.card.title)).toEqual([
      'Itouroup',
      'Saison 1 de Severance',
      'Saison 1 de Severance',
      "Vaccin d'AstraZeneca-Oxford contre la Covid-19",
      'Mosquée Al Qiblatain',
      'Baykar Bayraktar Akıncı',
      'Monocyte',
    ]);
  });

  it('should read the whole title from the attribute when the chip shows a cut one', () => {
    document.body.innerHTML = TRADES_HTML;

    const [, severance] = scanTradeChips(document.body);

    expect(severance?.card.title).toBe('Saison 1 de Severance');
    // What the site paints in the chip, ellipsis included: the very reason the
    // title is read from the attribute instead.
    expect(severance?.chip.textContent).toContain('…');
  });

  it('should read the rarity of each card from the colour the site gives its chip', () => {
    document.body.innerHTML = TRADES_HTML;

    const found = scanTradeChips(document.body);

    expect(found.map((observed) => observed.card.rarity)).toEqual([
      'sr',
      'sr',
      'sr',
      'pc',
      'pc',
      'r',
      'r',
    ]);
  });

  it('should give every card no description, which a chip never carries', () => {
    document.body.innerHTML = TRADES_HTML;

    const found = scanTradeChips(document.body);

    expect(found.every((observed) => observed.card.description === null)).toBe(true);
  });

  it('should skip a chip whose colour names no rarity of the site', () => {
    document.body.innerHTML = TRADES_HTML;
    const chip = document.body.querySelector(TRADE_CHIP_SELECTOR);
    chip?.setAttribute('style', 'background-color: var(--color-rarity-legendary); color: red;');

    const found = scanTradeChips(document.body);

    expect(found).toHaveLength(6);
    expect(found.map((observed) => observed.card.title)).not.toContain('Itouroup');
  });

  it('should skip a chip whose title attribute is empty', () => {
    document.body.innerHTML = TRADES_HTML;
    document.body.querySelector(TRADE_CHIP_SELECTOR)?.setAttribute('title', '   ');

    expect(scanTradeChips(document.body)).toHaveLength(6);
  });

  it('should find nothing on a page of cards, which names no card in a chip', () => {
    document.body.innerHTML = GRID_HTML;

    expect(scanTradeChips(document.body)).toEqual([]);
  });
});
