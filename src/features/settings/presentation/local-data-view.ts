import { createBlock, createButton, createText } from '../../../core/dom/create-elements';
import type { StorageStats } from '../domain/storage-stats';
import { createParagraph, createSection } from './options-elements';

/**
 * What the extension holds on this machine, and the ways to empty it. Every
 * action asks for its confirmation in place: a dialog of the browser would
 * take the focus out of the page.
 */

const SECTION_TITLE = 'Données locales';

/** The actions, in the order the section shows them. */
const MAINTENANCE_ACTIONS = ['categorization-cache', 'legacy-index-data'] as const;

export type MaintenanceActionId = (typeof MAINTENANCE_ACTIONS)[number];

/**
 * The one action every installation has, on every render of the section: the
 * caches are always there. Exported because it is also where the page sends
 * the focus when the control it aimed at has left the screen.
 */
export const CACHE_ACTION: MaintenanceActionId = 'categorization-cache';

/** What the section holds while there is no old index data to remove. */
const CACHE_ONLY: readonly MaintenanceActionId[] = [CACHE_ACTION];

/** The members of the stats the section shows as a number. */
type CountKey = 'cardFacts' | 'classTargets';

const COUNT_LABELS: readonly { key: CountKey; label: string }[] = [
  { key: 'cardFacts', label: 'Cartes en cache de catégorisation' },
  { key: 'classTargets', label: 'Classes Wikidata en cache' },
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

const LEGACY_HINT =
  "L'index de collection a été retiré de l'extension, mais une version précédente a laissé ses " +
  'deux entrées sur cette machine : la liste des cartes vues et les totaux du catalogue. Ce ' +
  'bouton les supprime. Le cache de catégorisation et les réglages ne sont pas touchés.';

const ACTION_TEXTS: Record<MaintenanceActionId, ActionText> = {
  'categorization-cache': {
    button: 'Vider le cache de catégorisation',
    hint: CACHE_HINT,
    question: 'Vider le cache de catégorisation ?',
    confirm: 'Oui, vider',
  },
  'legacy-index-data': {
    button: "Supprimer les données de l'ancien index",
    hint: LEGACY_HINT,
    question: "Supprimer les données de l'ancien index ?",
    confirm: 'Oui, supprimer',
  },
};

const CANCEL_LABEL = 'Annuler';
const LOADING_TEXT = 'Chargement...';
const ERROR_TEXT =
  "Les données locales n'ont pas pu être lues. Recharge cette page pour réessayer.";

/** Said next to the action that failed: nothing was erased, it can be retried. */
const CLEAR_ERROR_TEXTS: Record<MaintenanceActionId, string> = {
  'categorization-cache': "Le cache n'a pas pu être vidé. Réessaie dans un instant.",
  'legacy-index-data':
    "Les données de l'ancien index n'ont pas pu être supprimées. Réessaie dans un instant.",
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

/**
 * The removal of the old index is offered only while there is something left
 * to remove, so it goes away for good once it has run, and an installation
 * that never held the index never sees it. It is also left out while the
 * counts are unknown: nothing then says that those keys are there.
 */
function visibleActions(state: LocalDataState): readonly MaintenanceActionId[] {
  return state.stats?.hasLegacyIndexData === true ? MAINTENANCE_ACTIONS : CACHE_ONLY;
}

export function renderLocalDataSection(
  state: LocalDataState,
  callbacks: LocalDataCallbacks,
): HTMLElement {
  const section = createSection(SECTION_TITLE);
  section.appendChild(renderSummary(state));

  for (const action of visibleActions(state)) {
    section.appendChild(renderAction(action, state, callbacks));
  }
  return section;
}
