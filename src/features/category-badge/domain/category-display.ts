import type { CategoryId, PersonSubtypeId } from '../../categorization/domain/category';

/**
 * How a category is named and coloured, in one place: the labels the user
 * reads and the accent colour that carries the category on the badge, in the
 * modal and in the highlight panel.
 */

/** Short French labels. A badge sits on a card, so they must stay short. */
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  person: 'Personne',
  film_tv: 'Cinéma et TV',
  music: 'Musique',
  sport: 'Sport',
  living: 'Vivant',
  food_drink: 'Gastronomie',
  monument_building: 'Monument',
  religion_ideas: 'Religion et idées',
  work_culture: 'Oeuvre',
  place: 'Lieu',
  transport_tech: 'Technique',
  event: 'Évènement',
  organization: 'Organisation',
  astronomy: 'Astronomie',
  science_concept: 'Science',
  other: 'Autre',
};

/**
 * The subtypes of a person, `other` excluded: it means "no subtype worth
 * showing", and a card that falls in it reads as a plain person.
 */
export const PERSON_SUBTYPE_LABELS: Record<Exclude<PersonSubtypeId, 'other'>, string> = {
  cinema: 'Cinéma',
  music: 'Musique',
  sport: 'Sport',
  politics: 'Politique',
  science: 'Science',
  literature: 'Littérature',
  art: 'Art',
  media: 'Médias',
};

/**
 * One accent colour per category, used for the dot alone. They are light
 * enough to stay readable on the dark translucent background of our nodes,
 * and spread over the colour wheel so that two categories of a page can be
 * told apart. The two neutral ones are deliberate: an organization and a card
 * left in "other" are the cases where the colour carries no meaning.
 */
export const CATEGORY_ACCENT_COLORS: Record<CategoryId, string> = {
  person: '#6c90e0',
  film_tv: '#826ce0',
  music: '#ac6ce0',
  sport: '#e06cac',
  living: '#6ce082',
  food_drink: '#e0b76c',
  monument_building: '#e0906c',
  religion_ideas: '#d66ce0',
  work_culture: '#e06c6c',
  place: '#6ce0ac',
  transport_tech: '#6cb7e0',
  event: '#d6e06c',
  organization: '#9fb0c4',
  astronomy: '#6ce0e0',
  science_concept: '#ace06c',
  other: '#8b949e',
};
