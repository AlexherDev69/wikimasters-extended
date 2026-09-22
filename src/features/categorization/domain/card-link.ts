import type { CategoryId, PersonSubtypeId } from './category';
import type { EntityFacts } from './entity-facts';
import type { ClassResolution } from './ports';

/**
 * What this pipeline knows about one card once the batch has classified it,
 * handed to whatever builds an address for that card somewhere else.
 *
 * It exists so the pipeline can stop naming the features that read it. This
 * module used to reach into `letterboxd/domain` for the rules of cinema, which
 * put the one thing every other feature depends on in the position of
 * depending on one of them: the pipeline could not be read, moved or replaced
 * without Letterboxd coming along.
 *
 * The direction is now the natural one. A feature that wants an address of its
 * own reads this shape and knows about the pipeline, and the pipeline knows
 * about nobody. Nothing of this crosses a process boundary: the address is
 * built in the worker, and what travels back is the address alone.
 */
export interface ClassifiedCard {
  title: string;
  description: string | null;
  categoryId: CategoryId;
  personSubtypes: readonly PersonSubtypeId[];
  facts: EntityFacts;
  /** The target alone of each class met in this batch, or null for none. */
  categoryTargets: ReadonlyMap<string, CategoryId | null>;
  /** What each class the card claims resolved to, with the roots it matched. */
  categoryResolutions: ReadonlyMap<string, ClassResolution<CategoryId>>;
  /** The same, for the occupations a person claims. */
  occupationResolutions: ReadonlyMap<string, ClassResolution<PersonSubtypeId>>;
}

/**
 * The address a card has on a site of its own, or null when it has none.
 *
 * Injected into `categorizeCards`, so a build that drops the feature drops the
 * rules with it, and a test that has no interest in an address says so by
 * answering null.
 */
export type CardLinkResolver = (card: ClassifiedCard) => string | null;
