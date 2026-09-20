import { storage, type StorageArea, type StorageItemKey } from '#imports';

/**
 * Listing and removing the entries of a cache that spreads over one key per
 * entry. The storage API has no "list the keys under a prefix", so the area is
 * listed here, once per operation, and filtered by the caller: counting two
 * prefixes reads the area once and not twice.
 *
 * `browser.storage.local.getKeys()` would list the keys without their values,
 * but it cannot be feature detected here: the fake browser the tests run on
 * defines it as a stub that throws, so the detection would take that branch in
 * every test and never run against a real implementation.
 *
 * `local` is the only area the extension ever writes in.
 */
const LOCAL_AREA: StorageArea = 'local';

/** Every key of the local area, without the area prefix a snapshot omits. */
export async function listLocalKeys(): Promise<string[]> {
  return Object.keys(await storage.snapshot(LOCAL_AREA));
}

/** Removes exactly `keys`, which a listing of the area has just produced. */
export async function removeLocalKeys(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }
  await storage.removeItems(keys.map((key): StorageItemKey => `local:${key}`));
}
