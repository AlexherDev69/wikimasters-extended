import type { ObservedCard } from '../../card-detection/data/scan-cards';
import { applyWikipediaButton } from '../data/wikipedia-button';

/**
 * Puts the Wikipedia button of every card on screen in line with the title it
 * shows. Nothing is asked of Wikimedia and nothing is waited for: the address
 * is built from the title the scan has just read, so the button is there on
 * the very first pass, on every card, whatever else is switched on.
 *
 * `cards` comes from a scan that has just read the DOM, so the title is the
 * one the card shows right now: a card node the site reuses for another card,
 * which it does when paginating, gets the button of the card it shows now
 * rather than keeping the one of the card it showed before.
 *
 * Called after every scan. It is free to run often: it writes only where a
 * card does not already show the right button.
 */
export function syncWikipediaButtons(cards: readonly ObservedCard[]): void {
  for (const { element, card } of cards) {
    applyWikipediaButton(element, card.title);
  }
}
