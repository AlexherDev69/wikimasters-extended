import { describe, it, expect } from 'vitest';
import { parseTitleMappings } from './title-mappings';

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
