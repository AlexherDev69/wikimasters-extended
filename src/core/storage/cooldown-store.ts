import { storage, type StorageItemKey } from '#imports';
import type { CooldownStore, HostCooldown } from '../http/fetch-json';
import { isRecord } from '../types/guards';

/**
 * One entry per host. The WXT storage API splits a key on its FIRST colon only,
 * so the host keeps any colon it could contain. The version is part of the
 * prefix, like the other caches: bump it when the stored shape changes and the
 * previous entries simply become unreadable, which is harmless here.
 */
const KEY_PREFIX = 'wme:cooldown:v1:';

function cooldownKey(host: string): StorageItemKey {
  return `local:${KEY_PREFIX}${host}`;
}

function isHostCooldown(value: unknown): value is HostCooldown {
  return (
    isRecord(value) && typeof value['until'] === 'number' && typeof value['status'] === 'number'
  );
}

/**
 * Cooldowns that survive the service worker being killed, which MV3 does within
 * seconds of it going idle. An in-memory cooldown would be forgotten long
 * before a long `Retry-After` expires, and the retry of the content script
 * would then send a request to the banned host every minute.
 *
 * A storage failure degrades to "no cooldown" and is never propagated: losing a
 * pause is bad, refusing to categorize anything at all is worse.
 */
export function createStoredCooldownStore(): CooldownStore {
  return {
    async get(host: string): Promise<HostCooldown | null> {
      try {
        const stored: unknown = await storage.getItem(cooldownKey(host));
        return isHostCooldown(stored) ? stored : null;
      } catch {
        return null;
      }
    },

    async set(host: string, cooldown: HostCooldown): Promise<void> {
      try {
        await storage.setItem(cooldownKey(host), cooldown);
      } catch {
        // Nothing to do: the pause is lost, the request must still go through.
      }
    },

    async delete(host: string): Promise<void> {
      try {
        await storage.removeItem(cooldownKey(host));
      } catch {
        // The stale entry expires on its own, `get` compares it to the clock.
      }
    },
  };
}
