import { describe, it, expect, vi } from 'vitest';
import type { CategoryId } from '../../categorization/domain/category';
import type { CatalogueObservation, CatalogueTotals } from '../domain/catalogue-totals';
import type { CategorySummary, CollectionSummary } from '../domain/collection-summary';
import {
  renderEmptySummary,
  renderSummary,
  renderSummaryError,
  type SummaryCallbacks,
  type SummaryViewState,
} from './summary-view';

const SEEN_AT = new Date('2026-02-01T12:00:00.000Z').getTime();

/** The totals the catalogue page of the site announced when it was read. */
const TOTALS: CatalogueTotals = {
  l: 1761,
  ur: 12_368,
  sr: 66_788,
  r: 179_657,
  pc: 516_762,
  c: 1_996_125,
};

const CATALOGUE: CatalogueObservation = { totals: TOTALS, observedAt: SEEN_AT };

/** French formatting groups the thousands with a narrow no-break space. */
function withoutSpaces(text: string): string {
  return text.replace(/\s/g, '');
}

function makeCategory(
  categoryId: CategoryId,
  count: number,
  overrides: Partial<CategorySummary> = {},
): CategorySummary {
  return { categoryId, count, subtypes: [], cards: [], ...overrides };
}

function makeSummary(overrides: Partial<CollectionSummary> = {}): CollectionSummary {
  return {
    totalCards: 4,
    uncategorizedCount: 0,
    lastSeenAt: SEEN_AT,
    catalogue: null,
    categories: [makeCategory('film_tv', 3), makeCategory('place', 1)],
    rarities: [
      { rarity: 'l', count: 1 },
      { rarity: 'c', count: 3 },
    ],
    ...overrides,
  };
}

function makeCallbacks(): SummaryCallbacks {
  return {
    onOpenCategory: vi.fn(),
    onToggleSubtypes: vi.fn(),
    onAskReset: vi.fn(),
    onConfirmReset: vi.fn(),
    onCancelReset: vi.fn(),
  };
}

function makeState(overrides: Partial<SummaryViewState> = {}): SummaryViewState {
  return {
    summary: makeSummary(),
    subtypesExpanded: false,
    resetConfirming: false,
    ...overrides,
  };
}

function textOf(root: HTMLElement, selector: string): string {
  return root.querySelector(selector)?.textContent ?? '';
}

function textsOf(root: HTMLElement, selector: string): string[] {
  return [...root.querySelectorAll(selector)].map((node) => node.textContent ?? '');
}

describe('renderSummary', () => {
  it('should show the total, the last update and the hint when the index holds cards', () => {
    const screen = renderSummary(makeState(), makeCallbacks());

    expect(textOf(screen, '.wme-total')).toBe('4 cartes vues dans ta collection');
    expect(textOf(screen, '.wme-updated')).toContain('Dernière mise à jour');
    expect(textOf(screen, '.wme-hint')).toContain('ne navigue jamais à ta place');
  });

  it('should say one card in the singular when the index holds a single one', () => {
    const state = makeState({
      summary: makeSummary({ totalCards: 1, categories: [makeCategory('place', 1)] }),
    });

    expect(textOf(renderSummary(state, makeCallbacks()), '.wme-total')).toBe(
      '1 carte vue dans ta collection',
    );
  });

  it('should show no last update line when the index holds no sighting', () => {
    const state = makeState({ summary: makeSummary({ lastSeenAt: null }) });

    expect(renderSummary(state, makeCallbacks()).querySelector('.wme-updated')).toBeNull();
  });

  it('should show one row per category with its label, count and share', () => {
    const screen = renderSummary(makeState(), makeCallbacks());

    expect(textsOf(screen, '.wme-row-main .wme-label')).toEqual(['Cinéma et TV', 'Lieu']);
    expect(textsOf(screen, '.wme-row-main .wme-count')).toEqual(['3', '1']);
    expect(textsOf(screen, '.wme-share')).toEqual(['75 %', '25 %']);
  });

  it('should show shares that stay between zero and a hundred and add up sensibly', () => {
    const state = makeState({
      summary: makeSummary({
        totalCards: 3,
        categories: [makeCategory('film_tv', 1), makeCategory('place', 1), makeCategory('music', 1)],
      }),
    });

    const shares = textsOf(renderSummary(state, makeCallbacks()), '.wme-share').map((text) =>
      Number.parseInt(text, 10),
    );

    expect(shares.every((share) => share >= 0 && share <= 100)).toBe(true);
    expect(Math.abs(shares.reduce((total, share) => total + share, 0) - 100)).toBeLessThanOrEqual(2);
  });

  it('should show the rarity counts of the index', () => {
    const screen = renderSummary(makeState(), makeCallbacks());

    expect(textsOf(screen, '.wme-rarity-code')).toEqual(['L', 'C']);
  });

  it('should tell where to find the totals when the catalogue page was never opened', () => {
    const screen = renderSummary(makeState(), makeCallbacks());

    expect(textOf(screen, '.wme-catalogue')).toBe(
      'Ouvre la page « Toutes les cartes » du site pour afficher ta complétion par rareté.',
    );
    // The strip stays what it is today: the rarities of the index alone.
    expect(screen.querySelectorAll('.wme-rarity .wme-share')).toHaveLength(0);
  });

  it('should show one completion line per rarity of the game when the totals are known', () => {
    const state = makeState({ summary: makeSummary({ catalogue: CATALOGUE }) });

    const screen = renderSummary(state, makeCallbacks());

    expect(textsOf(screen, '.wme-rarity-code')).toEqual(['L', 'UR', 'SR', 'R', 'PC', 'C']);
  });

  it('should show the owned count against the total of the catalogue in French', () => {
    const state = makeState({
      summary: makeSummary({ catalogue: CATALOGUE, rarities: [{ rarity: 'l', count: 3 }] }),
    });

    const counts = textsOf(renderSummary(state, makeCallbacks()), '.wme-rarity .wme-count');

    expect(withoutSpaces(counts[0] ?? '')).toBe('3/1761');
    expect(counts[0]).toContain(' / ');
  });

  it('should show a share with two decimals at most, including zero and a full one', () => {
    const state = makeState({
      summary: makeSummary({
        catalogue: CATALOGUE,
        rarities: [
          { rarity: 'l', count: 3 },
          { rarity: 'ur', count: 12_368 },
        ],
      }),
    });

    const shares = textsOf(renderSummary(state, makeCallbacks()), '.wme-rarity .wme-share');

    // 3 of 1 761 legendaries, every ultra rare, and nothing of the rest.
    expect(shares[0]).toBe('0,17 %');
    expect(shares[1]).toBe('100 %');
    expect(shares[2]).toBe('0 %');
  });

  it('should show a floor rather than zero when a real share rounds down to nothing', () => {
    const state = makeState({
      summary: makeSummary({ catalogue: CATALOGUE, rarities: [{ rarity: 'c', count: 88 }] }),
    });

    const shares = textsOf(renderSummary(state, makeCallbacks()), '.wme-rarity .wme-share');

    // 88 of 1 996 125 commons is 0,004 %, which two decimals cannot show: "0 %"
    // is left to mean that not a single card of that rarity is owned.
    expect(shares[5]).toBe('< 0,01 %');
    expect(shares[0]).toBe('0 %');
  });

  it('should say when the totals were read and what the completion is computed on', () => {
    const state = makeState({ summary: makeSummary({ catalogue: CATALOGUE }) });

    const line = textOf(renderSummary(state, makeCallbacks()), '.wme-catalogue');

    expect(line).toContain('Totaux du catalogue relevés le');
    expect(line).toContain('Complétion calculée sur les cartes vues dans ta collection.');
  });

  it('should open the list of a category when its row is clicked', () => {
    const callbacks = makeCallbacks();
    const screen = renderSummary(makeState(), callbacks);

    screen.querySelector<HTMLButtonElement>('.wme-row-main')?.click();

    expect(callbacks.onOpenCategory).toHaveBeenCalledWith('film_tv');
  });

  it('should show no uncategorized row when every card is categorized', () => {
    const screen = renderSummary(makeState(), makeCallbacks());

    expect(screen.querySelector('.wme-row-static')).toBeNull();
  });

  it('should show an uncategorized row when some cards have no category', () => {
    const state = makeState({ summary: makeSummary({ uncategorizedCount: 2 }) });

    const row = renderSummary(state, makeCallbacks()).querySelector('.wme-row-static');

    expect(row?.textContent).toContain('Non catégorisées');
    expect(row?.querySelector('button')).toBeNull();
  });

  it('should show the person row collapsed with its subtypes hidden', () => {
    const person = makeCategory('person', 2, {
      subtypes: [
        { subtype: 'cinema', count: 1 },
        { subtype: 'music', count: 1 },
      ],
    });
    const state = makeState({ summary: makeSummary({ categories: [person] }) });

    const screen = renderSummary(state, makeCallbacks());

    expect(screen.querySelector('.wme-row-toggle')?.getAttribute('aria-expanded')).toBe('false');
    expect(screen.querySelector('.wme-subtypes')).toBeNull();
  });

  it('should list the subtypes of the person row when it is expanded', () => {
    const person = makeCategory('person', 2, {
      subtypes: [
        { subtype: 'cinema', count: 1 },
        { subtype: 'music', count: 1 },
      ],
    });
    const state = makeState({
      summary: makeSummary({ categories: [person] }),
      subtypesExpanded: true,
    });

    const screen = renderSummary(state, makeCallbacks());

    expect(screen.querySelector('.wme-row-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(textsOf(screen, '.wme-subtype .wme-label')).toEqual(['Cinéma', 'Musique']);
  });

  it('should close the subtype lines with the persons carrying no known trade', () => {
    const person = makeCategory('person', 5, {
      subtypes: [
        { subtype: 'cinema', count: 2 },
        { subtype: 'music', count: 1 },
      ],
    });
    const state = makeState({
      summary: makeSummary({ categories: [person] }),
      subtypesExpanded: true,
    });

    const screen = renderSummary(state, makeCallbacks());

    expect(textsOf(screen, '.wme-subtype .wme-label')).toEqual(['Cinéma', 'Musique', 'Autre']);
    expect(textsOf(screen, '.wme-subtype .wme-count')).toEqual(['2', '1', '2']);
  });

  it('should show no other line when every person has a known trade', () => {
    const person = makeCategory('person', 3, {
      subtypes: [
        { subtype: 'cinema', count: 2 },
        { subtype: 'music', count: 1 },
      ],
    });
    const state = makeState({
      summary: makeSummary({ categories: [person] }),
      subtypesExpanded: true,
    });

    expect(textsOf(renderSummary(state, makeCallbacks()), '.wme-subtype .wme-label')).toEqual([
      'Cinéma',
      'Musique',
    ]);
  });

  it('should ask to expand the subtypes when the toggle is clicked', () => {
    const callbacks = makeCallbacks();
    const person = makeCategory('person', 1, { subtypes: [{ subtype: 'cinema', count: 1 }] });
    const state = makeState({ summary: makeSummary({ categories: [person] }) });

    renderSummary(state, callbacks).querySelector<HTMLButtonElement>('.wme-row-toggle')?.click();

    expect(callbacks.onToggleSubtypes).toHaveBeenCalledOnce();
  });

  it('should show no expander on a row without subtypes', () => {
    const screen = renderSummary(makeState(), makeCallbacks());

    expect(screen.querySelector('.wme-row-toggle')).toBeNull();
  });

  it('should ask for a confirmation before the reset', () => {
    const callbacks = makeCallbacks();
    const screen = renderSummary(makeState(), callbacks);

    screen.querySelector<HTMLButtonElement>('.wme-reset')?.click();

    expect(callbacks.onAskReset).toHaveBeenCalledOnce();
    expect(callbacks.onConfirmReset).not.toHaveBeenCalled();
  });

  it('should show the question and both answers while the reset waits for a confirmation', () => {
    const callbacks = makeCallbacks();
    const screen = renderSummary(makeState({ resetConfirming: true }), callbacks);

    expect(textOf(screen, '.wme-question')).toBe("Effacer tout l'index ?");
    expect(screen.querySelector('.wme-reset')).toBeNull();

    screen.querySelector<HTMLButtonElement>('.wme-confirm')?.click();
    screen.querySelector<HTMLButtonElement>('.wme-cancel')?.click();
    expect(callbacks.onConfirmReset).toHaveBeenCalledOnce();
    expect(callbacks.onCancelReset).toHaveBeenCalledOnce();
  });
});

describe('renderEmptySummary', () => {
  it('should explain how the index fills up when no card was recorded', () => {
    const screen = renderEmptySummary();

    expect(textOf(screen, '.wme-message')).toContain('Aucune carte');
    expect(textOf(screen, '.wme-hint')).toContain('Parcours les pages de ta collection');
  });
});

describe('renderSummaryError', () => {
  it('should show a short message and nothing technical when the index cannot be read', () => {
    const screen = renderSummaryError();

    expect(textOf(screen, '.wme-message')).toBe(
      "L'index n'a pas pu être lu. Ferme et rouvre cette fenêtre pour réessayer.",
    );
    expect(screen.textContent).not.toContain('Error');
  });
});
