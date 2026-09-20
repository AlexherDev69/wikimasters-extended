import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from '../../../core/logger/logger';
import type { CategoryId, PersonSubtypeId } from '../../categorization/domain/category';
import type {
  CachedCardFacts,
  CardFactsCache,
  ClassResolution,
  ClassTargetCache,
} from '../../categorization/domain/ports';
import type {
  CatalogueObservation,
  CatalogueTotals,
  CatalogueTotalsRepository,
} from '../domain/catalogue-totals';
import type {
  CollectionIndex,
  CollectionIndexRepository,
  RecordedCard,
} from '../domain/collection-index';
import {
  createCollectionMessageHandler,
  type CollectionMessageResponse,
} from './handle-collection-messages';
import {
  CLEAR_COLLECTION_INDEX_MESSAGE,
  GET_COLLECTION_SUMMARY_MESSAGE,
  INDEX_UNAVAILABLE_ERROR,
  INVALID_REQUEST_ERROR,
  isClearCollectionIndexResponse,
  isCollectionSummaryResponse,
  isRecordCatalogueTotalsResponse,
  isRecordCollectionCardsResponse,
  RECORD_CATALOGUE_TOTALS_MESSAGE,
  RECORD_COLLECTION_CARDS_MESSAGE,
} from './messages';

const TOTALS: CatalogueTotals = {
  l: 1761,
  ur: 12_368,
  sr: 66_788,
  r: 179_657,
  pc: 516_762,
  c: 1_996_125,
};

const OBSERVED_AT = new Date('2026-02-01T12:00:00.000Z').getTime();

const EMPTY_FACTS_CACHE: CardFactsCache = {
  getFresh: (): Promise<Map<string, CachedCardFacts>> => Promise.resolve(new Map()),
  putMany: (): Promise<void> => Promise.resolve(),
};

const EMPTY_CLASS_CACHE: ClassTargetCache = {
  getCategoryTargets: (): Promise<Map<string, ClassResolution<CategoryId>>> =>
    Promise.resolve(new Map()),
  putCategoryTargets: (): Promise<void> => Promise.resolve(),
  getOccupationTargets: (): Promise<Map<string, ClassResolution<PersonSubtypeId>>> =>
    Promise.resolve(new Map()),
  putOccupationTargets: (): Promise<void> => Promise.resolve(),
};

interface FakeRepository extends CollectionIndexRepository {
  recorded: RecordedCard[];
  cleared: boolean;
}

function makeRepository(index: CollectionIndex = new Map()): FakeRepository {
  const recorded: RecordedCard[] = [];
  let cleared = false;

  return {
    recorded,
    get cleared(): boolean {
      return cleared;
    },
    read: (): Promise<CollectionIndex> => Promise.resolve(index),
    upsert: (cards: readonly RecordedCard[]): Promise<void> => {
      recorded.push(...cards);
      return Promise.resolve();
    },
    clear: (): Promise<void> => {
      cleared = true;
      return Promise.resolve();
    },
  };
}

interface FakeTotalsRepository extends CatalogueTotalsRepository {
  saved: CatalogueTotals[];
}

function makeTotalsRepository(observation: CatalogueObservation | null = null): FakeTotalsRepository {
  const saved: CatalogueTotals[] = [];

  return {
    saved,
    read: (): Promise<CatalogueObservation | null> => Promise.resolve(observation),
    save: (totals: CatalogueTotals): Promise<void> => {
      saved.push(totals);
      return Promise.resolve();
    },
  };
}

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createCollectionMessageHandler', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = makeLogger();
  });

  function makeHandler(
    repository: CollectionIndexRepository,
    totalsRepository: CatalogueTotalsRepository = makeTotalsRepository(),
  ): ReturnType<typeof createCollectionMessageHandler> {
    return createCollectionMessageHandler({
      indexRepository: repository,
      catalogueTotalsRepository: totalsRepository,
      cardFactsCache: EMPTY_FACTS_CACHE,
      classTargetCache: EMPTY_CLASS_CACHE,
      logger,
    });
  }

  it('should ignore a message of another feature', () => {
    const sendResponse = vi.fn();

    const handled = makeHandler(makeRepository())(
      { type: 'wikimasters-extended:categorize-cards', cards: [] },
      sendResponse,
    );

    expect(handled).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('should record the cards and answer their count when the request is valid', async () => {
    const repository = makeRepository();
    const sendResponse = vi.fn();
    const cards = [{ title: 'Alpha', rarity: 'sr' }];

    const handled = makeHandler(repository)(
      { type: RECORD_COLLECTION_CARDS_MESSAGE, cards },
      sendResponse,
    );

    expect(handled).toBe(true);
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    expect(repository.recorded).toEqual(cards);
    expect(isRecordCollectionCardsResponse(sendResponse.mock.calls[0]?.[0])).toBe(true);
  });

  it('should answer an explicit error when a known message carries an invalid payload', () => {
    const sendResponse = vi.fn();

    const handled = makeHandler(makeRepository())(
      { type: RECORD_COLLECTION_CARDS_MESSAGE, cards: [{ title: 'A|B', rarity: 'c' }] },
      sendResponse,
    );

    expect(handled).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({ error: INVALID_REQUEST_ERROR });
  });

  it('should save the catalogue totals and confirm them when the request is valid', async () => {
    const totalsRepository = makeTotalsRepository();
    const sendResponse = vi.fn();

    const handled = makeHandler(makeRepository(), totalsRepository)(
      { type: RECORD_CATALOGUE_TOTALS_MESSAGE, totals: TOTALS },
      sendResponse,
    );

    expect(handled).toBe(true);
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    expect(totalsRepository.saved).toEqual([TOTALS]);
    expect(isRecordCatalogueTotalsResponse(sendResponse.mock.calls[0]?.[0])).toBe(true);
  });

  it('should save nothing when the catalogue totals are not all readable', () => {
    const totalsRepository = makeTotalsRepository();
    const sendResponse = vi.fn();

    const handled = makeHandler(makeRepository(), totalsRepository)(
      { type: RECORD_CATALOGUE_TOTALS_MESSAGE, totals: { ...TOTALS, l: -1 } },
      sendResponse,
    );

    expect(handled).toBe(true);
    expect(totalsRepository.saved).toHaveLength(0);
    expect(sendResponse).toHaveBeenCalledWith({ error: INVALID_REQUEST_ERROR });
  });

  it('should carry the catalogue totals in the summary when they were observed', async () => {
    const sendResponse = vi.fn<(response: CollectionMessageResponse) => void>();
    const totalsRepository = makeTotalsRepository({ totals: TOTALS, observedAt: OBSERVED_AT });

    makeHandler(makeRepository(), totalsRepository)(
      { type: GET_COLLECTION_SUMMARY_MESSAGE },
      sendResponse,
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    const response = sendResponse.mock.calls[0]?.[0];
    expect(isCollectionSummaryResponse(response)).toBe(true);
    expect(response).toMatchObject({
      summary: { catalogue: { totals: TOTALS, observedAt: OBSERVED_AT } },
    });
  });

  it('should answer a valid summary when the index is asked for', async () => {
    const sendResponse = vi.fn();

    makeHandler(makeRepository())({ type: GET_COLLECTION_SUMMARY_MESSAGE }, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    expect(isCollectionSummaryResponse(sendResponse.mock.calls[0]?.[0])).toBe(true);
  });

  it('should clear the index and confirm it when the reset is asked for', async () => {
    const repository = makeRepository();
    const sendResponse = vi.fn();

    makeHandler(repository)({ type: CLEAR_COLLECTION_INDEX_MESSAGE }, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce();
    });
    expect(repository.cleared).toBe(true);
    expect(isClearCollectionIndexResponse(sendResponse.mock.calls[0]?.[0])).toBe(true);
  });

  it('should answer an error and log it when the repository fails', async () => {
    const failing: CollectionIndexRepository = {
      read: (): Promise<CollectionIndex> => Promise.reject(new Error('storage down')),
      upsert: (): Promise<void> => Promise.resolve(),
      clear: (): Promise<void> => Promise.resolve(),
    };
    const sendResponse = vi.fn<(response: CollectionMessageResponse) => void>();

    makeHandler(failing)({ type: GET_COLLECTION_SUMMARY_MESSAGE }, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ error: INDEX_UNAVAILABLE_ERROR });
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Collection index message failed',
      expect.objectContaining({ error: 'storage down' }),
    );
  });
});
