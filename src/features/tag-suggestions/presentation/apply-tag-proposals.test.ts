import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDetailModal } from '../../card-detection/data/detail-modal';
import { findTagSection, type TagSection } from '../data/find-tag-section';
import {
  applyTagProposals,
  findTagProposalsTarget,
  removeTagProposals,
  type TagProposalsCallbacks,
  type TagProposalsTarget,
} from './apply-tag-proposals';
import { TAG_ATTRIBUTE, TAG_PROPOSAL_BUTTON_SELECTOR, TAG_PROPOSALS_SELECTOR } from '../data/tag-selectors';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** Real sanitized export of a card the user owns, with no tag at all. */
const UNTAGGED_MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

const TITLE = 'Dvorichté';
const OTHER_TITLE = 'Autre carte';
const TAGS = ['Lieu', 'Astronomie'];

function openSection(): TagSection {
  document.body.innerHTML = UNTAGGED_MODAL_HTML;
  const modal = findDetailModal(document.body);
  if (modal === null) {
    throw new Error('The fixture modal was not found');
  }
  const section = findTagSection(modal);
  if (section === null) {
    throw new Error('The fixture tag section was not found');
  }
  return section;
}

function target(section: TagSection, title: string | null = TITLE): TagProposalsTarget {
  return findTagProposalsTarget(title, section);
}

function enabledCallbacks(): TagProposalsCallbacks {
  return { isAutoFillEnabled: () => true };
}

function disabledCallbacks(): TagProposalsCallbacks {
  return { isAutoFillEnabled: () => false };
}

function ourNode(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(TAG_PROPOSALS_SELECTOR);
}

function buttons(): HTMLButtonElement[] {
  return [...document.body.querySelectorAll<HTMLButtonElement>(TAG_PROPOSAL_BUTTON_SELECTOR)];
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

/** A click dispatched the way the user does: `isTrusted` is set by the browser. */
function dispatchTrustedClick(element: Element): void {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'isTrusted', { value: true });
  element.dispatchEvent(event);
}

/** A click as a script would raise it: `isTrusted` is false, as it always is for us too. */
function dispatchUntrustedClick(element: Element): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('applyTagProposals', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should insert one node with one button per proposal right after the input wrapper', () => {
    const section = openSection();

    applyTagProposals(target(section), TAGS, enabledCallbacks());

    expect(section.inputWrapper.nextElementSibling).toBe(ourNode());
    expect(buttons()).toHaveLength(TAGS.length);
    expect(buttons().map((button) => button.getAttribute(TAG_ATTRIBUTE))).toEqual(TAGS);
  });

  it('should carry a French aria-label naming the tag', () => {
    const section = openSection();

    applyTagProposals(target(section), ['Lieu'], enabledCallbacks());

    expect(buttons()[0]?.getAttribute('aria-label')).toBe("Ajouter l'étiquette Lieu");
  });

  it('should build the node from div, span and button only', () => {
    const section = openSection();

    applyTagProposals(target(section), TAGS, enabledCallbacks());

    const node = ourNode();
    if (node === null) {
      throw new Error('The proposals node was not built');
    }
    const tagNames = [node, ...node.querySelectorAll('*')].map((element) => element.tagName);
    expect([...new Set(tagNames)].sort()).toEqual(['BUTTON', 'DIV', 'SPAN']);
  });

  it('should remove the node entirely when there is nothing left to propose', () => {
    const section = openSection();
    applyTagProposals(target(section), TAGS, enabledCallbacks());

    applyTagProposals(target(section), [], enabledCallbacks());

    expect(ourNode()).toBeNull();
  });

  it('should do nothing when there was no node and nothing to propose', () => {
    const section = openSection();
    const observer = observeBody();

    applyTagProposals(target(section), [], enabledCallbacks());

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a second call with the same title and the same tags', () => {
    const section = openSection();
    applyTagProposals(target(section), TAGS, enabledCallbacks());
    const observer = observeBody();

    applyTagProposals(target(section), TAGS, enabledCallbacks());

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should rebuild the node when the tags change', () => {
    const section = openSection();
    applyTagProposals(target(section), TAGS, enabledCallbacks());
    const first = ourNode();

    applyTagProposals(target(section), ['Sport'], enabledCallbacks());

    expect(ourNode()).not.toBe(first);
    expect(buttons().map((button) => button.getAttribute(TAG_ATTRIBUTE))).toEqual(['Sport']);
  });

  it('should rebuild the node when the title changes even though the tags stay the same', () => {
    // The site can swap the modal to another card whose remaining proposals
    // happen to be identical strings: the button click handlers still have to
    // be rebuilt so they close over the fresh input of the new card.
    const section = openSection();
    applyTagProposals(target(section, TITLE), TAGS, enabledCallbacks());
    const first = ourNode();

    applyTagProposals(target(section, OTHER_TITLE), TAGS, enabledCallbacks());

    expect(ourNode()).not.toBe(first);
  });

  it('should rebuild the node when the site swaps the input while the card and the tags stay the same', () => {
    // A re-render of the site replaces the field without the title or the
    // proposals changing. The key alone cannot see it, and the buttons would
    // go on writing into a field that is no longer on the page.
    const section = openSection();
    applyTagProposals(target(section), ['Lieu'], enabledCallbacks());
    const replacement = section.input.cloneNode(true) as HTMLInputElement;
    section.input.replaceWith(replacement);
    const refreshed = { ...section, input: replacement };

    applyTagProposals(findTagProposalsTarget(TITLE, refreshed), ['Lieu'], enabledCallbacks());
    dispatchTrustedClick(buttons()[0] as HTMLButtonElement);

    expect(replacement.value).toBe('Lieu');
  });

  it('should never be moved once inserted', () => {
    const section = openSection();
    applyTagProposals(target(section), TAGS, enabledCallbacks());
    const first = ourNode();

    applyTagProposals(target(section), [...TAGS, 'Autre'], enabledCallbacks());

    expect(section.inputWrapper.nextElementSibling).toBe(ourNode());
    // Rebuilt, not the same node, but always in the very same position.
    expect(ourNode()).not.toBe(first);
  });

  it('should write the tag into the site field on a trusted click while auto-fill is on', () => {
    const section = openSection();
    applyTagProposals(target(section), ['Lieu'], enabledCallbacks());

    dispatchTrustedClick(buttons()[0] as HTMLButtonElement);

    expect(section.input.value).toBe('Lieu');
  });

  it('should only select the text of the proposal on a trusted click while auto-fill is off', () => {
    const section = openSection();
    applyTagProposals(target(section), ['Lieu'], disabledCallbacks());

    dispatchTrustedClick(buttons()[0] as HTMLButtonElement);

    expect(section.input.value).toBe('');
    expect(document.getSelection()?.toString()).toBe('Lieu');
  });

  it('should do nothing on an untrusted click, whatever the setting says', () => {
    const section = openSection();
    applyTagProposals(target(section), ['Lieu'], enabledCallbacks());

    dispatchUntrustedClick(buttons()[0] as HTMLButtonElement);

    expect(section.input.value).toBe('');
  });

  it('should not even select the text on an untrusted click while auto-fill is off', () => {
    // The other branch of the same handler: with auto-fill off a click
    // selects the text of our button, and a synthetic click must not reach
    // that either, or the guard of the handler would be held by nothing but
    // the second guard inside the fill module.
    const section = openSection();
    applyTagProposals(target(section), ['Lieu'], disabledCallbacks());
    document.getSelection()?.removeAllRanges();

    dispatchUntrustedClick(buttons()[0] as HTMLButtonElement);

    expect(document.getSelection()?.toString()).toBe('');
  });

  it('should ask the setting again at every click rather than the value read when the button was built', () => {
    const section = openSection();
    let autoFillOn = false;
    applyTagProposals(target(section), ['Lieu'], { isAutoFillEnabled: () => autoFillOn });
    const button = buttons()[0] as HTMLButtonElement;

    dispatchTrustedClick(button);
    expect(section.input.value).toBe('');

    autoFillOn = true;
    dispatchTrustedClick(button);
    expect(section.input.value).toBe('Lieu');
  });

  it('should leave every node of the site untouched', () => {
    const section = openSection();
    const siteHtml = document.body.innerHTML;

    applyTagProposals(target(section), TAGS, enabledCallbacks());
    applyTagProposals(target(section), ['Sport'], enabledCallbacks());
    removeTagProposals(document.body);

    expect(document.body.innerHTML).toBe(siteHtml);
  });
});

describe('removeTagProposals', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should take back the node and leave the site as it was', () => {
    const section = openSection();
    const siteHtml = document.body.innerHTML;
    applyTagProposals(target(section), TAGS, enabledCallbacks());

    removeTagProposals(document.body);

    expect(ourNode()).toBeNull();
    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should do nothing when no node was added', () => {
    openSection();
    const observer = observeBody();

    removeTagProposals(document.body);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
