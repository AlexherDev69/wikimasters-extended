import { describe, it, expect } from 'vitest';
import { frwikiArticleUrl, isFrwikiArticleUrl } from './article-url';

describe('frwikiArticleUrl', () => {
  it('should build the address of the article the card stands for', () => {
    expect(frwikiArticleUrl('Pulp Fiction')).toBe('https://fr.wikipedia.org/wiki/Pulp_Fiction');
  });

  it('should write the spaces of a title the way MediaWiki writes them', () => {
    expect(frwikiArticleUrl('Saison 1 de Severance')).toBe(
      'https://fr.wikipedia.org/wiki/Saison_1_de_Severance',
    );
  });

  it('should encode a title carrying an accent or a parenthesis', () => {
    expect(frwikiArticleUrl('Dvorichté')).toBe('https://fr.wikipedia.org/wiki/Dvoricht%C3%A9');
    expect(frwikiArticleUrl('The Backrooms (film, 2022)')).toBe(
      'https://fr.wikipedia.org/wiki/The_Backrooms_(film%2C_2022)',
    );
  });

  it('should encode the characters that would otherwise change the address', () => {
    // A hash would cut the title short and land on the wrong article, a
    // question mark would turn the rest into a query, and a slash would move
    // the address to another path.
    expect(frwikiArticleUrl('A#B')).toBe('https://fr.wikipedia.org/wiki/A%23B');
    expect(frwikiArticleUrl('A?B')).toBe('https://fr.wikipedia.org/wiki/A%3FB');
    expect(frwikiArticleUrl('A/B')).toBe('https://fr.wikipedia.org/wiki/A%2FB');
  });

  it('should trim a title the site padded with spaces', () => {
    expect(frwikiArticleUrl('  Foza  ')).toBe('https://fr.wikipedia.org/wiki/Foza');
  });

  it('should return no address for a title no article can bear', () => {
    expect(frwikiArticleUrl('')).toBeNull();
    expect(frwikiArticleUrl('   ')).toBeNull();
    expect(frwikiArticleUrl('a'.repeat(301))).toBeNull();
  });

  it('should build an address of the article space for every title it accepts', () => {
    const titles = ['Pulp Fiction', 'Dvorichté', 'A#B', 'javascript:alert(1)', '//evil.example'];

    for (const title of titles) {
      expect(isFrwikiArticleUrl(frwikiArticleUrl(title))).toBe(true);
    }
  });
});

describe('isFrwikiArticleUrl', () => {
  it('should accept an address of the article space of frwiki', () => {
    expect(isFrwikiArticleUrl('https://fr.wikipedia.org/wiki/Pulp_Fiction')).toBe(true);
  });

  it('should refuse an address on another origin, another path or another scheme', () => {
    const refused = [
      'https://fr.wikipedia.org.evil.example/wiki/Pulp_Fiction',
      'https://en.wikipedia.org/wiki/Pulp_Fiction',
      'http://fr.wikipedia.org/wiki/Pulp_Fiction',
      'https://fr.wikipedia.org/w/index.php?title=Pulp_Fiction&action=edit',
      'javascript:alert(1)',
      '/wiki/Pulp_Fiction',
      42,
      null,
      undefined,
    ];

    for (const value of refused) {
      expect(isFrwikiArticleUrl(value)).toBe(false);
    }
  });
});
