import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from '../../../core/logger/logger';
import type { ObservedCard } from '../data/scan-cards';
import { handleScan } from './handle-scan';

function makeLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function makeObservedCard(title: string): ObservedCard {
  return {
    element: document.createElement('div'),
    card: { title, description: null, rarity: 'c' },
  };
}

describe('handleScan', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = makeLogger();
  });

  it('should log once with the new cards when new cards are detected', () => {
    const seen = new Set<string>();
    handleScan([makeObservedCard('Alpha'), makeObservedCard('Beta')], seen, logger);

    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      'New cards detected',
      expect.objectContaining({ newCount: 2 }),
    );
  });

  it('should log nothing when no new card is found', () => {
    const seen = new Set(['Alpha']);
    handleScan([makeObservedCard('Alpha')], seen, logger);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should accumulate seen titles across consecutive scans', () => {
    const seen = new Set<string>();

    handleScan([makeObservedCard('Alpha')], seen, logger);
    expect(seen.has('Alpha')).toBe(true);

    handleScan([makeObservedCard('Alpha'), makeObservedCard('Beta')], seen, logger);
    expect(seen.has('Beta')).toBe(true);

    // Second call: only Beta is new, so info was called a second time with newCount 1.
    expect(logger.info).toHaveBeenCalledTimes(2);
    const secondCall = vi.mocked(logger.info).mock.calls[1];
    expect(secondCall?.[1]).toMatchObject({ newCount: 1 });
  });

  it('should include card details in the log context', () => {
    const seen = new Set<string>();
    const observedCards: ObservedCard[] = [
      {
        element: document.createElement('div'),
        card: { title: 'Alpha', description: 'desc', rarity: 'r' },
      },
    ];
    handleScan(observedCards, seen, logger);

    expect(logger.info).toHaveBeenCalledWith(
      'New cards detected',
      expect.objectContaining({
        cards: [{ title: 'Alpha', rarity: 'r', description: 'desc' }],
      }),
    );
  });
});
