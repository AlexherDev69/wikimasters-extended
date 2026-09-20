import { storage, type StorageItemKey } from '#imports';
import { isNullableString, isRecord, isStringArray } from '../../../core/types/guards';
import { isCommonsFile } from '../../missing-image/domain/card-image';
import { EXTERNAL_ID_KEYS, type EntityFacts, type ExternalIds } from '../domain/entity-facts';
import type { CachedCardFacts, CardFactsCache, CardFactsStatus, Clock } from '../domain/ports';

/**
 * Raw Wikidata facts cached per card title. The category itself is never
 * stored: it is recomputed on every read, so changing the root lists never
 * forces the facts to be fetched again.
 *
 * The key holds the article title as it is. The WXT storage API splits a key on
 * its FIRST colon only, so the title keeps any colon it contains.
 *
 * The prefix is exported so the maintenance of the options page can count and
 * remove these entries without knowing what they hold.
 */
export const CARD_FACTS_KEY_PREFIX = 'wme:card:';

/**
 * Bump when the stored shape changes, or when an entry of the current shape
 * can no longer be trusted to hold everything a fresh fetch would give it.
 * Version 2 added the image of the card. Version 3 wrote the article's own
 * image (phase 7d) into that same `image` field when Wikidata left it empty,
 * without changing the shape itself, so an entry written under version 2
 * never tried and had to expire just the same. Version 4 adds
 * `articleImageTried`, a genuinely new field remembering whether that lookup
 * was already attempted: a version 3 entry lacks it and fails the structural
 * check below on its own, so the bump is not strictly required for
 * correctness, but it keeps the version number a reliable label for "the
 * shape currently defined here", consistent with every earlier bump. Version
 * 5 changes no shape at all: the article image rule now also accepts a file
 * named after the article followed by one word, so a card remembered under
 * version 4 as having no article image would keep that answer forever on the
 * strength of a lookup the extension no longer makes the same way. Version 6
 * is that same story once more: the rule now falls back on the lead picture
 * MediaWiki picked for the article itself. Version 7 does change the shape:
 * the IMDb id left the stored external ids with the Letterboxd rung that was
 * its only reader. Entries of an earlier version are fetched again, once, on
 * the next display of their card.
 */
const SCHEMA_VERSION = 7;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const RESOLVED_TTL_MS = 90 * MILLISECONDS_PER_DAY;
const NOT_FOUND_TTL_MS = 7 * MILLISECONDS_PER_DAY;

interface StoredCardFacts {
  schemaVersion: number;
  status: CardFactsStatus;
  facts: EntityFacts | null;
  fetchedAt: number;
  articleImageTried: boolean;
}

function cardKey(title: string): StorageItemKey {
  return `local:${CARD_FACTS_KEY_PREFIX}${title}`;
}

function isCardFactsStatus(value: unknown): value is CardFactsStatus {
  return value === 'resolved' || value === 'not_found';
}

function isExternalIds(value: unknown): value is ExternalIds {
  return isRecord(value) && EXTERNAL_ID_KEYS.every((key) => isNullableString(value[key]));
}

function isEntityFacts(value: unknown): value is EntityFacts {
  return (
    isRecord(value) &&
    typeof value['qid'] === 'string' &&
    isStringArray(value['classIds']) &&
    isStringArray(value['parentClassIds']) &&
    isStringArray(value['occupationIds']) &&
    isExternalIds(value['externalIds']) &&
    (value['image'] === null || isCommonsFile(value['image']))
  );
}

function isStoredCardFacts(value: unknown): value is StoredCardFacts {
  return (
    isRecord(value) &&
    value['schemaVersion'] === SCHEMA_VERSION &&
    isCardFactsStatus(value['status']) &&
    typeof value['fetchedAt'] === 'number' &&
    typeof value['articleImageTried'] === 'boolean' &&
    (value['facts'] === null || isEntityFacts(value['facts']))
  );
}

function isFresh(stored: StoredCardFacts, now: number): boolean {
  const ttlMs = stored.status === 'resolved' ? RESOLVED_TTL_MS : NOT_FOUND_TTL_MS;
  return now - stored.fetchedAt < ttlMs;
}

export function createCardFactsCache(clock: Clock): CardFactsCache {
  return {
    async getFresh(titles: readonly string[]): Promise<Map<string, CachedCardFacts>> {
      const uniqueTitles = [...new Set(titles)];
      if (uniqueTitles.length === 0) {
        return new Map();
      }

      const items = await storage.getItems(uniqueTitles.map(cardKey));
      const now = clock.now();
      const fresh = new Map<string, CachedCardFacts>();

      for (const [index, title] of uniqueTitles.entries()) {
        const stored: unknown = items[index]?.value;
        if (isStoredCardFacts(stored) && isFresh(stored, now)) {
          fresh.set(title, {
            status: stored.status,
            facts: stored.facts,
            articleImageTried: stored.articleImageTried,
          });
        }
      }

      return fresh;
    },

    async putMany(entries: ReadonlyMap<string, CachedCardFacts>): Promise<void> {
      if (entries.size === 0) {
        return;
      }

      const fetchedAt = clock.now();
      await storage.setItems(
        [...entries].map(([title, entry]) => ({
          key: cardKey(title),
          value: {
            schemaVersion: SCHEMA_VERSION,
            status: entry.status,
            facts: entry.facts,
            fetchedAt,
            articleImageTried: entry.articleImageTried,
          } satisfies StoredCardFacts,
        })),
      );
    },
  };
}
