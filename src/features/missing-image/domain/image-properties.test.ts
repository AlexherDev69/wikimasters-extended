import { describe, it, expect } from 'vitest';
import { IMAGE_PROPERTIES } from './image-properties';

describe('IMAGE_PROPERTIES', () => {
  it('should give every property its own SPARQL variable', () => {
    const variables = IMAGE_PROPERTIES.map((property) => property.variable);

    expect(new Set(variables).size).toBe(IMAGE_PROPERTIES.length);
  });

  it('should ask each Wikidata property exactly once', () => {
    const propertyIds = IMAGE_PROPERTIES.map((property) => property.propertyId);

    expect(new Set(propertyIds).size).toBe(IMAGE_PROPERTIES.length);
    for (const propertyId of propertyIds) {
      expect(propertyId).toMatch(/^P[1-9]\d*$/);
    }
  });

  it('should choose the picture of the subject before any emblem', () => {
    expect(IMAGE_PROPERTIES[0]).toEqual({
      variable: 'imagePicture',
      propertyId: 'P18',
      kind: 'picture',
    });
  });
});
