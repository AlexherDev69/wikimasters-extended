import {
  CARD_ATTACK_VALUE_SELECTOR,
  CARD_DEFENSE_VALUE_SELECTOR,
  HIDE_STATS_STYLE_ATTRIBUTE,
  HIDE_STATS_STYLE_SELECTOR,
  MODAL_ATTACK_PANELS_SELECTOR,
  MODAL_DEFENSE_PANELS_SELECTOR,
} from './hide-stats-selectors';

const STYLE_TAG = 'style';

/**
 * The one style sheet of the extension that targets a node of the SITE
 * rather than one of ours. Every other rule this extension ships is scoped
 * to an attribute it writes itself, and lives in the style sheets the
 * manifest always injects; this one hides two numbers the site itself
 * draws, so it cannot live there: a rule of the site would then apply
 * whether the setting is on or off. It is built here instead, appended to
 * `document.head` only while the setting is on, and taken back whole the
 * moment it goes off.
 *
 * `document.head`, never `document.body`: the content script watches
 * `document.body` with `{ childList, subtree, characterData }`, so a node
 * living outside it is never seen by that observer and can never schedule a
 * scan of its own. Appending or removing this one node is the only write
 * this feature ever makes, and it is invisible to the very observer that
 * would otherwise have to write nothing to come to rest.
 *
 * The cascade only decides what is painted: no attribute, class or style is
 * ever written on a node of the site, and nothing is moved or removed.
 * Taking this one node back undoes the hiding completely and at once, which
 * is also why hiding a card's own number gives no advantage on the site: it
 * changes nothing the site itself sees or stores, only what this browser
 * paints.
 */
const HIDE_STATS_CSS = `
/* Card format (grid, large) and the small card the detail modal shows for
   itself: the ATK value block. Hidden with visibility, not display, so the
   row keeps its height and nothing the site laid out above it moves. */
${CARD_ATTACK_VALUE_SELECTOR} {
  visibility: hidden;
}

/* Same shape, the DEF value block. */
${CARD_DEFENSE_VALUE_SELECTOR} {
  visibility: hidden;
}

/* Detail modal: the grid holding the two big ATK/DEF panels, removed whole
   with display so no two empty frames are left in their place. */
${MODAL_ATTACK_PANELS_SELECTOR} {
  display: none;
}

/* Same grid, reached through its other panel: it is the same node either
   way, so stating the rule twice costs nothing and touches nothing twice. */
${MODAL_DEFENSE_PANELS_SELECTOR} {
  display: none;
}
`;

/**
 * Adds the style sheet to `document.head`, and writes NOTHING when it is
 * already there. Called on every scan while the setting is on, exactly like
 * every other sync of the overlay, so a sync repeated with the setting
 * unchanged never touches the page again.
 */
export function applyHideCardStats(document: Document): void {
  if (document.head.querySelector(HIDE_STATS_STYLE_SELECTOR) !== null) {
    return;
  }
  const style = document.createElement(STYLE_TAG);
  style.setAttribute(HIDE_STATS_STYLE_ATTRIBUTE, '');
  style.textContent = HIDE_STATS_CSS;
  document.head.appendChild(style);
}

/**
 * Takes the style sheet back, and writes NOTHING when there is none. Called
 * when the setting is switched off and when the content script context is
 * invalidated, so reloading the extension never leaves the site's own
 * numbers hidden with nothing left on the page to undo it.
 */
export function removeHideCardStats(document: Document): void {
  document.head.querySelector(HIDE_STATS_STYLE_SELECTOR)?.remove();
}
