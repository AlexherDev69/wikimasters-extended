/**
 * A topic tag read from the Wikidata roots a card's own classes reach.
 *
 * The category label alone says "Technique" for a car, a warship, a rifle and
 * a text editor alike: true, and useless as a tag. The roots that decided
 * that category are already resolved and cached for every card, so the more
 * precise word costs nothing to read and nothing to fetch.
 *
 * Only the roots of the technical category carry a topic here. Every other
 * category names itself well enough ("Cinéma et TV", "Musique", "Sport",
 * "Lieu"), and a second word saying the same thing would take a place in the
 * six proposals for nothing.
 */

export interface RootTopic {
  /** A root id of CATEGORY_ROOT_GROUPS, checked against it by the tests. */
  rootId: string;
  tag: string;
}

/**
 * Ordered from the most precise root to the most general one: the first match
 * wins, and a car model reaches both "car model" and "vehicle model".
 */
export const ROOT_TOPICS: readonly RootTopic[] = [
  // car model
  { rootId: 'Q3231690', tag: 'Voitures' },
  // ship
  { rootId: 'Q11446', tag: 'Bateaux' },
  // aircraft model, aircraft family
  { rootId: 'Q15056995', tag: 'Aviation' },
  { rootId: 'Q15056993', tag: 'Aviation' },
  // software
  { rootId: 'Q7397', tag: 'Logiciels' },
  // computer hardware, microarchitecture
  { rootId: 'Q3966', tag: 'Informatique' },
  { rootId: 'Q259864', tag: 'Informatique' },
  // weapon model, weapon
  { rootId: 'Q15142894', tag: 'Armes' },
  { rootId: 'Q728', tag: 'Armes' },
  // tool
  { rootId: 'Q39546', tag: 'Outils' },
  // vehicle model, vehicle: the fallback of anything that moves and is
  // neither a car, a ship nor an aircraft.
  { rootId: 'Q29048322', tag: 'Véhicules' },
  { rootId: 'Q42889', tag: 'Véhicules' },
];

/**
 * The topic of the first root of the table the card reaches, or null. The
 * table is walked rather than the card's roots: the order of the table is the
 * arbitration, while the roots of a card come back sorted by id.
 *
 * "Model series" (Q811701) deliberately carries no topic: it is a series of
 * models of anything at all, and the card always reaches a more precise root
 * beside it when there is one to reach.
 */
export function topicTagFromRoots(matchedRootIds: readonly string[]): string | null {
  const reached = new Set(matchedRootIds);

  return ROOT_TOPICS.find((topic) => reached.has(topic.rootId))?.tag ?? null;
}
