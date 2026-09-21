import { describe, it, expect } from 'vitest';
import { leadImageFile } from './lead-image';

describe('leadImageFile', () => {
  it('should read a photograph as a picture, which fills the image area', () => {
    expect(leadImageFile('Danny Strong June 2004.jpg')).toEqual({
      fileName: 'Danny Strong June 2004.jpg',
      kind: 'picture',
    });
  });

  it('should read a vector drawing as an emblem, which is shown whole', () => {
    // A logo, a flag or a coat of arms: never a photograph.
    expect(leadImageFile('Pulp Fiction Logo.svg')).toEqual({
      fileName: 'Pulp Fiction Logo.svg',
      kind: 'emblem',
    });
    expect(leadImageFile('Flag of the Community of Madrid.SVG')?.kind).toBe('emblem');
  });

  it('should spell the name with spaces, as every other picture of a card is spelled', () => {
    // MediaWiki writes underscores in a page property and spaces everywhere
    // else: the same file must not be remembered under two names.
    expect(leadImageFile('Albert_Einstein_Head_cleaned.jpg')?.fileName).toBe(
      'Albert Einstein Head cleaned.jpg',
    );
  });

  it('should refuse a name no thumbnail could be asked for', () => {
    expect(leadImageFile('Foo.pdf')).toBeNull();
    expect(leadImageFile('Foo.webm')).toBeNull();
    expect(leadImageFile('A#B.jpg')).toBeNull();
    expect(leadImageFile('')).toBeNull();
  });

  it('should refuse anything that is not a name at all', () => {
    // It comes from an answer of MediaWiki, read at the boundary like every
    // other value that crosses one.
    expect(leadImageFile(undefined)).toBeNull();
    expect(leadImageFile(null)).toBeNull();
    expect(leadImageFile(42)).toBeNull();
    expect(leadImageFile({ fileName: 'Foo.jpg' })).toBeNull();
  });
});
