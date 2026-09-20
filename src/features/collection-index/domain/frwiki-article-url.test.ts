import { describe, it, expect } from 'vitest';
import { frwikiArticleUrl } from './frwiki-article-url';

describe('frwikiArticleUrl', () => {
  it('should replace the spaces with underscores when the title holds several words', () => {
    expect(frwikiArticleUrl('Albert Einstein')).toBe('https://fr.wikipedia.org/wiki/Albert_Einstein');
  });

  it('should keep an apostrophe and parentheses readable when the title holds them', () => {
    expect(frwikiArticleUrl("Jeu d'horreur")).toBe("https://fr.wikipedia.org/wiki/Jeu_d'horreur");
    // The comma is encoded, the parentheses and the apostrophe are not: this
    // is what MediaWiki itself writes in its links.
    expect(frwikiArticleUrl('Paprika (film, 2006)')).toBe(
      'https://fr.wikipedia.org/wiki/Paprika_(film%2C_2006)',
    );
  });

  it('should encode an accent and a colon when the title holds them', () => {
    expect(frwikiArticleUrl('Évènement')).toBe('https://fr.wikipedia.org/wiki/%C3%89v%C3%A8nement');
    expect(frwikiArticleUrl('Star Wars: Episode IV')).toBe(
      'https://fr.wikipedia.org/wiki/Star_Wars%3A_Episode_IV',
    );
  });

  it('should encode a slash so no title can reach another path', () => {
    expect(frwikiArticleUrl('a/b')).toBe('https://fr.wikipedia.org/wiki/a%2Fb');
  });
});
