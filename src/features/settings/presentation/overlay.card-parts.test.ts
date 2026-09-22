/**
 * The parts the overlay draws on a card and in its detail modal: the
 * Letterboxd button and link, the button of the Wikipedia article, the image
 * of a card the site left without one with its credit line, the numbers of the
 * card being hidden, and the cards a trade offer names.
 *
 * The seam: every case here is anchored on a card. What is drawn beside the
 * cards lives in `overlay.page-parts.test.ts`, and what is given back when the
 * context is invalidated in `overlay.teardown.test.ts`.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  CARD_ATTACK_VALUE_SELECTOR,
  HIDE_STATS_STYLE_SELECTOR,
  MODAL_ATTACK_PANELS_SELECTOR,
} from '../../hide-card-stats/data/hide-stats-selectors';
import { CARD_BUTTON_SELECTOR } from '../../letterboxd/data/card-button-selectors';
import { LETTERBOXD_LINK_SELECTOR } from '../../letterboxd/data/modal-selectors';
import { CARD_IMAGE_SELECTOR, IMAGE_CREDIT_SELECTOR } from '../../missing-image/data/image-selectors';
import { TRADE_PREVIEW_SELECTOR } from '../../trade-cards/data/trade-selectors';
import {
  WIKIPEDIA_BUTTON_SELECTOR,
  WIKIPEDIA_BUTTON_ATTRIBUTE,
} from '../../wikipedia-link/data/wikipedia-button-selectors';
import { stubCanvasContext, type CanvasStub } from '../../../../tests/helpers/canvas-context';
import {
  ALL_OFF,
  GRID_HTML,
  LARGE_HTML,
  MODAL_HTML,
  PLACEHOLDER_HTML,
  TRADES_HTML,
  TRADE_CARD_TITLE,
  cardButtons,
  hideStatsStyle,
  mount,
  observeBody,
  scan,
  scanUntilDrawn,
} from '../../../../tests/helpers/overlay-harness';

import { DEFAULT_SETTINGS } from '../domain/settings';

/** The link of the site in the modal, which our own nodes are inserted after. */
const MODAL_ARTICLE_URL = 'https://fr.wikipedia.org/wiki/Dvoricht%C3%A9';

function wikipediaButtons(): NodeListOf<Element> {
  return document.body.querySelectorAll(WIKIPEDIA_BUTTON_SELECTOR);
}

function cardImages(): NodeListOf<Element> {
  return document.body.querySelectorAll(CARD_IMAGE_SELECTOR);
}

/** The picture of a trade card, which only a card with a known file has. */
const TRADE_PREVIEW_IMAGE_SELECTOR = TRADE_PREVIEW_SELECTOR + ' img';

function tradePreviews(): NodeListOf<Element> {
  return document.body.querySelectorAll(TRADE_PREVIEW_SELECTOR);
}

/**
 * The page showing a card the site has no picture for, in the grid and in the
 * open detail modal: the card of the modal export is replaced by a card of the
 * catalogue export, which is what the site renders when such a card is opened.
 */
function showPlaceholderCardAndModal(): void {
  document.body.innerHTML = MODAL_HTML + PLACEHOLDER_HTML;
  const [modalCard, placeholderCard] = document.body.querySelectorAll('div[class*="glow-"]');
  if (modalCard === undefined || placeholderCard === undefined) {
    throw new Error('The fixtures hold no card');
  }
  modalCard.replaceWith(placeholderCard);
}

/**
 * Watches `document.head`, which is where the two features that change how the
 * site looks put their style sheet.
 *
 * The content script does NOT watch the head, so a repeated write there cannot
 * loop the way a write on the body would. What it does instead is stack one
 * copy of the same style sheet at every scan, for as long as the tab stays
 * open, and the observer scoped to the body cannot see any of it. That is the
 * hole this observer closes.
 */
function observeHead(): MutationObserver {
  const observer = new MutationObserver(() => undefined);
  observer.observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  });
  return observer;
}

describe('createOverlay', () => {
  /**
   * happy-dom answers null to `getContext`, so the game of the loading screen
   * could never be built at all. The stub records what is painted instead of
   * painting it, and touches nothing but the canvases of this file.
   */
  let canvas: CanvasStub;

  beforeEach(() => {
    document.body.innerHTML = '';
    canvas = stubCanvasContext();
  });

  afterEach(() => {
    canvas.restore();
  });

  it('should put the Letterboxd link of the modal under the link of the site', async () => {
    // The card of the modal carries our own Wikipedia button by then, and it
    // points at the very same article as the link of the site. The modal
    // renders that card before the column holding its link, so a link of ours
    // anchored on the first match would be drawn inside the card.
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);

    const link = document.body.querySelector(LETTERBOXD_LINK_SELECTOR);
    const anchor = link?.previousElementSibling ?? null;
    expect(anchor?.getAttribute('href')).toBe(MODAL_ARTICLE_URL);
    expect(anchor?.hasAttribute(WIKIPEDIA_BUTTON_ATTRIBUTE)).toBe(false);
  });

  it('should show the image of a card the site left without one once the results arrive', async () => {
    showPlaceholderCardAndModal();
    const { overlay } = mount();

    await scanUntilDrawn(overlay);

    expect(cardImages().length).toBeGreaterThan(0);
    expect(document.body.querySelector(IMAGE_CREDIT_SELECTOR)).not.toBeNull();
  });

  it('should add no image and no credit line when the images are off at load', async () => {
    showPlaceholderCardAndModal();
    const { overlay } = mount({ ...DEFAULT_SETTINGS, missingImages: false });

    await scanUntilDrawn(overlay);

    expect(cardImages()).toHaveLength(0);
    expect(document.body.querySelector(IMAGE_CREDIT_SELECTOR)).toBeNull();
  });

  it('should take back the images and the credit line at once when they are turned off', async () => {
    showPlaceholderCardAndModal();
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    expect(cardImages().length).toBeGreaterThan(0);

    overlay.applySettings({ ...DEFAULT_SETTINGS, missingImages: false });

    expect(cardImages()).toHaveLength(0);
    expect(document.body.querySelector(IMAGE_CREDIT_SELECTOR)).toBeNull();
    expect(cardButtons().length).toBeGreaterThan(0);
  });

  it('should bring the images back at once when they are turned on again', async () => {
    showPlaceholderCardAndModal();
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    const drawn = cardImages().length;
    overlay.applySettings({ ...DEFAULT_SETTINGS, missingImages: false });

    overlay.applySettings(DEFAULT_SETTINGS);

    expect(cardImages()).toHaveLength(drawn);
    expect(document.body.querySelector(IMAGE_CREDIT_SELECTOR)).not.toBeNull();
  });

  it('should add the hide-stats style at once when the setting is on at load, asking for no categorization', () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay, categorize } = mount({ ...ALL_OFF, hideCardStats: true });

    scan(overlay);

    expect(hideStatsStyle()).not.toBeNull();
    expect(categorize).not.toHaveBeenCalled();
  });

  it('should hide the ATK/DEF value block and the modal panels once the style is applied', () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...ALL_OFF, hideCardStats: true });

    scan(overlay);

    const valueBlock = document.body.querySelector(CARD_ATTACK_VALUE_SELECTOR);
    const modalPanels = document.body.querySelector(MODAL_ATTACK_PANELS_SELECTOR);
    expect(valueBlock).not.toBeNull();
    expect(modalPanels).not.toBeNull();
    expect(getComputedStyle(valueBlock as Element).visibility).toBe('hidden');
    expect(getComputedStyle(modalPanels as Element).display).toBe('none');
  });

  it('should take back the hide-stats style at once when the setting is turned off', () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, hideCardStats: true });
    scan(overlay);
    expect(hideStatsStyle()).not.toBeNull();

    overlay.applySettings({ ...DEFAULT_SETTINGS, hideCardStats: false });

    expect(hideStatsStyle()).toBeNull();
  });

  it('should bring the hide-stats style back at once when it is turned on again', () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, hideCardStats: true });
    scan(overlay);
    overlay.applySettings({ ...DEFAULT_SETTINGS, hideCardStats: false });
    expect(hideStatsStyle()).toBeNull();

    overlay.applySettings({ ...DEFAULT_SETTINGS, hideCardStats: true });

    expect(hideStatsStyle()).not.toBeNull();
  });

  it('should write nothing on a second scan while the hide-stats style is already applied', () => {
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...ALL_OFF, hideCardStats: true });
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    // The style element lives in document.head, so even the write that first
    // adds it is outside what this observer, scoped to document.body exactly
    // as the content script scopes its own, could ever see.
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing in the head either, on the scans that follow the first', () => {
    // The test above says it plainly: scoped to the body, it cannot see the
    // head at all. So it would stay green with the guard of
    // `applyHideCardStats` deleted, while the page collected one more copy of
    // the same style sheet at every scan. This one watches where the write
    // actually lands.
    document.body.innerHTML = GRID_HTML + MODAL_HTML;
    const { overlay } = mount({ ...ALL_OFF, hideCardStats: true });
    scan(overlay);
    const observer = observeHead();

    scan(overlay);
    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    expect(document.head.querySelectorAll(HIDE_STATS_STYLE_SELECTOR)).toHaveLength(1);
    observer.disconnect();
  });

  it('should keep the Letterboxd button visible while the stats row it sits on is hidden', async () => {
    // The riskiest node of ours: it is absolutely positioned over the empty
    // middle of that very row, and `visibility: hidden` inherits, so a rule
    // aimed one level too high would take it with the numbers.
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount({ ...DEFAULT_SETTINGS, hideCardStats: true });

    await scanUntilDrawn(overlay);

    const button = document.body.querySelector(CARD_BUTTON_SELECTOR);
    const valueBlock = document.body.querySelector(CARD_ATTACK_VALUE_SELECTOR);
    expect(button).not.toBeNull();
    expect(valueBlock).not.toBeNull();
    expect(getComputedStyle(button as Element).visibility).not.toBe('hidden');
    expect(getComputedStyle(valueBlock as Element).visibility).toBe('hidden');
  });

  it('should write nothing on a second scan while an image and its credit are shown', async () => {
    showPlaceholderCardAndModal();
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    expect(cardImages().length).toBeGreaterThan(0);
    expect(document.body.querySelector(IMAGE_CREDIT_SELECTOR)).not.toBeNull();
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a second scan while only the images are left on', async () => {
    showPlaceholderCardAndModal();
    const { overlay } = mount({ ...ALL_OFF, missingImages: true });
    scan(overlay);
    await vi.waitFor(() => {
      expect(cardImages().length).toBeGreaterThan(0);
    });
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should take back the Letterboxd link at once when it is turned off', async () => {
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)).not.toBeNull();

    overlay.applySettings({ ...DEFAULT_SETTINGS, letterboxdLink: false });

    expect(document.body.querySelector(LETTERBOXD_LINK_SELECTOR)).toBeNull();
  });

  it('should take back the Letterboxd buttons at once when the link is turned off', async () => {
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    expect(document.body.querySelector(CARD_BUTTON_SELECTOR)).not.toBeNull();

    overlay.applySettings({ ...DEFAULT_SETTINGS, letterboxdLink: false });

    expect(document.body.querySelector(CARD_BUTTON_SELECTOR)).toBeNull();
  });

  it('should bring the Letterboxd buttons back at once when the link is turned on again', async () => {
    document.body.innerHTML = MODAL_HTML;
    const { overlay } = mount();
    await scanUntilDrawn(overlay);
    const drawn = document.body.querySelectorAll(CARD_BUTTON_SELECTOR).length;
    overlay.applySettings({ ...DEFAULT_SETTINGS, letterboxdLink: false });

    overlay.applySettings(DEFAULT_SETTINGS);

    expect(drawn).toBeGreaterThan(0);
    expect(document.body.querySelectorAll(CARD_BUTTON_SELECTOR)).toHaveLength(drawn);
  });

  it('should draw the button of the article on the first scan, asking for no categorization', () => {
    // The title of a card IS the title of its article: the button is built
    // from what the page already shows, so no card ever waits for an answer
    // to get one, and nothing is asked of Wikidata to draw it.
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const { overlay, categorize } = mount({ ...ALL_OFF, wikipediaLink: true });

    scan(overlay);

    expect(wikipediaButtons()).toHaveLength(2);
    expect(categorize).not.toHaveBeenCalled();
  });

  it('should take the buttons of the articles back at once when they are turned off', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount({ ...ALL_OFF, wikipediaLink: true });
    scan(overlay);
    expect(wikipediaButtons().length).toBeGreaterThan(0);

    overlay.applySettings({ ...ALL_OFF, wikipediaLink: false });

    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should write nothing on a second scan while the buttons of the articles are there', () => {
    document.body.innerHTML = GRID_HTML + LARGE_HTML;
    const { overlay } = mount({ ...ALL_OFF, wikipediaLink: true });
    scan(overlay);
    const observer = observeBody();

    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should draw the cards a trade offer names, with the picture of the ones it knows', async () => {
    document.body.innerHTML = TRADES_HTML;
    const { overlay, categorize } = mount();

    scan(overlay);

    await vi.waitFor(() => {
      expect(document.body.querySelectorAll(TRADE_PREVIEW_IMAGE_SELECTOR)).toHaveLength(2);
    });
    // Seven chips, six distinct cards, and the one named twice is drawn twice.
    expect(tradePreviews()).toHaveLength(7);
    const asked = categorize.mock.calls[0]?.[0] ?? [];
    expect(asked.map((card) => card.title)).toContain(TRADE_CARD_TITLE);
    expect(asked).toHaveLength(6);
  });

  it('should draw the button of the article on the cards it draws for a trade offer', () => {
    document.body.innerHTML = TRADES_HTML;
    const { overlay } = mount({ ...ALL_OFF, tradeCards: true, wikipediaLink: true });

    scan(overlay);

    expect(tradePreviews().length).toBeGreaterThan(0);
    expect(wikipediaButtons()).toHaveLength(tradePreviews().length);
  });

  it('should take those buttons back with the cards when the trade setting goes off', () => {
    document.body.innerHTML = TRADES_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount({ ...ALL_OFF, tradeCards: true, wikipediaLink: true });
    scan(overlay);
    expect(wikipediaButtons().length).toBeGreaterThan(0);

    overlay.applySettings({ ...ALL_OFF, tradeCards: false, wikipediaLink: true });

    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should draw no trade card and ask for nothing while every setting is off', () => {
    document.body.innerHTML = TRADES_HTML;
    const { overlay, categorize } = mount(ALL_OFF);

    scan(overlay);

    expect(tradePreviews()).toHaveLength(0);
    expect(categorize).not.toHaveBeenCalled();
  });

  it('should take the cards of the trade offers back when the setting is turned off', async () => {
    document.body.innerHTML = TRADES_HTML;
    const siteHtml = document.body.innerHTML;
    const { overlay } = mount({ ...ALL_OFF, tradeCards: true });
    scan(overlay);
    await vi.waitFor(() => {
      expect(tradePreviews().length).toBeGreaterThan(0);
    });

    overlay.applySettings({ ...ALL_OFF, tradeCards: false });

    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should resolve the addresses of the pictures while only the trade cards need them', async () => {
    document.body.innerHTML = TRADES_HTML;
    const { overlay, categorize } = mount({ ...ALL_OFF, tradeCards: true });

    scan(overlay);

    await vi.waitFor(() => {
      expect(categorize).toHaveBeenCalledOnce();
    });
    // The images of the cards of the site are off, but a trade card shows
    // nothing at all without a picture, so the batch asks for the addresses.
    expect(categorize).toHaveBeenNthCalledWith(1, expect.anything(), {
      resolveImageUrls: true,
    });
  });

  it('should write nothing on a second scan while the link is off and a modal is open', async () => {
    showPlaceholderCardAndModal();
    const { overlay } = mount({ ...DEFAULT_SETTINGS, letterboxdLink: false });
    scan(overlay);
    await vi.waitFor(() => {
      expect(cardImages().length).toBeGreaterThan(0);
    });
    scan(overlay);
    const observer = observeBody();

    // The modal is still looked up on every scan, for the credit of the image.
    scan(overlay);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
