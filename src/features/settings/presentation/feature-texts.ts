import type { SettingKey } from '../domain/settings';

/**
 * What each switch is called, and what it changes on the site. Shared by the
 * two windows the extension has: the popup of the toolbar, which shows the
 * summary, and the options page, which shows the whole line.
 *
 * One source for both, so a feature never ends up described in two ways.
 */

export interface FeatureText {
  label: string;
  /** One short sentence, for the popup: it has a column to fit, not a page. */
  summary: string;
  /** The whole explanation, for the options page. */
  hint: string;
  /** Carries a visible warning style: the switch writes on the site itself. */
  warning?: boolean;
}

export const FEATURE_TEXTS: Record<SettingKey, FeatureText> = {
  categoryBadges: {
    label: 'Badge de catégorie',
    summary: 'La pastille de catégorie sur les cartes.',
    hint: 'Pastille de catégorie sur les cartes, et ligne "Catégorie" dans la modale de détail.',
  },
  letterboxdLink: {
    label: 'Lien Letterboxd',
    summary: 'Le lien Letterboxd des films et du cinéma.',
    hint:
      'Lien vers Letterboxd dans la modale de détail, et petit logo sous la photo sur la carte, ' +
      'pour les films et les personnalités du cinéma.',
  },
  missingImages: {
    label: 'Images manquantes',
    summary: 'Une image Wikimedia sur les cartes sans visuel.',
    hint:
      'Affiche une image de Wikimedia Commons sur les cartes que le site laisse sans illustration, ' +
      "quand Wikidata en connaît une. L'image est chargée par ton navigateur depuis Wikimedia.",
  },
  tradeCards: {
    label: "Cartes sur la page d'échange",
    summary: "Les cartes dessinées dans les offres d'échange.",
    hint:
      "Dessine les cartes d'une offre d'échange à la place des noms tronqués de la page, " +
      'avec leur rareté et leur image quand Wikidata en connaît une, pour ne plus avoir à ' +
      'ouvrir chaque offre.',
  },
  hideCardStats: {
    label: 'Masquer les statistiques des cartes',
    summary: "Cache les valeurs d'attaque et de défense.",
    hint:
      "Masque les valeurs d'attaque et de défense sur les cartes et dans la modale de détail. " +
      "Rien n'est envoyé ni modifié sur le site, et décocher cette case les fait réapparaître " +
      'immédiatement.',
  },
  tagSuggestions: {
    label: 'Étiquettes suggérées',
    summary: "Des propositions d'étiquette dans la modale.",
    hint:
      "Propose des étiquettes dans la modale de détail, d'après ce que Wikidata sait de la carte. " +
      "Lecture seule : rien n'est écrit sur le site tant que le réglage suivant reste désactivé.",
  },
  tagAutoFill: {
    label: "Remplir l'étiquette au clic",
    summary: 'Écrit sur le site à ta place. Risque de bannissement.',
    hint:
      "Un clic sur une étiquette suggérée l'écrit et la valide dans le champ du site, à ta place : " +
      'le site ne peut pas distinguer cela de ta propre frappe au clavier. Les règles de ' +
      'wiki-masters.com interdisent "tout outil visant à jouer, ouvrir des paquets, échanger ou ' +
      'interagir à votre place", sanction annoncée : bannissement de TON compte wiki-masters.com, ' +
      'sans préavis. Laisse cette case décochée sauf accord explicite des auteurs du site.',
    warning: true,
  },
  pullStats: {
    label: 'Statistiques de tirage',
    summary: 'La part de chaque rareté dans tes tirages.',
    hint:
      'Compte les cartes que tes paquets révèlent et affiche la part de chaque rareté, sous le ' +
      "nombre de paquets disponibles. Le comptage part de zéro et reste sur cette machine : " +
      "rien n'est envoyé nulle part, et rien n'est lu sur le site à part la rareté déjà " +
      'affichée sur la carte.',
  },
  compactView: {
    label: 'Bouton vue compacte',
    summary: 'Un bouton qui réduit les cartes pour en voir plus.',
    hint:
      'Ajoute un bouton au bout des filtres de rareté, sur ta collection et sur la page de toutes ' +
      'les cartes, qui réduit les cartes pour en afficher beaucoup plus à la fois. Seule leur ' +
      "taille à l'écran change : le site garde exactement la page qu'il a construite, et la " +
      'vignette reprend sa taille normale dès que tu rappuies.',
  },
  loadingPong: {
    label: 'Pong pendant les chargements',
    summary: 'Une partie de Pong quand le site rame.',
    hint:
      'Quand le site tourne dans le vide plus de trois secondes, une partie de Pong apparaît à ' +
      "la place du rond qui tourne : la raquette suit ta souris, l'adversaire est battable. Le " +
      "jeu disparaît dès que la page affiche enfin quelque chose, et rien n'est envoyé ni " +
      'écrit sur le site.',
  },
};
