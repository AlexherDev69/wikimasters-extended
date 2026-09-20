import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CategoryId } from '../../categorization/domain/category';
import type { CategoryCount } from '../domain/category-counts';
import {
  applyCategoryPanel,
  removeCategoryPanels,
  type PanelCallbacks,
  type PanelState,
} from './category-panel';
import { PANEL_SELECTOR } from './highlight-selectors';

const PERSON: CategoryCount = {
  categoryId: 'person',
  label: 'Personne',
  accentColor: '#6c90e0',
  count: 3,
};

const PLACE: CategoryCount = {
  categoryId: 'place',
  label: 'Lieu',
  accentColor: '#6ce0ac',
  count: 1,
};

function makeCallbacks(): PanelCallbacks {
  return {
    onToggleCollapsed: vi.fn(),
    onSelectCategory: vi.fn<(categoryId: CategoryId) => void>(),
    onClearCategory: vi.fn(),
  };
}

function makeState(overrides: Partial<PanelState> = {}): PanelState {
  return { counts: [PERSON, PLACE], activeCategoryId: null, collapsed: true, ...overrides };
}

function panel(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(PANEL_SELECTOR);
}

function toggle(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('.wme-panel-toggle');
}

function items(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>('.wme-panel-item')];
}

function clearButton(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('.wme-panel-clear');
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

describe('applyCategoryPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should show one collapsed button counting the categories of the page', () => {
    applyCategoryPanel(document.body, makeState(), makeCallbacks());

    expect(toggle()?.textContent).toBe('Catégories (2)');
    expect(items()).toHaveLength(0);
  });

  it('should list every category with its count once expanded', () => {
    applyCategoryPanel(document.body, makeState({ collapsed: false }), makeCallbacks());

    expect(items().map((item) => item.textContent)).toEqual(['Personne3', 'Lieu1']);
  });

  it('should colour the dot of each line with the accent of its category', () => {
    applyCategoryPanel(document.body, makeState({ collapsed: false }), makeCallbacks());

    const dots = document.body.querySelectorAll<HTMLElement>('.wme-panel-dot');
    expect([...dots].every((dot) => dot.style.backgroundColor !== '')).toBe(true);
  });

  it('should show no panel when the page has no category to list', () => {
    applyCategoryPanel(document.body, makeState({ counts: [] }), makeCallbacks());

    expect(panel()).toBeNull();
  });

  it('should take the panel back when the last card left the page', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(document.body, makeState(), callbacks);

    applyCategoryPanel(document.body, makeState({ counts: [] }), callbacks);

    expect(panel()).toBeNull();
  });

  it('should ask for the collapsed state to change when the toggle is clicked', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(document.body, makeState(), callbacks);

    toggle()?.click();

    expect(callbacks.onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('should ask for the category of the line that was clicked', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(document.body, makeState({ collapsed: false }), callbacks);

    items()[1]?.click();

    expect(callbacks.onSelectCategory).toHaveBeenCalledWith('place');
  });

  it('should mark the line of the active category as pressed', () => {
    applyCategoryPanel(
      document.body,
      makeState({ collapsed: false, activeCategoryId: 'place' }),
      makeCallbacks(),
    );

    expect(items().map((item) => item.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });

  it('should offer a way out only while a filter is active', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(document.body, makeState({ collapsed: false }), callbacks);
    expect(clearButton()).toBeNull();

    applyCategoryPanel(
      document.body,
      makeState({ collapsed: false, activeCategoryId: 'person' }),
      callbacks,
    );

    expect(clearButton()?.textContent).toBe('Tout afficher');
  });

  it('should ask for the filter to be cleared when the way out is clicked', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(
      document.body,
      makeState({ collapsed: false, activeCategoryId: 'person' }),
      callbacks,
    );

    clearButton()?.click();

    expect(callbacks.onClearCategory).toHaveBeenCalledTimes(1);
  });

  it('should hide the list but keep the way out when the panel is collapsed', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(
      document.body,
      makeState({ collapsed: false, activeCategoryId: 'person' }),
      callbacks,
    );

    applyCategoryPanel(document.body, makeState({ activeCategoryId: 'person' }), callbacks);

    expect(items()).toHaveLength(0);
    expect(clearButton()?.textContent).toBe('Tout afficher');
  });

  it('should name the active filter in the toggle, collapsed or not', () => {
    const callbacks = makeCallbacks();

    applyCategoryPanel(document.body, makeState({ activeCategoryId: 'place' }), callbacks);
    expect(toggle()?.textContent).toBe('Catégories (2) · Lieu');

    applyCategoryPanel(
      document.body,
      makeState({ collapsed: false, activeCategoryId: 'place' }),
      callbacks,
    );
    expect(toggle()?.textContent).toBe('Catégories (2) · Lieu');
  });

  it('should keep the way out below the list when the filter came first', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(document.body, makeState({ activeCategoryId: 'person' }), callbacks);

    applyCategoryPanel(
      document.body,
      makeState({ collapsed: false, activeCategoryId: 'person' }),
      callbacks,
    );

    expect(panel()?.lastElementChild).toBe(clearButton());
    expect(items()).toHaveLength(2);
  });

  it('should show a line of the active filter even when its count is zero', () => {
    const callbacks = makeCallbacks();

    applyCategoryPanel(
      document.body,
      makeState({
        collapsed: false,
        activeCategoryId: 'place',
        counts: [PERSON, { ...PLACE, count: 0 }],
      }),
      callbacks,
    );

    expect(items().map((item) => item.textContent)).toEqual(['Personne3', 'Lieu0']);
    expect(items()[1]?.getAttribute('aria-pressed')).toBe('true');
  });

  it.each([
    ['collapsed', makeState()],
    ['expanded', makeState({ collapsed: false })],
    ['filtered', makeState({ collapsed: false, activeCategoryId: 'person' })],
    ['collapsed and filtered', makeState({ activeCategoryId: 'person' })],
    [
      'filtered on a category the page lost',
      makeState({
        collapsed: false,
        activeCategoryId: 'place',
        counts: [PERSON, { ...PLACE, count: 0 }],
      }),
    ],
  ])('should write nothing on a second render of the same %s state', (_name, state) => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(document.body, state, callbacks);
    const observer = observeBody();

    applyCategoryPanel(document.body, state, callbacks);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should keep the lines in place when only the counts change', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(document.body, makeState({ collapsed: false }), callbacks);
    const before = items();

    applyCategoryPanel(
      document.body,
      makeState({ collapsed: false, counts: [{ ...PERSON, count: 9 }, PLACE] }),
      callbacks,
    );

    expect(items()).toEqual(before);
    expect(items()[0]?.textContent).toBe('Personne9');
  });

  it('should keep the same lines when a count change swaps two categories', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(document.body, makeState({ collapsed: false }), callbacks);
    const [person, place] = items();

    applyCategoryPanel(
      document.body,
      makeState({ collapsed: false, counts: [{ ...PLACE, count: 7 }, PERSON] }),
      callbacks,
    );

    expect(items()).toEqual([place, person]);
    expect(items().map((item) => item.textContent)).toEqual(['Lieu7', 'Personne3']);
  });

  it('should still answer a click on a line it moved', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(document.body, makeState({ collapsed: false }), callbacks);

    applyCategoryPanel(
      document.body,
      makeState({ collapsed: false, counts: [PLACE, PERSON] }),
      callbacks,
    );
    items()[0]?.click();

    expect(callbacks.onSelectCategory).toHaveBeenCalledWith('place');
  });

  it('should remove only the line of the category that left the page', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(document.body, makeState({ collapsed: false }), callbacks);
    const [person] = items();

    applyCategoryPanel(
      document.body,
      makeState({ collapsed: false, counts: [PERSON] }),
      callbacks,
    );

    expect(items()).toEqual([person]);
  });

  it('should insert only the line of the category that appeared', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(
      document.body,
      makeState({ collapsed: false, counts: [PERSON] }),
      callbacks,
    );
    const [person] = items();

    applyCategoryPanel(document.body, makeState({ collapsed: false }), callbacks);

    expect(items()[0]).toBe(person);
    expect(items().map((item) => item.textContent)).toEqual(['Personne3', 'Lieu1']);
  });

  it('should rebuild a line that lost its count', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(document.body, makeState({ collapsed: false }), callbacks);
    const [person] = items();
    person?.querySelector('.wme-panel-count')?.remove();

    applyCategoryPanel(document.body, makeState({ collapsed: false }), callbacks);

    expect(items()).toHaveLength(2);
    expect(items()[0]).not.toBe(person);
    expect(items().map((item) => item.textContent)).toEqual(['Personne3', 'Lieu1']);
  });

  it('should answer a click on a line it rebuilt', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(document.body, makeState({ collapsed: false }), callbacks);
    items()[0]?.querySelector('.wme-panel-label')?.remove();

    applyCategoryPanel(document.body, makeState({ collapsed: false }), callbacks);
    items()[0]?.click();

    expect(callbacks.onSelectCategory).toHaveBeenCalledWith('person');
  });

  it('should rebuild a panel whose parts were lost', () => {
    const callbacks = makeCallbacks();
    applyCategoryPanel(document.body, makeState(), callbacks);
    toggle()?.remove();

    applyCategoryPanel(document.body, makeState(), callbacks);

    expect(toggle()?.textContent).toBe('Catégories (2)');
    expect(document.body.querySelectorAll(PANEL_SELECTOR)).toHaveLength(1);
  });
});

describe('removeCategoryPanels', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should take back the panel and leave the page as it was', () => {
    document.body.innerHTML = '<div class="site">contenu</div>';
    const siteHtml = document.body.innerHTML;
    applyCategoryPanel(
      document.body,
      makeState({ collapsed: false, activeCategoryId: 'person' }),
      makeCallbacks(),
    );

    removeCategoryPanels(document.body);

    expect(panel()).toBeNull();
    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should do nothing when no panel was added', () => {
    const observer = observeBody();

    removeCategoryPanels(document.body);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
