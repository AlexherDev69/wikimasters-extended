import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from '../../card-detection/data/scan-cards';
import type { BadgeDescriptor } from '../domain/describe-category';
import { applyCardBadge, removeCardBadges } from './card-badge';
import { BADGE_SELECTOR, CATEGORY_ATTRIBUTE } from './badge-selectors';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** Real sanitized exports: the two card formats, and the detail modal. */
const FIXTURES = {
  grid: readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8'),
  large: readFileSync(join(FIXTURES_DIR, 'card-large-with-description.html'), 'utf-8'),
  largeNoDescription: readFileSync(join(FIXTURES_DIR, 'card-large-no-description.html'), 'utf-8'),
  modal: readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8'),
} as const;

const PERSON: BadgeDescriptor = {
  categoryId: 'person',
  label: 'Personne · Cinéma',
  accentColor: '#6c90e0',
};

const PLACE: BadgeDescriptor = {
  categoryId: 'place',
  label: 'Lieu',
  accentColor: '#6ce0ac',
};

function showFixture(html: string): HTMLElement {
  document.body.innerHTML = html;
  const [observed] = scanCards(document.body);
  if (observed === undefined) {
    throw new Error('The fixture holds no card');
  }
  return observed.element;
}

function badge(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(BADGE_SELECTOR);
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

describe('applyCardBadge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it.each(Object.keys(FIXTURES) as (keyof typeof FIXTURES)[])(
    'should add one badge as the last child of the card when the fixture is %s',
    (fixture) => {
      const cardRoot = showFixture(FIXTURES[fixture]);

      applyCardBadge(cardRoot, PERSON);

      expect(cardRoot.lastElementChild).toBe(badge());
      expect(document.body.querySelectorAll(BADGE_SELECTOR)).toHaveLength(1);
    },
  );

  it('should show the label of the category', () => {
    const cardRoot = showFixture(FIXTURES.grid);

    applyCardBadge(cardRoot, PERSON);

    expect(badge()?.textContent).toBe('Personne · Cinéma');
  });

  it('should colour the dot with the accent of the category', () => {
    const cardRoot = showFixture(FIXTURES.grid);

    applyCardBadge(cardRoot, PERSON);

    const dot = badge()?.querySelector<HTMLElement>('.wme-badge-dot');
    expect(dot?.style.backgroundColor).not.toBe('');
    expect(badge()?.getAttribute(CATEGORY_ATTRIBUTE)).toBe('person');
  });

  it('should build the badge from div and span only, so the scanner ignores it', () => {
    const cardRoot = showFixture(FIXTURES.largeNoDescription);

    applyCardBadge(cardRoot, PERSON);

    const tags = [...(badge()?.querySelectorAll('*') ?? [])].map((node) => node.tagName);
    expect(badge()?.tagName).toBe('DIV');
    expect(new Set(tags)).toEqual(new Set(['SPAN']));
  });

  it('should carry no class that the card detection could take for a card', () => {
    const cardRoot = showFixture(FIXTURES.grid);

    applyCardBadge(cardRoot, PERSON);

    const classNames = [badge(), ...(badge()?.querySelectorAll('*') ?? [])].map(
      (node) => node?.className ?? '',
    );
    expect(classNames.every((name) => !name.includes('glow-'))).toBe(true);
  });

  it.each(Object.keys(FIXTURES) as (keyof typeof FIXTURES)[])(
    'should leave the scanned card unchanged when the fixture is %s',
    (fixture) => {
      const cardRoot = showFixture(FIXTURES[fixture]);
      const before = scanCards(document.body).map((observed) => observed.card);

      applyCardBadge(cardRoot, PERSON);

      expect(scanCards(document.body).map((observed) => observed.card)).toEqual(before);
    },
  );

  it('should write nothing on a second call with the same category', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyCardBadge(cardRoot, PERSON);
    const observer = observeBody();

    applyCardBadge(cardRoot, PERSON);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing when the card has no category and carries no badge', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    const observer = observeBody();

    applyCardBadge(cardRoot, null);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should update the badge in place when the category changes', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyCardBadge(cardRoot, PERSON);
    const first = badge();

    applyCardBadge(cardRoot, PLACE);

    expect(badge()).toBe(first);
    expect(badge()?.textContent).toBe('Lieu');
    expect(badge()?.getAttribute(CATEGORY_ATTRIBUTE)).toBe('place');
    expect(document.body.querySelectorAll(BADGE_SELECTOR)).toHaveLength(1);
  });

  it('should remove the badge when the card has no category any more', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyCardBadge(cardRoot, PERSON);

    applyCardBadge(cardRoot, null);

    expect(badge()).toBeNull();
  });

  it('should rebuild a badge whose parts were lost', () => {
    const cardRoot = showFixture(FIXTURES.grid);
    applyCardBadge(cardRoot, PERSON);
    badge()?.querySelector('.wme-badge-label')?.remove();

    applyCardBadge(cardRoot, PERSON);

    expect(badge()?.textContent).toBe('Personne · Cinéma');
    expect(document.body.querySelectorAll(BADGE_SELECTOR)).toHaveLength(1);
  });

  it('should leave every node of the site untouched', () => {
    const cardRoot = showFixture(FIXTURES.large);
    const siteHtml = document.body.innerHTML;

    applyCardBadge(cardRoot, PERSON);
    applyCardBadge(cardRoot, PLACE);
    badge()?.remove();

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});

describe('removeCardBadges', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should take back every badge and leave the site as it was', () => {
    document.body.innerHTML = FIXTURES.grid + FIXTURES.large;
    const siteHtml = document.body.innerHTML;
    for (const observed of scanCards(document.body)) {
      applyCardBadge(observed.element, PERSON);
    }

    removeCardBadges(document.body);

    expect(document.body.querySelectorAll(BADGE_SELECTOR)).toHaveLength(0);
    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should do nothing when no badge was added', () => {
    showFixture(FIXTURES.grid);
    const observer = observeBody();

    removeCardBadges(document.body);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
