import type { CardImageKind } from '../../../core/mediawiki/card-image';

/**
 * The image properties of Wikidata the entity facts query asks for, in the
 * order of the choice: the first one the item holds wins.
 *
 * The query builder and the reader of the answer both walk this table, as they
 * do for the external ids, so a property is added in one place and cannot be
 * projected without being read, nor read without being projected.
 */
export interface ImageProperty {
  /** Name of the SPARQL variable the query projects this property into. */
  variable: string;
  /** Wikidata property id, also the name of its raw variable in the query. */
  propertyId: string;
  kind: CardImageKind;
}

/**
 * P18 (image) first: it is the picture of the subject itself and covers most
 * of the cards. The four emblems come next, each for a kind of item the first
 * one leaves without a picture (organizations, territories, institutions), and
 * the poster and the collage are the pictures of last resort.
 *
 * The choice between properties is fixed by this order, the choice inside one
 * property is not: the query takes each of them with `SAMPLE`, which picks one
 * value among several without a defined order, so an item holding several P18
 * may show another picture after its cache entry has expired.
 */
export const IMAGE_PROPERTIES: readonly ImageProperty[] = [
  { variable: 'imagePicture', propertyId: 'P18', kind: 'picture' },
  { variable: 'imageLogo', propertyId: 'P154', kind: 'emblem' },
  { variable: 'imagePoster', propertyId: 'P3383', kind: 'picture' },
  { variable: 'imageFlag', propertyId: 'P41', kind: 'emblem' },
  { variable: 'imageCoatOfArms', propertyId: 'P94', kind: 'emblem' },
  { variable: 'imageCollage', propertyId: 'P2716', kind: 'picture' },
];

/**
 * The links that make an item ONE EDITION of a whole: P179 (part of the
 * series) for a season, an episode or a volume, P3450 (sports season of
 * league or competition) for the 2005 edition of a tournament.
 *
 * Both say "this item is one instalment of that one", which is what makes the
 * picture of the whole a true picture of the card. Nothing looser belongs
 * here: P361 (part of) would put the picture of a region on a town, and P664
 * (organizer) the headquarters of the French football federation on a cup
 * final, measured on 2026-09-21.
 */
export const SERIES_LINK_PROPERTY_IDS: readonly string[] = ['P179', 'P3450'];

/**
 * The image properties read on the whole, a deliberate subset of the table
 * above: a series, a franchise or a competition holds a picture (P18, the
 * trophy of "Trophée des champions") or a logo (P154, the wordmark of
 * "Grown-ish"), and never a flag, a coat of arms, a film poster or a collage.
 *
 * Their variables carry the `series` prefix of the query, so the reader tells
 * the two tables apart by the table it walks, never by a prefix of its own.
 */
export const SERIES_IMAGE_PROPERTIES: readonly ImageProperty[] = [
  { variable: 'seriesImagePicture', propertyId: 'P18', kind: 'picture' },
  { variable: 'seriesImageLogo', propertyId: 'P154', kind: 'emblem' },
];
