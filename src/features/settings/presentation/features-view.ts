import { createBlock, createText } from '../../../core/dom/create-elements';
import { SETTING_KEYS, type SettingKey, type Settings } from '../domain/settings';
import { FEATURE_TEXTS } from './feature-texts';
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
  const row = createBlock(SETTING_CLASS);
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
