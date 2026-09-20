import { describe, it, expect } from 'vitest';
import { CATEGORY_ROOT_GROUPS } from '../../categorization/domain/category-roots';
import { ROOT_TOPICS, topicTagFromRoots } from './root-topic';

/** Real, measured on the live service 2026-09-21: what "Alfa Romeo 147" reaches. */
const CAR_MODEL_ROOTS = ['Q29048322', 'Q3231690'];

describe('topicTagFromRoots', () => {
  it('should name the topic of a card the category label cannot name', () => {
    expect(topicTagFromRoots(CAR_MODEL_ROOTS)).toBe('Voitures');
  });

  it('should prefer the most precise root over the general one it also reaches', () => {
    // Both are reached by every car model, and the table settles the order.
    expect(topicTagFromRoots(['Q29048322'])).toBe('Véhicules');
    expect(topicTagFromRoots(CAR_MODEL_ROOTS)).toBe('Voitures');
  });

  it('should return nothing for roots that name no topic', () => {
    // "Model series", and the roots of every other category.
    expect(topicTagFromRoots(['Q811701', 'Q5398426'])).toBeNull();
    expect(topicTagFromRoots([])).toBeNull();
  });

  it('should only name roots the categorization actually resolves', () => {
    // A root absent from the groups is never queried, so its topic could
    // never fire: this catches the table drifting away from the lists.
    const known = new Set(CATEGORY_ROOT_GROUPS.flatMap((group) => group.rootIds));

    for (const topic of ROOT_TOPICS) {
      expect(known.has(topic.rootId)).toBe(true);
    }
  });
});
