import type { ObservedCard } from '../../card-detection/data/scan-cards';
import type { CardCategory } from '../../categorization/domain/category';
import { applyCardBadge } from '../data/card-badge';
import { describeCategory } from '../domain/describe-category';

/**
 * Puts the badge of every card on screen in line with what is known of it. A
 * card met before its category came back simply gets its badge on the next
 * sync, and a card that has no category to show never gets one.
 *
 * `cards` comes from a scan that has just read the DOM, so the title is the
 * one the card shows right now: a card node the site reuses for another card,
 * which it does when paginating, gets the badge of the card it shows now
 * rather than keeping the one of the card it showed before.
 *
 * Called after every scan and every batch of results. It is free to run often:
 * it writes only where a card does not already show the right badge.
 */
export function syncCardBadges(
  cards: readonly ObservedCard[],
  categoriesByTitle: ReadonlyMap<string, CardCategory>,
): void {
  for (const { element, card } of cards) {
    const category = categoriesByTitle.get(card.title);
    applyCardBadge(element, category === undefined ? null : describeCategory(category));
  }
}
