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
}

export const FEATURE_TEXTS: Record<SettingKey, FeatureText> = {
  letterboxdLink: {
    label: 'Lien Letterboxd',
    summary: 'Le lien Letterboxd des films et du cinéma.',
    hint:
      'Lien vers Letterboxd dans la modale de détail, et petit logo sous la photo sur la carte, ' +
      'pour les films et les personnalités du cinéma.',
  },
  wikipediaLink: {
    label: 'Bouton Wikipédia',
    summary: "L'article de la carte, depuis la carte.",
    hint:
      "Ajoute sur chaque carte un bouton qui ouvre son article de Wikipédia, à côté du bouton " +
      "Letterboxd quand la carte en a un. L'adresse est construite à partir du titre que la carte " +
      "affiche déjà : rien n'est demandé à personne pour l'afficher.",
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
  fullscreenCard: {
    label: 'Carte en plein écran',
    summary: 'Un bouton pour voir la carte en grand.',
    hint:
      "Ajoute à côté de la carte, dans la modale de détail, un bouton qui l'affiche en plein " +
      "écran, agrandie à la taille de l'écran. Échap, le même bouton ou la fermeture de la " +
      "modale la ramènent à sa place. Le navigateur agrandit la carte que le site affiche déjà : " +
      "rien n'est envoyé ni écrit sur le site.",
  },
  copyCard: {
    label: 'Copier la carte',
    summary: "Un bouton pour copier l'image de la carte.",
    hint:
      "Ajoute à côté de la carte, dans la modale de détail, un bouton qui la copie en image " +
      "dans le presse-papiers, prête à coller dans une conversation. L'image est faite à partir " +
      "de la carte que le site affiche, avec les images et les polices que la page a déjà " +
      "chargées : rien n'est envoyé ni écrit sur le site.",
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
  notificationSound: {
    label: 'Son de notification',
    summary: 'Un petit son quand une notification arrive.',
    hint:
      'Joue un petit son de deux notes quand le compteur de la cloche augmente, pour remarquer ' +
      "une notification sans avoir l'onglet sous les yeux. Rien n'est ajouté à la page et rien " +
      "n'est envoyé nulle part : le son se déclenche sur le nombre que le site affiche déjà. Le " +
      "navigateur ne le joue pas tant que tu n'as pas cliqué au moins une fois sur le site.",
  },
};
