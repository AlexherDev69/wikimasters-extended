import { formatCount, formatPercent } from '../domain/format-share';
import { pullShares, totalPulls, type PullShare, type PullTally } from '../domain/pull-tally';

/**
 * The panel of the page of the packs: what the user has pulled so far, one
 * row per rarity. It is added under the block that counts the packs left, so
 * it is read exactly where the user is already waiting for the next one, and
 * it is never drawn over a card.
 *
 * Only our own nodes are created, and the block of the site is only ever read
 * and used as an anchor: not one of its attributes, classes or styles is
 * touched.
 */

const PANEL_TAG = 'div';
const ROW_TAG = 'div';
const TEXT_TAG = 'span';

/** Marks the panel, so a second sync finds the one already there. */
const PULL_STATS_ATTRIBUTE = 'data-wme-pull-stats';
export const PULL_STATS_SELECTOR = `[${PULL_STATS_ATTRIBUTE}]`;

/**
 * What the panel currently shows. It is the comparison key of the zero write
 * rule: a panel already showing these very counts costs no mutation at all,
 * and the observer of the content script comes to rest.
 */
const PULL_STATS_KEY_ATTRIBUTE = 'data-wme-pull-stats-key';

/** Carries the colour of the rarity, which the style sheet reads. */
const ROW_RARITY_ATTRIBUTE = 'data-wme-pull-rarity';

const PANEL_CLASS = 'wme-pull-stats';
const HEAD_CLASS = 'wme-pull-stats-head';
const TITLE_CLASS = 'wme-pull-stats-title';
const TOTAL_CLASS = 'wme-pull-stats-total';
const ROWS_CLASS = 'wme-pull-stats-rows';
const ROW_CLASS = 'wme-pull-row';
const LABEL_CLASS = 'wme-pull-label';
const TRACK_CLASS = 'wme-pull-track';
const BAR_CLASS = 'wme-pull-bar';
const PERCENT_CLASS = 'wme-pull-percent';
const COUNT_CLASS = 'wme-pull-count';
const NOTE_CLASS = 'wme-pull-stats-note';

const PANEL_TITLE = 'Tes tirages';
const SINGLE_CARD_TOTAL = 'carte';
const MANY_CARDS_TOTAL = 'cartes';
const EMPTY_NOTE =
  "Aucune carte comptée pour l'instant : ouvre un paquet, les cartes révélées sont comptées " +
  'à partir de maintenant.';

/**
 * Text of the site the block of the packs left always carries, and which no
 * other block of the page does. Matched on the wording rather than on the
 * Tailwind classes around it, which change at every deployment of the site
 * (see docs/DOM_NOTES.md).
 */
const PACKS_LEFT_TEXT = 'paquets disponibles';

/** The one semantic class of the site, which frames its own panels. */
const PANEL_FRAME_SELECTOR = 'div.card-frame';

/** Where the panel goes, and what a previous sync already put there. */
export interface PullStatsTarget {
  /** The block of the site our panel is inserted after, never modified. */
  anchor: Element;
  ourPanel: HTMLElement | null;
}

/**
 * The insertion point on the page of the packs, null everywhere else. Null
 * also while a pack is being opened, the block of the packs left being gone
 * from the page then: the user is looking at the cards, and a panel of
 * numbers has nothing to do over them.
 */
export function findPullStatsTarget(root: ParentNode): PullStatsTarget | null {
  for (const frame of root.querySelectorAll<HTMLElement>(PANEL_FRAME_SELECTOR)) {
    if ((frame.textContent ?? '').includes(PACKS_LEFT_TEXT)) {
      return { anchor: frame, ourPanel: root.querySelector<HTMLElement>(PULL_STATS_SELECTOR) };
    }
  }
  return null;
}

function panelKey(shares: readonly PullShare[]): string {
  return JSON.stringify(shares.map((share) => share.count));
}

function buildRow(document: Document, share: PullShare): HTMLElement {
  const row = document.createElement(ROW_TAG);
  row.className = ROW_CLASS;
  row.setAttribute(ROW_RARITY_ATTRIBUTE, share.rarity);

  const label = document.createElement(TEXT_TAG);
  label.className = LABEL_CLASS;
  label.textContent = share.rarity.toUpperCase();

  const track = document.createElement(TEXT_TAG);
  track.className = TRACK_CLASS;
  // No bar at all rather than a bar of zero width: the style sheet gives
  // every bar a minimum width, so that one card in a thousand still shows,
  // and a rarity never pulled must not borrow that minimum.
  if (share.count > 0) {
    const bar = document.createElement(TEXT_TAG);
    bar.className = BAR_CLASS;
    bar.style.width = `${share.percent}%`;
    track.append(bar);
  }

  const percent = document.createElement(TEXT_TAG);
  percent.className = PERCENT_CLASS;
  percent.textContent = formatPercent(share.percent);

  const count = document.createElement(TEXT_TAG);
  count.className = COUNT_CLASS;
  count.textContent = formatCount(share.count);

  row.append(label, track, percent, count);
  return row;
}

function buildHead(document: Document, total: number): HTMLElement {
  const head = document.createElement(PANEL_TAG);
  head.className = HEAD_CLASS;

  const title = document.createElement(TEXT_TAG);
  title.className = TITLE_CLASS;
  title.textContent = PANEL_TITLE;

  const totalText = document.createElement(TEXT_TAG);
  totalText.className = TOTAL_CLASS;
  const unit = total > 1 ? MANY_CARDS_TOTAL : SINGLE_CARD_TOTAL;
  totalText.textContent = `${formatCount(total)} ${unit}`;

  head.append(title, totalText);
  return head;
}

function buildPanel(document: Document, tally: PullTally, key: string): HTMLElement {
  const panel = document.createElement(PANEL_TAG);
  panel.className = PANEL_CLASS;
  panel.setAttribute(PULL_STATS_ATTRIBUTE, '');
  panel.setAttribute(PULL_STATS_KEY_ATTRIBUTE, key);

  const total = totalPulls(tally);
  panel.append(buildHead(document, total));

  if (total === 0) {
    const note = document.createElement(TEXT_TAG);
    note.className = NOTE_CLASS;
    note.textContent = EMPTY_NOTE;
    panel.append(note);
    return panel;
  }

  const rows = document.createElement(PANEL_TAG);
  rows.className = ROWS_CLASS;
  for (const share of pullShares(tally)) {
    rows.append(buildRow(document, share));
  }
  panel.append(rows);
  return panel;
}

/**
 * Draws the panel under the block of the packs left, and writes strictly
 * nothing when it already shows these counts.
 */
export function applyPullStatsPanel(target: PullStatsTarget, tally: PullTally): void {
  const key = panelKey(pullShares(tally));
  const { ourPanel } = target;

  // The place is checked along with the counts: the site rebuilds its own
  // nodes around ours, and a panel left behind somewhere else on the page
  // would keep the right numbers in the wrong place for good.
  if (
    ourPanel !== null &&
    ourPanel.previousElementSibling === target.anchor &&
    ourPanel.getAttribute(PULL_STATS_KEY_ATTRIBUTE) === key
  ) {
    return;
  }
  ourPanel?.remove();
  const panel = buildPanel(target.anchor.ownerDocument, tally, key);
  target.anchor.insertAdjacentElement('afterend', panel);
}

/** Takes back every panel this feature added, and nothing else. */
export function removePullStatsPanels(root: ParentNode): void {
  for (const panel of root.querySelectorAll(PULL_STATS_SELECTOR)) {
    panel.remove();
  }
}
