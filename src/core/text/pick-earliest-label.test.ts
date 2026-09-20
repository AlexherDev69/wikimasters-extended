import { describe, it, expect } from 'vitest';
import { pickEarliestLabel, type LabeledValue } from './pick-earliest-label';

const ACTOR: LabeledValue<string> = { label: 'acteur ou actrice', value: 'actor' };
const SINGER: LabeledValue<string> = { label: 'chanteur ou chanteuse', value: 'singer' };
const UNLABELED: LabeledValue<string> = { label: null, value: 'unknown' };
const OPHTHALMOLOGIST: LabeledValue<string> = { label: "spécialiste de l'oeil", value: 'doctor' };

describe('pickEarliestLabel', () => {
  it('should return the value whose label appears earliest in the description', () => {
    expect(pickEarliestLabel('chanteur et acteur britannique', [ACTOR, SINGER])).toBe('singer');
  });

  it('should match the feminine variant when the description uses it', () => {
    expect(pickEarliestLabel('actrice et chanteuse française', [ACTOR, SINGER])).toBe('actor');
  });

  it('should not match a label that is only a substring of a longer word', () => {
    expect(pickEarliestLabel('facteur et chanteur', [ACTOR, SINGER])).toBe('singer');
  });

  it('should match a label written with the typographic apostrophe', () => {
    expect(pickEarliestLabel('spécialiste de l’oeil belge', [OPHTHALMOLOGIST])).toBe('doctor');
  });

  it('should ignore a candidate without a label', () => {
    expect(pickEarliestLabel('unknown profession', [UNLABELED])).toBeNull();
  });

  it('should return null when no label appears in the description', () => {
    expect(pickEarliestLabel('joueur de tennis suisse', [ACTOR, SINGER])).toBeNull();
  });

  it('should return null when there is no candidate at all', () => {
    expect(pickEarliestLabel('acteur américain', [])).toBeNull();
  });
});
