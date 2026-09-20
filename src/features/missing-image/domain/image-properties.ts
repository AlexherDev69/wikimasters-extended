import type { CardImageKind } from './card-image';

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
