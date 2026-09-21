import type { ObservedCard } from '../../card-detection/data/scan-cards';
import type { Rarity } from '../../card-detection/domain/rarity';

/**
 * The card a pack being opened shows right now, read from the page of the
 * packs. The site reveals the five cards of a pack one at a time, with a
 * counter above the card and arrows that walk back and forth between them,
 * so the same card is shown again and again: the counter is what tells one
 * card of the pack from another, and it is the only thing that lets a card be
 * counted once.
 *
 * Reads only. Nothing here is ever written on a node of the site, and no
 * click of the site is listened to: the extension watches the reveal exactly
 * as the user sees it.
 */

export interface PackReveal {
  /** Position of the card in its pack, 1 based, as the site writes it. */
  index: number;
  /** How many cards the pack holds, five today, read rather than assumed. */
  total: number;
  rarity: Rarity;
}

/**
 * The counter of the site, three spans reading "Carte", the position and
 * "/ 5", which come out of `textContent` glued together as "Carte1/ 5".
 *
 * Matched on its text and not on its classes on purpose: the Tailwind classes
 * of the site change at every deployment (see docs/DOM_NOTES.md), its French
 * wording does not.
 */
const COUNTER_PATTERN = /^Carte\s*(\d+)\s*\/\s*(\d+)$/;

/**
 * How far above the card the counter is looked for. It sits beside the
 * wrapper of the card, two levels up in the shape measured on 2026-09-21, and
 * a couple of levels of margin absorb a wrapper the site may add without
 * reaching the rest of the page.
 */
const MAX_COUNTER_DEPTH = 4;

const WHITESPACE_RUN = /\s+/g;

function normalizeWhitespace(text: string): string {
  return text.replace(WHITESPACE_RUN, ' ').trim();
}

/** The position and size the counter states, or null when it is not one. */
function readCounter(element: Element | null): { index: number; total: number } | null {
  if (element === null) {
    return null;
  }
  const matched = COUNTER_PATTERN.exec(normalizeWhitespace(element.textContent ?? ''));
  if (matched === null) {
    return null;
  }
  const index = Number(matched[1]);
  const total = Number(matched[2]);

  // A pack of zero cards, or a card at position zero, is not a reveal this
  // code understands: it counts nothing rather than counting something wrong.
  return index >= 1 && total >= 1 && index <= total ? { index, total } : null;
}

/** The counter standing just before one of the ancestors of `element`. */
function counterAbove(element: HTMLElement): { index: number; total: number } | null {
  let node: HTMLElement | null = element;

  for (let depth = 0; depth < MAX_COUNTER_DEPTH && node !== null; depth += 1) {
    const counter = readCounter(node.previousElementSibling);
    if (counter !== null) {
      return counter;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * The card of the pack currently being revealed, or null when the page shows
 * no such thing, which is every page of the site but one and, on that one,
 * every moment but an opening.
 *
 * The cards already scanned are walked rather than the document queried
 * again: the overlay reads the cards of the page once per scan, and a card of
 * the detail modal or of a grid simply has no counter above it.
 */
export function findPackReveal(cards: readonly ObservedCard[]): PackReveal | null {
  for (const observed of cards) {
    const counter = counterAbove(observed.element);
    if (counter !== null) {
      return { index: counter.index, total: counter.total, rarity: observed.card.rarity };
    }
  }
  return null;
}
