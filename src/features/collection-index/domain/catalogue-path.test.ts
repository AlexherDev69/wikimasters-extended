import { describe, it, expect } from 'vitest';
import { isCataloguePath } from './catalogue-path';

describe('isCataloguePath', () => {
  it('should accept the catalogue page with and without its trailing slash', () => {
    expect(isCataloguePath('/global-collection')).toBe(true);
    expect(isCataloguePath('/global-collection/')).toBe(true);
  });

  it('should reject a sub route of the catalogue, which may show other totals', () => {
    expect(isCataloguePath('/global-collection/anything')).toBe(false);
    expect(isCataloguePath('/global-collection/l')).toBe(false);
  });

  it('should reject the other pages of the site', () => {
    expect(isCataloguePath('/collection')).toBe(false);
    expect(isCataloguePath('/marketplace')).toBe(false);
    expect(isCataloguePath('/trades')).toBe(false);
    expect(isCataloguePath('/pulls')).toBe(false);
  });

  it('should reject a path that only starts or ends like the catalogue one', () => {
    expect(isCataloguePath('/global-collections')).toBe(false);
    expect(isCataloguePath('/my-global-collection')).toBe(false);
    expect(isCataloguePath('/')).toBe(false);
  });
});
