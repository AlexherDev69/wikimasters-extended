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
    const file = findArticleImageFile('Harry Hole', ['Fichier:Autre.svg', 'Harry Hole.png'], null);

    expect(file).toEqual({ fileName: 'Harry Hole.png', kind: 'emblem' });
  });

  it('should refuse a file that merely contains the title', () => {
    const file = findArticleImageFile('Harry Hole', ['Harry Hole Netflix.png'], null);

    expect(file).toBeNull();
  });

  it('should accept a different extension of the same name', () => {
    const file = findArticleImageFile('Lost River', ['Lost River.jpg'], null);

    expect(file).toEqual({ fileName: 'Lost River.jpg', kind: 'picture' });
  });

  it('should refuse a name that fails isCommonsFileName even when the base name matches', () => {
    const file = findArticleImageFile('Test', ['Test.pdf', 'Test|x.jpg'], null);

    expect(file).toBeNull();
  });

  it('should accept the lead picture of the article when no file carries its title', () => {
    // Real, measured 2026-09-21: the article names no file after itself.
    const file = findArticleImageFile(
      'Discographie de Janet Jackson',
      ['Flag of France (lighter variant).svg', 'Janet Jackson Number Ones Tour 2011 (cropped).jpeg'],
      'Janet Jackson Number Ones Tour 2011 (cropped).jpeg',
    );

    expect(file).toEqual({
      fileName: 'Janet Jackson Number Ones Tour 2011 (cropped).jpeg',
      kind: 'picture',
    });
  });

  it('should prefer the file named after the article over the lead picture', () => {
    const file = findArticleImageFile('Lost River', ['Autre.jpg', 'Lost River.jpg'], 'Autre.jpg');

    expect(file?.fileName).toBe('Lost River.jpg');
  });

  it('should prefer a qualified name over the lead picture', () => {
    const file = findArticleImageFile('Backrooms', ['Autre.jpg', 'Backrooms Logo.png'], 'Autre.jpg');

    expect(file?.fileName).toBe('Backrooms Logo.png');
  });

  it('should refuse a lead picture the file list does not hold', () => {
    // The shape of a cut answer: the lead name says nothing about a list
    // that never came back whole.
    const file = findArticleImageFile('Monocyte', ['Autre.jpg'], 'Blausen 0649 Monocyte.png');

    expect(file).toBeNull();
  });

  it('should refuse a lead picture that is not a usable Commons file', () => {
    const file = findArticleImageFile('Test', ['Test.pdf'], 'Test.pdf');

    expect(file).toBeNull();
  });

  it('should return null when no file is used at all', () => {
    expect(findArticleImageFile('Harry Hole', [], null)).toBeNull();
  });

  it('should accept the title followed by a word that names the picture', () => {
    const file = findArticleImageFile('Backrooms', ['Async Logo.png', 'Backrooms Logo.png'], null);

    expect(file).toEqual({ fileName: 'Backrooms Logo.png', kind: 'emblem' });
  });

  it('should accept that word whatever its case', () => {
    expect(findArticleImageFile('Backrooms', ['Backrooms logo.png'], null)).not.toBeNull();
    expect(findArticleImageFile('Lost River', ['Lost River AFFICHE.jpg'], null)).not.toBeNull();
  });

  it('should refuse a word that names another subject rather than the picture', () => {
    // The trap a free prefix would fall into: this file is a portrait of
    // someone else, and it begins with the title of the article "Paris".
    expect(findArticleImageFile('Paris', ['Paris Hilton.jpg'], null)).toBeNull();
  });

  it('should prefer the exact name over a qualified one wherever each sits in the list', () => {
    const file = findArticleImageFile('Alpha', ['Alpha Logo.png', 'Alpha.jpg'], null);

    expect(file).toEqual({ fileName: 'Alpha.jpg', kind: 'picture' });
  });

  it('should treat a PNG or an SVG as an emblem and a JPG or JPEG as a picture', () => {
    expect(findArticleImageFile('X', ['X.png'], null)?.kind).toBe('emblem');
    expect(findArticleImageFile('X', ['X.svg'], null)?.kind).toBe('emblem');
    expect(findArticleImageFile('X', ['X.jpg'], null)?.kind).toBe('picture');
    expect(findArticleImageFile('X', ['X.jpeg'], null)?.kind).toBe('picture');
  });
});
