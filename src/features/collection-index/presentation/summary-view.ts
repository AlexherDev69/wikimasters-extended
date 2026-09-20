import { createBlock, createButton, createText } from '../../../core/dom/create-elements';
import type { CategoryId } from '../../categorization/domain/category';
import { CATEGORY_ATTRIBUTE } from '../../category-badge/data/badge-selectors';
import {
  CATEGORY_LABELS,
  PERSON_SUBTYPE_LABELS,
} from '../../category-badge/domain/category-display';
import type {
  CategorySummary,
  CollectionSummary,
  RarityCount,
  SubtypeCount,
} from '../domain/collection-summary';
import { COUNT_CLASS, createCategoryDot, LABEL_CLASS, RARITY_LABELS } from './popup-elements';

/**
 * The first screen of the popup: what the index holds, category by category.
 * Every function here takes data and returns nodes, so the whole screen is
 * testable without any browser API.
 *
 * The labels and the colours are those of the badge shown on the cards: one
 * source of truth, so the popup and the page always say the same thing.
 */

const APP_NAME = 'WikiMasters Extended';

const HINT_TEXT =
  "Parcours les pages de ta collection sur le site pour compléter cet index : l'extension ne navigue jamais à ta place.";

const UPDATED_PREFIX = 'Dernière mise à jour : ';
const ONE_CARD_TEXT = 'carte vue dans ta collection';
const MANY_CARDS_TEXT = 'cartes vues dans ta collection';
const UNCATEGORIZED_LABEL = 'Non catégorisées';

/** The persons whose trade is unknown, which is not a subtype of its own. */
const OTHER_SUBTYPE_LABEL = 'Autre';
const EMPTY_TEXT = "Aucune carte dans l'index pour l'instant.";
const ERROR_TEXT = "L'index n'a pas pu être lu. Ferme et rouvre cette fenêtre pour réessayer.";
const LOADING_TEXT = 'Chargement...';

const RESET_LABEL = "Réinitialiser l'index";
const RESET_QUESTION = "Effacer tout l'index ?";
const RESET_CONFIRM_LABEL = 'Oui, effacer';
const RESET_CANCEL_LABEL = 'Annuler';

const EXPAND_LABEL = 'Afficher les sous-types';
const COLLAPSE_LABEL = 'Masquer les sous-types';
const EXPAND_SIGN = '+';
const COLLAPSE_SIGN = '-';

const EXPANDED_ATTRIBUTE = 'aria-expanded';
const ARIA_LABEL_ATTRIBUTE = 'aria-label';
const TRUE = 'true';
const FALSE = 'false';

const PERCENT_SUFFIX = ' %';
const FULL_SHARE = 100;

const DATE_LOCALE = 'fr-FR';
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' };

const SCREEN_CLASS = 'wme-screen';
const HEADER_CLASS = 'wme-header';
const APP_NAME_CLASS = 'wme-app-name';
const TOTAL_CLASS = 'wme-total';
const UPDATED_CLASS = 'wme-updated';
const HINT_CLASS = 'wme-hint';
const RARITIES_CLASS = 'wme-rarities';
const RARITY_CLASS = 'wme-rarity';
const RARITY_CODE_CLASS = 'wme-rarity-code';
const ROWS_CLASS = 'wme-rows';
const ROW_CLASS = 'wme-row';
const ROW_HEAD_CLASS = 'wme-row-head';
const ROW_MAIN_CLASS = 'wme-row-main';
const ROW_STATIC_CLASS = 'wme-row-static';
const ROW_TOGGLE_CLASS = 'wme-row-toggle';
const SHARE_CLASS = 'wme-share';
const BAR_CLASS = 'wme-bar';
const BAR_FILL_CLASS = 'wme-bar-fill';
const SUBTYPES_CLASS = 'wme-subtypes';
const SUBTYPE_CLASS = 'wme-subtype';
const FOOTER_CLASS = 'wme-footer';
const RESET_CLASS = 'wme-reset';
const CONFIRM_CLASS = 'wme-confirm';
const CANCEL_CLASS = 'wme-cancel';
const QUESTION_CLASS = 'wme-question';
const MESSAGE_CLASS = 'wme-message';

/**
 * Where the keyboard focus goes after a render caused by a user action. The
 * screen is rebuilt whole, so the control that continues what the user was
 * doing has to be named for the popup to find it again.
 */
export const SUBTYPE_TOGGLE_SELECTOR = `.${ROW_TOGGLE_CLASS}`;

export const RESET_SELECTOR = `.${RESET_CLASS}`;

export const RESET_CANCEL_SELECTOR = `.${CANCEL_CLASS}`;

export function categoryRowSelector(categoryId: CategoryId): string {
  return `.${ROW_MAIN_CLASS}[${CATEGORY_ATTRIBUTE}="${categoryId}"]`;
}

/** What a click on the summary screen asks the popup to do. */
export interface SummaryCallbacks {
  onOpenCategory: (categoryId: CategoryId) => void;
  onToggleSubtypes: () => void;
  onAskReset: () => void;
  onConfirmReset: () => void;
  onCancelReset: () => void;
}

export interface SummaryViewState {
  summary: CollectionSummary;
  /** The person row is the only one holding subtypes. */
  subtypesExpanded: boolean;
  /** True once the reset was asked for and waits for its confirmation. */
  resetConfirming: boolean;
}

function formatTotal(total: number): string {
  return `${String(total)} ${total > 1 ? MANY_CARDS_TEXT : ONE_CARD_TEXT}`;
}

function formatSeenAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString(DATE_LOCALE, DATE_OPTIONS);
}

function shareOf(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count * FULL_SHARE) / total);
}

function renderHeader(summary: CollectionSummary): HTMLElement {
  const header = createBlock(HEADER_CLASS);
  header.appendChild(createText(APP_NAME_CLASS, APP_NAME));
  header.appendChild(createText(TOTAL_CLASS, formatTotal(summary.totalCards)));
  if (summary.lastSeenAt !== null) {
    header.appendChild(
      createText(UPDATED_CLASS, `${UPDATED_PREFIX}${formatSeenAt(summary.lastSeenAt)}`),
    );
  }
  header.appendChild(createText(HINT_CLASS, HINT_TEXT));
  return header;
}

function renderRarities(rarities: readonly RarityCount[]): HTMLElement {
  const strip = createBlock(RARITIES_CLASS);

  for (const entry of rarities) {
    const item = createBlock(RARITY_CLASS);
    item.appendChild(createText(RARITY_CODE_CLASS, RARITY_LABELS[entry.rarity]));
    item.appendChild(createText(COUNT_CLASS, String(entry.count)));
    strip.appendChild(item);
  }
  return strip;
}

/** The thin proportional bar under a row, purely decorative. */
function renderBar(share: number): HTMLElement {
  const bar = createBlock(BAR_CLASS);
  const fill = createBlock(BAR_FILL_CLASS);
  fill.style.width = `${String(share)}%`;
  bar.appendChild(fill);
  return bar;
}

function renderSubtypeToggle(expanded: boolean, callbacks: SummaryCallbacks): HTMLElement {
  const toggle = createButton(ROW_TOGGLE_CLASS, callbacks.onToggleSubtypes);
  toggle.textContent = expanded ? COLLAPSE_SIGN : EXPAND_SIGN;
  toggle.setAttribute(EXPANDED_ATTRIBUTE, expanded ? TRUE : FALSE);
  toggle.setAttribute(ARIA_LABEL_ATTRIBUTE, expanded ? COLLAPSE_LABEL : EXPAND_LABEL);
  return toggle;
}

function appendSubtype(list: HTMLElement, label: string, count: number): void {
  const item = createBlock(SUBTYPE_CLASS);
  item.appendChild(createText(LABEL_CLASS, label));
  item.appendChild(createText(COUNT_CLASS, String(count)));
  list.appendChild(item);
}

/**
 * The subtypes of the persons, and last the ones carrying none. Without that
 * line, a row saying two hundred persons would expand into lines adding up to
 * a hundred and sixty, with nothing to explain the rest.
 */
function renderSubtypes(subtypes: readonly SubtypeCount[], total: number): HTMLElement {
  const list = createBlock(SUBTYPES_CLASS);
  let named = 0;

  for (const entry of subtypes) {
    appendSubtype(list, PERSON_SUBTYPE_LABELS[entry.subtype], entry.count);
    named += entry.count;
  }

  const remainder = total - named;
  if (remainder > 0) {
    appendSubtype(list, OTHER_SUBTYPE_LABEL, remainder);
  }
  return list;
}

function renderCategoryRow(
  category: CategorySummary,
  total: number,
  state: SummaryViewState,
  callbacks: SummaryCallbacks,
): HTMLElement {
  const share = shareOf(category.count, total);
  const row = createBlock(ROW_CLASS);
  const head = createBlock(ROW_HEAD_CLASS);
  const main = createButton(ROW_MAIN_CLASS, () => {
    callbacks.onOpenCategory(category.categoryId);
  });

  // The category of the row, so the popup can give it the focus back when the
  // user leaves the list of its cards.
  main.setAttribute(CATEGORY_ATTRIBUTE, category.categoryId);
  main.appendChild(createCategoryDot(category.categoryId));
  main.appendChild(createText(LABEL_CLASS, CATEGORY_LABELS[category.categoryId]));
  main.appendChild(createText(COUNT_CLASS, String(category.count)));
  main.appendChild(createText(SHARE_CLASS, `${String(share)}${PERCENT_SUFFIX}`));
  head.appendChild(main);

  // Only a person has subtypes, so only that row carries the expander.
  if (category.subtypes.length > 0) {
    head.appendChild(renderSubtypeToggle(state.subtypesExpanded, callbacks));
  }
  row.appendChild(head);
  row.appendChild(renderBar(share));

  if (category.subtypes.length > 0 && state.subtypesExpanded) {
    row.appendChild(renderSubtypes(category.subtypes, category.count));
  }
  return row;
}

/**
 * The cards the caches cannot classify right now. The row is not a button:
 * they belong to no category, so there is no list to open.
 */
function renderUncategorizedRow(count: number, total: number): HTMLElement {
  const share = shareOf(count, total);
  const row = createBlock(`${ROW_CLASS} ${ROW_STATIC_CLASS}`);
  const head = createBlock(ROW_HEAD_CLASS);

  head.appendChild(createText(LABEL_CLASS, UNCATEGORIZED_LABEL));
  head.appendChild(createText(COUNT_CLASS, String(count)));
  head.appendChild(createText(SHARE_CLASS, `${String(share)}${PERCENT_SUFFIX}`));
  row.appendChild(head);
  row.appendChild(renderBar(share));
  return row;
}

/** The reset, which asks for a confirmation in place rather than in a dialog. */
function renderFooter(state: SummaryViewState, callbacks: SummaryCallbacks): HTMLElement {
  const footer = createBlock(FOOTER_CLASS);

  if (!state.resetConfirming) {
    const reset = createButton(RESET_CLASS, callbacks.onAskReset);
    reset.textContent = RESET_LABEL;
    footer.appendChild(reset);
    return footer;
  }

  const confirm = createButton(CONFIRM_CLASS, callbacks.onConfirmReset);
  confirm.textContent = RESET_CONFIRM_LABEL;
  const cancel = createButton(CANCEL_CLASS, callbacks.onCancelReset);
  cancel.textContent = RESET_CANCEL_LABEL;

  footer.appendChild(createText(QUESTION_CLASS, RESET_QUESTION));
  footer.appendChild(confirm);
  footer.appendChild(cancel);
  return footer;
}

export function renderSummary(state: SummaryViewState, callbacks: SummaryCallbacks): HTMLElement {
  const { summary } = state;
  const screen = createBlock(SCREEN_CLASS);
  const rows = createBlock(ROWS_CLASS);

  for (const category of summary.categories) {
    rows.appendChild(renderCategoryRow(category, summary.totalCards, state, callbacks));
  }
  if (summary.uncategorizedCount > 0) {
    rows.appendChild(renderUncategorizedRow(summary.uncategorizedCount, summary.totalCards));
  }

  screen.appendChild(renderHeader(summary));
  screen.appendChild(renderRarities(summary.rarities));
  screen.appendChild(rows);
  screen.appendChild(renderFooter(state, callbacks));
  return screen;
}

/** Nothing recorded yet: the popup explains how the index fills up. */
export function renderEmptySummary(): HTMLElement {
  const screen = createBlock(SCREEN_CLASS);
  screen.appendChild(createText(APP_NAME_CLASS, APP_NAME));
  screen.appendChild(createText(MESSAGE_CLASS, EMPTY_TEXT));
  screen.appendChild(createText(HINT_CLASS, HINT_TEXT));
  return screen;
}

/** The service worker did not answer, or answered something unexpected. */
export function renderSummaryError(): HTMLElement {
  const screen = createBlock(SCREEN_CLASS);
  screen.appendChild(createText(APP_NAME_CLASS, APP_NAME));
  screen.appendChild(createText(MESSAGE_CLASS, ERROR_TEXT));
  return screen;
}

export function renderSummaryLoading(): HTMLElement {
  const screen = createBlock(SCREEN_CLASS);
  screen.appendChild(createText(MESSAGE_CLASS, LOADING_TEXT));
  return screen;
}
