import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CollectionSummary } from '../domain/collection-summary';
import { mountPopup, type PopupPorts } from './popup-app';

const PRESENTATION_DIR = dirname(fileURLToPath(import.meta.url));

const SEEN_AT = new Date('2026-02-01T12:00:00.000Z').getTime();

const SUMMARY: CollectionSummary = {
  totalCards: 3,
  uncategorizedCount: 0,
  lastSeenAt: SEEN_AT,
  catalogue: null,
  categories: [
    {
      categoryId: 'person',
      count: 2,
      subtypes: [{ subtype: 'cinema', count: 1 }],
      cards: [
        { title: 'Quentin Tarantino', rarity: 'l', primarySubtype: 'cinema' },
        { title: 'Albert Einstein', rarity: 'r', primarySubtype: 'science' },
      ],
    },
    {
      categoryId: 'place',
      count: 1,
      subtypes: [],
      cards: [{ title: 'Saint-Malo', rarity: 'c', primarySubtype: null }],
    },
  ],
  rarities: [{ rarity: 'l', count: 1 }],
};

const EMPTY_SUMMARY: CollectionSummary = {
  totalCards: 0,
  uncategorizedCount: 0,
  lastSeenAt: null,
  catalogue: null,
  categories: [],
  rarities: [],
};

function makePorts(overrides: Partial<PopupPorts> = {}): PopupPorts {
  return {
    loadSummary: (): Promise<CollectionSummary> => Promise.resolve(SUMMARY),
    clearIndex: (): Promise<void> => Promise.resolve(),
    openOptions: (): void => undefined,
    ...overrides,
  };
}

function makeContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

function click(container: HTMLElement, selector: string): void {
  container.querySelector<HTMLButtonElement>(selector)?.click();
}

describe('mountPopup', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('should show the summary of the index when the service worker answers', async () => {
    const container = makeContainer();

    mountPopup(container, makePorts());

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-total')?.textContent).toBe(
        '3 cartes vues dans ta collection',
      );
    });
    expect(container.querySelectorAll('.wme-row-main')).toHaveLength(2);
  });

  it('should explain how the index fills up when it holds no card', async () => {
    const container = makeContainer();

    mountPopup(container, makePorts({ loadSummary: () => Promise.resolve(EMPTY_SUMMARY) }));

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-message')?.textContent).toContain('Aucune carte');
    });
    expect(container.querySelector('.wme-reset')).toBeNull();
  });

  it('should show the error screen when the service worker does not answer', async () => {
    const container = makeContainer();

    mountPopup(container, makePorts({ loadSummary: () => Promise.reject(new Error('port closed')) }));

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-message')?.textContent).toContain(
        "L'index n'a pas pu être lu",
      );
    });
    expect(container.textContent).not.toContain('port closed');
  });

  it('should list the cards of a category when its row is clicked, and come back', async () => {
    const container = makeContainer();
    mountPopup(container, makePorts());
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-row-main')).not.toBeNull();
    });

    click(container, '.wme-row-main');
    expect([...container.querySelectorAll('.wme-card-link')].map((node) => node.textContent)).toEqual(
      ['Quentin Tarantino', 'Albert Einstein'],
    );

    click(container, '.wme-back');
    expect(container.querySelectorAll('.wme-row-main')).toHaveLength(2);
  });

  it('should expand and collapse the subtypes of the person row', async () => {
    const container = makeContainer();
    mountPopup(container, makePorts());
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-row-toggle')).not.toBeNull();
    });

    click(container, '.wme-row-toggle');
    expect(container.querySelector('.wme-row-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.wme-subtypes')?.textContent).toContain('Cinéma');

    click(container, '.wme-row-toggle');
    expect(container.querySelector('.wme-row-toggle')?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.wme-subtypes')).toBeNull();
  });

  it('should clear nothing when the confirmation is cancelled', async () => {
    const container = makeContainer();
    const clearIndex = vi.fn(() => Promise.resolve());
    mountPopup(container, makePorts({ clearIndex }));
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-reset')).not.toBeNull();
    });

    click(container, '.wme-reset');
    expect(container.querySelector('.wme-question')).not.toBeNull();

    click(container, '.wme-cancel');
    expect(clearIndex).not.toHaveBeenCalled();
    expect(container.querySelector('.wme-reset')).not.toBeNull();
  });

  it('should clear the index and read it again when the reset is confirmed', async () => {
    const container = makeContainer();
    const clearIndex = vi.fn(() => Promise.resolve());
    let summary: CollectionSummary = SUMMARY;
    const loadSummary = (): Promise<CollectionSummary> => Promise.resolve(summary);
    mountPopup(container, makePorts({ loadSummary, clearIndex }));
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-reset')).not.toBeNull();
    });

    click(container, '.wme-reset');
    summary = EMPTY_SUMMARY;
    click(container, '.wme-confirm');

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-message')?.textContent).toContain('Aucune carte');
    });
    expect(clearIndex).toHaveBeenCalledOnce();
  });

  it('should call the clear once when the confirmation is clicked twice in a row', async () => {
    const container = makeContainer();
    let releaseClear = (): void => {};
    const clearIndex = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseClear = resolve;
        }),
    );
    mountPopup(container, makePorts({ clearIndex }));
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-reset')).not.toBeNull();
    });

    click(container, '.wme-reset');
    click(container, '.wme-confirm');

    // The confirmation left the screen before the request went out, so there
    // is nothing left to click while it is in flight.
    expect(container.querySelector('.wme-confirm')).toBeNull();
    click(container, '.wme-confirm');
    expect(clearIndex).toHaveBeenCalledOnce();

    releaseClear();
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-reset')).not.toBeNull();
    });
  });

  it('should leave the focus alone on the first load', async () => {
    const container = makeContainer();

    mountPopup(container, makePorts());

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-row-main')).not.toBeNull();
    });
    expect(document.activeElement).toBe(document.body);
  });

  it('should focus the back control when a category is opened, and the row when coming back', async () => {
    const container = makeContainer();
    mountPopup(container, makePorts());
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-row-main')).not.toBeNull();
    });

    click(container, '.wme-row-main');
    expect(document.activeElement).toBe(container.querySelector('.wme-back'));

    click(container, '.wme-back');
    expect(document.activeElement).toBe(
      container.querySelector('.wme-row-main[data-wme-category="person"]'),
    );
  });

  it('should focus the toggle again when the subtypes are expanded', async () => {
    const container = makeContainer();
    mountPopup(container, makePorts());
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-row-toggle')).not.toBeNull();
    });

    click(container, '.wme-row-toggle');

    expect(document.activeElement).toBe(container.querySelector('.wme-row-toggle'));
    expect(container.querySelector('.wme-row-toggle')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('should focus the safe answer when the reset asks for a confirmation', async () => {
    const container = makeContainer();
    mountPopup(container, makePorts());
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-reset')).not.toBeNull();
    });

    click(container, '.wme-reset');
    expect(document.activeElement).toBe(container.querySelector('.wme-cancel'));

    click(container, '.wme-cancel');
    expect(document.activeElement).toBe(container.querySelector('.wme-reset'));
  });

  it('should show the error screen when the reset fails', async () => {
    const container = makeContainer();
    mountPopup(
      container,
      makePorts({ clearIndex: () => Promise.reject(new Error('storage down')) }),
    );
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-reset')).not.toBeNull();
    });

    click(container, '.wme-reset');
    click(container, '.wme-confirm');

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-message')?.textContent).toContain(
        "L'index n'a pas pu être lu",
      );
    });
  });

  it('should open the options page when the options control is clicked', async () => {
    const container = makeContainer();
    const openOptions = vi.fn();
    mountPopup(container, makePorts({ openOptions }));
    await vi.waitFor(() => {
      expect(container.querySelector('.wme-row-main')).not.toBeNull();
    });

    click(container, '.wme-options');

    expect(openOptions).toHaveBeenCalledOnce();
  });

  it('should offer the options page even when the index holds no card', async () => {
    const container = makeContainer();

    mountPopup(container, makePorts({ loadSummary: () => Promise.resolve(EMPTY_SUMMARY) }));

    await vi.waitFor(() => {
      expect(container.querySelector('.wme-message')?.textContent).toContain('Aucune carte');
    });
    expect(container.querySelector('.wme-options')).not.toBeNull();
  });

  it('should build every node of the popup without assigning HTML strings', () => {
    // Reading or writing the property at all, wherever it is spelled. A card
    // title comes from a page of the site, so it only ever travels as text.
    const htmlProperty = /\.innerHTML|innerHTML\s*=/;
    const sources = readdirSync(PRESENTATION_DIR).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    );

    expect(sources.length).toBeGreaterThan(0);
    for (const name of sources) {
      expect(readFileSync(join(PRESENTATION_DIR, name), 'utf-8')).not.toMatch(htmlProperty);
    }
  });
});
