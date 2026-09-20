import { describe, it, expect } from 'vitest';
import { isArrayOf, isNullableString, isRecord, isStringArray } from './guards';

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

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

describe('isArrayOf', () => {
  it('should accept an empty array and an array whose items all pass', () => {
    expect(isArrayOf([], isNumber)).toBe(true);
    expect(isArrayOf([1, 2], isNumber)).toBe(true);
  });

  it('should reject an array holding one failing item and a non-array', () => {
    expect(isArrayOf([1, 'a'], isNumber)).toBe(false);
    expect(isArrayOf(1, isNumber)).toBe(false);
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
