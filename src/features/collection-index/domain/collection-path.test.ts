import { describe, it, expect } from 'vitest';
import { isCollectionPath } from './collection-path';

describe('isCollectionPath', () => {
  it('should accept the collection page with and without its trailing slash', () => {
    expect(isCollectionPath('/collection')).toBe(true);
    expect(isCollectionPath('/collection/')).toBe(true);
  });

  it('should reject a sub route of the collection, which may list other cards', () => {
    expect(isCollectionPath('/collection/anything')).toBe(false);
    expect(isCollectionPath('/collection/souhaits')).toBe(false);
  });

  it('should reject the pages showing cards the user does not own', () => {
    expect(isCollectionPath('/global-collection')).toBe(false);
    expect(isCollectionPath('/marketplace')).toBe(false);
    expect(isCollectionPath('/trades')).toBe(false);
    expect(isCollectionPath('/pulls')).toBe(false);
  });

  it('should reject a path that only starts like the collection one', () => {
    expect(isCollectionPath('/collections')).toBe(false);
    expect(isCollectionPath('/collection-publique')).toBe(false);
    expect(isCollectionPath('/')).toBe(false);
  });
});
