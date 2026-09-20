import { describe, it, expect } from 'vitest';
import type { CardCategory } from '../domain/category';
import {
  CATEGORIZE_CARDS_MESSAGE,
  isCategorizeCardsRequest,
  isCategorizeCardsResponse,
  MAX_CARDS_PER_REQUEST,
  MAX_TITLE_LENGTH,
} from './messages';

function makeRequest(cards: unknown): unknown {
  return { type: CATEGORIZE_CARDS_MESSAGE, cards };
}

const VALID_CARD_CATEGORY: CardCategory = {
  title: 'Pulp Fiction',
  status: 'categorized',
  qid: 'Q104123',
  categoryId: 'film_tv',
  primarySubtype: null,
  personSubtypes: [],
  letterboxdUrl: 'https://letterboxd.com/film/pulp-fiction/',
  image: { fileName: 'Pulp Fiction poster.jpg', kind: 'picture' },
};

function makeResponse(cards: unknown): unknown {
  return { cards };
}

describe('isCategorizeCardsRequest', () => {
  it('should accept a request with a valid card', () => {
    expect(
      isCategorizeCardsRequest(makeRequest([{ title: 'Pulp Fiction', description: 'film' }])),
    ).toBe(true);
  });

  it('should accept a card whose description is null and an empty batch', () => {
    expect(isCategorizeCardsRequest(makeRequest([{ title: 'A', description: null }]))).toBe(true);
    expect(isCategorizeCardsRequest(makeRequest([]))).toBe(true);
  });

  it('should reject a message of another type', () => {
    expect(isCategorizeCardsRequest({ type: 'other', cards: [] })).toBe(false);
    expect(isCategorizeCardsRequest(null)).toBe(false);
    expect(isCategorizeCardsRequest('text')).toBe(false);
  });

  it('should reject a request whose cards are not an array', () => {
    expect(isCategorizeCardsRequest(makeRequest({ title: 'A' }))).toBe(false);
    expect(isCategorizeCardsRequest({ type: CATEGORIZE_CARDS_MESSAGE })).toBe(false);
  });

  it('should reject a batch larger than the maximum', () => {
    const cards = Array.from({ length: MAX_CARDS_PER_REQUEST + 1 }, () => ({
      title: 'A',
      description: null,
    }));

    expect(isCategorizeCardsRequest(makeRequest(cards))).toBe(false);
  });

  it('should reject an empty title and a title longer than the maximum', () => {
    expect(isCategorizeCardsRequest(makeRequest([{ title: '', description: null }]))).toBe(false);
    expect(
      isCategorizeCardsRequest(
        makeRequest([{ title: 'a'.repeat(MAX_TITLE_LENGTH + 1), description: null }]),
      ),
    ).toBe(false);
  });

  it('should reject a title made only of whitespace', () => {
    expect(isCategorizeCardsRequest(makeRequest([{ title: '   ', description: null }]))).toBe(
      false,
    );
  });

  it('should reject a title containing the frwiki batch separator', () => {
    expect(
      isCategorizeCardsRequest(makeRequest([{ title: 'Alpha|Beta', description: null }])),
    ).toBe(false);
  });

  it('should reject a card whose description is not a string or null', () => {
    expect(isCategorizeCardsRequest(makeRequest([{ title: 'A', description: 42 }]))).toBe(false);
    expect(isCategorizeCardsRequest(makeRequest([{ title: 'A' }]))).toBe(false);
  });

  it('should reject a card that is not an object', () => {
    expect(isCategorizeCardsRequest(makeRequest(['Pulp Fiction']))).toBe(false);
  });
});

describe('isCategorizeCardsResponse', () => {
  it('should accept a response carrying valid results', () => {
    expect(isCategorizeCardsResponse(makeResponse([VALID_CARD_CATEGORY]))).toBe(true);
    expect(isCategorizeCardsResponse(makeResponse([]))).toBe(true);
  });

  it('should accept a person result with its subtypes', () => {
    const person: CardCategory = {
      title: 'Quentin Tarantino',
      status: 'categorized',
      qid: 'Q3772',
      categoryId: 'person',
      primarySubtype: 'cinema',
      personSubtypes: ['cinema', 'media'],
      letterboxdUrl: 'https://letterboxd.com/director/quentin-tarantino/',
      image: { fileName: 'Quentin Tarantino by Gage Skidmore.jpg', kind: 'picture' },
    };

    expect(isCategorizeCardsResponse(makeResponse([person]))).toBe(true);
  });

  it('should reject a response that is not an object with a cards array', () => {
    expect(isCategorizeCardsResponse(undefined)).toBe(false);
    expect(isCategorizeCardsResponse(null)).toBe(false);
    expect(isCategorizeCardsResponse([VALID_CARD_CATEGORY])).toBe(false);
    expect(isCategorizeCardsResponse(makeResponse('nope'))).toBe(false);
  });

  it('should reject a result whose status is unknown', () => {
    expect(
      isCategorizeCardsResponse(makeResponse([{ ...VALID_CARD_CATEGORY, status: 'pending' }])),
    ).toBe(false);
  });

  it('should reject a result whose category or subtype is unknown', () => {
    expect(
      isCategorizeCardsResponse(makeResponse([{ ...VALID_CARD_CATEGORY, categoryId: 'cinema' }])),
    ).toBe(false);
    expect(
      isCategorizeCardsResponse(
        makeResponse([{ ...VALID_CARD_CATEGORY, primarySubtype: 'film_tv' }]),
      ),
    ).toBe(false);
    expect(
      isCategorizeCardsResponse(
        makeResponse([{ ...VALID_CARD_CATEGORY, personSubtypes: ['cinema', 'nope'] }]),
      ),
    ).toBe(false);
  });

  it('should accept a result without a Letterboxd URL', () => {
    expect(
      isCategorizeCardsResponse(makeResponse([{ ...VALID_CARD_CATEGORY, letterboxdUrl: null }])),
    ).toBe(true);
  });

  it('should reject a Letterboxd URL on another origin', () => {
    const foreign = [
      'https://evil.example.com/film/pulp-fiction/',
      'https://letterboxd.com.evil.example.com/film/x/',
      'http://letterboxd.com/film/x/',
      'javascript:alert(1)',
      42,
      undefined,
    ];

    for (const letterboxdUrl of foreign) {
      expect(
        isCategorizeCardsResponse(makeResponse([{ ...VALID_CARD_CATEGORY, letterboxdUrl }])),
      ).toBe(false);
    }
  });

  it('should reject a Letterboxd URL on a result that was not categorized', () => {
    for (const status of ['not_found', 'error']) {
      expect(
        isCategorizeCardsResponse(
          makeResponse([{ ...VALID_CARD_CATEGORY, status, categoryId: null, image: null }]),
        ),
      ).toBe(false);
    }
  });

  it('should accept a result without an image', () => {
    expect(isCategorizeCardsResponse(makeResponse([{ ...VALID_CARD_CATEGORY, image: null }]))).toBe(
      true,
    );
  });

  it('should accept an image of each kind', () => {
    for (const kind of ['picture', 'emblem']) {
      const image = { fileName: 'Logo.svg', kind };
      expect(isCategorizeCardsResponse(makeResponse([{ ...VALID_CARD_CATEGORY, image }]))).toBe(
        true,
      );
    }
  });

  it('should reject an image whose file name or kind is not usable', () => {
    const refused = [
      { fileName: 'Pulp Fiction poster.jpg', kind: 'photo' },
      { fileName: '../secret.jpg', kind: 'picture' },
      { fileName: 'Pulp Fiction poster.ogv', kind: 'picture' },
      { fileName: '', kind: 'picture' },
      { fileName: 'Pulp Fiction poster.jpg' },
      'Pulp Fiction poster.jpg',
      42,
      undefined,
    ];

    for (const image of refused) {
      expect(isCategorizeCardsResponse(makeResponse([{ ...VALID_CARD_CATEGORY, image }]))).toBe(
        false,
      );
    }
  });

  it('should reject an image on a result that was not categorized', () => {
    for (const status of ['not_found', 'error']) {
      expect(
        isCategorizeCardsResponse(
          makeResponse([
            { ...VALID_CARD_CATEGORY, status, categoryId: null, letterboxdUrl: null },
          ]),
        ),
      ).toBe(false);
    }
  });

  it('should accept a result that was not categorized and carries no URL', () => {
    expect(
      isCategorizeCardsResponse(
        makeResponse([
          {
            ...VALID_CARD_CATEGORY,
            status: 'not_found',
            categoryId: null,
            letterboxdUrl: null,
            image: null,
          },
        ]),
      ),
    ).toBe(true);
  });

  it('should reject a result whose title or qid has the wrong type', () => {
    expect(
      isCategorizeCardsResponse(makeResponse([{ ...VALID_CARD_CATEGORY, title: 42 }])),
    ).toBe(false);
    expect(
      isCategorizeCardsResponse(makeResponse([{ ...VALID_CARD_CATEGORY, qid: 104123 }])),
    ).toBe(false);
  });
});
