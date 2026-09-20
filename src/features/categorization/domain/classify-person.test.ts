import { describe, it, expect } from 'vitest';
import { classifyPerson, type ResolvedOccupation } from './classify-person';

const ACTOR: ResolvedOccupation = { label: 'acteur ou actrice', subtype: 'cinema' };
const SINGER: ResolvedOccupation = { label: 'chanteur ou chanteuse', subtype: 'music' };
const DRUMMER: ResolvedOccupation = { label: 'batteur ou batteuse', subtype: 'music' };
const SCREENWRITER: ResolvedOccupation = { label: 'scénariste', subtype: 'cinema' };
const LAWYER: ResolvedOccupation = { label: 'avocat ou avocate', subtype: null };
const ATHLETE: ResolvedOccupation = { label: 'athlète', subtype: 'sport' };
const JOURNALIST: ResolvedOccupation = { label: 'journaliste', subtype: 'media' };
const POLITICIAN: ResolvedOccupation = { label: 'homme politique ou femme politique', subtype: 'politics' };
const OPHTHALMOLOGIST: ResolvedOccupation = { label: "spécialiste de l'oeil", subtype: 'science' };

describe('classifyPerson', () => {
  it('should pick the occupation named first in the description when P106 lists another one first', () => {
    // Phil Collins: Wikidata lists "actor" first, the description does not.
    const result = classifyPerson('batteur, chanteur et auteur-compositeur britannique', [
      ACTOR,
      DRUMMER,
      SINGER,
    ]);

    expect(result.primarySubtype).toBe('music');
  });

  it('should match the feminine variant of a label when the description uses it', () => {
    const result = classifyPerson('chanteuse et actrice sud-coréenne', [ACTOR, SINGER]);
    expect(result.primarySubtype).toBe('music');
  });

  it('should not match a label that is only a substring of a longer word', () => {
    // "acteur" must not be found inside "facteur".
    const result = classifyPerson('facteur et athlète français', [ACTOR, ATHLETE]);
    expect(result.primarySubtype).toBe('sport');
  });

  it('should ignore occupations without a subtype during the description tie-break', () => {
    // "avocate" appears first but carries no subtype, so the vote decides.
    const result = classifyPerson('avocate française devenue humoriste', [
      LAWYER,
      ACTOR,
      SCREENWRITER,
    ]);

    expect(result.primarySubtype).toBe('cinema');
  });

  it('should fall back to the majority vote when the description is null', () => {
    const result = classifyPerson(null, [ACTOR, DRUMMER, SINGER]);
    expect(result.primarySubtype).toBe('music');
  });

  it('should fall back to the majority vote when no label appears in the description', () => {
    const result = classifyPerson('personnalité britannique', [ACTOR, DRUMMER, SINGER]);
    expect(result.primarySubtype).toBe('music');
  });

  it('should break a vote tie with the person subtype priority', () => {
    const result = classifyPerson(null, [SINGER, ACTOR]);
    expect(result.primarySubtype).toBe('cinema');
  });

  it('should return other and no subtype when no occupation has a subtype', () => {
    const result = classifyPerson('avocate française', [LAWYER]);
    expect(result).toEqual({ primarySubtype: 'other', personSubtypes: [] });
  });

  it('should return other and no subtype when there is no occupation at all', () => {
    expect(classifyPerson('description', [])).toEqual({
      primarySubtype: 'other',
      personSubtypes: [],
    });
  });

  it('should list the subtypes de-duplicated and ordered by the person priority', () => {
    const result = classifyPerson(null, [ATHLETE, SINGER, DRUMMER, ACTOR]);
    expect(result.personSubtypes).toEqual(['cinema', 'music', 'sport']);
  });

  it('should list media last even though it comes first among the occupation groups', () => {
    const result = classifyPerson(null, [JOURNALIST, ATHLETE]);
    expect(result.personSubtypes).toEqual(['sport', 'media']);
  });

  it('should keep the main occupation when a media occupation ties with it', () => {
    // Real card "Georges Mandel": politician and journalist, expected politics.
    const result = classifyPerson('homme politique français', [JOURNALIST, POLITICIAN]);
    expect(result.primarySubtype).toBe('politics');
  });

  it('should prefer the main occupation over media on a vote tie without description', () => {
    const result = classifyPerson(null, [JOURNALIST, POLITICIAN]);
    expect(result.primarySubtype).toBe('politics');
  });

  it('should match a label when the description uses a typographic apostrophe', () => {
    // Real descriptions carry U+2019, Wikidata labels carry U+0027.
    const result = classifyPerson('spécialiste de l’oeil et athlète', [
      OPHTHALMOLOGIST,
      ATHLETE,
    ]);
    expect(result.primarySubtype).toBe('science');
  });

  it('should match a label that carries a typographic apostrophe itself', () => {
    const labelled: ResolvedOccupation = {
      label: 'spécialiste de l’oeil',
      subtype: 'science',
    };
    const result = classifyPerson("spécialiste de l'oeil et athlète", [labelled, ATHLETE]);
    expect(result.primarySubtype).toBe('science');
  });

  it('should ignore an occupation with a subtype but no label during the description tie-break', () => {
    const unlabelled: ResolvedOccupation = { label: null, subtype: 'sport' };
    const result = classifyPerson('chanteur et sportif', [unlabelled, SINGER]);
    expect(result.primarySubtype).toBe('music');
  });
});
