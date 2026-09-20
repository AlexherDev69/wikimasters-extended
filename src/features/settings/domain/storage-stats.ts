/**
 * How much the extension holds on this machine, as the options page shows it.
 * Three counts and nothing else: the page says how many entries there are, it
 * never lists what they are about.
 */
export interface StorageStats {
  /** Cards whose Wikidata facts are cached, whatever their age. */
  cardFacts: number;
  /** Wikidata classes whose category or trade is cached. */
  classTargets: number;
  /** Cards the collection index holds. */
  collectionCards: number;
}
