import type { Logger } from '../../../core/logger/logger';
import type { ObservedCard } from '../../card-detection/data/scan-cards';
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
  /** Read from storage once, then kept in step with what has been counted. */
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
 * A failed write costs the card being counted, nothing more: the tally kept
 * in memory stays right for this page, and the next card that is counted
 * writes the whole of it again.
 */
function persist(tally: PullTally, deps: PullStatsDeps): void {
  deps.store.write(tally).catch((error: unknown) => {
    deps.logger.warn('Pull tally write failed', { error: toErrorMessage(error) });
  });
}

/**
 * One pass over the cards of the page. The pack being revealed is forgotten
 * only when the page positively shows the block of the packs left, which is
 * the screen the site comes back to between two packs: a card missing for one
 * render, between two of its own animations, must never make the next pack
 * look like a new one and count a card twice.
 */
export function syncPullStats(
  root: ParentNode,
  cards: readonly ObservedCard[],
  state: PullStatsState,
  deps: PullStatsDeps,
): void {
  const target = findPullStatsTarget(root);
  if (target !== null) {
    // The screen between two packs: nothing is being revealed, so the pack
    // just closed is forgotten and the panel is drawn. Counting is left out
    // of this branch entirely, and not merely skipped by the positions: a
    // page showing both would otherwise count the same card at every sync.
    state.countedPositions.clear();
    applyPullStatsPanel(target, state.tally);
    return;
  }

  const reveal = findPackReveal(cards);
  if (reveal === null || state.countedPositions.has(reveal.index)) {
    return;
  }
  state.countedPositions.add(reveal.index);
  state.tally = addPull(state.tally, reveal.rarity);
  persist(state.tally, deps);
}
