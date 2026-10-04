import { describe, it, expect } from 'vitest';
import { isPullsPage } from './pulls-page';

describe('isPullsPage', () => {
  it('should be true when the path is the page of the packs', () => {
    expect(isPullsPage('/pulls')).toBe(true);
  });

  it('should be true when the path carries a trailing slash', () => {
    expect(isPullsPage('/pulls/')).toBe(true);
  });

  it('should be false when the path is another page of the site', () => {
    expect(isPullsPage('/collection')).toBe(false);
    expect(isPullsPage('/')).toBe(false);
  });

  it('should be false when the path only starts like the page of the packs', () => {
    expect(isPullsPage('/pulls-history')).toBe(false);
    expect(isPullsPage('/pulls/42')).toBe(false);
  });
});
