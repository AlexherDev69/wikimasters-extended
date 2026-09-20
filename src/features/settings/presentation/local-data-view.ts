import { createBlock, createButton, createText } from '../../../core/dom/create-elements';
import type { StorageStats } from '../domain/storage-stats';
import { createParagraph, createSection } from './options-elements';

/**
 * What the extension holds on this machine, and the two ways to empty it. Both
 * actions ask for their confirmation in place, as the reset of the statistics
 * window does: a dialog of the browser would take the focus out of the page.
 */

const SECTION_TITLE = 'Données locales';

/** The two actions, in the order the section shows them. */
const MAINTENANCE_ACTIONS = ['categorization-cache', 'collection-index'] as const;

export type MaintenanceActionId = (typeof MAINTENANCE_ACTIONS)[number];

const COUNT_LABELS: readonly { key: keyof StorageStats; label: string }[] = [
  { key: 'cardFacts', label: 'Cartes en cache de catégorisation' },
  { key: 'classTargets', label: 'Classes Wikidata en cache' },
  { key: 'collectionCards', label: "Cartes dans l'index de collection" },
];

interface ActionText {
  button: string;
  hint: string;
  question: string;
  confirm: string;
}

const CACHE_HINT =
  'Efface les faits Wikidata gardés pour chaque carte et la catégorie gardée pour chaque classe. ' +
  'Les cartes seront redemandées à fr.wikipedia.org et à query.wikidata.org la prochaine fois que tu les affiches.';

const INDEX_HINT =
  "Efface la liste des cartes vues dans ta collection : les statistiques repartent de zéro et se " +
  'remplissent à nouveau au fil de ce que tu affiches. Le cache de catégorisation reste en place.';

const ACTION_TEXTS: Record<MaintenanceActionId, ActionText> = {
  'categorization-cache': {
    button: 'Vider le cache de catégorisation',
    hint: CACHE_HINT,
    question: 'Vider le cache de catégorisation ?',
    confirm: 'Oui, vider',
  },
  'collection-index': {
    button: "Réinitialiser l'index de collection",
    hint: INDEX_HINT,
    question: "Effacer tout l'index de collection ?",
    confirm: 'Oui, effacer',
  },
};

const CANCEL_LABEL = 'Annuler';
const LOADING_TEXT = 'Chargement...';
const ERROR_TEXT =
  "Les données locales n'ont pas pu être lues. Recharge cette page pour réessayer.";

/** Said next to the action that failed: nothing was erased, it can be retried. */
const CLEAR_ERROR_TEXTS: Record<MaintenanceActionId, string> = {
  'categorization-cache': "Le cache n'a pas pu être vidé. Réessaie dans un instant.",
  'collection-index': "L'index n'a pas pu être effacé. Réessaie dans un instant.",
};

const ACTION_ATTRIBUTE = 'data-wme-action';
const CONFIRM_ATTRIBUTE = 'data-wme-confirm';
const CANCEL_ATTRIBUTE = 'data-wme-cancel';

const STATS_CLASS = 'wme-stats';
const STAT_CLASS = 'wme-stat';
const STAT_LABEL_CLASS = 'wme-stat-label';
const STAT_COUNT_CLASS = 'wme-stat-count';
const MESSAGE_CLASS = 'wme-message';
const ACTION_CLASS = 'wme-action';
const ACTION_HINT_CLASS = 'wme-action-hint';
const ACTION_BUTTON_CLASS = 'wme-action-button';
const CONFIRM_ROW_CLASS = 'wme-confirm-row';
const QUESTION_CLASS = 'wme-question';
const CONFIRM_CLASS = 'wme-confirm';
const CANCEL_CLASS = 'wme-cancel';
const ACTION_ERROR_CLASS = 'wme-action-error';

/** Where the focus goes back when a confirmation is cancelled. */
export function actionSelector(action: MaintenanceActionId): string {
  return `button[${ACTION_ATTRIBUTE}="${action}"]`;
}

/** The safe answer of a confirmation, which takes the focus when it opens. */
export function cancelSelector(action: MaintenanceActionId): string {
  return `button[${CANCEL_ATTRIBUTE}="${action}"]`;
}

export interface LocalDataCallbacks {
  onAskClear: (action: MaintenanceActionId) => void;
  onConfirmClear: (action: MaintenanceActionId) => void;
  onCancelClear: (action: MaintenanceActionId) => void;
}

export interface LocalDataState {
  /** Null while the counts are being read. */
  stats: StorageStats | null;
  /** True when the counts could not be read: nothing is known of the storage. */
  failed: boolean;
  /**
   * The action whose last run failed, null when none did. Kept apart from
   * `failed`: a deletion that did not go through says nothing about the counts,
   * which stay on screen and stay right.
   */
  clearFailed: MaintenanceActionId | null;
  /** The action waiting for its confirmation, null when none is. */
  confirming: MaintenanceActionId | null;
}

function renderCounts(stats: StorageStats): HTMLElement {
  const list = createBlock(STATS_CLASS);

  for (const { key, label } of COUNT_LABELS) {
    const row = createBlock(STAT_CLASS);
    row.appendChild(createText(STAT_LABEL_CLASS, label));
    row.appendChild(createText(STAT_COUNT_CLASS, String(stats[key])));
    list.appendChild(row);
  }
  return list;
}

function renderConfirmation(
  action: MaintenanceActionId,
  callbacks: LocalDataCallbacks,
): HTMLElement {
  const text = ACTION_TEXTS[action];
  const row = createBlock(CONFIRM_ROW_CLASS);

  const confirm = createButton(CONFIRM_CLASS, () => {
    callbacks.onConfirmClear(action);
  });
  confirm.textContent = text.confirm;
  confirm.setAttribute(CONFIRM_ATTRIBUTE, action);

  const cancel = createButton(CANCEL_CLASS, () => {
    callbacks.onCancelClear(action);
  });
  cancel.textContent = CANCEL_LABEL;
  cancel.setAttribute(CANCEL_ATTRIBUTE, action);

  row.appendChild(createText(QUESTION_CLASS, text.question));
  row.appendChild(confirm);
  row.appendChild(cancel);
  return row;
}

function renderAction(
  action: MaintenanceActionId,
  state: LocalDataState,
  callbacks: LocalDataCallbacks,
): HTMLElement {
  const text = ACTION_TEXTS[action];
  const block = createBlock(ACTION_CLASS);
  block.appendChild(createParagraph(ACTION_HINT_CLASS, text.hint));

  if (state.confirming === action) {
    block.appendChild(renderConfirmation(action, callbacks));
    return block;
  }

  const button = createButton(ACTION_BUTTON_CLASS, () => {
    callbacks.onAskClear(action);
  });
  button.textContent = text.button;
  button.setAttribute(ACTION_ATTRIBUTE, action);
  block.appendChild(button);

  // Said here rather than in place of the counts: it is this deletion that
  // failed, not the reading of what the storage holds.
  if (state.clearFailed === action) {
    block.appendChild(createParagraph(ACTION_ERROR_CLASS, CLEAR_ERROR_TEXTS[action]));
  }
  return block;
}

/** The counts, or the one line that says why they are not there. */
function renderSummary(state: LocalDataState): HTMLElement {
  if (state.failed) {
    return createText(MESSAGE_CLASS, ERROR_TEXT);
  }
  return state.stats === null ? createText(MESSAGE_CLASS, LOADING_TEXT) : renderCounts(state.stats);
}

export function renderLocalDataSection(
  state: LocalDataState,
  callbacks: LocalDataCallbacks,
): HTMLElement {
  const section = createSection(SECTION_TITLE);
  section.appendChild(renderSummary(state));

  for (const action of MAINTENANCE_ACTIONS) {
    section.appendChild(renderAction(action, state, callbacks));
  }
  return section;
}
