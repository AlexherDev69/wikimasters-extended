import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { observeCards } from './card-observer';
import type { ObservedCard } from './scan-cards';

/** Minimal valid card HTML that passes findCardElements + extractCard. */
function cardHtml(title: string, rarity = 'c'): string {
  return `<div class="glow-${rarity} relative rounded-2xl overflow-hidden"><h3>${title}</h3></div>`;
}

describe('observeCards', () => {
  let disconnect: () => void;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    disconnect?.();
    vi.useRealTimers();
  });

  it('should emit the current cards once after the scan delay when a card is appended', async () => {
    const scans: ObservedCard[][] = [];
    disconnect = observeCards({
      root: document.body,
      onScan: (cards) => scans.push(cards),
      scanDelayMs: 200,
    });

    document.body.innerHTML = cardHtml('Alpha');

    // MutationObserver callbacks are delivered asynchronously in happy-dom.
    await Promise.resolve();

    // Before the scan delay elapses, nothing is emitted.
    expect(scans).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(200);
    expect(scans).toHaveLength(1);
    expect(scans[0]).toHaveLength(1);
    expect(scans[0]?.[0]?.card.title).toBe('Alpha');
  });

  it('should coalesce a burst of mutations into a single scan', async () => {
    const scans: ObservedCard[][] = [];
    disconnect = observeCards({
      root: document.body,
      onScan: (cards) => scans.push(cards),
      scanDelayMs: 200,
    });

    // Three rapid mutations.
    document.body.insertAdjacentHTML('beforeend', cardHtml('Alpha'));
    await Promise.resolve();
    document.body.insertAdjacentHTML('beforeend', cardHtml('Beta'));
    await Promise.resolve();
    document.body.insertAdjacentHTML('beforeend', cardHtml('Gamma'));
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(200);

    expect(scans).toHaveLength(1);
    expect(scans[0]).toHaveLength(3);
  });

  it('should still scan when mutations keep arriving faster than the scan delay', async () => {
    const scans: ObservedCard[][] = [];
    disconnect = observeCards({
      root: document.body,
      onScan: (cards) => scans.push(cards),
      scanDelayMs: 200,
    });

    // One mutation every 100 ms for one second. A timer re-armed by every
    // mutation would still be pending here and nothing would have been scanned.
    const mutationCount = 10;
    const mutationIntervalMs = 100;
    for (let index = 0; index < mutationCount; index += 1) {
      document.body.insertAdjacentHTML('beforeend', cardHtml(`Card ${index}`));
      await vi.advanceTimersByTimeAsync(mutationIntervalMs);
    }

    expect(scans.length).toBeGreaterThan(0);
  });

  it('should keep scanning on later mutations when onScan throws', async () => {
    const scans: ObservedCard[][] = [];
    let shouldThrow = true;
    disconnect = observeCards({
      root: document.body,
      onScan: (cards) => {
        if (shouldThrow) {
          shouldThrow = false;
          throw new Error('scan handler failure');
        }
        scans.push(cards);
      },
      scanDelayMs: 200,
    });

    document.body.insertAdjacentHTML('beforeend', cardHtml('Alpha'));
    await Promise.resolve();
    await expect(vi.advanceTimersByTimeAsync(200)).rejects.toThrow('scan handler failure');

    document.body.insertAdjacentHTML('beforeend', cardHtml('Beta'));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(200);

    expect(scans).toHaveLength(1);
    expect(scans[0]).toHaveLength(2);
  });

  it('should emit again when the title text of an existing card changes (pack-opening carousel case)', async () => {
    document.body.innerHTML = cardHtml('Before');
    const scans: ObservedCard[][] = [];
    disconnect = observeCards({
      root: document.body,
      onScan: (cards) => scans.push(cards),
      scanDelayMs: 200,
    });

    const h3 = document.body.querySelector('h3');
    expect(h3).not.toBeNull();
    if (h3 !== null) {
      h3.textContent = 'After';
    }
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(200);

    expect(scans).toHaveLength(1);
    expect(scans[0]?.[0]?.card.title).toBe('After');
  });

  it('should not perform a scan before the scan delay has elapsed', async () => {
    const scans: ObservedCard[][] = [];
    disconnect = observeCards({
      root: document.body,
      onScan: (cards) => scans.push(cards),
      scanDelayMs: 200,
    });

    document.body.innerHTML = cardHtml('Alpha');
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(100);
    expect(scans).toHaveLength(0);
  });

  it('should stop emitting after disconnect, including when a timer was pending', async () => {
    const scans: ObservedCard[][] = [];
    disconnect = observeCards({
      root: document.body,
      onScan: (cards) => scans.push(cards),
      scanDelayMs: 200,
    });

    document.body.innerHTML = cardHtml('Alpha');
    await Promise.resolve();

    // Disconnect before the scan delay elapses.
    disconnect();

    await vi.advanceTimersByTimeAsync(200);
    expect(scans).toHaveLength(0);
  });

  it('should be safe to call disconnect twice', async () => {
    disconnect = observeCards({
      root: document.body,
      onScan: () => undefined,
      scanDelayMs: 200,
    });

    expect(() => {
      disconnect();
      disconnect();
    }).not.toThrow();
  });
});
