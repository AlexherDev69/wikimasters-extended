import { createBlock, createText } from '../../../core/dom/create-elements';
import { SETTING_KEYS, type SettingKey, type Settings } from '../domain/settings';
import { createParagraph, createSection } from './options-elements';

/**
 * The switches of the options page: one real checkbox per setting, each with
 * the single line that says what it changes on the site. Every function here
 * takes data and returns nodes, so the whole section is testable without any
 * browser API.
 */

const SECTION_TITLE = 'Fonctionnalités';

/** What a save has just done, as the page tells it. */
export type SaveStatus = 'idle' | 'saved' | 'failed';

const STATUS_TEXTS: Record<SaveStatus, string> = {
  idle: '',
  saved: 'Enregistré',
  failed: "Le réglage n'a pas pu être enregistré.",
};

interface FeatureText {
  label: string;
  hint: string;
  /** Carries a visible warning style: the switch writes on the site itself. */
  warning?: boolean;
}

const FEATURE_TEXTS: Record<SettingKey, FeatureText> = {
  categoryBadges: {
    label: 'Badge de catégorie',
    hint: 'Pastille de catégorie sur les cartes, et ligne "Catégorie" dans la modale de détail.',
  },
  categoryHighlight: {
    label: 'Mise en évidence par catégorie',
    hint: 'Panneau flottant des catégories de la page, et voile sur les cartes hors du filtre choisi.',
  },
  letterboxdLink: {
    label: 'Lien Letterboxd',
    hint:
      'Lien vers Letterboxd dans la modale de détail, et petit logo sous la photo sur la carte, ' +
      'pour les films et les personnalités du cinéma.',
  },
  missingImages: {
    label: 'Images manquantes',
    hint:
      'Affiche une image de Wikimedia Commons sur les cartes que le site laisse sans illustration, ' +
      "quand Wikidata en connaît une. L'image est chargée par ton navigateur depuis Wikimedia.",
  },
  hideCardStats: {
    label: 'Masquer les statistiques des cartes',
    hint:
      "Masque les valeurs d'attaque et de défense sur les cartes et dans la modale de détail. " +
      "Rien n'est envoyé ni modifié sur le site, et décocher cette case les fait réapparaître " +
      'immédiatement.',
  },
  tagSuggestions: {
    label: 'Étiquettes suggérées',
    hint:
      "Propose des étiquettes dans la modale de détail, d'après ce que Wikidata sait de la carte. " +
      "Lecture seule : rien n'est écrit sur le site tant que le réglage suivant reste désactivé.",
  },
  tagAutoFill: {
    label: "Remplir l'étiquette au clic",
    hint:
      "Un clic sur une étiquette suggérée l'écrit et la valide dans le champ du site, à ta place. " +
      'Les règles de wiki-masters.com interdisent "tout outil visant à jouer, ouvrir des paquets, ' +
      'échanger ou interagir à votre place", sanction possible : bannissement sans préavis. Laisse ' +
      'cette case décochée sauf accord explicite des auteurs du site.',
    warning: true,
  },
};

const LABEL_TAG = 'label';
const CHECKBOX_TAG = 'input';
const CHECKBOX_TYPE = 'checkbox';
const CHANGE_EVENT = 'change';

const ROLE_ATTRIBUTE = 'role';
const STATUS_ROLE = 'status';

/** Names which switch a checkbox drives, so the page can focus it again. */
const SETTING_ATTRIBUTE = 'data-wme-setting';

const STATUS_ATTRIBUTE = 'data-wme-status';

const SETTING_CLASS = 'wme-setting';
const SETTING_WARNING_CLASS = 'wme-setting--warning';
const SETTING_HEAD_CLASS = 'wme-setting-head';
const SETTING_LABEL_CLASS = 'wme-setting-label';
const SETTING_HINT_CLASS = 'wme-setting-hint';
const STATUS_CLASS = 'wme-status';

/**
 * Where the keyboard focus goes after the render a toggle caused. The section
 * is rebuilt whole, so the checkbox the user has just used has to be named for
 * the page to find it again.
 */
export function settingSelector(key: SettingKey): string {
  return `input[${SETTING_ATTRIBUTE}="${key}"]`;
}

export interface FeatureCallbacks {
  onToggleSetting: (key: SettingKey) => void;
}

function renderSwitch(
  key: SettingKey,
  checked: boolean,
  callbacks: FeatureCallbacks,
): HTMLElement {
  const text = FEATURE_TEXTS[key];
  const rowClass = text.warning === true ? `${SETTING_CLASS} ${SETTING_WARNING_CLASS}` : SETTING_CLASS;
  const row = createBlock(rowClass);
  const head = document.createElement(LABEL_TAG);
  head.className = SETTING_HEAD_CLASS;

  const checkbox = document.createElement(CHECKBOX_TAG);
  checkbox.type = CHECKBOX_TYPE;
  checkbox.checked = checked;
  checkbox.setAttribute(SETTING_ATTRIBUTE, key);
  checkbox.addEventListener(CHANGE_EVENT, () => {
    callbacks.onToggleSetting(key);
  });

  head.appendChild(checkbox);
  head.appendChild(createText(SETTING_LABEL_CLASS, text.label));
  row.appendChild(head);
  row.appendChild(createParagraph(SETTING_HINT_CLASS, text.hint));

  return row;
}

/**
 * The one line confirming the save. It is built once and kept out of the
 * subtree the page rebuilds on every render: a live region has to be in the
 * tree BEFORE its text changes, and a node inserted with its text already in
 * it is announced by nothing.
 */
export function createStatusRegion(): HTMLElement {
  const status = createText(STATUS_CLASS, STATUS_TEXTS.idle);
  status.setAttribute(ROLE_ATTRIBUTE, STATUS_ROLE);
  status.setAttribute(STATUS_ATTRIBUTE, 'idle');
  return status;
}

/** Writes only what differs, so an unchanged status announces nothing again. */
export function writeStatus(region: HTMLElement, saveStatus: SaveStatus): void {
  const text = STATUS_TEXTS[saveStatus];

  if (region.textContent !== text) {
    region.textContent = text;
  }
  if (region.getAttribute(STATUS_ATTRIBUTE) !== saveStatus) {
    region.setAttribute(STATUS_ATTRIBUTE, saveStatus);
  }
}

export function renderFeaturesSection(
  settings: Settings,
  callbacks: FeatureCallbacks,
): HTMLElement {
  const section = createSection(SECTION_TITLE);

  for (const key of SETTING_KEYS) {
    section.appendChild(renderSwitch(key, settings[key], callbacks));
  }
  return section;
}
