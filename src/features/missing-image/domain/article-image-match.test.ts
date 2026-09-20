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

  it('should treat a PNG or an SVG as an emblem and a JPG or JPEG as a picture', () => {
    expect(findArticleImageFile('X', ['X.png'])?.kind).toBe('emblem');
    expect(findArticleImageFile('X', ['X.svg'])?.kind).toBe('emblem');
    expect(findArticleImageFile('X', ['X.jpg'])?.kind).toBe('picture');
    expect(findArticleImageFile('X', ['X.jpeg'])?.kind).toBe('picture');
  });
});
