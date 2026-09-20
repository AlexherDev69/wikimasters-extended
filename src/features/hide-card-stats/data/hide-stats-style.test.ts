import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from '../../card-detection/data/scan-cards';
import { applyHideCardStats, removeHideCardStats } from './hide-stats-style';
import {
  CARD_ATTACK_VALUE_SELECTOR,
  CARD_DEFENSE_VALUE_SELECTOR,
  CARD_STATS_ROW_SELECTOR,
  HIDE_STATS_STYLE_SELECTOR,
  MODAL_ATTACK_PANELS_SELECTOR,
  MODAL_DEFENSE_PANELS_SELECTOR,
} from './hide-stats-selectors';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const GRID_HTML = readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8');
const LARGE_HTML = readFileSync(join(FIXTURES_DIR, 'card-large-with-description.html'), 'utf-8');
const NO_DESCRIPTION_HTML = readFileSync(
  join(FIXTURES_DIR, 'card-large-no-description.html'),
  'utf-8',
);
const MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

function styleElement(): HTMLStyleElement | null {
  return document.head.querySelector<HTMLStyleElement>(HIDE_STATS_STYLE_SELECTOR);
}

function observeBody(): MutationObserver {
  const observer = new MutationObserver(() => undefined);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  return observer;
}

/**
 * The first rule of the injected sheet whose selector is exactly
 * `selectorText`, read through the CSSOM the way
 * missing-image/data/card-image.test.ts reads its own style sheet.
 */
function styleRuleFor(selectorText: string): CSSStyleRule | null {
  const sheet = styleElement()?.sheet ?? null;
  if (sheet === null) {
    throw new Error('The style sheet of the feature was not injected');
  }
  const rules = Array.from(sheet.cssRules).filter(
    (rule): rule is CSSStyleRule => 'selectorText' in rule,
  );
  return rules.find((rule) => rule.selectorText === selectorText) ?? null;
}

describe('applyHideCardStats', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = GRID_HTML + LARGE_HTML + MODAL_HTML;
  });

  it('should add one style element to document.head when the setting turns on', () => {
    applyHideCardStats(document);

    expect(document.head.querySelectorAll(HIDE_STATS_STYLE_SELECTOR)).toHaveLength(1);
  });

  it('should not add a second style element on a second call', () => {
    applyHideCardStats(document);

    applyHideCardStats(document);

    expect(document.head.querySelectorAll(HIDE_STATS_STYLE_SELECTOR)).toHaveLength(1);
  });

  it('should remove the style element when the setting turns off', () => {
    applyHideCardStats(document);

    removeHideCardStats(document);

    expect(styleElement()).toBeNull();
  });

  it('should do nothing when removed while no style element was ever added', () => {
    const observer = observeBody();

    removeHideCardStats(document);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing the body observer of the content script could ever see', () => {
    // { childList, subtree, characterData } on document.body, exactly as the
    // content script observes it: our one node lives in document.head, so
    // none of the writes below are of a kind that observer could report,
    // whether the style is being added, re-applied unchanged, or removed.
    const observer = observeBody();

    applyHideCardStats(document);
    applyHideCardStats(document);
    removeHideCardStats(document);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should leave every node of the site untouched, adding only its own node to document.head', () => {
    const bodyHtml = document.body.innerHTML;
    const headChildrenBefore = document.head.children.length;

    applyHideCardStats(document);

    expect(document.body.innerHTML).toBe(bodyHtml);
    expect(document.head.children).toHaveLength(headChildrenBefore + 1);
  });

  it('should never act on a node of the site, not even through a method that leaves no trace', () => {
    // The comparison above reads the serialized body, which cannot show a
    // dispatched event, a scroll or a focus: the site sanctions an automated
    // interaction with a ban, so those are pinned here by name rather than
    // left to a check that could never see them.
    // Spied on the prototype the DOM implementation actually resolves the
    // method from, which is not always EventTarget itself.
    const dispatchEvent = vi.spyOn(HTMLElement.prototype, 'dispatchEvent');
    const click = vi.spyOn(HTMLElement.prototype, 'click');
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    const scrollTo = vi.spyOn(Element.prototype, 'scrollTo');

    applyHideCardStats(document);
    applyHideCardStats(document);
    removeHideCardStats(document);

    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('should carry the two card selectors with visibility hidden', () => {
    applyHideCardStats(document);

    expect(styleRuleFor(CARD_ATTACK_VALUE_SELECTOR)?.style.getPropertyValue('visibility')).toBe(
      'hidden',
    );
    expect(styleRuleFor(CARD_DEFENSE_VALUE_SELECTOR)?.style.getPropertyValue('visibility')).toBe(
      'hidden',
    );
  });

  it('should carry the two modal selectors with display none', () => {
    applyHideCardStats(document);

    expect(styleRuleFor(MODAL_ATTACK_PANELS_SELECTOR)?.style.getPropertyValue('display')).toBe(
      'none',
    );
    expect(styleRuleFor(MODAL_DEFENSE_PANELS_SELECTOR)?.style.getPropertyValue('display')).toBe(
      'none',
    );
  });

  it('should hide the ATK and DEF value blocks of a card without collapsing their row', () => {
    applyHideCardStats(document);
    const attackBlock = document.body.querySelector(CARD_ATTACK_VALUE_SELECTOR);
    const defenseBlock = document.body.querySelector(CARD_DEFENSE_VALUE_SELECTOR);

    expect(attackBlock).not.toBeNull();
    expect(defenseBlock).not.toBeNull();
    expect(getComputedStyle(attackBlock as Element).visibility).toBe('hidden');
    expect(getComputedStyle(defenseBlock as Element).visibility).toBe('hidden');
    // visibility, never display: the row this block sits in keeps its height.
    expect(getComputedStyle(attackBlock as Element).display).not.toBe('none');
  });

  it('should take the colour of the line the stats row draws, and not the line', () => {
    applyHideCardStats(document);
    const rule = styleRuleFor(CARD_STATS_ROW_SELECTOR);

    expect(rule?.style.getPropertyValue('border-top-color')).toBe('transparent');
    // The border itself is never dropped: collapsing that pixel would move
    // everything the site laid out above it.
    expect(rule?.style.getPropertyValue('border-top-width')).toBe('');
    expect(rule?.style.getPropertyValue('border-top-style')).toBe('');
  });

  it('should aim that rule at the row itself and not at one of its value blocks', () => {
    applyHideCardStats(document);
    const card = document.body.querySelector('div[class*="glow-"]');
    // Reached through a utility class of the SITE, which no production
    // selector is allowed to use, precisely so this test walks a different
    // path to the node than the constant it checks: `border-t` is what draws
    // the very line at stake.
    const row = card?.querySelector('div.border-t') ?? null;
    const attackBlock = document.body.querySelector(CARD_ATTACK_VALUE_SELECTOR);

    expect(row).not.toBeNull();
    expect(row).not.toBe(attackBlock);
    // happy-dom resolves a `:has()` carrying a descendant combinator more
    // loosely than a browser does, so this pins that the row IS among the
    // nodes reached, not that nothing else is. A rule aimed at a value block
    // would leave the row out entirely, which is the mistake worth catching.
    expect([...document.body.querySelectorAll(CARD_STATS_ROW_SELECTOR)]).toContain(row);
  });

  it('should hide the big ATK/DEF panels of the detail modal as one block', () => {
    applyHideCardStats(document);
    const panels = document.body.querySelector(MODAL_ATTACK_PANELS_SELECTOR);

    expect(panels).not.toBeNull();
    // The node reached is the GRID and not one of its panels: asserted on the
    // shape it has on the page, never on the constant that selected it, or a
    // rule aimed at each panel would satisfy this test just as well and leave
    // two empty frames behind.
    expect((panels as Element).classList.contains('grid')).toBe(true);
    expect((panels as Element).querySelectorAll(':scope > div.card-frame')).toHaveLength(2);
    expect(getComputedStyle(panels as Element).display).toBe('none');
  });

  it('should reach neither panel grid when the same shape sits outside the detail modal', () => {
    // `card-frame` is a panel class of the SITE, not of the modal: it also
    // carries the header of the collection page and the tiles of the market,
    // so the same grid of panels can exist on a route with no modal at all.
    document.body.innerHTML = `
      <main>
        <div class="grid grid-cols-2 gap-3">
          <div class="card-frame"><div><svg class="lucide lucide-swords"></svg>900</div></div>
          <div class="card-frame"><div><svg class="lucide lucide-shield"></svg>700</div></div>
        </div>
      </main>
    `;
    applyHideCardStats(document);

    expect(document.body.querySelector(MODAL_ATTACK_PANELS_SELECTOR)).toBeNull();
    expect(document.body.querySelector(MODAL_DEFENSE_PANELS_SELECTOR)).toBeNull();
  });

  it('should still let scanCards read the same cards once the style is applied', () => {
    const before = scanCards(document.body).map((observed) => observed.card);
    expect(before.length).toBeGreaterThan(0);

    applyHideCardStats(document);

    expect(scanCards(document.body).map((observed) => observed.card)).toEqual(before);
  });

  it('should still let scanCards read a description-less card once the style is applied', () => {
    document.body.innerHTML = NO_DESCRIPTION_HTML;
    const before = scanCards(document.body).map((observed) => observed.card);
    expect(before.length).toBeGreaterThan(0);

    applyHideCardStats(document);

    expect(scanCards(document.body).map((observed) => observed.card)).toEqual(before);
  });
});
