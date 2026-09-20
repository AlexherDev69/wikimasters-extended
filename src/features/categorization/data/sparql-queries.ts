import { isQid } from './wikidata-uri';

/**
 * Pure builders for the three SPARQL queries used by the pipeline. The query
 * shapes were measured against the live service and must stay semantically
 * identical, see docs/PLAN.md section 4.
 */

const INVALID_QID_MESSAGE = 'Invalid Wikidata QID';

const ENTITY_VALUE_PREFIX = 'wd:';

function toEntityValues(qids: readonly string[]): string {
  return qids.map((qid) => `${ENTITY_VALUE_PREFIX}${assertQid(qid)}`).join(' ');
}

function toFilterList(qids: readonly string[]): string {
  return qids.map((qid) => `${ENTITY_VALUE_PREFIX}${assertQid(qid)}`).join(', ');
}

/** Only a well formed QID may ever be interpolated: this is the injection guard. */
function assertQid(qid: string): string {
  if (!isQid(qid)) {
    throw new Error(`${INVALID_QID_MESSAGE}: ${qid}`);
  }
  return qid;
}

/**
 * P31 classes, P279 parents, P106 occupations and the external ids of each
 * item, one row per item. Measured at about 1.1 s and 19 KB for 50 items.
 */
export function buildEntityFactsQuery(qids: readonly string[]): string {
  return `SELECT ?item
  (GROUP_CONCAT(DISTINCT ?class; separator=",") AS ?classes)
  (GROUP_CONCAT(DISTINCT ?parent; separator=",") AS ?parents)
  (GROUP_CONCAT(DISTINCT ?occupation; separator=",") AS ?occupations)
  (SAMPLE(?lbFilm) AS ?letterboxdFilm) (SAMPLE(?lbActor) AS ?letterboxdActor) (SAMPLE(?lbDirector) AS ?letterboxdDirector)
  (SAMPLE(?lbWriter) AS ?letterboxdWriter) (SAMPLE(?lbProducer) AS ?letterboxdProducer) (SAMPLE(?lbStudio) AS ?letterboxdStudio)
  (SAMPLE(?imdb) AS ?imdbId) (SAMPLE(?tmdbMovie) AS ?tmdbMovieId) (SAMPLE(?tmdbPerson) AS ?tmdbPersonId)
WHERE {
  VALUES ?item { ${toEntityValues(qids)} }
  OPTIONAL { ?item wdt:P31 ?class. } OPTIONAL { ?item wdt:P279 ?parent. } OPTIONAL { ?item wdt:P106 ?occupation. }
  OPTIONAL { ?item wdt:P6127 ?lbFilm. } OPTIONAL { ?item wdt:P6119 ?lbActor. } OPTIONAL { ?item wdt:P12383 ?lbDirector. }
  OPTIONAL { ?item wdt:P14583 ?lbWriter. } OPTIONAL { ?item wdt:P14196 ?lbProducer. } OPTIONAL { ?item wdt:P13273 ?lbStudio. }
  OPTIONAL { ?item wdt:P345 ?imdb. } OPTIONAL { ?item wdt:P4947 ?tmdbMovie. } OPTIONAL { ?item wdt:P4985 ?tmdbPerson. }
} GROUP BY ?item`;
}

/**
 * Roots reached by each class. This exact shape is mandatory: the transitive
 * path is evaluated once per class and only then filtered. Measured at 2.7 s
 * for 49 classes and 67 roots, where binding the roots with `VALUES ?root`
 * took 88 s and exceeded the 60 s limit of the service.
 *
 * A class that reaches no root is simply absent from the result.
 */
export function buildClassRootsQuery(
  classIds: readonly string[],
  rootIds: readonly string[],
): string {
  return `SELECT ?class ?root WHERE {
  VALUES ?class { ${toEntityValues(classIds)} }
  ?class wdt:P279* ?root. hint:Prior hint:gearing "forward".
  FILTER(?root IN (${toFilterList(rootIds)}))
}`;
}

/** French labels, needed by the description tie-break between occupations. */
export function buildClassLabelsQuery(classIds: readonly string[]): string {
  return `SELECT ?class ?label WHERE { VALUES ?class { ${toEntityValues(classIds)} } ?class rdfs:label ?label. FILTER(LANG(?label) = "fr") }`;
}
