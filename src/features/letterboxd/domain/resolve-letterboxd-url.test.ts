import { describe, it, expect } from 'vitest';
import type { ExternalIds } from '../../categorization/domain/entity-facts';
import {
  isLetterboxdUrl,
  resolveLetterboxdUrl,
  type CinemaRoleOccupation,
  type LetterboxdCard,
} from './resolve-letterboxd-url';

const NO_EXTERNAL_IDS: ExternalIds = {
  letterboxdFilm: null,
  letterboxdActor: null,
  letterboxdDirector: null,
  letterboxdWriter: null,
  letterboxdProducer: null,
  letterboxdStudio: null,
  imdbId: null,
  tmdbMovieId: null,
  tmdbPersonId: null,
};

const DIRECTOR: CinemaRoleOccupation = { role: 'director', label: 'réalisateur ou réalisatrice' };
const ACTOR: CinemaRoleOccupation = { role: 'actor', label: 'acteur ou actrice' };
const WRITER: CinemaRoleOccupation = { role: 'writer', label: 'scénariste' };
const PRODUCER: CinemaRoleOccupation = { role: 'producer', label: 'producteur de cinéma' };

/** Ids a hostile or sloppy Wikidata edit could put in a card. */
const MALICIOUS_IDS: readonly string[] = [
  '../../evil',
  'x/?a=b',
  'javascript:alert(1)',
  'Quentin-Tarantino',
  'quentin tarantino',
  'https://evil.example.com/film/x',
  '',
];

function makeCard(card: Partial<LetterboxdCard>): LetterboxdCard {
  return {
    title: 'Sans titre',
    description: null,
    categoryId: null,
    personSubtypes: [],
    externalIds: NO_EXTERNAL_IDS,
    isFilm: false,
    cinemaRoles: [],
    ...card,
  };
}

function makeFilm(externalIds: Partial<ExternalIds>, title = 'Pulp Fiction'): LetterboxdCard {
  return makeCard({
    title,
    categoryId: 'film_tv',
    isFilm: true,
    externalIds: { ...NO_EXTERNAL_IDS, ...externalIds },
  });
}

function makePerson(
  cinemaRoles: readonly CinemaRoleOccupation[],
  externalIds: Partial<ExternalIds> = {},
  description: string | null = null,
  title = 'Quentin Tarantino',
): LetterboxdCard {
  return makeCard({
    title,
    description,
    categoryId: 'person',
    personSubtypes: cinemaRoles.length === 0 ? [] : ['cinema'],
    cinemaRoles,
    externalIds: { ...NO_EXTERNAL_IDS, ...externalIds },
  });
}

describe('resolveLetterboxdUrl', () => {
  it('should link to the film page when the film has a Letterboxd id', () => {
    const card = makeFilm({ letterboxdFilm: 'pulp-fiction', tmdbMovieId: '680', imdbId: 'tt0110912' });

    expect(resolveLetterboxdUrl(card)).toBe('https://letterboxd.com/film/pulp-fiction/');
  });

  it('should fall back to the TMDb id when the film has no Letterboxd id', () => {
    const card = makeFilm({ tmdbMovieId: '680', imdbId: 'tt0110912' });

    expect(resolveLetterboxdUrl(card)).toBe('https://letterboxd.com/tmdb/680/');
  });

  it('should fall back to the IMDb id when the film has neither Letterboxd nor TMDb id', () => {
    const card = makeFilm({ imdbId: 'tt0110912' });

    expect(resolveLetterboxdUrl(card)).toBe('https://letterboxd.com/imdb/tt0110912/');
  });

  it('should fall back to a search when the film has no external id at all', () => {
    const card = makeFilm({}, 'Paprika (film, 2006)');

    expect(resolveLetterboxdUrl(card)).toBe('https://letterboxd.com/search/Paprika/');
  });

  it('should ignore a malformed film id and apply the next fallback', () => {
    for (const id of MALICIOUS_IDS) {
      const card = makeFilm({ letterboxdFilm: id, tmdbMovieId: '680' });

      expect(resolveLetterboxdUrl(card)).toBe('https://letterboxd.com/tmdb/680/');
    }
  });

  it('should ignore a TMDb id that is not made of digits and an IMDb id without its prefix', () => {
    const card = makeFilm({ tmdbMovieId: '68a', imdbId: 'co0057113' }, 'Lost River (film)');

    expect(resolveLetterboxdUrl(card)).toBe('https://letterboxd.com/search/Lost%20River/');
  });

  it('should return no link when the card is a television item', () => {
    const series = makeCard({
      title: 'Breaking Bad',
      categoryId: 'film_tv',
      isFilm: false,
      externalIds: { ...NO_EXTERNAL_IDS, imdbId: 'tt0903747' },
    });

    expect(resolveLetterboxdUrl(series)).toBeNull();
  });

  it('should link to the id of the dominant role when the description names it', () => {
    const card = makePerson(
      [WRITER, ACTOR, PRODUCER, DIRECTOR],
      { letterboxdDirector: 'quentin-tarantino', letterboxdActor: 'quentin-tarantino-actor' },
      'réalisateur, scénariste, producteur et acteur américain',
    );

    expect(resolveLetterboxdUrl(card)).toBe('https://letterboxd.com/director/quentin-tarantino/');
  });

  it('should link to the actor page when the description names the actress variant first', () => {
    const card = makePerson(
      [ACTOR, PRODUCER],
      { letterboxdActor: 'marion-cotillard', letterboxdProducer: 'marion-cotillard-producer' },
      'actrice et productrice française',
      'Marion Cotillard',
    );

    expect(resolveLetterboxdUrl(card)).toBe('https://letterboxd.com/actor/marion-cotillard/');
  });

  it('should fall back to the first role in order when the description names none', () => {
    const card = makePerson(
      [PRODUCER, ACTOR],
      { letterboxdActor: 'jisoo', letterboxdProducer: 'jisoo-producer' },
      'chanteuse et danseuse sud-coréenne',
      'Kim Ji-soo',
    );

    expect(resolveLetterboxdUrl(card)).toBe('https://letterboxd.com/actor/jisoo/');
  });

  it('should use the id of another role when the dominant one has no id', () => {
    const card = makePerson([DIRECTOR, ACTOR], { letterboxdActor: 'lillian-gish' }, 'réalisatrice et actrice américaine');

    expect(resolveLetterboxdUrl(card)).toBe('https://letterboxd.com/actor/lillian-gish/');
  });

  it('should search by name when a person with a cinema occupation has no usable id', () => {
    const card = makePerson([ACTOR, PRODUCER], { letterboxdActor: '../../evil' }, null, 'Phil Collins');

    expect(resolveLetterboxdUrl(card)).toBe('https://letterboxd.com/search/Phil%20Collins/');
  });

  it('should search by name when the person has a cinema subtype but no role at all', () => {
    // A cinematographer is `cinema` and has no Letterboxd path of its own.
    const card = makeCard({
      title: 'Ray Ventura',
      categoryId: 'person',
      personSubtypes: ['cinema', 'music'],
      cinemaRoles: [],
    });

    expect(resolveLetterboxdUrl(card)).toBe('https://letterboxd.com/search/Ray%20Ventura/');
  });

  it('should return no link for a person without any cinema occupation, ids included', () => {
    const einstein = makeCard({
      title: 'Albert Einstein',
      categoryId: 'person',
      personSubtypes: ['science'],
      externalIds: { ...NO_EXTERNAL_IDS, letterboxdActor: 'albert-einstein', imdbId: 'nm0251868' },
    });

    expect(resolveLetterboxdUrl(einstein)).toBeNull();
  });

  it('should link to the studio page of an organization that has a studio id', () => {
    const card = makeCard({
      title: 'A24',
      categoryId: 'organization',
      externalIds: { ...NO_EXTERNAL_IDS, letterboxdStudio: 'a24' },
    });

    expect(resolveLetterboxdUrl(card)).toBe('https://letterboxd.com/studio/a24/');
  });

  it('should return no link for an organization without a studio id', () => {
    const card = makeCard({
      title: "McDonald's",
      categoryId: 'organization',
      externalIds: { ...NO_EXTERNAL_IDS, imdbId: 'co0057113' },
    });

    expect(resolveLetterboxdUrl(card)).toBeNull();
  });

  it('should return no link for any other category and for an uncategorized card', () => {
    expect(resolveLetterboxdUrl(makeCard({ categoryId: 'music' }))).toBeNull();
    expect(resolveLetterboxdUrl(makeCard({ categoryId: 'place' }))).toBeNull();
    expect(resolveLetterboxdUrl(makeCard({ categoryId: null }))).toBeNull();
  });

  it('should remove only a parenthetical placed at the very end of the title', () => {
    const card = makeFilm({}, 'Harry Potter (film) et la coupe de feu');

    expect(resolveLetterboxdUrl(card)).toBe(
      'https://letterboxd.com/search/Harry%20Potter%20(film)%20et%20la%20coupe%20de%20feu/',
    );
  });

  it('should keep the title when it is made of a parenthetical only', () => {
    const card = makeFilm({}, '(film)');

    expect(resolveLetterboxdUrl(card)).toBe('https://letterboxd.com/search/(film)/');
  });

  it('should encode the separators of the search text', () => {
    const card = makeFilm({}, "L'Esquive / a#b?c");

    expect(resolveLetterboxdUrl(card)).toBe(
      "https://letterboxd.com/search/L'Esquive%20%2F%20a%23b%3Fc/",
    );
  });

  it('should encode the accented characters of the search text', () => {
    const card = makePerson([ACTOR], {}, null, 'Mikkel Boe Følsgaard');

    expect(resolveLetterboxdUrl(card)).toBe(
      'https://letterboxd.com/search/Mikkel%20Boe%20F%C3%B8lsgaard/',
    );
  });

  it('should never return a URL outside the Letterboxd origin', () => {
    const hostileIds: ExternalIds = {
      letterboxdFilm: '../../evil',
      letterboxdActor: 'https://evil.example.com',
      letterboxdDirector: 'javascript:alert(1)',
      letterboxdWriter: 'a/../..',
      letterboxdProducer: 'x/?a=b',
      letterboxdStudio: '//evil.example.com',
      imdbId: 'tt1/../evil',
      tmdbMovieId: '1/evil',
      tmdbPersonId: '1',
    };
    const cards: LetterboxdCard[] = [
      makeCard({ title: '//evil.example.com', categoryId: 'film_tv', isFilm: true, externalIds: hostileIds }),
      makeCard({
        title: 'https://evil.example.com',
        categoryId: 'person',
        personSubtypes: ['cinema'],
        cinemaRoles: [DIRECTOR, ACTOR, WRITER, PRODUCER],
        externalIds: hostileIds,
      }),
      makeCard({ title: 'Evil', categoryId: 'organization', externalIds: hostileIds }),
    ];

    for (const card of cards) {
      const url = resolveLetterboxdUrl(card);
      if (url === null) {
        continue;
      }
      expect(new URL(url).origin).toBe('https://letterboxd.com');
      expect(isLetterboxdUrl(url)).toBe(true);
    }
  });
});

describe('isLetterboxdUrl', () => {
  it('should accept a URL of the Letterboxd origin only', () => {
    expect(isLetterboxdUrl('https://letterboxd.com/film/pulp-fiction/')).toBe(true);
    expect(isLetterboxdUrl('https://letterboxd.com.evil.example.com/film/x/')).toBe(false);
    expect(isLetterboxdUrl('http://letterboxd.com/film/x/')).toBe(false);
    expect(isLetterboxdUrl('https://evil.example.com/')).toBe(false);
    expect(isLetterboxdUrl(null)).toBe(false);
    expect(isLetterboxdUrl(42)).toBe(false);
  });
});
