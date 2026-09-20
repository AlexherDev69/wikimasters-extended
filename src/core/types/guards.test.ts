import { describe, it, expect } from 'vitest';
import { isNullableString, isRecord, isStringArray } from './guards';

describe('isRecord', () => {
  it('should accept a plain object', () => {
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it('should reject null, arrays and primitives', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord([1, 2])).toBe(false);
    expect(isRecord('text')).toBe(false);
  });
});

describe('isStringArray', () => {
  it('should accept an empty array and an array of strings', () => {
    expect(isStringArray([])).toBe(true);
    expect(isStringArray(['a', 'b'])).toBe(true);
  });

  it('should reject an array containing a non-string item', () => {
    expect(isStringArray(['a', 1])).toBe(false);
    expect(isStringArray('a')).toBe(false);
  });
});

describe('isNullableString', () => {
  it('should accept a string and null', () => {
    expect(isNullableString('a')).toBe(true);
    expect(isNullableString(null)).toBe(true);
  });

  it('should reject undefined and non-string values', () => {
    expect(isNullableString(undefined)).toBe(false);
    expect(isNullableString(42)).toBe(false);
  });
});
