import { describe, it, expect } from 'vitest';
import { isWikimediaThumbnailUrl } from './thumbnail-url';

/** A real answer of the frwiki API, tracking parameters included. */
const REAL_THUMBNAIL_URL =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Adan_Canto.jpg/500px-Adan_Canto.jpg' +
  '?utm_source=fr.wikipedia.org&utm_campaign=imageinfo&utm_content=thumbnail';

describe('isWikimediaThumbnailUrl', () => {
  it('should accept a thumbnail on each of the two Wikimedia hosts', () => {
    expect(isWikimediaThumbnailUrl(REAL_THUMBNAIL_URL)).toBe(true);
    expect(
      isWikimediaThumbnailUrl(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Flag.svg/500px-Flag.svg.png',
      ),
    ).toBe(true);
  });

  it('should refuse an address that is not https', () => {
    expect(isWikimediaThumbnailUrl('http://upload.wikimedia.org/wikipedia/commons/a.jpg')).toBe(
      false,
    );
    expect(isWikimediaThumbnailUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(false);
    expect(isWikimediaThumbnailUrl('javascript:alert(1)')).toBe(false);
  });

  it('should refuse a look-alike host, which only a whole host comparison catches', () => {
    // Each of these ends with, starts with or contains an allowed host: a check
    // written with `endsWith`, `startsWith` or `includes` would let it through.
    const lookAlikes = [
      'https://upload.wikimedia.org.evil.example/wikipedia/commons/a.jpg',
      'https://evil.example/upload.wikimedia.org/a.jpg',
      'https://notupload.wikimedia.org/a.jpg',
      'https://thumb.wikimedia.org.evil.example/a.jpg',
      'https://upload.wikimedia.org.evil.example:443/a.jpg',
      // Another host of Wikimedia itself is not a thumbnail server either.
      'https://commons.wikimedia.org/wiki/Special:FilePath/Adan%20Canto.jpg?width=500',
    ];

    for (const lookAlike of lookAlikes) {
      expect(isWikimediaThumbnailUrl(lookAlike)).toBe(false);
    }
  });

  it('should refuse an address carrying credentials', () => {
    expect(isWikimediaThumbnailUrl('https://user:secret@upload.wikimedia.org/a.jpg')).toBe(false);
    expect(isWikimediaThumbnailUrl('https://user@thumb.wikimedia.org/a.jpg')).toBe(false);
    // The allowed host written as a user name, the real host being elsewhere.
    expect(isWikimediaThumbnailUrl('https://upload.wikimedia.org@evil.example/a.jpg')).toBe(false);
  });

  it('should refuse an address on another port of an allowed host', () => {
    expect(isWikimediaThumbnailUrl('https://upload.wikimedia.org:8443/a.jpg')).toBe(false);
  });

  it('should refuse a value that is not a URL', () => {
    expect(isWikimediaThumbnailUrl('/wikipedia/commons/a.jpg')).toBe(false);
    expect(isWikimediaThumbnailUrl('upload.wikimedia.org/a.jpg')).toBe(false);
    expect(isWikimediaThumbnailUrl('')).toBe(false);
    expect(isWikimediaThumbnailUrl(null)).toBe(false);
    expect(isWikimediaThumbnailUrl(undefined)).toBe(false);
    expect(isWikimediaThumbnailUrl(42)).toBe(false);
    expect(isWikimediaThumbnailUrl([REAL_THUMBNAIL_URL])).toBe(false);
  });
});
