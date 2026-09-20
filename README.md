# WikiMasters Extended

Extension Chrome (Manifest V3) en lecture seule pour [wiki-masters.com](https://www.wiki-masters.com).

Objectif : afficher sur chaque carte une catégorie (via Wikidata) et un lien Letterboxd pour les films et personnalités du cinéma. Elle ne clique jamais, ne scrolle pas, ne saisit rien et n'intercepte aucun trafic réseau.

## État actuel

Phases 1 à 3, 4a, 4c, 5 et 6a : l'extension détecte les cartes affichées, y compris celles qui arrivent après le chargement de la page (rendu React, pagination, bouton "Charger la suite", carrousel d'ouverture de paquet), en extrait le titre, la description et la rareté, puis demande leur catégorie à Wikidata depuis le service worker (personne, film et TV, musique, sport, vivant, gastronomie, monument, religion et idées, oeuvre, lieu, transport et technique, évènement, organisation, astronomie, science, autre), avec un sous-type pour les personnes (cinéma, musique, sport, politique, science, littérature, art, médias, autre).

### Badge de catégorie sur les cartes

Chaque carte catégorisée reçoit une pastille sombre en bas de sa zone image : un point de la couleur de la catégorie et son libellé, par exemple "Lieu" ou "Personne · Cinéma" pour une personne dont le sous-type principal est connu. La pastille suit toujours la carte affichée à l'instant : si le site réutilise un emplacement pour une autre carte (pagination), le badge est recalculé à partir du titre affiché. Une carte dont l'article est introuvable, dont la catégorisation a échoué ou dont la catégorie n'est pas encore connue ne reçoit aucun badge.

### Catégorie dans la modale de détail

Quand la modale de détail est ouverte, une ligne "Catégorie : ..." est ajoutée sous le lien "Voir l'article sur Wikipédia" (et sous le lien Letterboxd quand il est présent). Pour une personne ayant plusieurs métiers, les autres sous-types sont listés entre parenthèses, par exemple "Catégorie : Personne · Musique (aussi : Cinéma)".

### Mise en évidence par catégorie

Un petit panneau flottant en bas à gauche liste les catégories présentes parmi les cartes actuellement détectées, avec leur nombre, triées par nombre décroissant puis par libellé. Il est replié par défaut ("Catégories (N)") et se déplie d'un clic. Cliquer une catégorie l'active comme filtre : les cartes des autres catégories sont assombries par un voile ajouté par l'extension, qui laisse passer les clics vers la carte. Un second clic sur la même catégorie, ou le bouton "Tout afficher", annule le filtre. Le filtre reste actif quand tu changes de page de la collection : si la page suivante ne contient aucune carte de cette catégorie, elle est entièrement assombrie, et le panneau le dit (ligne de la catégorie active avec un compte de 0, titre "Catégories (N) · Lieu"). Le bouton "Tout afficher" reste accessible même quand le panneau est replié. Le panneau ne compte qu'une fois une carte affichée deux fois (dans la grille et dans la modale), disparaît quand aucune carte n'est détectée (aucun voile n'est alors posé), et son état n'est pas mémorisé : il repart replié et sans filtre à chaque chargement de page.

### Index de collection

Quand tu parcours ta collection (la page `/collection` elle-même, pagination comprise), l'extension retient le titre et la rareté des cartes affichées, avec la date de leur première et de leur dernière apparition. Rien d'autre n'alimente cet index : les cartes du marché, des échanges, des ouvertures de paquet, de la collection globale et de toute autre page ne t'appartiennent pas. L'extension ne tourne jamais les pages à ta place, donc l'index ne grandit qu'avec ce que tu affiches toi-même.

L'index ne mémorise pas la catégorie des cartes, seulement ce que le site affiche. La catégorie est recalculée à la lecture depuis les caches, comme partout ailleurs dans l'extension : ajuster les listes de racines ne demande jamais de reparcourir la collection.

### Fenêtre de statistiques

Un clic sur l'icône de l'extension ouvre une fenêtre qui résume l'index : le nombre de cartes vues, la date de la dernière mise à jour, la répartition par rareté, puis une ligne par catégorie avec son nombre de cartes, son pourcentage et une barre proportionnelle. La ligne "Personne" se déplie sur ses sous-types. Un clic sur une catégorie affiche la liste de ses cartes, chaque titre étant un lien vers l'article Wikipédia en français. Le bouton "Réinitialiser l'index" demande une confirmation sur place avant de tout effacer.

Ces statistiques sont calculées uniquement à partir des caches locaux : ouvrir la fenêtre ne déclenche aucune requête vers Wikipédia ou Wikidata. Une carte dont les données ne sont pas disponibles (cache expiré, article introuvable, classe non résolue) est comptée dans "Non catégorisées", et retrouve sa catégorie la prochaine fois que tu l'affiches sur le site.

Approximation connue : l'index ne stocke pas la description des cartes, alors que c'est elle qui départage les métiers d'une personne. Le sous-type principal affiché dans la fenêtre est donc décidé par vote majoritaire, et peut différer de celui du badge posé sur la carte, où la description est lue.

### Lien Letterboxd

Quand la modale de détail d'une carte est ouverte, un lien "Voir sur Letterboxd" est ajouté juste après le lien "Voir l'article sur Wikipédia", et ouvre la page Letterboxd dans un nouvel onglet. Il n'apparaît que pour les films et pour les personnes ayant au moins un métier de cinéma (page du réalisateur, de l'acteur, du scénariste ou du producteur, sinon recherche par titre ou par nom), ainsi que pour les studios. Une série, une saison, un épisode ou une personnalité sans métier de cinéma n'en reçoivent aucun, même si Wikidata leur connaît un identifiant Letterboxd (Albert Einstein en a un, hérité d'images d'archives).

### Options

Un bouton "Options" en bas de la fenêtre de statistiques ouvre la page d'options de l'extension (également accessible depuis `chrome://extensions`, bouton "Détails" puis "Options de l'extension").

Section "Fonctionnalités" : quatre cases à cocher, toutes activées par défaut.

| Réglage | Ce qu'il active |
| --- | --- |
| Badge de catégorie | La pastille de catégorie sur les cartes et la ligne "Catégorie" dans la modale de détail |
| Mise en évidence par catégorie | Le panneau flottant des catégories de la page et le voile posé sur les cartes hors du filtre choisi |
| Lien Letterboxd | Le lien vers Letterboxd dans la modale de détail |
| Index de collection | L'enregistrement des cartes que tu affiches sur ta collection, qui alimente la fenêtre de statistiques |

Un changement est enregistré immédiatement et un petit message "Enregistré" le confirme. Si l'enregistrement échoue, la page relit les réglages réellement stockés, les affiche et signale l'erreur : ce qui est coché correspond toujours à ce qui est réellement stocké, y compris quand une autre case a été cochée entre-temps.

Les onglets du site déjà ouverts suivent le changement sans rechargement : une fonctionnalité désactivée voit ses éléments retirés tout de suite, et réactivée elle les repose immédiatement. Le filtre du panneau de catégories repart de zéro après une désactivation. Quand les quatre réglages sont désactivés, l'extension n'envoie plus aucune requête de catégorisation : aucun appel ne part vers Wikipédia ni Wikidata.

Section "Données locales" : le nombre de cartes en cache de catégorisation, de classes Wikidata en cache et de cartes dans l'index de collection, avec deux actions qui demandent chacune une confirmation sur place.

- "Vider le cache de catégorisation" efface les faits Wikidata gardés par carte et les catégories gardées par classe. Les cartes seront redemandées à `fr.wikipedia.org` et à `query.wikidata.org` la prochaine fois que tu les affiches. Les réglages, l'index de collection et les pauses en cours sur un hôte ne sont pas touchés.
- "Réinitialiser l'index de collection" efface la liste des cartes vues dans ta collection, comme le bouton du même nom dans la fenêtre de statistiques. Le cache de catégorisation n'est pas touché.

Section "Confidentialité" : le même texte que la section ci-dessous, rappelé dans la page.

La dernière réponse au besoin de filtre prévue par la phase 4 reste à faire : la synergie avec les étiquettes natives du site, que tu poses toi-même avec la sélection en lot.

Voir [docs/PLAN.md](docs/PLAN.md) pour l'analyse de faisabilité et la feuille de route complète.

## Prérequis

- Node.js 22 ou supérieur
- pnpm 10 ou supérieur

## Scripts

| Commande | Description |
| --- | --- |
| `pnpm dev` | Démarrage en mode développement avec rechargement automatique |
| `pnpm build` | Build de production dans `.output/chrome-mv3/` |
| `pnpm zip` | Build et création du zip pour le Chrome Web Store |
| `pnpm typecheck` | Vérification TypeScript sans émission |
| `pnpm lint` | Analyse statique ESLint |
| `pnpm test` | Lancement de la suite de tests (Vitest) |
| `pnpm test:watch` | Tests en mode watch |
| `pnpm knip` | Détection de code mort et d'exports orphelins |

## Charger l'extension dans Chrome

L'extension se charge dans ton Chrome habituel, celui où tu es connecté au site. `pnpm dev` n'ouvre volontairement aucun navigateur : la vérification Turnstile du site refuse les profils automatisés.

1. Exécuter `pnpm dev` (développement) ou `pnpm build` (production)
2. Ouvrir `chrome://extensions`
3. Activer le "Mode développeur" (en haut à droite)
4. Cliquer sur "Charger l'extension non empaquetée"
5. Sélectionner `.output/chrome-mv3-dev/` (développement) ou `.output/chrome-mv3/` (production)

## Journaux

Les journaux apparaissent dans la console de la page (F12) avec le préfixe de l'extension. En développement, tous les niveaux sont affichés. En production, seuls `warn` et `error` le sont : le message "Cards categorized" n'est donc visible qu'avec `pnpm dev`. Il apparaît une fois par lot de cartes encore jamais vues depuis le chargement de la page, avec leur titre, leur rareté, leur statut, leur catégorie et le sous-type des personnes. Les journaux du service worker se consultent depuis `chrome://extensions`, lien "Service worker" de l'extension.

## Confidentialité

- Les titres des cartes affichées à l'écran sont envoyés à `fr.wikipedia.org` et à `query.wikidata.org` pour être catégorisés. Ce sont des titres d'articles publics, rien d'autre ne part.
- Ces appels sont faits sans cookie (`credentials: 'omit'`) : ta session Wikipédia n'est jamais utilisée et aucun compte n'est identifié.
- Rien n'est envoyé au site WikiMasters ni à aucun autre serveur. L'extension n'appelle aucune API du site.
- L'extension ne contacte jamais Letterboxd : elle se contente de construire une adresse à partir des identifiants publics de Wikidata. Rien n'est envoyé à Letterboxd tant que tu ne cliques pas toi-même sur le lien.
- Les résultats sont mis en cache localement dans le stockage de l'extension (`chrome.storage.local`), sur ta machine uniquement : 90 jours pour une carte résolue, 7 jours pour une carte introuvable.
- L'index de collection (titre, rareté, dates de première et de dernière apparition) est stocké au même endroit, sur ta machine uniquement. Il n'est envoyé nulle part, pas même au site, et le bouton "Réinitialiser l'index" l'efface entièrement.
- Les réglages de la page d'options sont stockés au même endroit, sur ta machine uniquement.
- La fenêtre de statistiques et la page d'options sont des pages de l'extension : elles lisent et effacent uniquement ce qui est stocké localement, et ne font aucun appel réseau.
- Si tu désactives les quatre fonctionnalités dans les options, plus aucun titre ne part vers Wikipédia ni Wikidata.

## Contrainte fondamentale

Cette extension est un overlay en lecture seule. Elle ne clique jamais, ne scrolle pas, ne saisit rien, n'intercepte pas le trafic réseau et n'appelle pas les API du site. Tout contournement de cette règle expose au bannissement du compte.

Elle ajoute uniquement ses propres éléments (badge, ligne de catégorie, lien Letterboxd, voile d'atténuation, panneau de catégories) et ne modifie jamais un élément du site : aucune classe, aucun attribut ni aucun style n'est posé sur un noeud du site, et rien n'y est déplacé ni supprimé. Tout ce qui est posé au-dessus d'une carte laisse passer les clics (`pointer-events: none`), de sorte que les interactions du site restent exactement celles qu'il prévoit. Les seuls clics écoutés sont ceux que tu fais sur les boutons de l'extension, et aucun clic du site n'est intercepté ni bloqué. Tous les éléments ajoutés sont retirés quand l'extension est rechargée, désactivée, ou quand la fonctionnalité correspondante est décochée dans la page d'options.
