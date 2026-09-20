import { chunk } from '../../../core/array/chunk';
import { CLASS_BATCH_SIZE } from '../../../core/config/wikimedia';
import type { FetchJsonOptions } from '../../../core/http/fetch-json';
import type { CategoryId, PersonSubtypeId } from '../domain/category';
import {
  CATEGORY_ROOT_GROUPS,
  OCCUPATION_ROOT_GROUPS,
  type RootGroup,
} from '../domain/category-roots';
import { pickRootTarget } from '../domain/pick-root-target';
import type { ClassResolution, ClassRootsSource } from '../domain/ports';
import { createSparqlClient, type RunSparqlQuery } from './sparql-client';
import { buildClassLabelsQuery, buildClassRootsQuery } from './sparql-queries';
import { qidFromEntityUri } from './wikidata-uri';

const CLASS_VARIABLE = 'class';
const ROOT_VARIABLE = 'root';
const LABEL_VARIABLE = 'label';

function collectRootIds<TTarget>(groups: readonly RootGroup<TTarget>[]): Set<string> {
  const rootIds = new Set<string>();
  for (const group of groups) {
    for (const rootId of group.rootIds) {
      rootIds.add(rootId);
    }
  }
  return rootIds;
}

/** Roots matched by each class, as returned by the transitive P279 query. */
async function queryMatchedRoots(
  classIds: readonly string[],
  rootIds: readonly string[],
  runQuery: RunSparqlQuery,
): Promise<Map<string, Set<string>>> {
  const matchedByClass = new Map<string, Set<string>>();

  for (const batch of chunk(classIds, CLASS_BATCH_SIZE)) {
    for (const binding of await runQuery(buildClassRootsQuery(batch, rootIds))) {
      const classUri = binding[CLASS_VARIABLE];
      const rootUri = binding[ROOT_VARIABLE];
      if (classUri === undefined || rootUri === undefined) {
        continue;
      }
      const classId = qidFromEntityUri(classUri);
      const rootId = qidFromEntityUri(rootUri);
      if (classId === null || rootId === null) {
        continue;
      }
      const matched = matchedByClass.get(classId) ?? new Set<string>();
      matched.add(rootId);
      matchedByClass.set(classId, matched);
    }
  }

  return matchedByClass;
}

async function queryFrenchLabels(
  classIds: readonly string[],
  runQuery: RunSparqlQuery,
): Promise<Map<string, string>> {
  const labelByClass = new Map<string, string>();

  for (const batch of chunk(classIds, CLASS_BATCH_SIZE)) {
    for (const binding of await runQuery(buildClassLabelsQuery(batch))) {
      const classUri = binding[CLASS_VARIABLE];
      const label = binding[LABEL_VARIABLE];
      if (classUri === undefined || label === undefined) {
        continue;
      }
      const classId = qidFromEntityUri(classUri);
      if (classId !== null) {
        labelByClass.set(classId, label);
      }
    }
  }

  return labelByClass;
}

/** Classes that reached a target, the only ones whose label is ever read. */
function classifiedClassIds<TTarget>(
  resolutions: ReadonlyMap<string, RootMatch<TTarget>>,
): string[] {
  const classIds: string[] = [];
  for (const [classId, resolution] of resolutions) {
    if (resolution.target !== null) {
      classIds.push(classId);
    }
  }
  return classIds;
}

/** What the roots query tells about one class, before its label is fetched. */
type RootMatch<TTarget> = Omit<ClassResolution<TTarget>, 'label'>;

/**
 * Resolves the target and the matched roots of each class. A class that IS one
 * of the roots is resolved locally, without any network call, and matches
 * itself.
 */
async function resolveTargets<TTarget>(
  classIds: readonly string[],
  groups: readonly RootGroup<TTarget>[],
  runQuery: RunSparqlQuery,
): Promise<Map<string, RootMatch<TTarget>>> {
  const rootIds = collectRootIds(groups);
  const remoteClassIds = classIds.filter((classId) => !rootIds.has(classId));
  const matchedByClass = await queryMatchedRoots(remoteClassIds, [...rootIds], runQuery);

  const resolutions = new Map<string, RootMatch<TTarget>>();
  for (const classId of classIds) {
    const matched = rootIds.has(classId)
      ? new Set<string>([classId])
      : (matchedByClass.get(classId) ?? new Set<string>());
    resolutions.set(classId, {
      target: pickRootTarget(matched, groups),
      // Sorted so that a stored entry does not depend on the row order of the
      // service, which makes the cached value stable and comparable.
      matchedRootIds: [...matched].sort(),
    });
  }
  return resolutions;
}

export function createClassRootsSource(httpOptions: FetchJsonOptions): ClassRootsSource {
  const runQuery = createSparqlClient(httpOptions);

  return {
    async resolveCategoryClasses(
      classIds: readonly string[],
    ): Promise<Map<string, ClassResolution<CategoryId>>> {
      const matches = await resolveTargets(classIds, CATEGORY_ROOT_GROUPS, runQuery);

      const resolutions = new Map<string, ClassResolution<CategoryId>>();
      for (const [classId, match] of matches) {
        resolutions.set(classId, { ...match, label: null });
      }
      return resolutions;
    },

    async resolveOccupationClasses(
      classIds: readonly string[],
    ): Promise<Map<string, ClassResolution<PersonSubtypeId>>> {
      const matches = await resolveTargets(classIds, OCCUPATION_ROOT_GROUPS, runQuery);
      // Only a classified occupation can win the description tie-break of
      // classifyPerson, so the labels of the others would never be read.
      const labels = await queryFrenchLabels(classifiedClassIds(matches), runQuery);

      const resolutions = new Map<string, ClassResolution<PersonSubtypeId>>();
      for (const [classId, match] of matches) {
        resolutions.set(classId, { ...match, label: labels.get(classId) ?? null });
      }
      return resolutions;
    },
  };
}
