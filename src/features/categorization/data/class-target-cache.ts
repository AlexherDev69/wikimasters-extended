import { storage, type StorageItemKey } from '#imports';
import { isNullableString, isRecord } from '../../../core/types/guards';
import {
  isCategoryId,
  isPersonSubtypeId,
  type CategoryId,
  type PersonSubtypeId,
} from '../domain/category';
import { ROOTS_VERSION } from '../domain/category-roots';
import type { ClassResolution, ClassTargetCache } from '../domain/ports';

/**
 * Resolved target of each Wikidata class, per kind. There is no TTL: a class
 * rarely changes its parents. An entry written with another ROOTS_VERSION is a
 * miss, which is how a change in the root lists is rolled out.
 */
const KEY_PREFIX = 'wme:class:';

type ClassKind = 'category' | 'occupation';

interface StoredClassTarget {
  rootsVersion: number;
  target: string | null;
  label: string | null;
}

type TargetGuard<TTarget> = (value: unknown) => value is TTarget;

function classKey(kind: ClassKind, classId: string): StorageItemKey {
  return `local:${KEY_PREFIX}${kind}:${classId}`;
}

function isStoredClassTarget(value: unknown): value is StoredClassTarget {
  return (
    isRecord(value) &&
    value['rootsVersion'] === ROOTS_VERSION &&
    isNullableString(value['target']) &&
    isNullableString(value['label'])
  );
}

async function readTargets<TTarget>(
  kind: ClassKind,
  classIds: readonly string[],
  isTarget: TargetGuard<TTarget>,
): Promise<Map<string, ClassResolution<TTarget>>> {
  const uniqueIds = [...new Set(classIds)];
  const resolutions = new Map<string, ClassResolution<TTarget>>();
  if (uniqueIds.length === 0) {
    return resolutions;
  }

  const items = await storage.getItems(uniqueIds.map((classId) => classKey(kind, classId)));

  for (const [index, classId] of uniqueIds.entries()) {
    const stored: unknown = items[index]?.value;
    if (!isStoredClassTarget(stored)) {
      continue;
    }
    if (stored.target !== null && !isTarget(stored.target)) {
      continue;
    }
    resolutions.set(classId, { target: stored.target, label: stored.label });
  }

  return resolutions;
}

async function writeTargets<TTarget extends string>(
  kind: ClassKind,
  entries: ReadonlyMap<string, ClassResolution<TTarget>>,
): Promise<void> {
  if (entries.size === 0) {
    return;
  }

  await storage.setItems(
    [...entries].map(([classId, resolution]) => ({
      key: classKey(kind, classId),
      value: {
        rootsVersion: ROOTS_VERSION,
        target: resolution.target,
        label: resolution.label,
      } satisfies StoredClassTarget,
    })),
  );
}

export function createClassTargetCache(): ClassTargetCache {
  return {
    getCategoryTargets(
      classIds: readonly string[],
    ): Promise<Map<string, ClassResolution<CategoryId>>> {
      return readTargets('category', classIds, isCategoryId);
    },

    putCategoryTargets(
      entries: ReadonlyMap<string, ClassResolution<CategoryId>>,
    ): Promise<void> {
      return writeTargets('category', entries);
    },

    getOccupationTargets(
      classIds: readonly string[],
    ): Promise<Map<string, ClassResolution<PersonSubtypeId>>> {
      return readTargets('occupation', classIds, isPersonSubtypeId);
    },

    putOccupationTargets(
      entries: ReadonlyMap<string, ClassResolution<PersonSubtypeId>>,
    ): Promise<void> {
      return writeTargets('occupation', entries);
    },
  };
}
