import {
  IMAGE_PROPERTIES,
  SERIES_IMAGE_PROPERTIES,
  SERIES_LINK_PROPERTY_IDS,
  type ImageProperty,
} from '../../missing-image/domain/image-properties';
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
 * One table of image properties, and where its properties are read: on the
 * item itself, or on the whole the item is one edition of.
 */
interface ImageGroup {
  properties: readonly ImageProperty[];
  /** Prefixes the raw variables: the two tables share their property ids. */
  variablePrefix: string;
  /**
   * The links walked from `?item` to the subject the properties are read on.
   * Empty for the item itself, which is read directly. The path is built from
   * the ids below and never written by hand: a missing separator would make
   * `?item wdt:P179wdt:P18` out of it, a triple that parses and means nothing.
   */
  linkPropertyIds: readonly string[];
}

const OWN_IMAGES: ImageGroup = {
  properties: IMAGE_PROPERTIES,
  variablePrefix: '',
  linkPropertyIds: [],
};

const SERIES_IMAGES: ImageGroup = {
  properties: SERIES_IMAGE_PROPERTIES,
  variablePrefix: 'series_',
  linkPropertyIds: SERIES_LINK_PROPERTY_IDS,
};

/** Alternation of the links of the group, followed by the sequence separator. */
function subjectPath(group: ImageGroup): string {
  if (group.linkPropertyIds.length === 0) {
    return '';
  }
  return `(${group.linkPropertyIds.map((propertyId) => `wdt:${propertyId}`).join('|')})/`;
}

/** Raw variable of an image property, distinct from the projected one. */
function imageVariable(property: ImageProperty, group: ImageGroup): string {
  return `${group.variablePrefix}${property.propertyId.toLowerCase()}`;
}

/** One SAMPLE per image property of the group, built from its table. */
function imageProjections(group: ImageGroup): string {
  return group.properties
    .map((property) => `(SAMPLE(?${imageVariable(property, group)}) AS ?${property.variable})`)
    .join(' ');
}

/** One OPTIONAL per image property of the group, built from the same table. */
function imagePatterns(group: ImageGroup): string {
  const path = subjectPath(group);

  return group.properties
    .map(
      (property) =>
        `OPTIONAL { ?item ${path}wdt:${property.propertyId} ?${imageVariable(property, group)}. }`,
    )
    .join(' ');
}

/**
 * P31 classes, P279 parents, P106 occupations, the external ids, the image
 * properties of each item and those of the whole it is one edition of, one
 * row per item.
 *
 * The figure of about 1.1 s and 19 KB for 50 items predates the six image
 * properties: it was measured on the shape without them. The shape below,
 * with the image properties AND the two series ones, was measured on
 * 2026-09-21 with 50 real card items: 32 KB and a median around 0.7 s, the
 * two optional values reached through a path costing less than the run to run
 * spread of the service itself.
 */
export function buildEntityFactsQuery(qids: readonly string[]): string {
  return `SELECT ?item
  (GROUP_CONCAT(DISTINCT ?class; separator=",") AS ?classes)
  (GROUP_CONCAT(DISTINCT ?parent; separator=",") AS ?parents)
  (GROUP_CONCAT(DISTINCT ?occupation; separator=",") AS ?occupations)
  (SAMPLE(?lbFilm) AS ?letterboxdFilm) (SAMPLE(?lbActor) AS ?letterboxdActor) (SAMPLE(?lbDirector) AS ?letterboxdDirector)
  (SAMPLE(?lbWriter) AS ?letterboxdWriter) (SAMPLE(?lbProducer) AS ?letterboxdProducer) (SAMPLE(?lbStudio) AS ?letterboxdStudio)
  (SAMPLE(?tmdbMovie) AS ?tmdbMovieId) (SAMPLE(?tmdbPerson) AS ?tmdbPersonId)
  ${imageProjections(OWN_IMAGES)} ${imageProjections(SERIES_IMAGES)}
WHERE {
  VALUES ?item { ${toEntityValues(qids)} }
  OPTIONAL { ?item wdt:P31 ?class. } OPTIONAL { ?item wdt:P279 ?parent. } OPTIONAL { ?item wdt:P106 ?occupation. }
  OPTIONAL { ?item wdt:P6127 ?lbFilm. } OPTIONAL { ?item wdt:P6119 ?lbActor. } OPTIONAL { ?item wdt:P12383 ?lbDirector. }
  OPTIONAL { ?item wdt:P14583 ?lbWriter. } OPTIONAL { ?item wdt:P14196 ?lbProducer. } OPTIONAL { ?item wdt:P13273 ?lbStudio. }
  OPTIONAL { ?item wdt:P4947 ?tmdbMovie. } OPTIONAL { ?item wdt:P4985 ?tmdbPerson. }
  ${imagePatterns(OWN_IMAGES)}
  ${imagePatterns(SERIES_IMAGES)}
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
