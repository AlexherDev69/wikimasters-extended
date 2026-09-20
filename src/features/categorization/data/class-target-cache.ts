import { storage, type StorageItemKey } from '#imports';
import { isNullableString, isRecord, isStringArray } from '../../../core/types/guards';
import {
  isCategoryId,
  isPersonSubtypeId,
  type CategoryId,
  type PersonSubtypeId,
} from '../domain/category';
import { ROOTS_VERSION } from '../domain/category-roots';
import type { Clock, ClassResolution, ClassTargetCache } from '../domain/ports';

/**
 * Resolved target of each Wikidata class, per kind. An entry written with
 * another ROOTS_VERSION is a miss, which is how a change in the root lists is
 * rolled out, and an entry older than CLASS_TARGET_TTL_MS is a miss too.
 *
 * A class rarely changes its parents, which is why this cache once had no
 * expiry at all. Rarely is not never: Wikidata does reclassify a class, and
 * an entry that never expires keeps answering with the hierarchy of the day
 * it was written, for as long as the browser keeps it. The card it
 * categorizes is refetched after ninety days and classified again with that
 * same stale answer, so the card stays wrong with nothing to correct it short
 * of the maintenance button of the options page.
 *
 * Both kinds share the prefix, which is exported so the maintenance of the
 * options page can count and remove these entries without knowing what they
 * hold.
 */
export const CLASS_TARGET_KEY_PREFIX = 'wme:class:';

type ClassKind = 'category' | 'occupation';

/**
 * The same ninety days as a resolved card: a class entry that outlived the
 * facts of the cards it classifies would hand the very same stale target to
 * the fresh facts of every one of them.
 */
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const CLASS_TARGET_TTL_MS = 90 * MILLISECONDS_PER_DAY;

interface StoredClassTarget {
  rootsVersion: number;
  target: string | null;
  label: string | null;
  matchedRootIds: string[];
  /**
   * Added after the entries above: an entry written before it fails the
   * structural check below on its own and is resolved once more, exactly as a
   * change of ROOTS_VERSION would have it resolved.
   */
  fetchedAt: number;
}

type TargetGuard<TTarget> = (value: unknown) => value is TTarget;

function classKey(kind: ClassKind, classId: string): StorageItemKey {
  return `local:${CLASS_TARGET_KEY_PREFIX}${kind}:${classId}`;
}

function isStoredClassTarget(value: unknown): value is StoredClassTarget {
  return (
    isRecord(value) &&
    value['rootsVersion'] === ROOTS_VERSION &&
    isNullableString(value['target']) &&
    isNullableString(value['label']) &&
    isStringArray(value['matchedRootIds']) &&
    typeof value['fetchedAt'] === 'number'
  );
}

function isFresh(stored: StoredClassTarget, now: number): boolean {
  return now - stored.fetchedAt < CLASS_TARGET_TTL_MS;
}

async function readTargets<TTarget>(
  kind: ClassKind,
  classIds: readonly string[],
  isTarget: TargetGuard<TTarget>,
  clock: Clock,
): Promise<Map<string, ClassResolution<TTarget>>> {
  const uniqueIds = [...new Set(classIds)];
  const resolutions = new Map<string, ClassResolution<TTarget>>();
  if (uniqueIds.length === 0) {
    return resolutions;
  }

  const items = await storage.getItems(uniqueIds.map((classId) => classKey(kind, classId)));
  const now = clock.now();

  for (const [index, classId] of uniqueIds.entries()) {
    const stored: unknown = items[index]?.value;
    if (!isStoredClassTarget(stored) || !isFresh(stored, now)) {
      continue;
    }
    if (stored.target !== null && !isTarget(stored.target)) {
      continue;
    }
    resolutions.set(classId, {
      target: stored.target,
      label: stored.label,
      matchedRootIds: stored.matchedRootIds,
    });
  }

  return resolutions;
}

async function writeTargets<TTarget extends string>(
  kind: ClassKind,
  entries: ReadonlyMap<string, ClassResolution<TTarget>>,
  clock: Clock,
): Promise<void> {
  if (entries.size === 0) {
    return;
  }

  const fetchedAt = clock.now();
  await storage.setItems(
    [...entries].map(([classId, resolution]) => ({
      key: classKey(kind, classId),
      value: {
        rootsVersion: ROOTS_VERSION,
        target: resolution.target,
        label: resolution.label,
        matchedRootIds: resolution.matchedRootIds,
        fetchedAt,
      } satisfies StoredClassTarget,
    })),
  );
}

export function createClassTargetCache(clock: Clock): ClassTargetCache {
  return {
    getCategoryTargets(
      classIds: readonly string[],
    ): Promise<Map<string, ClassResolution<CategoryId>>> {
      return readTargets('category', classIds, isCategoryId, clock);
    },

    putCategoryTargets(
      entries: ReadonlyMap<string, ClassResolution<CategoryId>>,
    ): Promise<void> {
      return writeTargets('category', entries, clock);
    },

    getOccupationTargets(
      classIds: readonly string[],
    ): Promise<Map<string, ClassResolution<PersonSubtypeId>>> {
      return readTargets('occupation', classIds, isPersonSubtypeId, clock);
    },

    putOccupationTargets(
      entries: ReadonlyMap<string, ClassResolution<PersonSubtypeId>>,
    ): Promise<void> {
      return writeTargets('occupation', entries, clock);
    },
  };
}
