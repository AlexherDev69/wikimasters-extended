import { chunk } from '../../../core/array/chunk';
import { ENTITY_BATCH_SIZE } from '../../../core/config/wikimedia';
import type { FetchJsonOptions } from '../../../core/http/fetch-json';
import type { CommonsFile } from '../../missing-image/domain/card-image';
import { fileNameFromFilePathUri } from '../../missing-image/domain/commons-url';
import {
  IMAGE_PROPERTIES,
  SERIES_IMAGE_PROPERTIES,
  type ImageProperty,
} from '../../missing-image/domain/image-properties';
import { EXTERNAL_ID_KEYS, type EntityFacts, type ExternalIds } from '../domain/entity-facts';
import type { EntityFactsSource } from '../domain/ports';
import { createSparqlClient, type SparqlBinding } from './sparql-client';
import { buildEntityFactsQuery } from './sparql-queries';
import { qidFromEntityUri, qidsFromConcatenatedUris } from './wikidata-uri';

const ITEM_VARIABLE = 'item';
const CLASSES_VARIABLE = 'classes';
const PARENTS_VARIABLE = 'parents';
const OCCUPATIONS_VARIABLE = 'occupations';

function emptyExternalIds(): ExternalIds {
  return {
    letterboxdFilm: null,
    letterboxdActor: null,
    letterboxdDirector: null,
    letterboxdWriter: null,
    letterboxdProducer: null,
    letterboxdStudio: null,
    tmdbMovieId: null,
    tmdbPersonId: null,
  };
}

/** The SPARQL variable of each external id is its key in ExternalIds. */
function readExternalIds(binding: SparqlBinding): ExternalIds {
  const externalIds = emptyExternalIds();
  for (const key of EXTERNAL_ID_KEYS) {
    externalIds[key] = binding[key] ?? null;
  }
  return externalIds;
}

/**
 * The first image property of `properties` the row carries, in the order of
 * the table. A value that yields no usable file name is skipped and the next
 * property is tried: one unusable URI must not cost the card its image.
 *
 * The same reader serves both tables: each one projects its own variables, so
 * the table it is given is the only thing that tells the picture of the item
 * from the picture of the whole it is one edition of.
 */
function readImage(
  binding: SparqlBinding,
  properties: readonly ImageProperty[],
): CommonsFile | null {
  for (const property of properties) {
    const uri = binding[property.variable];
    const fileName = uri === undefined ? null : fileNameFromFilePathUri(uri);
    if (fileName !== null) {
      return { fileName, kind: property.kind };
    }
  }
  return null;
}

function emptyFacts(qid: string): EntityFacts {
  return {
    qid,
    classIds: [],
    parentClassIds: [],
    occupationIds: [],
    externalIds: emptyExternalIds(),
    image: null,
    seriesImage: null,
  };
}

function readFacts(binding: SparqlBinding): EntityFacts | null {
  const itemUri = binding[ITEM_VARIABLE];
  const qid = itemUri === undefined ? null : qidFromEntityUri(itemUri);
  if (qid === null) {
    return null;
  }

  return {
    qid,
    classIds: qidsFromConcatenatedUris(binding[CLASSES_VARIABLE]),
    parentClassIds: qidsFromConcatenatedUris(binding[PARENTS_VARIABLE]),
    occupationIds: qidsFromConcatenatedUris(binding[OCCUPATIONS_VARIABLE]),
    externalIds: readExternalIds(binding),
    image: readImage(binding, IMAGE_PROPERTIES),
    seriesImage: readImage(binding, SERIES_IMAGE_PROPERTIES),
  };
}

/**
 * Fetches the raw facts of each entity, by batches of ENTITY_BATCH_SIZE.
 *
 * Every requested QID gets an entry: a deleted entity produces no row at all,
 * and an entity without facts would otherwise be indistinguishable from a
 * failed request.
 */
export function createEntityFactsSource(httpOptions: FetchJsonOptions): EntityFactsSource {
  const runQuery = createSparqlClient(httpOptions);

  return {
    async fetchFacts(qids: readonly string[]): Promise<Map<string, EntityFacts>> {
      const factsByQid = new Map<string, EntityFacts>();

      for (const batch of chunk(qids, ENTITY_BATCH_SIZE)) {
        for (const qid of batch) {
          factsByQid.set(qid, emptyFacts(qid));
        }
        for (const binding of await runQuery(buildEntityFactsQuery(batch))) {
          const facts = readFacts(binding);
          if (facts !== null && factsByQid.has(facts.qid)) {
            factsByQid.set(facts.qid, facts);
          }
        }
      }

      return factsByQid;
    },
  };
}
