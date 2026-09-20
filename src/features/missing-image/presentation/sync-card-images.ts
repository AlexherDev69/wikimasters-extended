import type { ObservedCard } from '../../card-detection/data/scan-cards';
import type { CardCategory } from '../../categorization/domain/category';
import { applyCardImage } from '../data/card-image';

/**
 * Puts the image of every card on screen in line with what is known of it. A
 * card met before its facts came back simply gets its image on the next sync,
 * a card Wikidata knows no image for never gets one, and a card the site shows
 * a real picture for is left untouched.
 *
 * `cards` comes from a scan that has just read the DOM, so the title is the
 * one the card shows right now: a card node the site reuses for another card,
 * which it does when paginating, gets the image of the card it shows now
 * rather than keeping the one of the card it showed before.
 *
 * Called after every scan and every batch of results. It is free to run often:
 * it writes only where a card does not already show the right image.
 */
export function syncCardImages(
  cards: readonly ObservedCard[],
  categoriesByTitle: ReadonlyMap<string, CardCategory>,
): void {
  for (const { element, card } of cards) {
    applyCardImage(element, categoriesByTitle.get(card.title)?.image ?? null);
  }
}
