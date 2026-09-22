import { describe, it, expect } from 'vitest';
import {
  isCardImage,
  isCommonsFile,
  isCommonsFileName,
  MAX_COMMONS_FILE_NAME_LENGTH,
  type CommonsFile,
} from './card-image';

/** Real file names of Commons, taken from cards of the site. */
const REAL_FILE_NAMES: readonly string[] = [
  'Airbus A400M Atlas (ZM400) - ASCOT482 - 50038572826.jpg',
  'Logo - République française.svg',
  "The Legend of Zelda Majora's Mask Logo.png",
  'Nages, Laouzas, Rieumontagne.JPG',
  'Dharma Wheel (2).svg',
];

const VALID_FILE: CommonsFile = { fileName: 'Georges Mandel.jpg', kind: 'picture' };

/** A real answer of the frwiki API, which the card carries beside the file. */
const THUMBNAIL_URL =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Georges_Mandel.jpg/500px-Georges_Mandel.jpg';

/** Written by code point: a raw control character is invisible in a source file. */
const NUL_CHARACTER = String.fromCodePoint(0x00);
const DELETE_CHARACTER = String.fromCodePoint(0x7f);

/** Half a character each, which a string may hold and an address may not. */
const HIGH_SURROGATE = String.fromCodePoint(0xd800);
const LOW_SURROGATE = String.fromCodePoint(0xdfff);

/** A whole character outside the basic plane, which a string holds as a pair. */
const RARE_IDEOGRAPH = String.fromCodePoint(0x20bb7);

describe('isCommonsFileName', () => {
  it.each(REAL_FILE_NAMES)('should accept the real file name %s', (fileName) => {
    expect(isCommonsFileName(fileName)).toBe(true);
  });

  it('should accept every allowed extension whatever its case', () => {
    for (const extension of ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'tif', 'tiff']) {
      expect(isCommonsFileName(`Fichier.${extension}`)).toBe(true);
      expect(isCommonsFileName(`Fichier.${extension.toUpperCase()}`)).toBe(true);
    }
  });

  it('should refuse a name without an extension or with one that is not an image', () => {
    expect(isCommonsFileName('Sans extension')).toBe(false);
    expect(isCommonsFileName('Document.pdf')).toBe(false);
    expect(isCommonsFileName('Sequence.ogv')).toBe(false);
    expect(isCommonsFileName('Sequence.webm')).toBe(false);
    expect(isCommonsFileName('Fichier.jpg.exe')).toBe(false);
  });

  it('should refuse every character MediaWiki forbids in a file name', () => {
    for (const character of ['#', '<', '>', '[', ']', '|', '{', '}', ':', '/', '\\']) {
      expect(isCommonsFileName(`Fichier${character}.jpg`)).toBe(false);
    }
  });

  it('should refuse a control character', () => {
    expect(isCommonsFileName('Fichier\n.jpg')).toBe(false);
    expect(isCommonsFileName(`Fichier${NUL_CHARACTER}.jpg`)).toBe(false);
    expect(isCommonsFileName(`Fichier${DELETE_CHARACTER}.jpg`)).toBe(false);
  });

  it('should refuse a lone surrogate, which the address builder cannot encode', () => {
    expect(isCommonsFileName(`Fichier${HIGH_SURROGATE}.jpg`)).toBe(false);
    expect(isCommonsFileName(`Fichier${LOW_SURROGATE}.jpg`)).toBe(false);
  });

  it('should accept a character made of a well formed surrogate pair', () => {
    expect(isCommonsFileName(`Fichier ${RARE_IDEOGRAPH}.jpg`)).toBe(true);
  });

  it('should refuse an empty name and a name that is not trimmed', () => {
    expect(isCommonsFileName('')).toBe(false);
    expect(isCommonsFileName(' Fichier.jpg')).toBe(false);
    expect(isCommonsFileName('Fichier.jpg ')).toBe(false);
    expect(isCommonsFileName('   ')).toBe(false);
  });

  it('should refuse a name longer than the maximum', () => {
    const longest = `${'a'.repeat(MAX_COMMONS_FILE_NAME_LENGTH - 4)}.jpg`;

    expect(isCommonsFileName(longest)).toBe(true);
    expect(isCommonsFileName(`a${longest}`)).toBe(false);
  });

  it('should refuse a value that is not a string', () => {
    expect(isCommonsFileName(null)).toBe(false);
    expect(isCommonsFileName(undefined)).toBe(false);
    expect(isCommonsFileName(42)).toBe(false);
    expect(isCommonsFileName(['Fichier.jpg'])).toBe(false);
  });
});

describe('isCommonsFile', () => {
  it('should accept a file of each kind', () => {
    expect(isCommonsFile(VALID_FILE)).toBe(true);
    expect(isCommonsFile({ fileName: 'Flag of the Azores.svg', kind: 'emblem' })).toBe(true);
  });

  it('should accept a file written before the address was part of the shape', () => {
    // This is what every entry of the card facts cache holds: the file alone.
    // Asking those entries for an address would make the whole cache a miss.
    expect(isCommonsFile({ fileName: 'Georges Mandel.jpg', kind: 'picture' })).toBe(true);
  });

  it('should refuse an unknown kind', () => {
    expect(isCommonsFile({ ...VALID_FILE, kind: 'photo' })).toBe(false);
    expect(isCommonsFile({ ...VALID_FILE, kind: null })).toBe(false);
  });

  it('should refuse a file name the guard rejects', () => {
    expect(isCommonsFile({ ...VALID_FILE, fileName: 'Georges Mandel.pdf' })).toBe(false);
    expect(isCommonsFile({ ...VALID_FILE, fileName: 'Georges/Mandel.jpg' })).toBe(false);
  });

  it('should refuse a value that is not a record with both fields', () => {
    expect(isCommonsFile(null)).toBe(false);
    expect(isCommonsFile('Georges Mandel.jpg')).toBe(false);
    expect(isCommonsFile({ fileName: 'Georges Mandel.jpg' })).toBe(false);
    expect(isCommonsFile({ kind: 'picture' })).toBe(false);
    expect(isCommonsFile([VALID_FILE])).toBe(false);
  });
});

describe('isCardImage', () => {
  it('should accept an image with a resolved address and one without', () => {
    expect(isCardImage({ ...VALID_FILE, thumbnailUrl: THUMBNAIL_URL })).toBe(true);
    expect(isCardImage({ ...VALID_FILE, thumbnailUrl: null })).toBe(true);
  });

  it('should refuse an address outside the Wikimedia thumbnail hosts', () => {
    const refused = [
      'https://upload.wikimedia.org.evil.example/500px-Georges_Mandel.jpg',
      'http://upload.wikimedia.org/500px-Georges_Mandel.jpg',
      'javascript:alert(1)',
      42,
      undefined,
    ];

    for (const thumbnailUrl of refused) {
      expect(isCardImage({ ...VALID_FILE, thumbnailUrl })).toBe(false);
    }
  });

  it('should refuse an image carrying no address field at all', () => {
    expect(isCardImage(VALID_FILE)).toBe(false);
  });

  it('should refuse a file name or a kind the guard rejects', () => {
    expect(isCardImage({ ...VALID_FILE, fileName: 'Georges Mandel.pdf', thumbnailUrl: null })).toBe(
      false,
    );
    expect(isCardImage({ ...VALID_FILE, kind: 'photo', thumbnailUrl: null })).toBe(false);
  });

  it('should refuse a value that is not a record', () => {
    expect(isCardImage(null)).toBe(false);
    expect(isCardImage('Georges Mandel.jpg')).toBe(false);
    expect(isCardImage([{ ...VALID_FILE, thumbnailUrl: null }])).toBe(false);
  });
});
