import type { CategoryId, PersonSubtypeId } from './category';

/**
 * Bump whenever a root list below changes. It invalidates the class target
 * cache only: the raw facts cached per card stay valid and are never refetched.
 *
 * Version 2 tunes the lists against 100 real cards, so the class caches written
 * by version 1 must be recomputed.
 */
export const ROOTS_VERSION = 2;

export const HUMAN_CLASS_ID = 'Q5';

export interface RootGroup<TTarget> {
  target: TTarget;
  /** Wikidata class ids reached through `P279*` from the class being resolved. */
  rootIds: readonly string[];
}

/**
 * Order matters: for one class, the FIRST group containing one of its roots
 * wins. A Wikidata class usually reaches several roots, so the order encodes
 * real arbitrations. The same target may appear in several groups when its
 * roots need different priorities.
 */
export const CATEGORY_ROOT_GROUPS: readonly RootGroup<CategoryId>[] = [
  {
    target: 'film_tv',
    // film, film series, television program, television series, season, episode
    rootIds: ['Q11424', 'Q24856', 'Q15416', 'Q5398426', 'Q3464665', 'Q21191270'],
  },
  {
    target: 'music',
    // musical ensemble, musical work, musical composition, album, single
    rootIds: ['Q2088357', 'Q2188189', 'Q105543609', 'Q482994', 'Q134556'],
  },
  {
    target: 'sport',
    // sporting event, sports competition, sports club, sports team, sports
    // season, competition at a multi-sport event, type of sport, sport
    rootIds: [
      'Q16510064',
      'Q13406554',
      'Q847017',
      'Q12973014',
      'Q27020041',
      'Q51031626',
      'Q31629',
      'Q349',
    ],
  },
  {
    target: 'living',
    // taxon, organisms known by a particular common name, organism
    rootIds: ['Q16521', 'Q55983715', 'Q7239'],
  },
  {
    target: 'food_drink',
    // food, drink, dish, food and beverage
    rootIds: ['Q2095', 'Q40050', 'Q746549', 'Q118451828'],
  },
  {
    target: 'place',
    // body of water: a reservoir lake is also an architectural structure, so
    // this root must be read before monument_building.
    rootIds: ['Q15324'],
  },
  {
    target: 'monument_building',
    // built structure, archaeological site, monument
    rootIds: ['Q811979', 'Q839954', 'Q4989906'],
  },
  {
    target: 'religion_ideas',
    // religion, worldview, ideology, belief system, philosophical movement,
    // philosophy, mythology, school of thought. Must precede organization:
    // in Wikidata a religion is a subclass of organization.
    rootIds: ['Q9174', 'Q49447', 'Q7257', 'Q5390013', 'Q2915955', 'Q5891', 'Q9134', 'Q1387659'],
  },
  {
    target: 'work_culture',
    // video game, work of art, literary work, written work, comic, genre,
    // art movement, fictional entity, media franchise, creative work
    rootIds: [
      'Q7889',
      'Q838948',
      'Q7725634',
      'Q47461344',
      'Q1004',
      'Q483394',
      'Q968159',
      'Q14897293',
      'Q196600',
      'Q17537576',
    ],
  },
  {
    target: 'place',
    // administrative territorial entity, human settlement, country,
    // geographical feature, region
    rootIds: ['Q56061', 'Q486972', 'Q6256', 'Q618123', 'Q82794'],
  },
  {
    target: 'transport_tech',
    // vehicle, ship, model series, aircraft family, aircraft model, car model,
    // vehicle model, computer hardware, microarchitecture, software, weapon,
    // weapon model, tool
    rootIds: [
      'Q42889',
      'Q11446',
      'Q811701',
      'Q15056993',
      'Q15056995',
      'Q3231690',
      'Q29048322',
      'Q3966',
      'Q259864',
      'Q7397',
      'Q728',
      'Q15142894',
      'Q39546',
    ],
  },
  {
    target: 'event',
    // battle, war, planned event, disaster, accident, historical event.
    // "occurrence" Q1190554 is deliberately absent: it is so generic that a
    // religion reached it through "way of life", and so did a neurotoxin.
    rootIds: ['Q178561', 'Q198', 'Q1656682', 'Q3839081', 'Q171558', 'Q13418847'],
  },
  {
    target: 'organization',
    // trademark, business, political party, organization
    rootIds: ['Q167270', 'Q4830453', 'Q7278', 'Q43229'],
  },
  {
    target: 'astronomy',
    // astronomical object
    rootIds: ['Q6999'],
  },
  {
    target: 'science_concept',
    // academic discipline, chemical element, chemical compound, disease, gene,
    // protein, concept
    rootIds: ['Q11862829', 'Q11344', 'Q11173', 'Q12136', 'Q7187', 'Q8054', 'Q151885'],
  },
];

/**
 * Same ordering rule applied to P106 occupations, at CLASS level: `media` comes
 * first because "television presenter" is a subclass of "actor" in Wikidata,
 * which used to tag journalists as cinema.
 */
export const OCCUPATION_ROOT_GROUPS: readonly RootGroup<PersonSubtypeId>[] = [
  {
    target: 'media',
    // journalist, television presenter, news presenter, radio personality,
    // presenter, podcaster
    rootIds: ['Q1930187', 'Q947873', 'Q270389', 'Q2722764', 'Q13590141', 'Q15077007'],
  },
  {
    target: 'cinema',
    // actor, film director, screenwriter, film producer, cinematographer,
    // film editor, filmmaker
    rootIds: ['Q33999', 'Q2526255', 'Q28389', 'Q3282637', 'Q222344', 'Q7042855', 'Q1414443'],
  },
  {
    target: 'music',
    // musician, composer, songwriter, conductor
    rootIds: ['Q639669', 'Q36834', 'Q753110', 'Q158852'],
  },
  {
    target: 'sport',
    // athlete, coach, sportsperson
    rootIds: ['Q2066131', 'Q41583', 'Q50995749'],
  },
  {
    target: 'politics',
    // politician, statesperson, diplomat, monarch, aristocrat
    rootIds: ['Q82955', 'Q372436', 'Q193391', 'Q116', 'Q2478141'],
  },
  {
    target: 'science',
    // scientist, university teacher, engineer, physician
    rootIds: ['Q901', 'Q1622272', 'Q81096', 'Q39631'],
  },
  {
    target: 'literature',
    // writer
    rootIds: ['Q36180'],
  },
  {
    target: 'art',
    // artist, visual artist, architect. Visual artist is needed because
    // "painter" does not reach "artist" in Wikidata.
    rootIds: ['Q483501', 'Q3391743', 'Q42973'],
  },
];

/**
 * Tie-break of the category vote, declared explicitly and NOT derived from the
 * group order: the two orders answer different questions. The group order
 * resolves ONE class to one target, while this order arbitrates between the
 * targets of several classes that got the same number of votes. Deriving it
 * silently moved `place` above three other categories when the body of water
 * group was inserted early to beat monument_building on a single class.
 */
export const CATEGORY_PRIORITY: readonly CategoryId[] = [
  'film_tv',
  'music',
  'sport',
  'living',
  'food_drink',
  'monument_building',
  'religion_ideas',
  'work_culture',
  'place',
  'transport_tech',
  'event',
  'organization',
  'astronomy',
  'science_concept',
];

/**
 * Person level order, used for the vote tie-break and for sorting
 * `personSubtypes`. It differs from the class level order on purpose: `media`
 * comes LAST here so that a side occupation does not outrank the main one on a
 * tie (a politician who also writes columns stays a politician).
 */
export const PERSON_SUBTYPE_PRIORITY: readonly PersonSubtypeId[] = [
  'cinema',
  'music',
  'sport',
  'politics',
  'science',
  'literature',
  'art',
  'media',
];
