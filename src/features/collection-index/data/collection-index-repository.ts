import { storage, type StorageItemKey } from '#imports';
import { isRecord } from '../../../core/types/guards';
import { isRarity } from '../../card-detection/domain/rarity';
import type { Clock } from '../../categorization/domain/ports';
import type {
  CollectionCardEntry,
  CollectionIndex,
  CollectionIndexRepository,
  RecordedCard,
} from '../domain/collection-index';

/**
 * The whole index lives under ONE key, so listing it is a single read. An
 * entry costs about eighty bytes, which leaves a complete collection far below
 * the quota of `chrome.storage.local`.
 *
 * The version is part of the key, as for the cooldowns: a change of shape
 * simply starts from an empty index instead of reading entries it cannot
 * understand.
 */
const INDEX_KEY: StorageItemKey = 'local:wme:collection-index:v1';

type StoredIndex = Record<string, CollectionCardEntry>;

function isCardEntry(value: unknown): value is CollectionCardEntry {
  return (
    isRecord(value) &&
    isRarity(value['rarity']) &&
    typeof value['firstSeenAt'] === 'number' &&
    typeof value['lastSeenAt'] === 'number'
  );
}

function isStoredIndex(value: unknown): value is StoredIndex {
  return isRecord(value) && Object.values(value).every(isCardEntry);
}

/**
 * The stored index, or an empty one when nothing is there or the value is not
 * of the expected shape. A corrupted value is never read and never kept: the
 * next write replaces it whole.
 */
async function readIndex(): Promise<Map<string, CollectionCardEntry>> {
  const stored: unknown = await storage.getItem(INDEX_KEY);
  return isStoredIndex(stored) ? new Map(Object.entries(stored)) : new Map();
}

function writeIndex(index: ReadonlyMap<string, CollectionCardEntry>): Promise<void> {
  return storage.setItem<StoredIndex>(INDEX_KEY, Object.fromEntries(index));
}

/**
 * The local index of the cards the user has displayed on their collection.
 *
 * Every operation is queued behind the previous one. Two batches can reach the
 * service worker at the same time, and two read-modify-write running together
 * would keep only the last write, silently losing the cards of the other.
 */
export function createCollectionIndexRepository(clock: Clock): CollectionIndexRepository {
  let pending: Promise<unknown> = Promise.resolve();

  function serialize<TResult>(task: () => Promise<TResult>): Promise<TResult> {
    const result = pending.then(task);
    // A failed task must not break the chain: the next one still runs, and the
    // caller still sees the failure through the promise it was handed.
    pending = result.catch(() => undefined);
    return result;
  }

  return {
    read(): Promise<CollectionIndex> {
      return serialize(readIndex);
    },

    upsert(cards: readonly RecordedCard[]): Promise<void> {
      return serialize(async () => {
        if (cards.length === 0) {
          return;
        }
        const index = await readIndex();
        const seenAt = clock.now();

        for (const card of cards) {
          const known = index.get(card.title);
          index.set(card.title, {
            // The rarity is refreshed: the same title can be owned in another
            // rarity later, and what the user shows now is what they have.
            rarity: card.rarity,
            firstSeenAt: known?.firstSeenAt ?? seenAt,
            lastSeenAt: seenAt,
          });
        }
        await writeIndex(index);
      });
    },

    clear(): Promise<void> {
      return serialize(() => storage.removeItem(INDEX_KEY));
    },
  };
}
