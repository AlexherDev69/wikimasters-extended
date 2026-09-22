import { describe, it, expect } from 'vitest';
import { commonsFilePageUrl, commonsThumbnailUrl, fileNameFromFilePathUri } from './commons-url';

/** Real values of the SPARQL answer, as the service returns them. */
const PNG_URI = 'http://commons.wikimedia.org/wiki/Special:FilePath/PQ%20logo%20complet%20grd%20bleu.png';
const SVG_URI =
  'http://commons.wikimedia.org/wiki/Special:FilePath/Logo%20-%20R%C3%A9publique%20fran%C3%A7aise.svg';

const INVALID_FILE_NAME_MESSAGE = 'Invalid Commons file name';

describe('fileNameFromFilePathUri', () => {
  it('should decode the file name of a real file path URI', () => {
    expect(fileNameFromFilePathUri(PNG_URI)).toBe('PQ logo complet grd bleu.png');
    expect(fileNameFromFilePathUri(SVG_URI)).toBe('Logo - République française.svg');
  });

  it('should accept the same URI on https', () => {
    expect(fileNameFromFilePathUri(SVG_URI.replace('http://', 'https://'))).toBe(
      'Logo - République française.svg',
    );
  });

  it('should refuse another host and a host that only looks like the right one', () => {
    expect(
      fileNameFromFilePathUri('http://evil.example/wiki/Special:FilePath/Logo.png'),
    ).toBeNull();
    expect(
      fileNameFromFilePathUri(
        'https://commons.wikimedia.org.evil.example/wiki/Special:FilePath/Logo.png',
      ),
    ).toBeNull();
    expect(
      fileNameFromFilePathUri('https://commons.wikimedia.org@evil.example/wiki/Special:FilePath/Logo.png'),
    ).toBeNull();
  });

  it('should refuse another path of the same host', () => {
    expect(fileNameFromFilePathUri('https://commons.wikimedia.org/wiki/File:Logo.png')).toBeNull();
    expect(fileNameFromFilePathUri('https://commons.wikimedia.org/w/index.php')).toBeNull();
  });

  it('should refuse a malformed percent sequence', () => {
    expect(
      fileNameFromFilePathUri('https://commons.wikimedia.org/wiki/Special:FilePath/Logo%ZZ.png'),
    ).toBeNull();
    expect(
      fileNameFromFilePathUri('https://commons.wikimedia.org/wiki/Special:FilePath/Logo%.png'),
    ).toBeNull();
  });

  it('should refuse a name that decodes to a forbidden character', () => {
    // An encoded slash would otherwise smuggle a path segment into the name.
    expect(
      fileNameFromFilePathUri(
        'https://commons.wikimedia.org/wiki/Special:FilePath/dossier%2FLogo.png',
      ),
    ).toBeNull();
  });

  it('should refuse an empty name and a name that is not an image', () => {
    expect(fileNameFromFilePathUri('https://commons.wikimedia.org/wiki/Special:FilePath/')).toBeNull();
    expect(
      fileNameFromFilePathUri('https://commons.wikimedia.org/wiki/Special:FilePath/Film.ogv'),
    ).toBeNull();
  });
});

describe('commonsThumbnailUrl', () => {
  it('should build the thumbnail address of a name holding spaces and accents', () => {
    expect(commonsThumbnailUrl('Logo - République française.svg')).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/Logo%20-%20R%C3%A9publique%20fran%C3%A7aise.svg?width=500',
    );
  });

  it('should encode the characters that would otherwise change the address', () => {
    expect(commonsThumbnailUrl('A?b&c%d.jpg')).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/A%3Fb%26c%25d.jpg?width=500',
    );
  });

  it('should refuse to build an address from an invalid name', () => {
    expect(() => commonsThumbnailUrl('Logo.pdf')).toThrow(INVALID_FILE_NAME_MESSAGE);
    expect(() => commonsThumbnailUrl('../Logo.jpg')).toThrow(INVALID_FILE_NAME_MESSAGE);
    expect(() => commonsThumbnailUrl('')).toThrow(INVALID_FILE_NAME_MESSAGE);
  });
});

describe('commonsFilePageUrl', () => {
  it('should build the file page address, where the author and the licence are', () => {
    expect(commonsFilePageUrl("The Legend of Zelda Majora's Mask Logo.png")).toBe(
      "https://commons.wikimedia.org/wiki/File:The%20Legend%20of%20Zelda%20Majora's%20Mask%20Logo.png",
    );
    expect(commonsFilePageUrl('Nages, Laouzas, Rieumontagne.JPG')).toBe(
      'https://commons.wikimedia.org/wiki/File:Nages%2C%20Laouzas%2C%20Rieumontagne.JPG',
    );
  });

  it('should refuse to build an address from an invalid name', () => {
    expect(() => commonsFilePageUrl('Logo|.png')).toThrow(INVALID_FILE_NAME_MESSAGE);
  });
});
