import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDetailModal, type DetailModal } from '../../card-detection/data/detail-modal';
import { findTagSection } from './find-tag-section';
import { TAG_INPUT_SELECTOR } from './tag-selectors';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** Real sanitized export of a card the user owns, carrying one tag, "Football". */
const TAGGED_MODAL_HTML = readFileSync(
  join(FIXTURES_DIR, 'card-detail-modal-with-tag.html'),
  'utf-8',
);

/** Real sanitized export of a card the user owns, with no tag at all: the chips container is absent. */
const UNTAGGED_MODAL_HTML = readFileSync(join(FIXTURES_DIR, 'card-detail-modal.html'), 'utf-8');

function openModal(html: string): DetailModal {
  document.body.innerHTML = html;
  const modal = findDetailModal(document.body);
  if (modal === null) {
    throw new Error('The fixture modal was not found');
  }
  return modal;
}

/**
 * A card with no tag field at all, built in memory from the tagged fixture:
 * the input is removed from the live document, never from the fixture file.
 */
function openModalWithoutTagField(): DetailModal {
  const modal = openModal(TAGGED_MODAL_HTML);
  const input = document.body.querySelector(TAG_INPUT_SELECTOR);
  if (input === null) {
    throw new Error('The fixture input was not found');
  }
  // The whole wrapper is removed, exactly as a card the user does not own
  // never renders it at all, rather than just its combobox role or placeholder.
  input.parentElement?.remove();
  return modal;
}

describe('findTagSection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should find the section and the one tag already on a card carrying one', () => {
    const modal = openModal(TAGGED_MODAL_HTML);

    const section = findTagSection(modal);

    expect(section).not.toBeNull();
    expect(section?.tags).toEqual(['Football']);
    expect(section?.input.getAttribute('placeholder')).toBe('Ajouter une étiquette…');
  });

  it('should find the section with an empty tag list on a card with no tag', () => {
    const modal = openModal(UNTAGGED_MODAL_HTML);

    const section = findTagSection(modal);

    expect(section).not.toBeNull();
    expect(section?.tags).toEqual([]);
  });

  it('should return null for a card with no tag field at all', () => {
    const modal = openModalWithoutTagField();

    expect(findTagSection(modal)).toBeNull();
  });

  it('should never mistake the favourite button for a tag removal button', () => {
    // The favourite button of the tagged fixture carries
    // aria-label="Retirer des favoris", which starts with the bare word
    // "Retirer" but not with the full prefix this reader requires.
    const modal = openModal(TAGGED_MODAL_HTML);

    const section = findTagSection(modal);

    expect(section?.tags).not.toContain('des favoris');
    expect(section?.tags).toEqual(['Football']);
  });

  it('should choose the tag field and not another combobox placed before it', () => {
    // This selector decides where a tag is eventually WRITTEN, so the
    // placeholder prefix that narrows it is held here: without it, any
    // combobox the site adds higher in the modal becomes the target.
    const modal = openModal(TAGGED_MODAL_HTML);
    const decoy = document.createElement('input');
    decoy.setAttribute('role', 'combobox');
    decoy.setAttribute('placeholder', 'Rechercher une carte');
    modal.root.insertBefore(decoy, modal.root.firstChild);

    const section = findTagSection(modal);

    expect(section?.input).not.toBe(decoy);
    expect(section?.input.getAttribute('placeholder')).toBe('Ajouter une étiquette…');
  });

  it('should return null when the only combobox of the modal is for something else', () => {
    const modal = openModalWithoutTagField();
    const decoy = document.createElement('input');
    decoy.setAttribute('role', 'combobox');
    decoy.setAttribute('placeholder', 'Rechercher une carte');
    modal.root.appendChild(decoy);

    expect(findTagSection(modal)).toBeNull();
  });

  it('should return the input wrapper as the parent of the input', () => {
    const modal = openModal(TAGGED_MODAL_HTML);

    const section = findTagSection(modal);

    expect(section?.inputWrapper.contains(section.input)).toBe(true);
    expect(section?.inputWrapper.parentElement).toBe(section?.root);
  });

  it('should fall back to the chip text when the label does not start with the expected prefix', () => {
    const modal = openModal(TAGGED_MODAL_HTML);
    const button = document.body.querySelector('button[aria-label^="Retirer l\'étiquette"]');
    if (button === null) {
      throw new Error('The fixture remove button was not found');
    }
    button.setAttribute('aria-label', 'Supprimer');

    const section = findTagSection(modal);

    expect(section?.tags).toEqual(['Football']);
  });

  it('should skip a chip whose tag cannot be read at all', () => {
    const modal = openModal(TAGGED_MODAL_HTML);
    const chip = document.body.querySelector('.flex-wrap > span');
    if (chip === null) {
      throw new Error('The fixture chip was not found');
    }
    chip.textContent = '';
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Supprimer');
    chip.appendChild(button);

    const section = findTagSection(modal);

    expect(section?.tags).toEqual([]);
  });
});
