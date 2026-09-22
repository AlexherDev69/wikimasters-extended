import type { CommonsFile } from '../../../core/mediawiki/card-image';

/**
 * External identifiers fetched with the rest of the facts because the same
 * query returns them for free. Phase 5 (Letterboxd links) is their only
 * consumer; nothing reads them in phase 3. The IMDb id left on 2026-09-21
 * with the rung that read it: an id no rule reads is a fact asked of
 * Wikidata, stored and kept in every cache for nothing.
 */
export interface ExternalIds {
  letterboxdFilm: string | null;
  letterboxdActor: string | null;
  letterboxdDirector: string | null;
  letterboxdWriter: string | null;
  letterboxdProducer: string | null;
  letterboxdStudio: string | null;
  tmdbMovieId: string | null;
  tmdbPersonId: string | null;
}

/** Also the SPARQL variable names of the entity facts query. */
export const EXTERNAL_ID_KEYS: readonly (keyof ExternalIds)[] = [
  'letterboxdFilm',
  'letterboxdActor',
  'letterboxdDirector',
  'letterboxdWriter',
  'letterboxdProducer',
  'letterboxdStudio',
  'tmdbMovieId',
  'tmdbPersonId',
];

/** Raw Wikidata facts of one entity. The category is never stored, it is recomputed. */
export interface EntityFacts {
  qid: string;
  /** P31 instance of. */
  classIds: string[];
  /** P279 subclass of. */
  parentClassIds: string[];
  /** P106 occupation. */
  occupationIds: string[];
  externalIds: ExternalIds;
  /**
   * First image property the item holds, in the order of IMAGE_PROPERTIES.
   * Null when Wikidata knows none, which is the case of three cards in four.
   *
   * The file only: the address of its thumbnail is resolved and cached apart,
   * with a lifetime of its own, so it is not one of the facts of the card.
   */
  image: CommonsFile | null;
  /**
   * The picture of the whole this item is one edition of, reached through
   * SERIES_LINK_PROPERTY_IDS: the trophy of the competition for the card of
   * one of its editions, the logo of the series for the card of one season.
   * Null for everything that is not an instalment of something, which is most
   * cards.
   *
   * Kept apart from `image` rather than folded into it: it is the LAST
   * picture tried, after the one the article itself uses, and folding it in
   * would stop that lookup from ever running (phase 7g).
   */
  seriesImage: CommonsFile | null;
}
