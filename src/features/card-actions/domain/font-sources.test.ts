import { describe, it, expect } from 'vitest';
import { fontFamilyNames, sourceUrls } from './font-sources';

describe('fontFamilyNames', () => {
  it('should list every family without its quotes when the value mixes both forms', () => {
    expect(fontFamilyNames('Inter, "Inter Fallback", sans-serif')).toEqual([
      'Inter',
      'Inter Fallback',
      'sans-serif',
    ]);
  });

  it('should read single quotes the same way', () => {
    expect(fontFamilyNames("'Outfit'")).toEqual(['Outfit']);
  });

  it('should list nothing when the value is empty', () => {
    expect(fontFamilyNames('')).toEqual([]);
  });
});

describe('sourceUrls', () => {
  it('should list the address of every url of the descriptor, as written', () => {
    const src = 'url("../media/a.woff2?dpl=1") format("woff2"), url(../media/b.woff) format("woff")';

    expect(sourceUrls(src)).toEqual(['../media/a.woff2?dpl=1', '../media/b.woff']);
  });

  it('should read an address in single quotes', () => {
    expect(sourceUrls("url('/fonts/c.woff2')")).toEqual(['/fonts/c.woff2']);
  });

  it('should give no address for a font of the machine', () => {
    expect(sourceUrls('local("Arial")')).toEqual([]);
  });

  it('should give the same answer when called twice in a row', () => {
    const src = 'url("a.woff2")';

    expect(sourceUrls(src)).toEqual(sourceUrls(src));
  });
});
