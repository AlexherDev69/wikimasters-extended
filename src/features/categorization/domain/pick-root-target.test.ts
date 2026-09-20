import { describe, it, expect } from 'vitest';
import type { RootGroup } from './category-roots';
import { pickRootTarget } from './pick-root-target';

const GROUPS: readonly RootGroup<string>[] = [
  { target: 'first', rootIds: ['Q1', 'Q2'] },
  { target: 'second', rootIds: ['Q3'] },
];

/** A target may appear in several groups, as `place` does for the real lists. */
const GROUPS_WITH_DUPLICATE_TARGET: readonly RootGroup<string>[] = [
  { target: 'shared', rootIds: ['Q1'] },
  { target: 'other', rootIds: ['Q2'] },
  { target: 'shared', rootIds: ['Q3'] },
];

describe('pickRootTarget', () => {
  it('should return the target of the only matching group when one root matches', () => {
    expect(pickRootTarget(new Set(['Q3']), GROUPS)).toBe('second');
  });

  it('should return the target of the earliest group when several groups match', () => {
    expect(pickRootTarget(new Set(['Q3', 'Q2']), GROUPS)).toBe('first');
  });

  it('should return null when no root matches', () => {
    expect(pickRootTarget(new Set(['Q99']), GROUPS)).toBeNull();
  });

  it('should return null when the matched set is empty', () => {
    expect(pickRootTarget(new Set<string>(), GROUPS)).toBeNull();
  });

  it('should pick the earliest group when a target appears in several groups', () => {
    expect(pickRootTarget(new Set(['Q2', 'Q3']), GROUPS_WITH_DUPLICATE_TARGET)).toBe('other');
    expect(pickRootTarget(new Set(['Q1', 'Q2']), GROUPS_WITH_DUPLICATE_TARGET)).toBe('shared');
  });

  it('should return the duplicated target when only its later group matches', () => {
    expect(pickRootTarget(new Set(['Q3']), GROUPS_WITH_DUPLICATE_TARGET)).toBe('shared');
  });
});
