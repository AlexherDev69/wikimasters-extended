import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from '../../../core/logger/logger';
import type { ObservedCard } from '../../card-detection/data/scan-cards';
import { CATEGORIZATION_RETRY_DELAY_MS } from '../../card-detection/presentation/handle-scan';
import {
  MAX_CARDS_PER_REQUEST,
  MAX_TITLE_LENGTH,
} from '../../categorization/presentation/messages';
import type { RecordedCard } from '../domain/collection-index';
import { createCollectionRecorder, type SendRecordedCards } from './record-collection-cards';

const COLLECTION_PATH = '/collection';
const MARKETPLACE_PATH = '/marketplace';

interface CapturedRetries {
  scheduleRetry: (callback: () => void, delayMs: number) => void;
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
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeObservedCard(title: string): ObservedCard {
  return {
    element: document.createElement('div'),
    card: { title, description: null, rarity: 'sr' },
  };
}

function makeObservedCards(count: number): ObservedCard[] {
  return Array.from({ length: count }, (_unused, index) => makeObservedCard(`Carte ${String(index)}`));
}

/** The batches handed to the service worker, in order. */
function captureSends(): { send: SendRecordedCards; batches: RecordedCard[][] } {
  const batches: RecordedCard[][] = [];
  return {
    send: (cards): Promise<void> => {
      batches.push([...cards]);
      return Promise.resolve();
    },
    batches,
  };
}

describe('createCollectionRecorder', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = makeLogger();
  });

  it('should send one batch with the cards of the page when they are new', () => {
    const { send, batches } = captureSends();
    const recorder = createCollectionRecorder({
      send,
      logger,
      scheduleRetry: captureRetries().scheduleRetry,
    });

    recorder.record([makeObservedCard('Alpha'), makeObservedCard('Beta')], COLLECTION_PATH);

    expect(batches).toEqual([
      [
        { title: 'Alpha', rarity: 'sr' },
        { title: 'Beta', rarity: 'sr' },
      ],
    ]);
  });

  it('should send nothing more when the next scans show the same cards', () => {
    const { send, batches } = captureSends();
    const recorder = createCollectionRecorder({
      send,
      logger,
      scheduleRetry: captureRetries().scheduleRetry,
    });
    const cards = [makeObservedCard('Alpha')];

    recorder.record(cards, COLLECTION_PATH);
    recorder.record(cards, COLLECTION_PATH);
    recorder.record(cards, COLLECTION_PATH);

    expect(batches).toHaveLength(1);
  });

  it('should send only the new cards when the page shows more of them', () => {
    const { send, batches } = captureSends();
    const recorder = createCollectionRecorder({
      send,
      logger,
      scheduleRetry: captureRetries().scheduleRetry,
    });

    recorder.record([makeObservedCard('Alpha')], COLLECTION_PATH);
    recorder.record([makeObservedCard('Alpha'), makeObservedCard('Beta')], COLLECTION_PATH);

    expect(batches[1]).toEqual([{ title: 'Beta', rarity: 'sr' }]);
  });

  it('should send one entry per title when the same card is rendered twice', () => {
    const { send, batches } = captureSends();
    const recorder = createCollectionRecorder({
      send,
      logger,
      scheduleRetry: captureRetries().scheduleRetry,
    });

    // The grid card and the detail modal opened on it are the same card.
    recorder.record([makeObservedCard('Alpha'), makeObservedCard('Alpha')], COLLECTION_PATH);

    expect(batches).toEqual([[{ title: 'Alpha', rarity: 'sr' }]]);
  });

  it('should send nothing when the page is not a collection page', () => {
    const { send, batches } = captureSends();
    const recorder = createCollectionRecorder({
      send,
      logger,
      scheduleRetry: captureRetries().scheduleRetry,
    });

    recorder.record([makeObservedCard('Alpha')], MARKETPLACE_PATH);
    recorder.record([makeObservedCard('Alpha')], '/global-collection');

    expect(batches).toHaveLength(0);
  });

  it('should send nothing when the collection page shows no card', () => {
    const { send, batches } = captureSends();
    const recorder = createCollectionRecorder({
      send,
      logger,
      scheduleRetry: captureRetries().scheduleRetry,
    });

    recorder.record([], COLLECTION_PATH);

    expect(batches).toHaveLength(0);
  });

  it('should send the same cards again after the retry delay when the send rejects', async () => {
    const retries = captureRetries();
    const batches: RecordedCard[][] = [];
    let failNext = true;
    const send: SendRecordedCards = (cards) => {
      batches.push([...cards]);
      if (failNext) {
        failNext = false;
        return Promise.reject(new Error('port closed'));
      }
      return Promise.resolve();
    };
    const recorder = createCollectionRecorder({ send, logger, scheduleRetry: retries.scheduleRetry });

    recorder.record([makeObservedCard('Alpha')], COLLECTION_PATH);
    await vi.waitFor(() => {
      expect(retries.delays).toEqual([CATEGORIZATION_RETRY_DELAY_MS]);
    });

    // Until the delay expires the title stays sent, so the scans in between
    // ask for nothing.
    recorder.record([makeObservedCard('Alpha')], COLLECTION_PATH);
    expect(batches).toHaveLength(1);

    retries.runAll();
    recorder.record([makeObservedCard('Alpha')], COLLECTION_PATH);
    expect(batches).toHaveLength(2);
  });

  it('should leave out a title the service worker could never record', () => {
    const { send, batches } = captureSends();
    const recorder = createCollectionRecorder({
      send,
      logger,
      scheduleRetry: captureRetries().scheduleRetry,
    });
    const tooLong = 'A'.repeat(MAX_TITLE_LENGTH + 1);

    recorder.record(
      [
        makeObservedCard('Alpha|Beta'),
        makeObservedCard('   '),
        makeObservedCard(tooLong),
        makeObservedCard('Gamma'),
      ],
      COLLECTION_PATH,
    );

    // The whole batch would be refused because of them, and the valid card of
    // the same scan would never be recorded.
    expect(batches).toEqual([[{ title: 'Gamma', rarity: 'sr' }]]);
  });

  it('should send nothing at all when every title of the scan is unusable', () => {
    const { send, batches } = captureSends();
    const recorder = createCollectionRecorder({
      send,
      logger,
      scheduleRetry: captureRetries().scheduleRetry,
    });

    recorder.record([makeObservedCard('Alpha|Beta')], COLLECTION_PATH);

    expect(batches).toHaveLength(0);
  });

  it('should split a scan into several messages when it holds more cards than the limit', () => {
    const { send, batches } = captureSends();
    const recorder = createCollectionRecorder({
      send,
      logger,
      scheduleRetry: captureRetries().scheduleRetry,
    });

    recorder.record(makeObservedCards(MAX_CARDS_PER_REQUEST + 1), COLLECTION_PATH);

    expect(batches.map((batch) => batch.length)).toEqual([MAX_CARDS_PER_REQUEST, 1]);
  });

  it('should release only the titles of the message that was rejected', async () => {
    const retries = captureRetries();
    const batches: RecordedCard[][] = [];
    const send: SendRecordedCards = (cards) => {
      batches.push([...cards]);
      // The full batch fails, the one holding the last card goes through.
      return cards.length === MAX_CARDS_PER_REQUEST
        ? Promise.reject(new Error('port closed'))
        : Promise.resolve();
    };
    const recorder = createCollectionRecorder({ send, logger, scheduleRetry: retries.scheduleRetry });
    const cards = makeObservedCards(MAX_CARDS_PER_REQUEST + 1);

    recorder.record(cards, COLLECTION_PATH);
    await vi.waitFor(() => {
      expect(retries.delays).toEqual([CATEGORIZATION_RETRY_DELAY_MS]);
    });
    retries.runAll();

    recorder.record(cards, COLLECTION_PATH);
    expect(batches[2]).toHaveLength(MAX_CARDS_PER_REQUEST);
  });

  it('should record nothing on the first scan after the route changed', () => {
    const { send, batches } = captureSends();
    const recorder = createCollectionRecorder({
      send,
      logger,
      scheduleRetry: captureRetries().scheduleRetry,
    });
    const marketplaceCards = [makeObservedCard('Alpha')];

    recorder.record(marketplaceCards, MARKETPLACE_PATH);
    // The scan fires after the URL changed but still reads the cards of the
    // page being left: recording them would say the user owns them.
    recorder.record(marketplaceCards, COLLECTION_PATH);
    expect(batches).toHaveLength(0);

    recorder.record([makeObservedCard('Beta')], COLLECTION_PATH);
    expect(batches).toEqual([[{ title: 'Beta', rarity: 'sr' }]]);
  });

  it('should record at once on the first scan of a page loaded on the collection', () => {
    const { send, batches } = captureSends();
    const recorder = createCollectionRecorder({
      send,
      logger,
      scheduleRetry: captureRetries().scheduleRetry,
    });

    // At load the URL and the DOM agree, so there is nothing to skip.
    recorder.record([makeObservedCard('Alpha')], COLLECTION_PATH);

    expect(batches).toHaveLength(1);
  });

  it('should skip one scan again when the user leaves the collection and comes back', () => {
    const { send, batches } = captureSends();
    const recorder = createCollectionRecorder({
      send,
      logger,
      scheduleRetry: captureRetries().scheduleRetry,
    });

    recorder.record([makeObservedCard('Alpha')], COLLECTION_PATH);
    recorder.record([makeObservedCard('Beta')], MARKETPLACE_PATH);
    recorder.record([makeObservedCard('Beta')], COLLECTION_PATH);
    expect(batches).toHaveLength(1);

    recorder.record([makeObservedCard('Gamma')], COLLECTION_PATH);
    expect(batches[1]).toEqual([{ title: 'Gamma', rarity: 'sr' }]);
  });

  it('should log a warning when the send rejects', async () => {
    const retries = captureRetries();
    const send: SendRecordedCards = () => Promise.reject(new Error('port closed'));
    const recorder = createCollectionRecorder({ send, logger, scheduleRetry: retries.scheduleRetry });

    recorder.record([makeObservedCard('Alpha')], COLLECTION_PATH);

    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledOnce();
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Collection cards not recorded',
      expect.objectContaining({ error: 'port closed', count: 1 }),
    );
  });
});
