import { describe, it, expect } from 'vitest';
import { MAX_CARDS_PER_REQUEST } from '../../categorization/presentation/messages';
import type { CollectionSummary } from '../domain/collection-summary';
import {
  CLEAR_COLLECTION_INDEX_MESSAGE,
  GET_COLLECTION_SUMMARY_MESSAGE,
  isClearCollectionIndexRequest,
  isClearCollectionIndexResponse,
  isCollectionIndexMessage,
  isCollectionSummaryResponse,
  isGetCollectionSummaryRequest,
  isRecordCollectionCardsRequest,
  isRecordCollectionCardsResponse,
  RECORD_COLLECTION_CARDS_MESSAGE,
} from './messages';

function makeRecordRequest(cards: unknown): unknown {
  return { type: RECORD_COLLECTION_CARDS_MESSAGE, cards };
}

const VALID_SUMMARY: CollectionSummary = {
  totalCards: 3,
  uncategorizedCount: 1,
  lastSeenAt: 1_760_000_000_000,
  categories: [
    {
      categoryId: 'person',
      count: 2,
      subtypes: [{ subtype: 'cinema', count: 1 }],
      cards: [
        { title: 'Quentin Tarantino', rarity: 'l', primarySubtype: 'cinema' },
        { title: 'Poule', rarity: 'c', primarySubtype: null },
      ],
    },
  ],
  rarities: [{ rarity: 'l', count: 1 }],
};

describe('isRecordCollectionCardsRequest', () => {
  it('should accept a request holding valid cards and an empty batch', () => {
    expect(isRecordCollectionCardsRequest(makeRecordRequest([{ title: 'A', rarity: 'c' }]))).toBe(
      true,
    );
    expect(isRecordCollectionCardsRequest(makeRecordRequest([]))).toBe(true);
  });

  it('should reject a message of another type', () => {
    expect(isRecordCollectionCardsRequest({ type: 'other', cards: [] })).toBe(false);
    expect(isRecordCollectionCardsRequest(null)).toBe(false);
    expect(isRecordCollectionCardsRequest('text')).toBe(false);
  });

  it('should reject a card whose rarity is unknown', () => {
    expect(
      isRecordCollectionCardsRequest(makeRecordRequest([{ title: 'A', rarity: 'mythic' }])),
    ).toBe(false);
  });

  it('should reject a card whose title breaks the frwiki batch rules', () => {
    expect(isRecordCollectionCardsRequest(makeRecordRequest([{ title: '  ', rarity: 'c' }]))).toBe(
      false,
    );
    expect(isRecordCollectionCardsRequest(makeRecordRequest([{ title: 'A|B', rarity: 'c' }]))).toBe(
      false,
    );
    expect(isRecordCollectionCardsRequest(makeRecordRequest([{ rarity: 'c' }]))).toBe(false);
  });

  it('should reject a batch larger than the maximum', () => {
    const cards = Array.from({ length: MAX_CARDS_PER_REQUEST + 1 }, () => ({
      title: 'A',
      rarity: 'c',
    }));

    expect(isRecordCollectionCardsRequest(makeRecordRequest(cards))).toBe(false);
    expect(isRecordCollectionCardsRequest({ type: RECORD_COLLECTION_CARDS_MESSAGE })).toBe(false);
  });
});

describe('isGetCollectionSummaryRequest', () => {
  it('should accept the summary request and reject anything else', () => {
    expect(isGetCollectionSummaryRequest({ type: GET_COLLECTION_SUMMARY_MESSAGE })).toBe(true);
    expect(isGetCollectionSummaryRequest({ type: CLEAR_COLLECTION_INDEX_MESSAGE })).toBe(false);
    expect(isGetCollectionSummaryRequest(undefined)).toBe(false);
  });
});

describe('isClearCollectionIndexRequest', () => {
  it('should accept the clear request and reject anything else', () => {
    expect(isClearCollectionIndexRequest({ type: CLEAR_COLLECTION_INDEX_MESSAGE })).toBe(true);
    expect(isClearCollectionIndexRequest({ type: GET_COLLECTION_SUMMARY_MESSAGE })).toBe(false);
    expect(isClearCollectionIndexRequest([])).toBe(false);
  });
});

describe('isCollectionIndexMessage', () => {
  it('should recognize a message of this feature even when its payload is invalid', () => {
    expect(isCollectionIndexMessage({ type: RECORD_COLLECTION_CARDS_MESSAGE })).toBe(true);
    expect(isCollectionIndexMessage({ type: GET_COLLECTION_SUMMARY_MESSAGE })).toBe(true);
    expect(isCollectionIndexMessage({ type: CLEAR_COLLECTION_INDEX_MESSAGE })).toBe(true);
  });

  it('should reject a message of another feature', () => {
    expect(isCollectionIndexMessage({ type: 'wikimasters-extended:categorize-cards' })).toBe(false);
    expect(isCollectionIndexMessage(null)).toBe(false);
  });
});

describe('isRecordCollectionCardsResponse', () => {
  it('should accept a count and reject anything else', () => {
    expect(isRecordCollectionCardsResponse({ recorded: 0 })).toBe(true);
    expect(isRecordCollectionCardsResponse({ recorded: -1 })).toBe(false);
    expect(isRecordCollectionCardsResponse({ recorded: 1.5 })).toBe(false);
    expect(isRecordCollectionCardsResponse({ error: 'index-unavailable' })).toBe(false);
    expect(isRecordCollectionCardsResponse(undefined)).toBe(false);
  });
});

describe('isCollectionSummaryResponse', () => {
  it('should accept a complete summary', () => {
    expect(isCollectionSummaryResponse({ summary: VALID_SUMMARY })).toBe(true);
  });

  it('should accept a summary of an empty index', () => {
    expect(
      isCollectionSummaryResponse({
        summary: {
          totalCards: 0,
          uncategorizedCount: 0,
          lastSeenAt: null,
          categories: [],
          rarities: [],
        },
      }),
    ).toBe(true);
  });

  it('should reject an error answer and a missing summary', () => {
    expect(isCollectionSummaryResponse({ error: 'index-unavailable' })).toBe(false);
    expect(isCollectionSummaryResponse({})).toBe(false);
    expect(isCollectionSummaryResponse('text')).toBe(false);
  });

  it('should reject a summary holding an unknown category', () => {
    expect(
      isCollectionSummaryResponse({
        summary: {
          ...VALID_SUMMARY,
          categories: [{ categoryId: 'aliens', count: 1, subtypes: [], cards: [] }],
        },
      }),
    ).toBe(false);
  });

  it('should reject a summary holding a card without a valid rarity', () => {
    expect(
      isCollectionSummaryResponse({
        summary: {
          ...VALID_SUMMARY,
          categories: [
            {
              categoryId: 'person',
              count: 1,
              subtypes: [],
              cards: [{ title: 'A', rarity: 'mythic', primarySubtype: null }],
            },
          ],
        },
      }),
    ).toBe(false);
  });

  it('should reject a subtype the popup cannot name', () => {
    expect(
      isCollectionSummaryResponse({
        summary: {
          ...VALID_SUMMARY,
          categories: [
            {
              categoryId: 'person',
              count: 1,
              subtypes: [{ subtype: 'other', count: 1 }],
              cards: [],
            },
          ],
        },
      }),
    ).toBe(false);
  });

  it('should reject a negative count and a missing rarity list', () => {
    expect(isCollectionSummaryResponse({ summary: { ...VALID_SUMMARY, totalCards: -1 } })).toBe(
      false,
    );
    expect(isCollectionSummaryResponse({ summary: { ...VALID_SUMMARY, rarities: null } })).toBe(
      false,
    );
  });
});

describe('isClearCollectionIndexResponse', () => {
  it('should accept the confirmation and reject anything else', () => {
    expect(isClearCollectionIndexResponse({ cleared: true })).toBe(true);
    expect(isClearCollectionIndexResponse({ cleared: false })).toBe(false);
    expect(isClearCollectionIndexResponse({ error: 'invalid-request' })).toBe(false);
    expect(isClearCollectionIndexResponse(null)).toBe(false);
  });
});
