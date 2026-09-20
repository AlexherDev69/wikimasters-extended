import type { Rarity } from '../../card-detection/domain/rarity';

/**
 * What is kept of one card of the collection. The category is deliberately
 * absent: it is recomputed from the caches at read time, exactly like the rest
 * of the extension, so retuning the root lists never asks the user to walk
 * through their collection again.
 */
export interface CollectionCardEntry {
  rarity: Rarity;
  firstSeenAt: number;
  lastSeenAt: number;
}

/** Every card the user has displayed on their collection, by frwiki title. */
export type CollectionIndex = ReadonlyMap<string, CollectionCardEntry>;

/** What the content script reports of a card seen on a collection page. */
export interface RecordedCard {
  title: string;
  rarity: Rarity;
}

/**
 * The index as the service worker owns it. The implementation serializes its
 * writes: two messages arriving together must not lose an update.
 */
export interface CollectionIndexRepository {
  read(): Promise<CollectionIndex>;
  /** Adds the unknown titles and refreshes the known ones. */
  upsert(cards: readonly RecordedCard[]): Promise<void>;
  clear(): Promise<void>;
}
