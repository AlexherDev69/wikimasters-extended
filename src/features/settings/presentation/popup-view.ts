import { createBlock, createButton, createText } from '../../../core/dom/create-elements';
import { SETTING_KEYS, type SettingKey, type Settings } from '../domain/settings';
import { FEATURE_TEXTS } from './feature-texts';
import type { SaveStatus } from './features-view';

/**
 * The window a click on the icon of the extension opens: the ten switches, and
 * nothing else. What the extension keeps on this machine stays on the options
 * page, one press away at the bottom.
 *
 * Every function here takes data and returns nodes, so the whole window is
 * testable without the extension runtime. Nodes are filled through
 * `textContent` and never through `innerHTML`.
 */

const APP_NAME = 'WikiMasters Extended';
const SUBTITLE = "S'applique aux onglets déjà ouverts, sans rechargement.";

const OPTIONS_LABEL = 'Options et données locales';

const LOADING_TEXT = 'Chargement...';

const UNREADABLE_TEXT =
  "Les réglages n'ont pas pu être lus. Rouvre cette fenêtre pour réessayer : tant qu'ils sont " +
  'inconnus, aucune case ne peut être affichée sans risquer de remplacer ce qui est enregistré.';

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

/** Names which switch a row drives, so the window can focus it again. */
const SETTING_ATTRIBUTE = 'data-wme-setting';
const STATUS_ATTRIBUTE = 'data-wme-status';
const OPTIONS_ATTRIBUTE = 'data-wme-open-options';

const POPUP_CLASS = 'wme-popup';
const HEADER_CLASS = 'wme-popup-header';
const APP_NAME_CLASS = 'wme-popup-name';
const SUBTITLE_CLASS = 'wme-popup-subtitle';
const LIST_CLASS = 'wme-popup-list';
const ROW_CLASS = 'wme-popup-row';
const ROW_TEXT_CLASS = 'wme-popup-text';
const ROW_LABEL_CLASS = 'wme-popup-label';
const ROW_SUMMARY_CLASS = 'wme-popup-summary';
const SWITCH_CLASS = 'wme-popup-switch';
const TRACK_CLASS = 'wme-popup-track';
const FOOTER_CLASS = 'wme-popup-footer';
const OPTIONS_BUTTON_CLASS = 'wme-popup-options';
const STATUS_CLASS = 'wme-popup-status';
const MESSAGE_CLASS = 'wme-popup-message';

/** Where the focus goes after the render a toggle caused. */
export function popupSettingSelector(key: SettingKey): string {
  return `input[${SETTING_ATTRIBUTE}="${key}"]`;
}

export const POPUP_OPTIONS_SELECTOR = `button[${OPTIONS_ATTRIBUTE}]`;

export interface PopupCallbacks {
  onToggleSetting: (key: SettingKey) => void;
  onOpenOptions: () => void;
}

/**
 * One switch: a real checkbox, hidden behind the track that paints it. The
 * label wraps both, so the whole row answers the click and the keyboard, and
 * a screen reader announces an ordinary checkbox.
 */
function renderRow(key: SettingKey, checked: boolean, callbacks: PopupCallbacks): HTMLElement {
  const text = FEATURE_TEXTS[key];
  const row = document.createElement(LABEL_TAG);
  row.className = ROW_CLASS;

  const body = createBlock(ROW_TEXT_CLASS);
  body.appendChild(createText(ROW_LABEL_CLASS, text.label));
  body.appendChild(createText(ROW_SUMMARY_CLASS, text.summary));

  const control = createBlock(SWITCH_CLASS);
  const checkbox = document.createElement(CHECKBOX_TAG);
  checkbox.type = CHECKBOX_TYPE;
  checkbox.checked = checked;
  checkbox.setAttribute(SETTING_ATTRIBUTE, key);
  checkbox.addEventListener(CHANGE_EVENT, () => {
    callbacks.onToggleSetting(key);
  });
  control.appendChild(checkbox);
  control.appendChild(createBlock(TRACK_CLASS));

  row.appendChild(body);
  row.appendChild(control);

  return row;
}

function renderHeader(): HTMLElement {
  const header = createBlock(HEADER_CLASS);
  header.appendChild(createText(APP_NAME_CLASS, APP_NAME));
  header.appendChild(createText(SUBTITLE_CLASS, SUBTITLE));
  return header;
}

/** The way to the options page, which holds what this window leaves out. */
function renderFooter(callbacks: PopupCallbacks): HTMLElement {
  const footer = createBlock(FOOTER_CLASS);
  const button = createButton(OPTIONS_BUTTON_CLASS, callbacks.onOpenOptions);
  button.setAttribute(OPTIONS_ATTRIBUTE, '');
  button.textContent = OPTIONS_LABEL;
  footer.appendChild(button);
  return footer;
}

/**
 * Built once and kept out of the subtree the renders replace: a live region
 * has to be in the tree BEFORE its text changes for it to be announced.
 */
export function createPopupStatusRegion(): HTMLElement {
  const status = createText(STATUS_CLASS, STATUS_TEXTS.idle);
  status.setAttribute(ROLE_ATTRIBUTE, STATUS_ROLE);
  status.setAttribute(STATUS_ATTRIBUTE, 'idle');
  return status;
}

/** Writes only what differs, so an unchanged status announces nothing again. */
export function writePopupStatus(region: HTMLElement, saveStatus: SaveStatus): void {
  const text = STATUS_TEXTS[saveStatus];

  if (region.textContent !== text) {
    region.textContent = text;
  }
  if (region.getAttribute(STATUS_ATTRIBUTE) !== saveStatus) {
    region.setAttribute(STATUS_ATTRIBUTE, saveStatus);
  }
}

export function renderPopup(settings: Settings, callbacks: PopupCallbacks): HTMLElement {
  const popup = createBlock(POPUP_CLASS);
  const list = createBlock(LIST_CLASS);

  for (const key of SETTING_KEYS) {
    list.appendChild(renderRow(key, settings[key], callbacks));
  }
  popup.appendChild(renderHeader());
  popup.appendChild(list);
  popup.appendChild(renderFooter(callbacks));

  return popup;
}

/** Shown for the instant it takes to read the settings back from storage. */
export function renderPopupLoading(): HTMLElement {
  const popup = createBlock(POPUP_CLASS);
  popup.appendChild(renderHeader());
  popup.appendChild(createText(MESSAGE_CLASS, LOADING_TEXT));
  return popup;
}

/**
 * Shown when the settings could not be read at all. No switch is drawn: one
 * shown in a position nobody read would be written over the saved settings by
 * the very next toggle.
 */
export function renderPopupUnreadable(callbacks: PopupCallbacks): HTMLElement {
  const popup = createBlock(POPUP_CLASS);

  popup.appendChild(renderHeader());
  popup.appendChild(createText(MESSAGE_CLASS, UNREADABLE_TEXT));
  popup.appendChild(renderFooter(callbacks));

  return popup;
}
