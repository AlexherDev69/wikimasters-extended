import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDetailModal } from '../../card-detection/data/detail-modal';
import type { CardCategory } from '../../categorization/domain/category';
import { removeTagProposals } from './apply-tag-proposals';
import { syncTagSuggestions } from './sync-tag-suggestions';
import { TAG_INPUT_SELECTOR, TAG_PROPOSAL_BUTTON_SELECTOR, TAG_PROPOSALS_SELECTOR } from '../data/tag-selectors';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** Real sanitized export of a card the user owns, carrying one tag, "Football". */
const TAGGED_MODAL_HTML = readFileSync(
  join(FIXTURES_DIR, 'card-detail-modal-with-tag.html'),
  'utf-8',
);

/** Real sanitized export of a card the user owns, with no tag at all. */
const UNTAGGED_MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

const TAGGED_CARD_TITLE = 'Andriy Chevtchenko';
const UNTAGGED_CARD_TITLE = 'Dvorichté';

function makeCategory(title: string, suggestedTags: string[]): CardCategory {
  return {
    title,
    status: 'categorized',
    qid: 'Q1',
    categoryId: 'person',
    primarySubtype: 'sport',
    personSubtypes: ['sport'],
    letterboxdUrl: null,
    image: null,
    suggestedTags,
  };
}

function enabledCallbacks(): { isAutoFillEnabled: () => boolean } {
  return { isAutoFillEnabled: () => true };
}

function sync(categoriesByTitle: ReadonlyMap<string, CardCategory>): void {
  const modal = findDetailModal(document.body);
  syncTagSuggestions(modal, categoriesByTitle, enabledCallbacks());
}

function proposalTexts(): (string | null)[] {
  return [...document.body.querySelectorAll(TAG_PROPOSAL_BUTTON_SELECTOR)].map(
    (button) => button.textContent,
  );
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

/** The page as the site wrote it, whatever we added to it. */
function siteHtmlWithoutOurNodes(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  removeTagProposals(clone);
  return clone.innerHTML;
}

describe('syncTagSuggestions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should show the proposals not already on the card', () => {
    document.body.innerHTML = TAGGED_MODAL_HTML;
    const categories = new Map([
      [TAGGED_CARD_TITLE, makeCategory(TAGGED_CARD_TITLE, ['Personne', 'Sport', 'Footballeur', 'Football'])],
    ]);

    sync(categories);

    // "Football" is already a chip on the card, read straight from the site's
    // own remove button: it is filtered out, unlike the profession "Footballeur".
    expect(proposalTexts()).toEqual(['Personne', 'Sport', 'Footballeur']);
  });

  it('should show every proposal on a card with no tag at all', () => {
    document.body.innerHTML = UNTAGGED_MODAL_HTML;
    const categories = new Map([[UNTAGGED_CARD_TITLE, makeCategory(UNTAGGED_CARD_TITLE, ['Lieu'])]]);

    sync(categories);

    expect(proposalTexts()).toEqual(['Lieu']);
  });

  it('should show nothing for a card with no tag field at all', () => {
    document.body.innerHTML = TAGGED_MODAL_HTML;
    const input = document.body.querySelector(TAG_INPUT_SELECTOR);
    input?.parentElement?.remove();
    const categories = new Map([[TAGGED_CARD_TITLE, makeCategory(TAGGED_CARD_TITLE, ['Lieu'])]]);

    sync(categories);

    expect(document.body.querySelector(TAG_PROPOSALS_SELECTOR)).toBeNull();
  });

  it('should show nothing when the card has no known category yet', () => {
    document.body.innerHTML = UNTAGGED_MODAL_HTML;

    sync(new Map());

    expect(document.body.querySelector(TAG_PROPOSALS_SELECTOR)).toBeNull();
  });

  it('should show nothing when every suggested tag is already on the card', () => {
    document.body.innerHTML = TAGGED_MODAL_HTML;
    const categories = new Map([[TAGGED_CARD_TITLE, makeCategory(TAGGED_CARD_TITLE, ['Football'])]]);

    sync(categories);

    expect(document.body.querySelector(TAG_PROPOSALS_SELECTOR)).toBeNull();
  });

  it('should do nothing at all when no detail modal is open', () => {
    document.body.innerHTML = '<div>Pas de modale</div>';
    const observer = observeBody();

    sync(new Map([['X', makeCategory('X', ['Lieu'])]]));

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a second sync while the section already shows the right proposals', () => {
    document.body.innerHTML = UNTAGGED_MODAL_HTML;
    const categories = new Map([[UNTAGGED_CARD_TITLE, makeCategory(UNTAGGED_CARD_TITLE, ['Lieu'])]]);
    sync(categories);
    const observer = observeBody();

    sync(categories);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should modify no node of the site across repeated syncs', () => {
    document.body.innerHTML = TAGGED_MODAL_HTML;
    const siteHtml = document.body.innerHTML;
    const categories = new Map([[TAGGED_CARD_TITLE, makeCategory(TAGGED_CARD_TITLE, ['Lieu', 'Sport'])]]);

    sync(categories);
    sync(categories);

    expect(siteHtmlWithoutOurNodes()).toBe(siteHtml);
  });
});
