import { storage, type StorageItemKey } from '#imports';
import { isRecord } from '../../../core/types/guards';
import type { Clock, ThumbnailUrlCache } from '../../categorization/domain/ports';
import { isCommonsFileName } from '../../../core/mediawiki/card-image';
import { isWikimediaThumbnailUrl } from '../../../core/mediawiki/thumbnail-url';

/**
 * Final thumbnail address of each Commons file, cached per file name. This is
 * the whole point of the phase: the address the extension builds itself answers
 * 302 with `cache-control: private, max-age=0, must-revalidate`, so the browser
 * re-walks two redirects on every display, while the picture behind them was
 * cached the first time. What is remembered here is the resolution, not the
 * picture.
 *
 * The key holds the file name as it is. The WXT storage API splits a key on its
 * FIRST colon only, and a Commons file name may not hold a colon at all.
 *
 * The prefix is exported so the maintenance of the options page can count and
 * remove these entries without knowing what they hold: it is a cache of
 * Wikimedia data exactly like the two others.
 */
export const THUMBNAIL_URL_KEY_PREFIX = 'wme:image:';

/** Bump when the stored shape changes: entries of another version are misses. */
const SCHEMA_VERSION = 1;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const RESOLVED_TTL_MS = 90 * MILLISECONDS_PER_DAY;
const NOT_RESOLVED_TTL_MS = 7 * MILLISECONDS_PER_DAY;

interface StoredThumbnailUrl {
  schemaVersion: number;
  /**
   * Null is the "not resolved" marker: the file was asked for and no usable
   * address came back. It is stored so the same file is not asked again on
   * every display, and it expires much sooner than a resolved address.
   */
  url: string | null;
  fetchedAt: number;
}

function thumbnailKey(fileName: string): StorageItemKey {
  return `local:${THUMBNAIL_URL_KEY_PREFIX}${fileName}`;
}

/**
 * Storage is a trust boundary like any other, and this value ends up in a
 * `src`: an address that does not pass the host allowlist is read as an entry
 * that is not there, so the file is resolved again.
 */
function isStoredThumbnailUrl(value: unknown): value is StoredThumbnailUrl {
  return (
    isRecord(value) &&
    value['schemaVersion'] === SCHEMA_VERSION &&
    typeof value['fetchedAt'] === 'number' &&
    (value['url'] === null || isWikimediaThumbnailUrl(value['url']))
  );
}

function isFresh(stored: StoredThumbnailUrl, now: number): boolean {
  const ttlMs = stored.url === null ? NOT_RESOLVED_TTL_MS : RESOLVED_TTL_MS;
  return now - stored.fetchedAt < ttlMs;
}

export function createThumbnailUrlCache(clock: Clock): ThumbnailUrlCache {
  return {
    async getFresh(fileNames: readonly string[]): Promise<Map<string, string | null>> {
      // A name that could never have been written is not looked up: it would
      // build a key out of something the file name guard has already refused.
      const uniqueNames = [...new Set(fileNames)].filter(isCommonsFileName);
      if (uniqueNames.length === 0) {
        return new Map();
      }

      const items = await storage.getItems(uniqueNames.map(thumbnailKey));
      const now = clock.now();
      const fresh = new Map<string, string | null>();

      for (const [index, fileName] of uniqueNames.entries()) {
        const stored: unknown = items[index]?.value;
        if (isStoredThumbnailUrl(stored) && isFresh(stored, now)) {
          fresh.set(fileName, stored.url);
        }
      }

      return fresh;
    },

    async putMany(entries: ReadonlyMap<string, string | null>): Promise<void> {
      const writable = [...entries].filter(([fileName]) => isCommonsFileName(fileName));
      if (writable.length === 0) {
        return;
      }

      const fetchedAt = clock.now();
      await storage.setItems(
        writable.map(([fileName, url]) => ({
          key: thumbnailKey(fileName),
          value: {
            schemaVersion: SCHEMA_VERSION,
            url: isWikimediaThumbnailUrl(url) ? url : null,
            fetchedAt,
          } satisfies StoredThumbnailUrl,
        })),
      );
    },
  };
}
