import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from '../../../core/logger/logger';
import type { CardCategory } from '../../categorization/domain/category';
import type { CardToCategorize } from '../../categorization/domain/categorize-cards';
import type { ObservedCard } from '../data/scan-cards';
import {
  CATEGORIZATION_RETRY_DELAY_MS,
  handleScan,
  type CategorizeCards,
  type ScheduleRetry,
} from './handle-scan';

interface CapturedRetries {
  scheduleRetry: ScheduleRetry;
  /** Delay of each scheduled retry, in scheduling order. */
  delays: number[];
  runAll: () => void;
}

/** Collects the retries instead of arming a real timer. */
function captureRetries(): CapturedRetries {
  const callbacks: (() => void)[] = [];
  const delays: number[] = [];

  return {
    scheduleRetry: (callback, delayMs): void => {
      callbacks.push(callback);
      delays.push(delayMs);
    },
    delays,
    runAll: (): void => {
      for (const callback of callbacks) {
        callback();
      }
    },
  };
}

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

function makeCategory(title: string): CardCategory {
  return {
    title,
    status: 'categorized',
    qid: 'Q1',
    letterboxdUrl: null,
    image: null,
  };
}

/** Categorizes every submitted card, so the log can be inspected. */
function makeCategorize(): CategorizeCards {
  return vi.fn((cards: readonly CardToCategorize[]) =>
    Promise.resolve(cards.map((card) => makeCategory(card.title))),
  );
}

describe('handleScan', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = makeLogger();
  });

  it('should log once with the new cards when new cards are detected', async () => {
    const seen = new Set<string>();

    handleScan(
      [makeObservedCard('Alpha'), makeObservedCard('Beta')],
      seen,
      logger,
      makeCategorize(),
    );

    await vi.waitFor(() => {
      expect(logger.info).toHaveBeenCalledOnce();
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Cards categorized',
      expect.objectContaining({ count: 2 }),
    );
  });

  it('should log nothing and categorize nothing when no new card is found', () => {
    const seen = new Set(['Alpha']);
    const categorize = makeCategorize();

    handleScan([makeObservedCard('Alpha')], seen, logger, categorize);

    expect(logger.info).not.toHaveBeenCalled();
    expect(categorize).not.toHaveBeenCalled();
  });

  it('should accumulate seen titles across consecutive scans', async () => {
    const seen = new Set<string>();
    const categorize = makeCategorize();

    handleScan([makeObservedCard('Alpha')], seen, logger, categorize);
    expect(seen.has('Alpha')).toBe(true);

    handleScan([makeObservedCard('Alpha'), makeObservedCard('Beta')], seen, logger, categorize);
    expect(seen.has('Beta')).toBe(true);

    // Second call: only Beta is new, so info is called a second time with count 1.
    await vi.waitFor(() => {
      expect(logger.info).toHaveBeenCalledTimes(2);
    });
    const secondCall = vi.mocked(logger.info).mock.calls[1];
    expect(secondCall?.[1]).toMatchObject({ count: 1 });
  });

  it('should only submit the unseen cards to the categorization', () => {
    const seen = new Set(['Alpha']);
    const categorize = makeCategorize();

    handleScan([makeObservedCard('Alpha'), makeObservedCard('Beta')], seen, logger, categorize);

    expect(categorize).toHaveBeenCalledWith([{ title: 'Beta', description: null }]);
  });

  it('should include the category of each card in the log context', async () => {
    const seen = new Set<string>();
    const observedCards: ObservedCard[] = [
      {
        element: document.createElement('div'),
        card: { title: 'Alpha', description: 'desc', rarity: 'r' },
      },
    ];
    const categorize: CategorizeCards = () =>
      Promise.resolve([
        {
          title: 'Alpha',
          status: 'categorized',
          qid: 'Q42',
          letterboxdUrl: 'https://letterboxd.com/actor/alpha/',
          image: null,
        },
      ]);

    handleScan(observedCards, seen, logger, categorize);

    await vi.waitFor(() => {
      expect(logger.info).toHaveBeenCalledOnce();
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Cards categorized',
      expect.objectContaining({
        cards: [
          {
            title: 'Alpha',
            rarity: 'r',
            status: 'categorized',
          },
        ],
      }),
    );
  });

  it('should report an error status for a card the answer does not cover', async () => {
    const seen = new Set<string>();
    const categorize: CategorizeCards = () => Promise.resolve([]);

    handleScan([makeObservedCard('Alpha')], seen, logger, categorize);

    await vi.waitFor(() => {
      expect(logger.info).toHaveBeenCalledOnce();
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Cards categorized',
      expect.objectContaining({
        cards: [{ title: 'Alpha', rarity: 'c', status: 'error' }],
      }),
    );
  });

  it('should log a warning and keep working when the categorization rejects', async () => {
    const seen = new Set<string>();
    const failing: CategorizeCards = () => Promise.reject(new Error('port closed'));

    handleScan([makeObservedCard('Alpha')], seen, logger, failing);

    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledOnce();
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Card categorization failed',
      expect.objectContaining({ error: 'port closed' }),
    );
    expect(logger.info).not.toHaveBeenCalled();

    // A later scan still detects and submits new cards.
    handleScan([makeObservedCard('Beta')], seen, logger, makeCategorize());
    await vi.waitFor(() => {
      expect(logger.info).toHaveBeenCalledOnce();
    });
  });

  it('should release the submitted titles after the retry delay when the categorization rejects', async () => {
    const seen = new Set<string>();
    const retries = captureRetries();
    const failing: CategorizeCards = () => Promise.reject(new Error('port closed'));

    handleScan([makeObservedCard('Alpha')], seen, logger, failing, retries.scheduleRetry);

    await vi.waitFor(() => {
      expect(retries.delays).toEqual([CATEGORIZATION_RETRY_DELAY_MS]);
    });
    // Still seen until the delay expires, so the scans in between ask nothing.
    expect(seen.has('Alpha')).toBe(true);

    retries.runAll();
    expect(seen.has('Alpha')).toBe(false);
  });

  it('should release only the failed and missing titles when some cards are categorized', async () => {
    const seen = new Set<string>();
    const retries = captureRetries();
    const categorize: CategorizeCards = () =>
      Promise.resolve([
        makeCategory('Alpha'),
        {
          title: 'Beta',
          status: 'not_found',
          qid: null,
          letterboxdUrl: null,
          image: null,
        },
        {
          title: 'Gamma',
          status: 'error',
          qid: null,
          letterboxdUrl: null,
          image: null,
        },
      ]);

    // Delta is absent from the answer, which counts as a failure too.
    handleScan(
      ['Alpha', 'Beta', 'Gamma', 'Delta'].map(makeObservedCard),
      seen,
      logger,
      categorize,
      retries.scheduleRetry,
    );

    await vi.waitFor(() => {
      expect(retries.delays).toEqual([CATEGORIZATION_RETRY_DELAY_MS]);
    });
    retries.runAll();
    expect([...seen].sort()).toEqual(['Alpha', 'Beta']);
  });

  it('should schedule no retry when every card is categorized', async () => {
    const seen = new Set<string>();
    const retries = captureRetries();

    handleScan(
      [makeObservedCard('Alpha')],
      seen,
      logger,
      makeCategorize(),
      retries.scheduleRetry,
    );

    await vi.waitFor(() => {
      expect(logger.info).toHaveBeenCalledOnce();
    });
    expect(retries.delays).toEqual([]);
    expect(seen.has('Alpha')).toBe(true);
  });
});
