import type { ObservedCard } from '../../card-detection/data/scan-cards';
import type { CardCategory } from '../../categorization/domain/category';
import { applyCardButton } from '../data/card-button';

/**
 * Puts the Letterboxd button of every card on screen in line with what is
 * known of it. A card met before its category came back simply gets its
 * button on the next sync, and a card that has no Letterboxd address never
 * gets one.
 *
 * `cards` comes from a scan that has just read the DOM, so the title is the
 * one the card shows right now: a card node the site reuses for another card,
 * which it does when paginating, gets the button of the card it shows now
 * rather than keeping the one of the card it showed before.
 *
 * Called after every scan and every batch of results. It is free to run
 * often: it writes only where a card does not already show the right button.
 */
export function syncCardButtons(
  cards: readonly ObservedCard[],
  categoriesByTitle: ReadonlyMap<string, CardCategory>,
): void {
  for (const { element, card } of cards) {
    const url = categoriesByTitle.get(card.title)?.letterboxdUrl ?? null;
    applyCardButton(element, card.title, url);
  }
}
