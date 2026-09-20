import type { ObservedCard } from './scan-cards';
import { scanCards } from './scan-cards';

/** Default delay between the first mutation of a batch and the scan, in milliseconds. */
const DEFAULT_SCAN_DELAY_MS = 200;

export interface CardObserverOptions {
  /**
   * The node that acts as the observation root. Must be an Element or Document
   * (both satisfy ParentNode, so scanCards can use it directly).
   */
  root: ParentNode & Node;
  /** Called with the full current list of card elements after each batch of mutations. */
  onScan: (cards: ObservedCard[]) => void;
  /** Delay between the first mutation of a batch and the scan. Defaults to DEFAULT_SCAN_DELAY_MS. */
  scanDelayMs?: number;
}

/**
 * Observes `root` for DOM mutations and calls `onScan` with the full current
 * card list, at most once per `scanDelayMs`.
 *
 * The pending timer is deliberately NOT re-armed by later mutations: a page
 * that mutates continuously (countdowns, animated counters) would otherwise
 * postpone the scan forever. The scan reads the DOM when the timer fires, so
 * mutations that arrive while it is pending are still taken into account.
 *
 * The caller is responsible for the initial scan. This function does NOT
 * perform it. De-duplication across scans is the caller's responsibility via
 * selectUnseenCards.
 *
 * Attribute mutations are intentionally excluded: hover and animation class
 * changes would generate excessive noise without adding new cards.
 *
 * @returns A disconnect function. Safe to call multiple times.
 */
export function observeCards(options: CardObserverOptions): () => void {
  const { root, onScan, scanDelayMs = DEFAULT_SCAN_DELAY_MS } = options;

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let disconnected = false;

  function scheduleScan(): void {
    if (timerId !== null) {
      return;
    }
    timerId = setTimeout(() => {
      timerId = null;
      onScan(scanCards(root));
    }, scanDelayMs);
  }

  const observer = new MutationObserver(() => {
    scheduleScan();
  });

  observer.observe(root, { childList: true, subtree: true, characterData: true });

  return function disconnect(): void {
    if (disconnected) {
      return;
    }
    disconnected = true;
    observer.disconnect();
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };
}
