import { isCommonsFileName, type CardImageKind, type CommonsFile } from '../../../core/mediawiki/card-image';

/**
 * The picture an article leads with, which is the very file the site draws on
 * its own card: measured on 2026-09-21, the card "Jeu d'horreur" carries
 * `Ss asa 07-09-10 11-58-02 (l01 escape).jpg`, the lead picture of the
 * article of that name, and so does every other card looked at.
 *
 * It is preferred to what Wikidata holds for the same subject, because
 * Wikidata may hold several pictures of it and the query answers with one of
 * them without a defined order: "Danny Strong" carries two P18, a photograph
 * of 2004 and one of 2013, so the same card could show either one, and the
 * one the site shows is the lead picture of the article.
 */

const EXTENSION_SEPARATOR = '.';

/**
 * MediaWiki spells a file name with underscores in a page property and with
 * spaces everywhere else. The two name the same file, and the rest of this
 * extension only ever sees the spelling Wikidata gives, which is the one with
 * spaces: a card must not be remembered under two names, nor credited under a
 * name no reader would recognize.
 */
const UNDERSCORE = /_/g;
const SPACE = ' ';

/** The one file type of Commons that is never a photograph. */
const VECTOR_EXTENSION = 'svg';

/**
 * A lead picture says nothing of what it shows, where a picture of Wikidata
 * says it by the very property it is held in. The file type is what tells
 * here: a vector drawing is a logo, a flag or a coat of arms, which is shown
 * whole on a flat ground, and anything else is a photograph, which fills the
 * picture area. Measured on the golden set: 43 of its 100 articles lead with
 * a picture, 6 of them a vector one.
 */
function kindOfFile(fileName: string): CardImageKind {
  const extension = fileName.slice(fileName.lastIndexOf(EXTENSION_SEPARATOR) + 1);

  return extension.toLowerCase() === VECTOR_EXTENSION ? 'emblem' : 'picture';
}

/**
 * The lead picture of an article as a file a card can draw, or null when the
 * article has none or names one no thumbnail can be asked for. Narrowed at
 * the boundary exactly as the pictures of Wikidata are: the name reaches a
 * URL and an attribute, and MediaWiki is not the one that decides what this
 * extension is willing to draw.
 */
export function leadImageFile(fileName: unknown): CommonsFile | null {
  if (typeof fileName !== 'string') {
    return null;
  }
  const spelled = fileName.replace(UNDERSCORE, SPACE);

  return isCommonsFileName(spelled) ? { fileName: spelled, kind: kindOfFile(spelled) } : null;
}
