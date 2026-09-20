import { describe, it, expect, vi } from 'vitest';
import type { CategorySummary } from '../domain/collection-summary';
import { renderCategoryCards } from './category-cards-view';

function makeCategory(overrides: Partial<CategorySummary> = {}): CategorySummary {
  return {
    categoryId: 'person',
    count: 2,
    subtypes: [{ subtype: 'cinema', count: 1 }],
    cards: [
      { title: 'Quentin Tarantino', rarity: 'l', primarySubtype: 'cinema' },
      { title: "Jeu d'horreur", rarity: 'c', primarySubtype: null },
    ],
    ...overrides,
  };
}

function links(screen: HTMLElement): HTMLAnchorElement[] {
  return [...screen.querySelectorAll<HTMLAnchorElement>('.wme-card-link')];
}

describe('renderCategoryCards', () => {
  it('should show the label and the count of the category', () => {
    const screen = renderCategoryCards(makeCategory(), vi.fn());

    expect(screen.querySelector('.wme-detail-head')?.textContent).toContain('Personne');
    expect(screen.querySelector('.wme-detail-head .wme-count')?.textContent).toBe('2');
  });

  it('should list the cards in the order they were given', () => {
    const screen = renderCategoryCards(makeCategory(), vi.fn());

    expect(links(screen).map((link) => link.textContent)).toEqual([
      'Quentin Tarantino',
      "Jeu d'horreur",
    ]);
  });

  it('should link every card to its French Wikipedia article in a new tab', () => {
    const screen = renderCategoryCards(makeCategory(), vi.fn());
    const [first] = links(screen);

    expect(first?.getAttribute('href')).toBe('https://fr.wikipedia.org/wiki/Quentin_Tarantino');
    expect(first?.target).toBe('_blank');
    expect(first?.rel).toBe('noopener noreferrer');
  });

  it('should show the rarity of every card and the subtype of the persons only', () => {
    const screen = renderCategoryCards(makeCategory(), vi.fn());

    expect([...screen.querySelectorAll('.wme-chip')].map((node) => node.textContent)).toEqual([
      'L',
      'C',
    ]);
    expect(
      [...screen.querySelectorAll('.wme-card-subtype')].map((node) => node.textContent),
    ).toEqual(['Cinéma']);
  });

  it('should go back to the summary when the back control is clicked', () => {
    const onBack = vi.fn();

    renderCategoryCards(makeCategory(), onBack).querySelector<HTMLButtonElement>('.wme-back')?.click();

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('should show an empty list when the category holds no card', () => {
    const screen = renderCategoryCards(makeCategory({ count: 0, cards: [] }), vi.fn());

    expect(screen.querySelector('.wme-cards')?.childElementCount).toBe(0);
  });
});
