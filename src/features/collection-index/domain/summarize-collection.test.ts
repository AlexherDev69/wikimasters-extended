import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createReplayFetch, readFixture } from '../../../../tests/helpers/wikidata-replay';
import {
  createMemoryCooldownStore,
  type FetchJsonOptions,
} from '../../../core/http/fetch-json';
import type { Logger } from '../../../core/logger/logger';
import { isRecord } from '../../../core/types/guards';
import { RARITIES, type Rarity } from '../../card-detection/domain/rarity';
import { createCardFactsCache } from '../../categorization/data/card-facts-cache';
import { createClassRootsSource } from '../../categorization/data/class-roots-source';
import { createClassTargetCache } from '../../categorization/data/class-target-cache';
import { createEntityFactsSource } from '../../categorization/data/entity-facts-source';
import { createTitleResolver } from '../../categorization/data/title-resolver';
import type { CategoryId, PersonSubtypeId } from '../../categorization/domain/category';
import { categorizeCards } from '../../categorization/domain/categorize-cards';
import type { EntityFacts } from '../../categorization/domain/entity-facts';
import type {
  CachedCardFacts,
  CardFactsCache,
  ClassResolution,
  ClassTargetCache,
  Clock,
} from '../../categorization/domain/ports';
import { createCatalogueTotalsRepository } from '../data/catalogue-totals-repository';
import { createCollectionIndexRepository } from '../data/collection-index-repository';
import type {
  CatalogueObservation,
  CatalogueTotals,
  CatalogueTotalsRepository,
} from './catalogue-totals';
import type {
  CollectionCardEntry,
  CollectionIndex,
  CollectionIndexRepository,
  RecordedCard,
} from './collection-index';
import { summarizeCollection, type SummarizeCollectionDeps } from './summarize-collection';

const HUMAN_CLASS_ID = 'Q5';
const FILM_CLASS_ID = 'Q11424';
const PLACE_CLASS_ID = 'Q515';
const ACTOR_ID = 'Q33999';
const SINGER_ID = 'Q177220';

const SEEN_AT = new Date('2026-02-01T12:00:00.000Z').getTime();
const LATER = SEEN_AT + 60_000;

const SYSTEM_CLOCK: Clock = { now: (): number => Date.now() };

function makeFacts(overrides: Partial<EntityFacts> = {}): EntityFacts {
  return {
    qid: 'Q1',
    classIds: [],
    parentClassIds: [],
    occupationIds: [],
    externalIds: {
      letterboxdFilm: null,
      letterboxdActor: null,
      letterboxdDirector: null,
      letterboxdWriter: null,
      letterboxdProducer: null,
      letterboxdStudio: null,
      imdbId: null,
      tmdbMovieId: null,
      tmdbPersonId: null,
    },
    ...overrides,
  };
}

interface IndexedCard {
  title: string;
  rarity: Rarity;
  lastSeenAt?: number;
}

function makeIndex(cards: readonly IndexedCard[]): CollectionIndex {
  const index = new Map<string, CollectionCardEntry>();
  for (const card of cards) {
    index.set(card.title, {
      rarity: card.rarity,
      firstSeenAt: SEEN_AT,
      lastSeenAt: card.lastSeenAt ?? SEEN_AT,
    });
  }
  return index;
}

/** The use case only reads the index, so the two writes are never reached. */
function makeIndexRepository(index: CollectionIndex): CollectionIndexRepository {
  return {
    read: (): Promise<CollectionIndex> => Promise.resolve(index),
    upsert: (): Promise<void> => Promise.resolve(),
    clear: (): Promise<void> => Promise.resolve(),
  };
}

function makeFactsCache(entries: ReadonlyMap<string, CachedCardFacts>): CardFactsCache {
  return {
    getFresh: (titles: readonly string[]): Promise<Map<string, CachedCardFacts>> => {
      const fresh = new Map<string, CachedCardFacts>();
      for (const title of titles) {
        const entry = entries.get(title);
        if (entry !== undefined) {
          fresh.set(title, entry);
        }
      }
      return Promise.resolve(fresh);
    },
    putMany: (): Promise<void> => Promise.resolve(),
  };
}

function toResolutions<TTarget>(
  targets: ReadonlyMap<string, TTarget | null>,
  classIds: readonly string[],
): Map<string, ClassResolution<TTarget>> {
  const resolutions = new Map<string, ClassResolution<TTarget>>();
  for (const classId of classIds) {
    if (targets.has(classId)) {
      resolutions.set(classId, {
        target: targets.get(classId) ?? null,
        label: null,
        matchedRootIds: [],
      });
    }
  }
  return resolutions;
}

function makeClassTargetCache(
  categories: ReadonlyMap<string, CategoryId | null>,
  occupations: ReadonlyMap<string, PersonSubtypeId | null> = new Map(),
): ClassTargetCache {
  return {
    getCategoryTargets: (classIds): Promise<Map<string, ClassResolution<CategoryId>>> =>
      Promise.resolve(toResolutions(categories, classIds)),
    putCategoryTargets: (): Promise<void> => Promise.resolve(),
    getOccupationTargets: (classIds): Promise<Map<string, ClassResolution<PersonSubtypeId>>> =>
      Promise.resolve(toResolutions(occupations, classIds)),
    putOccupationTargets: (): Promise<void> => Promise.resolve(),
  };
}

/** The use case only reads the totals, so the write is never reached. */
function makeTotalsRepository(
  observation: CatalogueObservation | null = null,
): CatalogueTotalsRepository {
  return {
    read: (): Promise<CatalogueObservation | null> => Promise.resolve(observation),
    save: (): Promise<void> => Promise.resolve(),
  };
}

interface Scenario {
  cards: readonly IndexedCard[];
  facts: ReadonlyMap<string, CachedCardFacts>;
  categories: ReadonlyMap<string, CategoryId | null>;
  occupations?: ReadonlyMap<string, PersonSubtypeId | null>;
  catalogue?: CatalogueObservation | null;
}

function makeDeps(scenario: Scenario): SummarizeCollectionDeps {
  return {
    indexRepository: makeIndexRepository(makeIndex(scenario.cards)),
    catalogueTotalsRepository: makeTotalsRepository(scenario.catalogue ?? null),
    cardFactsCache: makeFactsCache(scenario.facts),
    classTargetCache: makeClassTargetCache(scenario.categories, scenario.occupations),
  };
}

const CATALOGUE_TOTALS: CatalogueTotals = {
  l: 1761,
  ur: 12_368,
  sr: 66_788,
  r: 179_657,
  pc: 516_762,
  c: 1_996_125,
};

const RESOLVED_FILM: CachedCardFacts = {
  status: 'resolved',
  facts: makeFacts({ classIds: [FILM_CLASS_ID] }),
};
const RESOLVED_PLACE: CachedCardFacts = {
  status: 'resolved',
  facts: makeFacts({ classIds: [PLACE_CLASS_ID] }),
};
const NOT_FOUND: CachedCardFacts = { status: 'not_found', facts: null };

const CATEGORY_TARGETS = new Map<string, CategoryId | null>([
  [FILM_CLASS_ID, 'film_tv'],
  [PLACE_CLASS_ID, 'place'],
]);

function categoryCounts(categories: readonly { categoryId: CategoryId; count: number }[]): [
  CategoryId,
  number,
][] {
  return categories.map((entry) => [entry.categoryId, entry.count]);
}

describe('summarizeCollection', () => {
  it('should return an empty summary when the index holds no card', async () => {
    const summary = await summarizeCollection(
      makeDeps({ cards: [], facts: new Map(), categories: new Map() }),
    );

    expect(summary).toEqual({
      totalCards: 0,
      uncategorizedCount: 0,
      lastSeenAt: null,
      catalogue: null,
      categories: [],
      rarities: [],
    });
  });

  it('should report no catalogue totals when the page that displays them was never opened', async () => {
    const summary = await summarizeCollection(
      makeDeps({
        cards: [{ title: 'Alpha', rarity: 'c' }],
        facts: new Map([['Alpha', RESOLVED_FILM]]),
        categories: CATEGORY_TARGETS,
      }),
    );

    expect(summary.catalogue).toBeNull();
  });

  it('should report the catalogue totals when they were observed on the site', async () => {
    const catalogue: CatalogueObservation = { totals: CATALOGUE_TOTALS, observedAt: SEEN_AT };

    const summary = await summarizeCollection(
      makeDeps({
        cards: [{ title: 'Alpha', rarity: 'l' }],
        facts: new Map([['Alpha', RESOLVED_FILM]]),
        categories: CATEGORY_TARGETS,
        catalogue,
      }),
    );

    expect(summary.catalogue).toEqual(catalogue);
    expect(summary.rarities).toEqual([{ rarity: 'l', count: 1 }]);
  });

  it('should count the cards of each category when the caches answer for them', async () => {
    const summary = await summarizeCollection(
      makeDeps({
        cards: [
          { title: 'Alpha', rarity: 'c' },
          { title: 'Beta', rarity: 'c' },
          { title: 'Gamma', rarity: 'c' },
        ],
        facts: new Map([
          ['Alpha', RESOLVED_FILM],
          ['Beta', RESOLVED_FILM],
          ['Gamma', RESOLVED_PLACE],
        ]),
        categories: CATEGORY_TARGETS,
      }),
    );

    expect(summary.totalCards).toBe(3);
    expect(summary.uncategorizedCount).toBe(0);
    expect(categoryCounts(summary.categories)).toEqual([
      ['film_tv', 2],
      ['place', 1],
    ]);
  });

  it('should order two categories of equal count by the category priority', async () => {
    const summary = await summarizeCollection(
      makeDeps({
        cards: [
          { title: 'Alpha', rarity: 'c' },
          { title: 'Gamma', rarity: 'c' },
        ],
        facts: new Map([
          ['Alpha', RESOLVED_PLACE],
          ['Gamma', RESOLVED_FILM],
        ]),
        categories: CATEGORY_TARGETS,
      }),
    );

    // film_tv comes before place in CATEGORY_PRIORITY, whatever the order the
    // cards were met in.
    expect(categoryCounts(summary.categories)).toEqual([
      ['film_tv', 1],
      ['place', 1],
    ]);
  });

  it('should count the main subtypes when the category is person', async () => {
    const singer: CachedCardFacts = {
      status: 'resolved',
      facts: makeFacts({ classIds: [HUMAN_CLASS_ID], occupationIds: [SINGER_ID] }),
    };
    const actor: CachedCardFacts = {
      status: 'resolved',
      facts: makeFacts({ classIds: [HUMAN_CLASS_ID], occupationIds: [ACTOR_ID] }),
    };

    const summary = await summarizeCollection(
      makeDeps({
        cards: [
          { title: 'Alpha', rarity: 'c' },
          { title: 'Beta', rarity: 'c' },
          { title: 'Gamma', rarity: 'c' },
        ],
        facts: new Map([
          ['Alpha', singer],
          ['Beta', singer],
          ['Gamma', actor],
        ]),
        categories: new Map(),
        occupations: new Map<string, PersonSubtypeId | null>([
          [SINGER_ID, 'music'],
          [ACTOR_ID, 'cinema'],
        ]),
      }),
    );

    expect(summary.categories[0]?.subtypes).toEqual([
      { subtype: 'music', count: 2 },
      { subtype: 'cinema', count: 1 },
    ]);
  });

  it('should leave a person without a known trade out of the subtypes', async () => {
    const person: CachedCardFacts = {
      status: 'resolved',
      facts: makeFacts({ classIds: [HUMAN_CLASS_ID] }),
    };

    const summary = await summarizeCollection(
      makeDeps({
        cards: [{ title: 'Alpha', rarity: 'c' }],
        facts: new Map([['Alpha', person]]),
        categories: new Map(),
      }),
    );

    expect(summary.categories[0]).toMatchObject({ categoryId: 'person', count: 1, subtypes: [] });
    expect(summary.categories[0]?.cards[0]?.primarySubtype).toBeNull();
  });

  it('should count the cards of each rarity, rarest first', async () => {
    const summary = await summarizeCollection(
      makeDeps({
        cards: [
          { title: 'Alpha', rarity: 'c' },
          { title: 'Beta', rarity: 'l' },
          { title: 'Gamma', rarity: 'c' },
        ],
        facts: new Map([['Alpha', RESOLVED_FILM]]),
        categories: CATEGORY_TARGETS,
      }),
    );

    expect(summary.rarities).toEqual([
      { rarity: 'l', count: 1 },
      { rarity: 'c', count: 2 },
    ]);
  });

  it('should report the most recent sighting of the index', async () => {
    const summary = await summarizeCollection(
      makeDeps({
        cards: [
          { title: 'Alpha', rarity: 'c', lastSeenAt: SEEN_AT },
          { title: 'Beta', rarity: 'c', lastSeenAt: LATER },
        ],
        facts: new Map(),
        categories: new Map(),
      }),
    );

    expect(summary.lastSeenAt).toBe(LATER);
  });

  it('should count a card as uncategorized when its facts are missing or expired', async () => {
    const summary = await summarizeCollection(
      makeDeps({
        cards: [{ title: 'Alpha', rarity: 'c' }],
        facts: new Map(),
        categories: CATEGORY_TARGETS,
      }),
    );

    expect(summary).toMatchObject({ totalCards: 1, uncategorizedCount: 1, categories: [] });
  });

  it('should count a card as uncategorized when its article was not found', async () => {
    const summary = await summarizeCollection(
      makeDeps({
        cards: [{ title: 'Alpha', rarity: 'c' }],
        facts: new Map([['Alpha', NOT_FOUND]]),
        categories: CATEGORY_TARGETS,
      }),
    );

    expect(summary.uncategorizedCount).toBe(1);
  });

  it('should count a card as uncategorized when one of its class targets is missing', async () => {
    const summary = await summarizeCollection(
      makeDeps({
        cards: [{ title: 'Alpha', rarity: 'c' }],
        facts: new Map([['Alpha', RESOLVED_FILM]]),
        categories: new Map(),
      }),
    );

    expect(summary.uncategorizedCount).toBe(1);
  });

  it('should count a person as uncategorized when one of its occupations is missing', async () => {
    const actor: CachedCardFacts = {
      status: 'resolved',
      facts: makeFacts({ classIds: [HUMAN_CLASS_ID], occupationIds: [ACTOR_ID] }),
    };

    const summary = await summarizeCollection(
      makeDeps({
        cards: [{ title: 'Alpha', rarity: 'c' }],
        facts: new Map([['Alpha', actor]]),
        categories: new Map(),
      }),
    );

    expect(summary.uncategorizedCount).toBe(1);
  });

  it('should list the cards of a category by rarity then by French collation', async () => {
    const facts = new Map<string, CachedCardFacts>();
    const cards: IndexedCard[] = [
      { title: 'Zoé', rarity: 'c' },
      { title: 'Émile', rarity: 'c' },
      { title: 'Eve', rarity: 'c' },
      { title: 'Alpha', rarity: 'l' },
    ];
    for (const card of cards) {
      facts.set(card.title, RESOLVED_FILM);
    }

    const summary = await summarizeCollection(
      makeDeps({ cards, facts, categories: CATEGORY_TARGETS }),
    );

    // The legendary comes first, then the commons sorted as a French reader
    // expects: a code point sort would put "Zoé" before "Émile".
    expect(summary.categories[0]?.cards.map((card) => card.title)).toEqual([
      'Alpha',
      'Émile',
      'Eve',
      'Zoé',
    ]);
  });
});

/** Expected category of the 100 real cards, produced independently of the rules. */
interface GoldenEntry {
  title: string;
  description: string | null;
  categoryId: string;
}

function parseGoldenEntry(raw: unknown): GoldenEntry {
  if (!isRecord(raw) || typeof raw['title'] !== 'string' || typeof raw['categoryId'] !== 'string') {
    throw new Error('Unexpected golden expectation shape');
  }
  const description = raw['description'];

  return {
    title: raw['title'],
    description: typeof description === 'string' ? description : null,
    categoryId: raw['categoryId'],
  };
}

function readGoldenExpectations(): GoldenEntry[] {
  const raw = readFixture('golden-expectations.json');
  if (!Array.isArray(raw)) {
    throw new Error('Unexpected golden expectation shape');
  }
  return raw.map(parseGoldenEntry);
}

const GOLDEN_EXPECTATIONS = readGoldenExpectations();

/** One rarity after another, so every rarity of the index is exercised. */
function goldenRarity(index: number): Rarity {
  return RARITIES[index % RARITIES.length] ?? 'c';
}

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('summarizeCollection over the golden set', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should count the golden categories when the recorded cards were categorized first', async () => {
    const replay = createReplayFetch();
    const httpOptions: FetchJsonOptions = {
      fetchImpl: replay.fetchImpl,
      sleep: (): Promise<void> => Promise.resolve(),
      cooldownStore: createMemoryCooldownStore(),
    };
    const cardFactsCache = createCardFactsCache(SYSTEM_CLOCK);
    const classTargetCache = createClassTargetCache();

    await categorizeCards(
      GOLDEN_EXPECTATIONS.map((entry) => ({ title: entry.title, description: entry.description })),
      {
        titleResolver: createTitleResolver(httpOptions),
        entityFactsSource: createEntityFactsSource(httpOptions),
        classRootsSource: createClassRootsSource(httpOptions),
        cardFactsCache,
        classTargetCache,
        logger: makeLogger(),
      },
    );

    const indexRepository = createCollectionIndexRepository(SYSTEM_CLOCK);
    const recorded: RecordedCard[] = GOLDEN_EXPECTATIONS.map((entry, index) => ({
      title: entry.title,
      rarity: goldenRarity(index),
    }));
    await indexRepository.upsert(recorded);

    // Nothing may leave the machine while the summary is computed: the use
    // case has no network port, and the global fetch is trapped to prove it.
    vi.stubGlobal('fetch', () => {
      throw new Error('The summary must not perform any request');
    });
    const summary = await summarizeCollection({
      indexRepository,
      catalogueTotalsRepository: createCatalogueTotalsRepository(SYSTEM_CLOCK),
      cardFactsCache,
      classTargetCache,
    });

    const expectedCounts = new Map<string, number>();
    for (const entry of GOLDEN_EXPECTATIONS) {
      expectedCounts.set(entry.categoryId, (expectedCounts.get(entry.categoryId) ?? 0) + 1);
    }
    const actualCounts = new Map<string, number>(
      summary.categories.map((entry) => [String(entry.categoryId), entry.count]),
    );

    expect(summary.totalCards).toBe(GOLDEN_EXPECTATIONS.length);
    expect(summary.uncategorizedCount).toBe(0);
    expect(actualCounts).toEqual(expectedCounts);
    expect(summary.categories.reduce((total, entry) => total + entry.cards.length, 0)).toBe(
      GOLDEN_EXPECTATIONS.length,
    );
  });
});
