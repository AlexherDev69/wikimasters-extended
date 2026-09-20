import { describe, it, expect } from 'vitest';
import { findArticleImageFile, stripTrailingParenthetical } from './article-image-match';

describe('stripTrailingParenthetical', () => {
  it('should remove a trailing disambiguation parenthetical', () => {
    expect(stripTrailingParenthetical('Harry Hole (série télévisée)')).toBe('Harry Hole');
    expect(stripTrailingParenthetical('Lost River (film)')).toBe('Lost River');
  });

  it('should keep a title unchanged when it is only a parenthetical', () => {
    expect(stripTrailingParenthetical('(Homonymie)')).toBe('(Homonymie)');
  });

  it('should keep a title unchanged when it carries no parenthetical', () => {
    expect(stripTrailingParenthetical('Saint-Malo')).toBe('Saint-Malo');
  });
});

describe('findArticleImageFile', () => {
  it('should accept a file whose name, without its extension, matches exactly', () => {
    const file = findArticleImageFile('Harry Hole', ['Fichier:Autre.svg', 'Harry Hole.png']);

    expect(file).toEqual({ fileName: 'Harry Hole.png', kind: 'emblem' });
  });

  it('should refuse a file that merely contains the title', () => {
    const file = findArticleImageFile('Harry Hole', ['Harry Hole Netflix.png']);

    expect(file).toBeNull();
  });

  it('should accept a different extension of the same name', () => {
    const file = findArticleImageFile('Lost River', ['Lost River.jpg']);

    expect(file).toEqual({ fileName: 'Lost River.jpg', kind: 'picture' });
  });

  it('should refuse a name that fails isCommonsFileName even when the base name matches', () => {
    const file = findArticleImageFile('Test', ['Test.pdf', 'Test|x.jpg']);

    expect(file).toBeNull();
  });

  it('should return null when no file is used at all', () => {
    expect(findArticleImageFile('Harry Hole', [])).toBeNull();
  });

  it('should accept the title followed by a word that names the picture', () => {
    const file = findArticleImageFile('Backrooms', ['Async Logo.png', 'Backrooms Logo.png']);

    expect(file).toEqual({ fileName: 'Backrooms Logo.png', kind: 'emblem' });
  });

  it('should accept that word whatever its case', () => {
    expect(findArticleImageFile('Backrooms', ['Backrooms logo.png'])).not.toBeNull();
    expect(findArticleImageFile('Lost River', ['Lost River AFFICHE.jpg'])).not.toBeNull();
  });

  it('should refuse a word that names another subject rather than the picture', () => {
    // The trap a free prefix would fall into: this file is a portrait of
    // someone else, and it begins with the title of the article "Paris".
    expect(findArticleImageFile('Paris', ['Paris Hilton.jpg'])).toBeNull();
  });

  it('should prefer the exact name over a qualified one wherever each sits in the list', () => {
    const file = findArticleImageFile('Alpha', ['Alpha Logo.png', 'Alpha.jpg']);

    expect(file).toEqual({ fileName: 'Alpha.jpg', kind: 'picture' });
  });

  it('should treat a PNG or an SVG as an emblem and a JPG or JPEG as a picture', () => {
    expect(findArticleImageFile('X', ['X.png'])?.kind).toBe('emblem');
    expect(findArticleImageFile('X', ['X.svg'])?.kind).toBe('emblem');
    expect(findArticleImageFile('X', ['X.jpg'])?.kind).toBe('picture');
    expect(findArticleImageFile('X', ['X.jpeg'])?.kind).toBe('picture');
  });
});
