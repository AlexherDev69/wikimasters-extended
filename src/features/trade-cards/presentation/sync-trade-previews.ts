import type { CardCategory } from '../../categorization/domain/category';
import type { ObservedTradeCard } from '../data/scan-trade-chips';
import { applyTradePreview, removeStaleTradePreviews } from '../data/trade-preview';

/**
 * Puts the preview of every card named in a trade offer in line with what is
 * known of it. A card met before its facts came back simply gets its picture
 * on the next sync, and a card Wikidata knows no picture for shows the flat
 * ground of its rarity, its rarity code and its full title, which is already
 * everything the site made the reader click for.
 *
 * `chips` comes from a scan that has just read the DOM, so each title is the
 * one its chip carries right now: a row the site rebuilds for another offer
 * gets the cards it names now rather than keeping the ones it named before.
 *
 * Called after every scan and every batch of results. It is free to run
 * often: it writes only where a chip does not already stand behind the right
 * preview.
 */
export function syncTradePreviews(
  root: ParentNode,
  chips: readonly ObservedTradeCard[],
  categoriesByTitle: ReadonlyMap<string, CardCategory>,
): void {
  const kept = new Set<Element>();

  for (const observed of chips) {
    const preview = applyTradePreview(observed, categoriesByTitle.get(observed.card.title)?.image ?? null);
    if (preview !== null) {
      kept.add(preview);
    }
  }
  removeStaleTradePreviews(root, kept);
}
