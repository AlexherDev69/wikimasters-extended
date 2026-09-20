import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCard } from './extract-card';

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../tests/fixtures',
);

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

function cardRootFromHtml(html: string): HTMLElement {
  document.body.innerHTML = html;
  const el = document.body.querySelector<HTMLElement>('[class*="glow-"]');
  if (el === null) {
    throw new Error('No card root found in fixture HTML');
  }
  return el;
}

describe('extractCard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should extract card data from card-grid-with-description fixture', () => {
    const el = cardRootFromHtml(readFixture('card-grid-with-description.html'));
    const result = extractCard(el);
    expect(result).toEqual({
      title: "Jeu d'horreur",
      description: 'genre de jeu vidéo',
      rarity: 'pc',
    });
  });

  it('should extract card data from card-large-with-description fixture', () => {
    const el = cardRootFromHtml(readFixture('card-large-with-description.html'));
    const result = extractCard(el);
    expect(result).toEqual({
      title: 'Foza',
      description: 'commune italienne',
      rarity: 'c',
    });
  });

  it('should extract card data from card-large-no-description fixture', () => {
    const el = cardRootFromHtml(readFixture('card-large-no-description.html'));
    const result = extractCard(el);
    expect(result).toEqual({
      title: 'Dvorichté',
      description: null,
      rarity: 'c',
    });
  });

  it('should extract card data from the card inside card-detail-modal fixture', () => {
    const el = cardRootFromHtml(readFixture('card-detail-modal.html'));
    const result = extractCard(el);
    // The modal has its own paragraphs (Q-Score, copies, views) outside the card
    // root: a null description proves the selector does not reach them.
    expect(result).toEqual({
      title: 'Dvorichté',
      description: null,
      rarity: 'c',
    });
  });

  it('should normalize whitespace when the title spans several lines', () => {
    document.body.innerHTML = '<div class="glow-r"><h3>  Titre\n  sur\n  plusieurs lignes  </h3></div>';
    const el = document.body.querySelector<HTMLElement>('[class*="glow-"]');
    expect(el).not.toBeNull();
    const result = extractCard(el as HTMLElement);
    expect(result?.title).toBe('Titre sur plusieurs lignes');
  });

  it('should return null when the element has no rarity class', () => {
    document.body.innerHTML = '<div class="rounded-2xl"><h3>Title</h3></div>';
    const el = document.body.querySelector<HTMLElement>('div');
    expect(el).not.toBeNull();
    expect(extractCard(el as HTMLElement)).toBeNull();
  });

  it('should return null when the title is empty', () => {
    document.body.innerHTML = '<div class="glow-c"><h3>   </h3></div>';
    const el = document.body.querySelector<HTMLElement>('[class*="glow-"]');
    expect(el).not.toBeNull();
    expect(extractCard(el as HTMLElement)).toBeNull();
  });

  it('should return a null description when the paragraph is empty', () => {
    document.body.innerHTML = '<div class="glow-c"><h3>Title</h3><p>   </p></div>';
    const el = document.body.querySelector<HTMLElement>('[class*="glow-"]');
    expect(el).not.toBeNull();
    const result = extractCard(el as HTMLElement);
    expect(result?.description).toBeNull();
  });
});
