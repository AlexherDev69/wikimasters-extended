import { createBlock, createText } from '../../../core/dom/create-elements';
import type { Settings } from '../domain/settings';
import { renderFeaturesSection, type FeatureCallbacks } from './features-view';
import {
  renderLocalDataSection,
  type LocalDataCallbacks,
  type LocalDataState,
} from './local-data-view';
import { createParagraph, createSection } from './options-elements';

/**
 * The whole options page: the switches, what the extension keeps on this
 * machine, and what leaves it. Every function here takes data and returns
 * nodes, so the page is testable without the extension runtime.
 */

const APP_NAME = 'WikiMasters Extended';

const SUBTITLE =
  "Overlay en lecture seule pour wiki-masters.com. Ces réglages s'appliquent aux onglets déjà ouverts, sans rechargement.";

const PRIVACY_TITLE = 'Confidentialité';

const PRIVACY_ITEMS: readonly string[] = [
  "Seuls les titres des cartes affichées à l'écran sont envoyés, à fr.wikipedia.org et à " +
    "query.wikidata.org, pour être catégorisés. Ce sont des titres d'articles publics.",
  "Ces appels sont faits sans cookie : aucune session ni aucun compte n'est identifié.",
  "Rien n'est envoyé à wiki-masters.com, ni à Letterboxd, ni à aucun autre serveur. Le lien " +
    'Letterboxd est seulement construit à partir des identifiants publics de Wikidata.',
  'Les images manquantes sont chargées par ton navigateur depuis Wikimedia Commons, sans ' +
    "référent, exactement comme les photos d'un article de Wikipédia. L'extension, elle, demande " +
    "l'adresse exacte de ces images à fr.wikipedia.org, sans cookie, et ne contacte toujours que " +
    'Wikipédia et Wikidata.',
  "L'extension ne garde aucune liste de tes cartes : rien de ta collection n'est enregistré. " +
    'Les statistiques de tirage ne gardent que six nombres, un par rareté, jamais le titre ' +
    "d'une carte. Tout le reste (caches, réglages) reste dans le stockage local de ton " +
    'navigateur, sur cette machine uniquement.',
  'Cette page ne fait aucun appel réseau : elle lit et efface uniquement ce qui est stocké sur ' +
    'ta machine.',
];

const LOADING_TEXT = 'Chargement...';

const UNREADABLE_TEXT =
  "Les réglages n'ont pas pu être lus. Recharge cette page pour réessayer : tant qu'ils sont " +
  'inconnus, aucune case ne peut être affichée sans risquer de remplacer ce qui est enregistré.';

const PAGE_CLASS = 'wme-page';
const HEADER_CLASS = 'wme-header';
const APP_NAME_CLASS = 'wme-app-name';
const SUBTITLE_CLASS = 'wme-subtitle';
const PRIVACY_ITEM_CLASS = 'wme-privacy-item';
const MESSAGE_CLASS = 'wme-message';

export interface OptionsCallbacks extends FeatureCallbacks, LocalDataCallbacks {}

export interface OptionsViewState {
  settings: Settings;
  data: LocalDataState;
}

function renderHeader(): HTMLElement {
  const header = createBlock(HEADER_CLASS);
  header.appendChild(createText(APP_NAME_CLASS, APP_NAME));
  header.appendChild(createParagraph(SUBTITLE_CLASS, SUBTITLE));
  return header;
}

/** A fixed text: nothing here depends on what the extension has stored. */
function renderPrivacySection(): HTMLElement {
  const section = createSection(PRIVACY_TITLE);

  for (const item of PRIVACY_ITEMS) {
    section.appendChild(createParagraph(PRIVACY_ITEM_CLASS, item));
  }
  return section;
}

export function renderOptions(
  state: OptionsViewState,
  callbacks: OptionsCallbacks,
): HTMLElement {
  const page = createBlock(PAGE_CLASS);

  page.appendChild(renderHeader());
  page.appendChild(renderFeaturesSection(state.settings, callbacks));
  page.appendChild(renderLocalDataSection(state.data, callbacks));
  page.appendChild(renderPrivacySection());

  return page;
}

/** Shown for the instant it takes to read the settings back from storage. */
export function renderOptionsLoading(): HTMLElement {
  const page = createBlock(PAGE_CLASS);
  page.appendChild(createText(MESSAGE_CLASS, LOADING_TEXT));
  return page;
}

/**
 * Shown when the settings could not be read at all. No switch is drawn: one
 * shown in a position nobody read would be written over the saved settings by
 * the very next toggle.
 */
export function renderOptionsUnreadable(): HTMLElement {
  const page = createBlock(PAGE_CLASS);

  page.appendChild(renderHeader());
  page.appendChild(createParagraph(MESSAGE_CLASS, UNREADABLE_TEXT));
  return page;
}
