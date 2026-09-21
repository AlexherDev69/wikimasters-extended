import { CARD_BUTTON_SELECTOR } from '../../letterboxd/data/card-button-selectors';
import {
  COMPACT_CARD_SELECTOR,
  COMPACT_PICTURE_SELECTOR,
  COMPACT_STYLE_ATTRIBUTE,
  COMPACT_STYLE_SELECTOR,
  COMPACT_TEXT_SELECTOR,
} from './compact-selectors';

const STYLE_TAG = 'style';

/**
 * Where the picture stops and the text starts, once the description and the
 * numbers are out of the way. The site puts that line at 45 % of the card and
 * fills the rest with three blocks; with one title left, the picture takes
 * the room they gave back.
 */
const SPLIT_PERCENT = '68%';

/**
 * The second of the two style sheets this extension aims at nodes of the
 * SITE (the first hides the card statistics), and it works exactly the same
 * way: it is built here, appended to `document.head` only while the compact
 * view is on, and taken back whole the moment it goes off.
 *
 * `document.head`, never `document.body`: the content script watches
 * `document.body`, so a node living outside it is never seen by that observer
 * and can never schedule a scan of its own.
 *
 * The cascade only decides what is painted: no attribute, class or style is
 * ever written on a node of the site, nothing is moved and nothing is
 * removed. The site keeps exactly the document it built, its own numbers and
 * tags included, and taking this one node back brings the cards it draws back
 * to their full size at once.
 *
 * Nothing here is `!important`: each rule names the card root through the
 * site's own `glow-<rarity>` class plus a negation, which already outweighs
 * the single utility class Tailwind writes the size with.
 */
const COMPACT_CSS = `
/* The card itself, at about two thirds of the size the site gives it. The
   shape is the site's own clamp, scaled: the narrowest cards still follow
   the viewport, and the widest stop at a fixed size. */
${COMPACT_CARD_SELECTOR} {
  width: clamp(5.4rem, 27vw, 6.5rem);
  height: clamp(7.6rem, 37.8vw, 9.1rem);
}

/* The picture takes the room the description and the numbers gave back. */
${COMPACT_PICTURE_SELECTOR} {
  height: ${SPLIT_PERCENT};
}

/* The text area starts where the picture stops, on a padding of its own:
   the site's 12 px would leave nothing for the title at this size. */
${COMPACT_TEXT_SELECTOR} {
  top: ${SPLIT_PERCENT};
  padding: 4px 5px;
}

/* Of that area, the title alone is kept. The description, the tags and the
   ATK/DEF row are what a compact view trades away for the cards it fits on
   screen, and they are one click away in the detail modal, which this sheet
   never touches. Our own Letterboxd mark is spared by name: it is not a node
   of the site, and it is moved rather than hidden, just below. */
${COMPACT_TEXT_SELECTOR} > *:not(h3):not(${CARD_BUTTON_SELECTOR}) {
  display: none;
}

/* The title, one size down and tighter, so two lines still fit. */
${COMPACT_TEXT_SELECTOR} > h3 {
  font-size: 10px;
  line-height: 1.15;
}

/* Our Letterboxd mark sits in the band the ATK/DEF row leaves free at the
   foot of the text area. That band is gone, so the mark moves just above the
   text area instead, into the bottom right corner of the picture, where the
   site draws its own dark fade. */
${COMPACT_CARD_SELECTOR} ${CARD_BUTTON_SELECTOR} {
  top: -15px;
  bottom: auto;
}
`;

/**
 * Adds the style sheet to `document.head`, and writes NOTHING when it is
 * already there. Called on every scan while the view is on, exactly like
 * every other sync of the overlay.
 */
export function applyCompactStyle(document: Document): void {
  if (document.head.querySelector(COMPACT_STYLE_SELECTOR) !== null) {
    return;
  }
  const style = document.createElement(STYLE_TAG);
  style.setAttribute(COMPACT_STYLE_ATTRIBUTE, '');
  style.textContent = COMPACT_CSS;
  document.head.appendChild(style);
}

/**
 * Takes the style sheet back, and writes NOTHING when there is none. Called
 * when the view is switched off, when the page leaves the two routes that
 * offer it, when the setting is switched off and when the content script
 * context is invalidated: reloading the extension must never leave the cards
 * of the site smaller with nothing left on the page to undo it.
 */
export function removeCompactStyle(document: Document): void {
  document.head.querySelector(COMPACT_STYLE_SELECTOR)?.remove();
}
