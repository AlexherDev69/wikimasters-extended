import { describe, it, expect, beforeEach } from 'vitest';
import { findChildWithAttribute } from './find-child-with-attribute';

const ATTRIBUTE = 'data-wme-badge';

function makeParent(html: string): Element {
  document.body.innerHTML = `<div id="parent">${html}</div>`;
  const parent = document.body.querySelector('#parent');
  if (parent === null) {
    throw new Error('The parent was not created');
  }
  return parent;
}

describe('findChildWithAttribute', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should find the direct child that carries the attribute', () => {
    const parent = makeParent('<span></span><div data-wme-badge="" id="ours"></div>');

    expect(findChildWithAttribute(parent, ATTRIBUTE)?.id).toBe('ours');
  });

  it('should find it wherever it sits among the children', () => {
    const parent = makeParent('<div data-wme-badge="" id="ours"></div><span></span><span></span>');

    expect(findChildWithAttribute(parent, ATTRIBUTE)?.id).toBe('ours');
  });

  it('should ignore a descendant that is not a direct child', () => {
    const parent = makeParent('<div><div data-wme-badge="" id="deep"></div></div>');

    expect(findChildWithAttribute(parent, ATTRIBUTE)).toBeNull();
  });

  it('should return the last child when several carry the attribute', () => {
    const parent = makeParent(
      '<div data-wme-badge="" id="first"></div><div data-wme-badge="" id="last"></div>',
    );

    expect(findChildWithAttribute(parent, ATTRIBUTE)?.id).toBe('last');
  });

  it('should return nothing when no child carries the attribute', () => {
    const parent = makeParent('<span></span><div></div>');

    expect(findChildWithAttribute(parent, ATTRIBUTE)).toBeNull();
  });

  it('should return nothing when the parent has no child at all', () => {
    const parent = makeParent('');

    expect(findChildWithAttribute(parent, ATTRIBUTE)).toBeNull();
  });
});
