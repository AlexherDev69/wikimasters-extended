import { describe, it, expect } from 'vitest';
import {
  isCardImage,
  isCommonsFileName,
  MAX_COMMONS_FILE_NAME_LENGTH,
  type CardImage,
} from './card-image';

/** Real file names of Commons, taken from cards of the site. */
const REAL_FILE_NAMES: readonly string[] = [
  'Airbus A400M Atlas (ZM400) - ASCOT482 - 50038572826.jpg',
  'Logo - République française.svg',
  "The Legend of Zelda Majora's Mask Logo.png",
  'Nages, Laouzas, Rieumontagne.JPG',
  'Dharma Wheel (2).svg',
];

const VALID_IMAGE: CardImage = { fileName: 'Georges Mandel.jpg', kind: 'picture' };

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

describe('isCardImage', () => {
  it('should accept an image of each kind', () => {
    expect(isCardImage(VALID_IMAGE)).toBe(true);
    expect(isCardImage({ fileName: 'Flag of the Azores.svg', kind: 'emblem' })).toBe(true);
  });

  it('should refuse an unknown kind', () => {
    expect(isCardImage({ ...VALID_IMAGE, kind: 'photo' })).toBe(false);
    expect(isCardImage({ ...VALID_IMAGE, kind: null })).toBe(false);
  });

  it('should refuse a file name the guard rejects', () => {
    expect(isCardImage({ ...VALID_IMAGE, fileName: 'Georges Mandel.pdf' })).toBe(false);
    expect(isCardImage({ ...VALID_IMAGE, fileName: 'Georges/Mandel.jpg' })).toBe(false);
  });

  it('should refuse a value that is not a record with both fields', () => {
    expect(isCardImage(null)).toBe(false);
    expect(isCardImage('Georges Mandel.jpg')).toBe(false);
    expect(isCardImage({ fileName: 'Georges Mandel.jpg' })).toBe(false);
    expect(isCardImage({ kind: 'picture' })).toBe(false);
    expect(isCardImage([VALID_IMAGE])).toBe(false);
  });
});
