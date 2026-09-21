import { describe, it, expect } from 'vitest';
import {
  IMAGE_PROPERTIES,
  SERIES_IMAGE_PROPERTIES,
} from '../../missing-image/domain/image-properties';
import {
  buildClassLabelsQuery,
  buildClassRootsQuery,
  buildEntityFactsQuery,
} from './sparql-queries';

describe('buildEntityFactsQuery', () => {
  it('should bind every requested item and keep the grouped projection', () => {
    const query = buildEntityFactsQuery(['Q937', 'Q104123']);

    expect(query).toContain('VALUES ?item { wd:Q937 wd:Q104123 }');
    expect(query).toContain('wdt:P31');
    expect(query).toContain('wdt:P279');
    expect(query).toContain('wdt:P106');
    expect(query).toContain('GROUP BY ?item');
  });

  it('should project every external id property', () => {
    const query = buildEntityFactsQuery(['Q1']);

    for (const property of ['P6127', 'P6119', 'P12383', 'P14583', 'P14196', 'P13273', 'P4947', 'P4985']) {
      expect(query).toContain(`wdt:${property}`);
    }
  });

  it('should ask for every image property of the shared table', () => {
    const query = buildEntityFactsQuery(['Q1']);

    // The table is what both the query and the reader of the answer walk, so
    // the six properties are checked through it rather than written twice.
    expect(IMAGE_PROPERTIES).toHaveLength(6);
    for (const property of IMAGE_PROPERTIES) {
      const rawVariable = property.propertyId.toLowerCase();
      expect(query).toContain(`(SAMPLE(?${rawVariable}) AS ?${property.variable})`);
      expect(query).toContain(`OPTIONAL { ?item wdt:${property.propertyId} ?${rawVariable}. }`);
    }
  });

  it('should ask for the same image properties on the whole an item is one edition of', () => {
    const query = buildEntityFactsQuery(['Q1']);

    // Its own table, read through the two edition links rather than on the
    // item, and with raw variables of its own: both tables name the same
    // Wikidata properties, and two identical variables would merge the
    // picture of a season into the picture of its series.
    expect(SERIES_IMAGE_PROPERTIES).toHaveLength(2);
    for (const property of SERIES_IMAGE_PROPERTIES) {
      const rawVariable = `series_${property.propertyId.toLowerCase()}`;
      expect(query).toContain(`(SAMPLE(?${rawVariable}) AS ?${property.variable})`);
      expect(query).toContain(
        `OPTIONAL { ?item (wdt:P179|wdt:P3450)/wdt:${property.propertyId} ?${rawVariable}. }`,
      );
    }
  });

  it('should reject an identifier that is not a QID', () => {
    expect(() => buildEntityFactsQuery(['Q1 } DELETE {'])).toThrow('Invalid Wikidata QID');
    expect(() => buildEntityFactsQuery(['P31'])).toThrow('Invalid Wikidata QID');
    expect(() => buildEntityFactsQuery(['Q0'])).toThrow('Invalid Wikidata QID');
    expect(() => buildEntityFactsQuery(['q5'])).toThrow('Invalid Wikidata QID');
  });
});

describe('buildClassRootsQuery', () => {
  it('should filter the roots instead of binding them, and keep the gearing hint', () => {
    const query = buildClassRootsQuery(['Q10742'], ['Q56061', 'Q486972']);

    expect(query).toContain('VALUES ?class { wd:Q10742 }');
    expect(query).toContain('?class wdt:P279* ?root.');
    expect(query).toContain('hint:Prior hint:gearing "forward".');
    expect(query).toContain('FILTER(?root IN (wd:Q56061, wd:Q486972))');
    expect(query).not.toContain('VALUES ?root');
  });

  it('should reject an invalid class id and an invalid root id', () => {
    expect(() => buildClassRootsQuery(['oops'], ['Q1'])).toThrow('Invalid Wikidata QID');
    expect(() => buildClassRootsQuery(['Q1'], ['oops'])).toThrow('Invalid Wikidata QID');
  });
});

describe('buildClassLabelsQuery', () => {
  it('should request the French label of every requested class', () => {
    const query = buildClassLabelsQuery(['Q33999', 'Q36180']);

    expect(query).toContain('VALUES ?class { wd:Q33999 wd:Q36180 }');
    expect(query).toContain('rdfs:label');
    expect(query).toContain('FILTER(LANG(?label) = "fr")');
  });

  it('should reject an invalid class id', () => {
    expect(() => buildClassLabelsQuery(['Q1; DROP'])).toThrow('Invalid Wikidata QID');
  });
});
