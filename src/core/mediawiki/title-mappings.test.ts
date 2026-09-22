import { describe, it, expect } from 'vitest';
import { parseTitleMappings, resolveFinalTitle } from './title-mappings';

const NO_MAPPING = new Map<string, string>();

describe('parseTitleMappings', () => {
  it('should map every pair when the API reports a normalization', () => {
    const mappings = parseTitleMappings([
      { from: 'albert Einstein', to: 'Albert Einstein' },
      { from: 'File:Adan Canto.jpg', to: 'Fichier:Adan Canto.jpg' },
    ]);

    expect(mappings.get('albert Einstein')).toBe('Albert Einstein');
    expect(mappings.get('File:Adan Canto.jpg')).toBe('Fichier:Adan Canto.jpg');
  });

  it('should drop a pair whose members are not both strings', () => {
    const mappings = parseTitleMappings([
      { from: 'Einstein' },
      { to: 'Albert Einstein' },
      { from: 42, to: 'Albert Einstein' },
      'Einstein',
      null,
    ]);

    expect(mappings.size).toBe(0);
  });

  it('should return no mapping when the field is absent or not an array', () => {
    expect(parseTitleMappings(undefined).size).toBe(0);
    expect(parseTitleMappings(null).size).toBe(0);
    expect(parseTitleMappings({ from: 'Einstein', to: 'Albert Einstein' }).size).toBe(0);
  });
});

describe('resolveFinalTitle', () => {
  it('should return the requested title when the API changed nothing', () => {
    const finalTitle = resolveFinalTitle('Albert Einstein', {
      normalized: NO_MAPPING,
      redirects: NO_MAPPING,
    });

    expect(finalTitle).toBe('Albert Einstein');
  });

  it('should apply the normalization before following any redirect', () => {
    const finalTitle = resolveFinalTitle('einstein', {
      normalized: new Map([['einstein', 'Einstein']]),
      redirects: new Map([['Einstein', 'Albert Einstein']]),
    });

    expect(finalTitle).toBe('Albert Einstein');
  });

  it('should follow a chain of redirects to its end', () => {
    const finalTitle = resolveFinalTitle('A', {
      normalized: NO_MAPPING,
      redirects: new Map([
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'D'],
      ]),
    });

    expect(finalTitle).toBe('D');
  });

  it('should stop on a redirect cycle instead of looping', () => {
    const finalTitle = resolveFinalTitle('A', {
      normalized: NO_MAPPING,
      redirects: new Map([
        ['A', 'B'],
        ['B', 'A'],
      ]),
    });

    expect(finalTitle).toBe('B');
  });

  it('should stop after the bounded number of hops on a longer chain', () => {
    const finalTitle = resolveFinalTitle('T0', {
      normalized: NO_MAPPING,
      redirects: new Map([
        ['T0', 'T1'],
        ['T1', 'T2'],
        ['T2', 'T3'],
        ['T3', 'T4'],
        ['T4', 'T5'],
        ['T5', 'T6'],
      ]),
    });

    expect(finalTitle).toBe('T5');
  });

  it('should ignore a redirect declared for a title the answer never reaches', () => {
    const finalTitle = resolveFinalTitle('Pulp Fiction', {
      normalized: NO_MAPPING,
      redirects: new Map([['Einstein', 'Albert Einstein']]),
    });

    expect(finalTitle).toBe('Pulp Fiction');
  });
});
