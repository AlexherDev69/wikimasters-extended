import { describe, it, expect } from 'vitest';
import { isCompactPage } from './compact-page';

describe('isCompactPage', () => {
  it('should offer the view on the collection of the user', () => {
    expect(isCompactPage('/collection')).toBe(true);
  });

  it('should offer the view on the catalogue of every card', () => {
    expect(isCompactPage('/global-collection')).toBe(true);
  });

  it('should ignore a trailing slash the site may write', () => {
    expect(isCompactPage('/collection/')).toBe(true);
  });

  it('should not offer the view on the marketplace, whose cards sit in a tile of their own', () => {
    expect(isCompactPage('/marketplace')).toBe(false);
  });

  it('should not offer the view on the other pages of the site', () => {
    expect(isCompactPage('/pulls')).toBe(false);
    expect(isCompactPage('/trades')).toBe(false);
    expect(isCompactPage('/')).toBe(false);
  });

  it('should not offer the view on a path that merely starts like one of them', () => {
    expect(isCompactPage('/collection-of-someone-else')).toBe(false);
  });
});
