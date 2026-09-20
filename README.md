# WikiMasters Extended

Extension Chrome (Manifest V3) en lecture seule pour [wiki-masters.com](https://www.wiki-masters.com).

Objectif : afficher sur chaque carte une catégorie (via Wikidata), une image pour les cartes que le site laisse sans illustration, et un lien Letterboxd pour les films et personnalités du cinéma. Elle ne clique jamais, ne scrolle pas, ne saisit rien et n'intercepte aucun trafic réseau.

## État actuel

Phases 1 à 3, 4a, 5, 6a et 7a : l'extension détecte les cartes affichées, y compris celles qui arrivent après le chargement de la page (rendu React, pagination, bouton "Charger la suite", carrousel d'ouverture de paquet), en extrait le titre, la description et la rareté, puis demande leur catégorie à Wikidata depuis le service worker (personne, film et TV, musique, sport, vivant, gastronomie, monument, religion et idées, oeuvre, lieu, transport et technique, évènement, organisation, astronomie, science, autre), avec un sous-type pour les personnes (cinéma, musique, sport, politique, science, littérature, art, médias, autre).

Les phases 4c et 4d (index de collection, fenêtre de statistiques et complétion par rareté) ont été retirées le 20 septembre 2026 : l'extension ne peut pas voir une carte quitter ta collection (vente, échange, destruction) sans interagir avec le site, donc ses nombres auraient fini par dériver.

L'extension ne garde aucune liste de tes cartes : rien de ta collection n'est enregistré.

### Badge de catégorie sur les cartes

Chaque carte catégorisée reçoit une petite pastille sombre en bas à gauche, à cheval sur la limite entre la photo et le texte : un point de la couleur de la catégorie et son libellé, par exemple "Lieu" ou "Personne · Cinéma" pour une personne dont le sous-type principal est connu. La pastille suit toujours la carte affichée à l'instant : si le site réutilise un emplacement pour une autre carte (pagination), le badge est recalculé à partir du titre affiché. Une carte dont l'article est introuvable, dont la catégorisation a échoué ou dont la catégorie n'est pas encore connue ne reçoit aucun badge.

### Catégorie dans la modale de détail

Quand la modale de détail est ouverte, une ligne "Catégorie : ..." est ajoutée sous le lien "Voir l'article sur Wikipédia" (et sous le lien Letterboxd quand il est présent). Pour une personne ayant plusieurs métiers, les autres sous-types sont listés entre parenthèses, par exemple "Catégorie : Personne · Musique (aussi : Cinéma)".

### Mise en évidence par catégorie

Un petit panneau flottant en bas à gauche liste les catégories présentes parmi les cartes actuellement détectées, avec leur nombre, triées par nombre décroissant puis par libellé. Il est replié par défaut ("Catégories (N)") et se déplie d'un clic. Cliquer une catégorie l'active comme filtre : les cartes des autres catégories sont assombries par un voile ajouté par l'extension, qui laisse passer les clics vers la carte. Un second clic sur la même catégorie, ou le bouton "Tout afficher", annule le filtre. Le filtre reste actif quand tu changes de page de la collection : si la page suivante ne contient aucune carte de cette catégorie, elle est entièrement assombrie, et le panneau le dit (ligne de la catégorie active avec un compte de 0, titre "Catégories (N) · Lieu"). Le bouton "Tout afficher" reste accessible même quand le panneau est replié. Le panneau ne compte qu'une fois une carte affichée deux fois (dans la grille et dans la modale), disparaît quand aucune carte n'est détectée (aucun voile n'est alors posé), et son état n'est pas mémorisé : il repart replié et sans filtre à chaque chargement de page.

### Lien Letterboxd

Quand la modale de détail d'une carte est ouverte, un lien "Voir sur Letterboxd" est ajouté juste après le lien "Voir l'article sur Wikipédia", et ouvre la page Letterboxd dans un nouvel onglet. Il apparaît pour les films et pour les personnes ayant au moins un métier de cinéma (page du réalisateur, de l'acteur, du scénariste ou du producteur, sinon recherche par titre ou par nom), ainsi que pour les studios. Une personnalité sans métier de cinéma n'en reçoit aucun, même si Wikidata lui connaît un identifiant Letterboxd (Albert Einstein en a un, hérité d'images d'archives).

Une série, une saison ou un épisode n'en reçoit pas non plus, sauf si Letterboxd le référence lui-même : quand Wikidata porte un identifiant de film Letterboxd pour l'oeuvre, le lien est affiché, car c'est Letterboxd qui indique alors que la page existe. C'est le cas de certaines web-séries, comme "The Backrooms". En l'absence de cet identifiant, aucun repli n'est tenté : un identifiant IMDb ou TMDb de série ne mène à aucune page Letterboxd, et une recherche par titre mènerait à la mauvaise.

Le même lien apparaît aussi sous la forme d'un petit logo Letterboxd sur la carte elle-même, sous la photo, pour les mêmes cartes que ci-dessus. Il s'ouvre dans un nouvel onglet, exactement comme celui de la modale. C'est le seul élément de l'extension qui réagit à un clic fait sur une carte : cliquer dessus ouvre Letterboxd sans ouvrir en plus la modale de détail de la carte, alors qu'un clic n'importe où ailleurs sur la carte ouvre cette modale. Le petit logo est dessiné par l'extension elle-même, avec ses trois pastilles de couleur : rien n'est téléchargé depuis Letterboxd pour l'afficher, et Letterboxd n'apprend rien tant que tu n'as pas cliqué toi-même dessus.

La modale de détail affiche elle-même une copie complète de la carte : le petit logo apparaît donc aussi là, sous la vignette, à côté du lien texte.

### Images manquantes

Beaucoup de cartes n'ont pas d'illustration : le site affiche alors son propre logo à la place. Quand Wikidata connaît une image pour la carte, l'extension l'affiche par-dessus ce logo, dans la grille comme dans la modale de détail. Tant que l'image n'est pas chargée, ou si elle ne se charge pas, le logo du site reste visible : aucun trou n'apparaît jamais.

L'image vient de Wikidata, par les propriétés "image" (P18), "logo" (P154), "affiche" (P3383), "drapeau" (P41), "blason" (P94) et "collage" (P2716), dans cet ordre : la première que possède l'élément est retenue. Elle est demandée avec les autres faits de la carte, dans la requête qui existait déjà : l'extension n'envoie aucune requête supplémentaire. Le fichier lui-même est hébergé par Wikimedia Commons et c'est ton navigateur qui le charge, comme n'importe quelle image d'un article de Wikipédia. Les photos sont cadrées en plein (avec un léger décalage vers le haut, là où se trouvent les visages), les logos, drapeaux et blasons sont affichés en entier sur un fond uni.

Quand Wikidata ne connaît aucune image, l'extension regarde en second lieu le fichier que l'article utilise pour lui-même : si un fichier y porte exactement le nom de l'article, une fois sa parenthèse finale retirée, et qu'il est hébergé sur Wikimedia Commons, il est affiché à sa place. Contrairement à l'image de Wikidata, cette recherche envoie sa propre requête à fr.wikipedia.org, uniquement pour les cartes que Wikidata laisse sans image. Cette seconde source est volontairement étroite, sur le nom exact du fichier, sur son usage réel dans l'article et sur son hébergement, car une règle plus large finit par mettre sur une carte une image sans rapport avec elle (un téléphone, un tableau, un logo d'un tout autre sujet), ce qui est pire que pas d'image du tout. Une page d'homonymie n'en reçoit jamais, et un fichier que frwiki héberge lui-même sous son exception de fichier non libre est refusé même quand il porte le bon nom : seul un fichier de Wikimedia Commons peut illustrer une carte.

Les images posées par l'extension portent une petite pastille "C" dans le coin bas droit : elles se distinguent ainsi des illustrations du site lui-même. La source complète, avec son auteur et sa licence, est écrite en toutes lettres dans la modale de détail.

L'adresse exacte de l'image est résolue une seule fois, par l'API de Wikipédia, puis mémorisée sur ta machine : les affichages suivants vont droit à l'image, sans repasser par les deux redirections que le navigateur n'a pas le droit de mettre en cache. Pendant qu'une image est en route, un léger voile animé occupe sa place, et il disparaît dès qu'elle s'affiche. Si elle ne peut pas être chargée, tout ce que l'extension avait posé est retiré : il ne reste que le logo du site, comme si l'extension n'avait rien trouvé. Le voile est remplacé par une teinte fixe, sans animation, si ton système demande de réduire les animations.

Les fichiers de Commons sont sous licence libre et demandent d'attribuer leur auteur : quand la modale de détail affiche une carte dont l'image vient de nous, une ligne "Image : Wikimedia Commons (auteur et licence)" est ajoutée avec un lien vers la page du fichier, où figurent l'auteur et la licence exacte. Le lien s'ouvre dans un nouvel onglet.

Cette fonctionnalité suit le réglage "Images manquantes" de la page d'options. Désactivée, les images et la ligne de crédit sont retirées immédiatement.

Limites connues : environ une carte sans illustration sur quatre a une image sur Wikidata, essentiellement des personnes, des logos et des drapeaux. Les films et les séries n'en ont presque jamais, car les affiches ne sont pas libres de droits. La seconde source ajoute environ une carte de plus sur dix parmi celles qui restent sans illustration : elle est volontairement rare, pour rester sûre. Enfin, le cache de catégorisation change de version à chacune de ces deux mises à jour : les cartes déjà en cache sont redemandées une fois, puis reprennent leur durée de vie habituelle.

### Masquer les statistiques des cartes

Une option, désactivée par défaut, masque les valeurs d'attaque (ATK) et de défense (DEF) : sur les cartes elles-mêmes, dans la grille comme en grand format, et dans les deux grands encadrés de la modale de détail. Rien d'autre n'est touché : le Q-Score, le nombre d'exemplaires et le nombre de vues de la modale ne sont pas concernés.

Techniquement, cette option ne fonctionne pas comme les autres. Toutes les autres fonctionnalités de cette extension ajoutent leurs propres éléments à la page, alors que celle-ci en cache un, ce qui mérite d'être expliqué en détail plutôt que passé sous silence. L'extension pose une feuille de style qui lui appartient dans l'en-tête de la page (jamais dans la page elle-même) quand l'option est cochée, et la retire entièrement dès qu'elle est décochée. Cette feuille de style ne fait que dire au navigateur de ne pas peindre deux nombres à l'écran : elle ne pose, ne modifie ni ne retire aucune classe, aucun attribut, ni aucun texte sur un élément du site, et rien n'est déplacé. Décocher l'option fait réapparaître les deux valeurs instantanément, sur tous les onglets ouverts, sans recharger la page.

Cacher un nombre dans ton propre navigateur ne donne aucun avantage dans le jeu, ne révèle rien à personne et n'automatise rien : c'est une préférence d'affichage, comme un mode lecture. Rien n'est envoyé nulle part par cette option, qu'elle soit activée ou non.

### Options

Un clic sur l'icône de l'extension ouvre sa page d'options (également accessible depuis `chrome://extensions`, bouton "Détails" puis "Options de l'extension").

Section "Fonctionnalités" : cinq cases à cocher, quatre activées par défaut et une désactivée par défaut (celle qui masque des statistiques du site, voir plus bas).

| Réglage | Ce qu'il active |
| --- | --- |
| Badge de catégorie | La pastille de catégorie sur les cartes et la ligne "Catégorie" dans la modale de détail |
| Mise en évidence par catégorie | Le panneau flottant des catégories de la page et le voile posé sur les cartes hors du filtre choisi |
| Lien Letterboxd | Le lien vers Letterboxd dans la modale de détail, et le petit logo sous la photo sur la carte |
| Images manquantes | L'image de Wikimedia Commons posée sur les cartes que le site laisse sans illustration, et la ligne de crédit dans la modale de détail |
| Masquer les statistiques des cartes | Les valeurs d'attaque et de défense, sur les cartes et dans la modale de détail |

Un changement est enregistré immédiatement et un petit message "Enregistré" le confirme. Si l'enregistrement échoue, la page relit les réglages réellement stockés, les affiche et signale l'erreur : ce qui est coché correspond toujours à ce qui est réellement stocké, y compris quand une autre case a été cochée entre-temps.

Les onglets du site déjà ouverts suivent le changement sans rechargement : une fonctionnalité désactivée voit ses éléments retirés tout de suite, et réactivée elle les repose immédiatement. Le filtre du panneau de catégories repart de zéro après une désactivation. Quand les quatre premiers réglages sont désactivés, l'extension n'envoie plus aucune requête de catégorisation : aucun appel ne part vers Wikipédia ni Wikidata. Le cinquième réglage, qui masque les statistiques, n'a jamais envoyé la moindre requête, qu'il soit coché ou non : il ne fait que peindre la page différemment.

Section "Données locales" : le nombre de cartes en cache de catégorisation, de classes Wikidata en cache et d'adresses d'images en cache, avec une action qui demande une confirmation sur place.

- "Vider le cache de catégorisation" efface les faits Wikidata gardés par carte, les catégories gardées par classe et les adresses gardées par image. Les cartes seront redemandées à `fr.wikipedia.org` et à `query.wikidata.org` la prochaine fois que tu les affiches. Les réglages et les pauses en cours sur un hôte ne sont pas touchés.

Une version précédente de l'extension tenait un index de ta collection. Il a été retiré, et sur une installation mise à jour un second bouton, "Supprimer les données de l'ancien index", apparaît le temps de supprimer ses deux entrées restantes. Il disparaît dès qu'elles ne sont plus là, et une installation neuve ne le voit jamais.

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
- Les réglages de la page d'options sont stockés au même endroit, sur ta machine uniquement.
- La page d'options est une page de l'extension : elle lit et efface uniquement ce qui est stocké localement, et ne fait aucun appel réseau.
- Les images manquantes sont chargées par ton navigateur depuis `commons.wikimedia.org` et les serveurs de vignettes de Wikimedia, sans référent (`referrerpolicy="no-referrer"`) : Wikimedia reçoit une demande de fichier, jamais la page qui l'affiche. Ce sont des requêtes de ton navigateur, comme pour n'importe quelle image d'un article de Wikipédia.
- La résolution de l'adresse de ces images est, elle, un appel de l'extension : il part vers `fr.wikipedia.org`, sans cookie, exactement comme celui qui résout les titres des cartes. Seuls des noms de fichiers publics de Wikimedia Commons y sont envoyés. Aucun autre hôte n'est contacté.
- Si tu désactives les quatre fonctionnalités qui en ont besoin dans les options, plus aucun titre ne part vers Wikipédia ni Wikidata.
- L'option qui masque les statistiques des cartes n'envoie jamais rien, qu'elle soit activée ou non : elle agit uniquement par une feuille de style locale, sans le moindre appel réseau.

## Contrainte fondamentale

Cette extension est un overlay en lecture seule. Elle ne clique jamais, ne scrolle pas, ne saisit rien, n'intercepte pas le trafic réseau et n'appelle pas les API du site. Tout contournement de cette règle expose au bannissement du compte.

Elle ajoute uniquement ses propres éléments (badge, ligne de catégorie, lien Letterboxd et son petit logo sur la carte, voile d'atténuation, panneau de catégories, image sur les cartes sans illustration et sa ligne de crédit, feuille de style qui masque les statistiques) et ne modifie jamais un élément du site : aucune classe, aucun attribut ni aucun style n'est posé sur un noeud du site, et rien n'y est déplacé ni supprimé. La feuille de style qui masque les statistiques ne fait pas exception : c'est un élément qui n'appartient qu'à l'extension, ajouté dans l'en-tête de la page plutôt que dans la page elle-même, qui se contente de dire au navigateur de ne pas peindre deux nombres à l'écran. Elle ne pose aucune classe, aucun attribut, aucun style ni aucun texte sur un élément du site, et la retirer (en décochant l'option) fait réapparaître ces deux nombres aussitôt : la promesse ci-dessus reste entière. Tout ce qui est posé au-dessus d'une carte laisse passer les clics (`pointer-events: none`), de sorte que les interactions du site restent exactement celles qu'il prévoit, à une seule exception près : le petit logo Letterboxd de la carte (voir la section "Lien Letterboxd"), qui empêche son propre clic d'ouvrir en plus la modale de détail. Les seuls clics écoutés sont ceux que tu fais sur les boutons de l'extension, et aucun clic du site n'est par ailleurs intercepté ni bloqué. Tous les éléments ajoutés sont retirés quand l'extension est rechargée, désactivée, ou quand la fonctionnalité correspondante est décochée dans la page d'options.
