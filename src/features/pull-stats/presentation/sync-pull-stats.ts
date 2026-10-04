import type { Logger } from '../../../core/logger/logger';
import type { ObservedCard } from '../../card-detection/data/scan-cards';
import type { Rarity } from '../../card-detection/domain/rarity';
import { findPackReveal } from '../data/pack-reveal';
import { applyPullStatsPanel, findPullStatsTarget } from '../data/pull-stats-panel';
import { addPull, type PullTally } from '../domain/pull-tally';
import type { PullTallyStore } from '../domain/pull-tally-store';

/**
 * Counts the cards a pack reveals, and draws what the user has pulled so far
 * under the block that counts the packs left.
 *
 * Reading only: the extension counts the cards the site shows, exactly as the
 * user sees them. It opens nothing, clicks nothing and asks the site nothing.
 */

/** What survives between two syncs of one page. */
export interface PullStatsState {
  /**
   * What the panel shows. Read from storage when the page loads, then kept in
   * step with what this page counts, and replaced by what the storage holds
   * each time a card is added to it: that one also carries the cards another
   * tab has counted.
   */
  tally: PullTally;
  /**
   * Positions of the pack being revealed that were already counted. The site
   * reveals the five cards one at a time and lets the user walk back and
   * forth between them, so the same card is shown again and again: its
   * position in the pack is what makes it one card and not five.
   */
  countedPositions: Set<number>;
}

export interface PullStatsDeps {
  store: PullTallyStore;
  logger: Logger;
}

export function createPullStatsState(tally: PullTally): PullStatsState {
  return { tally, countedPositions: new Set<number>() };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The card is added to what the storage holds at that moment, never to the
 * tally of this page written back as a whole: the site may be open in another
 * tab, which has counted cards of its own since this one read the storage.
 *
 * A failed write costs the card being counted, nothing more: it stays in the
 * tally of this page, which is what the panel shows, and the next card is
 * added to the storage all the same.
 */
function persist(rarity: Rarity, state: PullStatsState, deps: PullStatsDeps): void {
  deps.store
    .add(rarity)
    .then((stored) => {
      state.tally = stored;
    })
    .catch((error: unknown) => {
      deps.logger.warn('Pull tally write failed', { error: toErrorMessage(error) });
    });
}

/**
 * Counts the card the pack shows right now, once. The pack being revealed is
 * forgotten only when the page positively shows the block of the packs left,
 * which is the screen the site comes back to between two packs: a card
 * missing for one render, between two of its own animations, must never make
 * the next pack look like a new one and count a card twice.
 */
function countReveal(
  isBetweenPacks: boolean,
  cards: readonly ObservedCard[],
  state: PullStatsState,
  deps: PullStatsDeps,
): void {
  if (isBetweenPacks) {
    // Nothing is being revealed, so the pack just closed is forgotten.
    // Counting is left out of this branch entirely, and not merely skipped by
    // the positions: a page showing both would otherwise count the same card
    // at every sync.
    state.countedPositions.clear();
    return;
  }

  const reveal = findPackReveal(cards);
  if (reveal === null || state.countedPositions.has(reveal.index)) {
    return;
  }
  state.countedPositions.add(reveal.index);
  // Counted on this page at once, so the panel never waits for the storage.
  state.tally = addPull(state.tally, reveal.rarity);
  persist(reveal.rarity, state, deps);
}

/**
 * The counting alone, for the mutations of the page of the packs, which are
 * read as they come rather than at the next scan. The site has a card down as
 * seen the instant it is shown, and unlocks its "Continuer" button on that
 * alone: a user who presses its arrow twice in a row never comes back to the
 * card in between, so a scan that comes after it has lost that card for good.
 *
 * Draws nothing, and so writes nothing on the page: the panel is left to
 * `syncPullStats`.
 */
export function countPackReveal(
  root: ParentNode,
  cards: readonly ObservedCard[],
  state: PullStatsState,
  deps: PullStatsDeps,
): void {
  countReveal(findPullStatsTarget(root) !== null, cards, state, deps);
}

/**
 * One pass over the cards of the page: what the pack shows is counted, and
 * the panel is drawn on the screen between two packs.
 */
export function syncPullStats(
  root: ParentNode,
  cards: readonly ObservedCard[],
  state: PullStatsState,
  deps: PullStatsDeps,
): void {
  const target = findPullStatsTarget(root);
  countReveal(target !== null, cards, state, deps);
  if (target !== null) {
    applyPullStatsPanel(target, state.tally);
  }
}
