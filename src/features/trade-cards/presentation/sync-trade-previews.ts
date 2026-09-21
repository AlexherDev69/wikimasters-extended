import type { CardCategory } from '../../categorization/domain/category';
import type { ObservedTradeCard } from '../data/scan-trade-chips';
import { applyTradePreview, removeStaleTradePreviews } from '../data/trade-preview';

/**
 * The two marks the cards drawn here may carry, each switched on its own: a
 * card of an offer shows exactly what the same card shows in the collection,
 * so a switch turned off there must turn it off here too.
 */
export interface TradeMarkSettings {
  /** The button of the article, which every card can carry. */
  wikipedia: boolean;
  /** The Letterboxd button, on the cards Wikidata knows an address for. */
  letterboxd: boolean;
}

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
  marks: TradeMarkSettings,
): void {
  const kept = new Set<Element>();

  for (const observed of chips) {
    const category = categoriesByTitle.get(observed.card.title) ?? null;
    const preview = applyTradePreview(observed, category?.image ?? null, {
      // Needs nothing of what Wikidata knows: the address of the article is
      // built from the title the chip itself carries, so this mark is there
      // on the very first sync, on every card of every offer.
      article: marks.wikipedia,
      letterboxdUrl: marks.letterboxd ? (category?.letterboxdUrl ?? null) : null,
    });
    if (preview !== null) {
      kept.add(preview);
    }
  }
  removeStaleTradePreviews(root, kept);
}
