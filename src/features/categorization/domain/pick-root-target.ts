import type { RootGroup } from './category-roots';

/**
 * Returns the target of the first group, in declaration order, that owns one of
 * the matched roots. Null when no group matches.
 */
export function pickRootTarget<TTarget>(
  matchedRootIds: ReadonlySet<string>,
  groups: readonly RootGroup<TTarget>[],
): TTarget | null {
  for (const group of groups) {
    for (const rootId of group.rootIds) {
      if (matchedRootIds.has(rootId)) {
        return group.target;
      }
    }
  }
  return null;
}
