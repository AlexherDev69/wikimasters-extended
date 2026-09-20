# WikiMasters Extended

Extension Chrome (Manifest V3) en lecture seule pour [wiki-masters.com](https://www.wiki-masters.com).

Objectif : afficher sur chaque carte une catégorie (via Wikidata), une image pour les cartes que le site laisse sans illustration, un lien Letterboxd pour les films et personnalités du cinéma, des étiquettes suggérées dans la modale de détail, et les cartes elles-mêmes à la place des noms tronqués sur la page des échanges. Elle ne scrolle pas et n'intercepte aucun trafic réseau. Elle est en lecture seule sur le site, à une seule exception près : un réglage désactivé par défaut qui, sur un clic explicite de ta part, écrit une étiquette suggérée dans le champ du site (voir la section "Étiquettes suggérées").

## État actuel

Phases 1 à 3, 4a, 5, 6a et 7a : l'extension détecte les cartes affichées, y compris celles qui arrivent après le chargement de la page (rendu React, pagination, bouton "Charger la suite", carrousel d'ouverture de paquet), en extrait le titre, la description et la rareté, puis demande leur catégorie à Wikidata depuis le service worker (personne, film et TV, musique, sport, vivant, gastronomie, monument, religion et idées, oeuvre, lieu, transport et technique, évènement, organisation, astronomie, science, autre), avec un sous-type pour les personnes (cinéma, musique, sport, politique, science, littérature, art, médias, autre).

Les phases 4c et 4d (index de collection, fenêtre de statistiques et complétion par rareté) ont été retirées le 20 septembre 2026 : l'extension ne peut pas voir une carte quitter ta collection (vente, échange, destruction) sans interagir avec le site, donc ses nombres auraient fini par dériver.

L'extension ne garde aucune liste de tes cartes : rien de ta collection n'est enregistré.

### Badge de catégorie sur les cartes

Chaque carte catégorisée reçoit une petite pastille sombre en bas à gauche, à cheval sur la limite entre la photo et le texte : un point de la couleur de la catégorie et son libellé, par exemple "Lieu" ou "Personne · Cinéma" pour une personne dont le sous-type principal est connu. La pastille suit toujours la carte affichée à l'instant : si le site réutilise un emplacement pour une autre carte (pagination), le badge est recalculé à partir du titre affiché. Une carte dont l'article est introuvable, dont la catégorisation a échoué ou dont la catégorie n'est pas encore connue ne reçoit aucun badge.

### Catégorie dans la modale de détail

Quand la modale de détail est ouverte, une ligne "Catégorie : ..." est ajoutée sous le lien "Voir l'article sur Wikipédia" (et sous le lien Letterboxd quand il est présent). Pour une personne ayant plusieurs métiers, les autres sous-types sont listés entre parenthèses, par exemple "Catégorie : Personne · Musique (aussi : Cinéma)".

### Lien Letterboxd

Quand la modale de détail d'une carte est ouverte, un lien "Voir sur Letterboxd" est ajouté juste après le lien "Voir l'article sur Wikipédia", et ouvre la page Letterboxd dans un nouvel onglet. Il apparaît pour les films et pour les personnes ayant au moins un métier de cinéma (page du réalisateur, de l'acteur, du scénariste ou du producteur, sinon recherche par titre ou par nom), ainsi que pour les studios.

Pour un film, le lien est la page que Letterboxd nomme lui-même (identifiant Letterboxd de Wikidata), sinon celle que son identifiant TMDb désigne, sinon une recherche sur le titre. L'identifiant IMDb servait de repli jusqu'au 2026-09-21 : mesuré sur Wikidata, 95 % des films de frwiki qui en portent un portent aussi l'identifiant Letterboxd, donc ce repli ne servait que pour les 4 % restants, c'est-à-dire justement les films absents du catalogue de Letterboxd, où il ouvrait une page vide. Une personnalité sans métier de cinéma n'en reçoit aucun, même si Wikidata lui connaît un identifiant Letterboxd (Albert Einstein en a un, hérité d'images d'archives).

Une série, une saison ou un épisode n'en reçoit pas non plus, sauf si Letterboxd le référence lui-même : quand Wikidata porte un identifiant de film Letterboxd pour l'oeuvre, le lien est affiché, car c'est Letterboxd qui indique alors que la page existe. C'est le cas de certaines web-séries, comme "The Backrooms". En l'absence de cet identifiant, aucun repli n'est tenté : un identifiant TMDb de série ne mène à aucune page Letterboxd, et une recherche par titre mènerait à la mauvaise.

Le même lien apparaît aussi sous la forme d'un petit logo Letterboxd sur la carte elle-même, dans le coin bas droit, sous la ligne des statistiques, pour les mêmes cartes que ci-dessus. Il s'ouvre dans un nouvel onglet, exactement comme celui de la modale. C'est le seul élément de l'extension qui réagit à un clic fait sur une carte : cliquer dessus ouvre Letterboxd sans ouvrir en plus la modale de détail de la carte, alors qu'un clic n'importe où ailleurs sur la carte ouvre cette modale. Le petit logo est dessiné par l'extension elle-même, avec ses trois pastilles de couleur : rien n'est téléchargé depuis Letterboxd pour l'afficher, et Letterboxd n'apprend rien tant que tu n'as pas cliqué toi-même dessus.

La modale de détail affiche elle-même une copie complète de la carte : le petit logo apparaît donc aussi là, dans le coin bas droit de cette copie, en plus du lien texte.

### Images manquantes

Beaucoup de cartes n'ont pas d'illustration : le site affiche alors son propre logo à la place. Quand Wikidata connaît une image pour la carte, l'extension l'affiche par-dessus ce logo, dans la grille comme dans la modale de détail. Tant que l'image n'est pas chargée, ou si elle ne se charge pas, le logo du site reste visible : aucun trou n'apparaît jamais.

L'image vient de Wikidata, par les propriétés "image" (P18), "logo" (P154), "affiche" (P3383), "drapeau" (P41), "blason" (P94) et "collage" (P2716), dans cet ordre : la première que possède l'élément est retenue. Elle est demandée avec les autres faits de la carte, dans la requête qui existait déjà : l'extension n'envoie aucune requête supplémentaire. Le fichier lui-même est hébergé par Wikimedia Commons et c'est ton navigateur qui le charge, comme n'importe quelle image d'un article de Wikipédia. Les photos sont cadrées en plein (avec un léger décalage vers le haut, là où se trouvent les visages), les logos, drapeaux et blasons sont affichés en entier sur un fond uni.

Quand Wikidata ne connaît aucune image, l'extension regarde en second lieu le fichier que l'article utilise pour lui-même : si un fichier y porte exactement le nom de l'article, une fois sa parenthèse finale retirée, et qu'il est hébergé sur Wikimedia Commons, il est affiché à sa place. À défaut, un fichier portant ce nom suivi d'un seul mot qui désigne l'image elle-même (logo, affiche, poster, couverture, bannière, titre) est accepté aussi : beaucoup d'articles de séries, de marques et d'organisations s'illustrent avec un "<titre> Logo" et jamais avec un "<titre>" tout court. La liste de ces mots est fermée, et non un préfixe libre : "Paris Hilton.jpg" commence par le titre de l'article "Paris", et un préfixe libre poserait le portrait de quelqu'un d'autre sur cette carte. En dernier recours, l'extension retient l'illustration principale libre que Wikipédia désigne elle-même pour l'article, celle de ses propres aperçus : elle voyage dans la requête qui vient d'être envoyée, ne coûte donc aucun appel de plus, et doit comme les autres être hébergée sur Commons et réellement utilisée dans l'article. Mesuré le 2026-09-21 sur 22 articles de cartes réelles : 10 en ont une, 9 sont sur Commons (la dixième, hébergée sur frwiki, est refusée), et aucune ne montrait un sujet étranger à son article.

Contrairement à l'image de Wikidata, cette recherche envoie sa propre requête à fr.wikipedia.org, uniquement pour les cartes que Wikidata laisse sans image. Cette seconde source reste volontairement étroite : le nom exact du fichier, l'illustration que Wikipédia désigne elle-même, l'usage réel du fichier dans l'article et son hébergement. Jamais un fichier quelconque de l'article, car cette règle-là finit par mettre sur une carte une image sans rapport avec elle (un téléphone, un tableau, un logo d'un tout autre sujet), ce qui est pire que pas d'image du tout. Une page d'homonymie n'en reçoit jamais, et un fichier que frwiki héberge lui-même sous son exception de fichier non libre est refusé même quand il porte le bon nom : seul un fichier de Wikimedia Commons peut illustrer une carte.

Les images posées par l'extension portent une petite pastille "C" dans le coin bas droit : elles se distinguent ainsi des illustrations du site lui-même. La source complète, avec son auteur et sa licence, est écrite en toutes lettres dans la modale de détail.

L'adresse exacte de l'image est résolue une seule fois, par l'API de Wikipédia, puis mémorisée sur ta machine : les affichages suivants vont droit à l'image, sans repasser par les deux redirections que le navigateur n'a pas le droit de mettre en cache. Pendant qu'une image est en route, un léger voile animé occupe sa place, et il disparaît dès qu'elle s'affiche. Si elle ne peut pas être chargée, tout ce que l'extension avait posé est retiré : il ne reste que le logo du site, comme si l'extension n'avait rien trouvé. Le voile est remplacé par une teinte fixe, sans animation, si ton système demande de réduire les animations.

Les fichiers de Commons sont sous licence libre et demandent d'attribuer leur auteur : quand la modale de détail affiche une carte dont l'image vient de nous, une ligne "Image : Wikimedia Commons (auteur et licence)" est ajoutée avec un lien vers la page du fichier, où figurent l'auteur et la licence exacte. Le lien s'ouvre dans un nouvel onglet.

Cette fonctionnalité suit le réglage "Images manquantes" de la page d'options. Désactivée, les images et la ligne de crédit sont retirées immédiatement.

Limites connues : environ une carte sans illustration sur quatre a une image sur Wikidata, essentiellement des personnes, des logos et des drapeaux. Les films et les séries n'en ont presque jamais, car les affiches ne sont pas libres de droits. La seconde source ajoute environ une carte de plus sur dix parmi celles qui restent sans illustration : elle est volontairement rare, pour rester sûre. Enfin, le cache de catégorisation change de version à chacune de ces deux mises à jour : les cartes déjà en cache sont redemandées une fois, puis reprennent leur durée de vie habituelle.

### Cartes sur la page d'échange

Sur la page des échanges, chaque offre nomme les cartes proposées dans de petites pastilles dont le texte est coupé au bout de quelques caractères ("SR · The Backrooms (fil…"). Il fallait ouvrir l'offre pour savoir de quelles cartes il s'agissait.

L'extension dessine la carte à la place de chaque pastille, dans la forme que le site donne à ses propres cartes : format portrait, image dans le haut, badge de rareté dans son coin, et le titre entier en dessous, jamais coupé, sur le fond de la rareté. L'image est celle que Wikidata ou l'article de Wikipédia connaît (la même source que pour les images manquantes), posée sur le fond clair ou sombre des cartes du site selon qu'il s'agit d'un logo ou d'une photographie. Une carte dont aucune image n'est connue garde le fond de sa rareté, son code et son titre complet, ce qui est déjà tout ce que la pastille cachait.

La pastille du site n'est ni modifiée ni retirée : elle reste dans la page exactement comme le site l'a écrite, et c'est une règle de style qui la laisse hors du rendu, uniquement là où une carte de l'extension vient d'être dessinée juste avant elle. Là où l'extension ne dessine rien, la pastille s'affiche comme avant.

Un clic sur la carte fait exactement ce qu'un clic sur la pastille faisait, c'est-à-dire ouvrir l'offre : rien de ce que l'extension pose sur le site ne prend le clic.

Cette fonctionnalité suit le réglage "Cartes sur la page d'échange" de la page d'options. Désactivée, les cartes dessinées sont retirées immédiatement et les pastilles du site réapparaissent.

### Masquer les statistiques des cartes

Une option, désactivée par défaut, masque les valeurs d'attaque (ATK) et de défense (DEF) : sur les cartes elles-mêmes, dans la grille comme en grand format, et dans les deux grands encadrés de la modale de détail. Rien d'autre n'est touché : le Q-Score, le nombre d'exemplaires et le nombre de vues de la modale ne sont pas concernés, car ils sont ailleurs dans la page que les deux encadrés retirés. Si le site venait à les déplacer dans ce même bloc, ils disparaîtraient avec, et la règle serait à corriger.

La ligne noire que la carte trace au-dessus de ces deux valeurs s'efface avec elles : une bande vide fermée par un trait est tout ce que la carte montrerait sinon. Seule la couleur du trait part, jamais le trait lui-même, sinon un pixel s'effondrerait et tout ce que le site a posé au-dessus remonterait d'autant.

Techniquement, cette option ne fonctionne pas comme les autres. Les autres fonctionnalités de cette extension ajoutent leurs propres éléments à la page ; celle-ci est la seule qui cache quelque chose du site en toutes circonstances, ce qui mérite d'être expliqué en détail plutôt que passé sous silence. Les cartes de la page d'échange laissent bien une pastille du site hors du rendu, mais seulement là où elles viennent d'en dessiner la carte, et jamais ailleurs. L'extension pose une feuille de style qui lui appartient dans l'en-tête de la page (jamais dans la page elle-même) quand l'option est cochée, et la retire entièrement dès qu'elle est décochée. Cette feuille de style ne fait que dire au navigateur de ne pas peindre deux nombres à l'écran : elle ne pose, ne modifie ni ne retire aucune classe, aucun attribut, ni aucun texte sur un élément du site, et rien n'est déplacé. Décocher l'option fait réapparaître les deux valeurs instantanément, sur tous les onglets ouverts, sans recharger la page.

Cacher un nombre dans ton propre navigateur ne donne aucun avantage dans le jeu, ne révèle rien à personne et n'automatise rien : c'est une préférence d'affichage, comme un mode lecture. Rien n'est envoyé nulle part par cette option, qu'elle soit activée ou non.

### Étiquettes suggérées

Le site propose déjà des étiquettes manuelles sur les cartes que tu possèdes, dans la modale de détail. Quand cette zone est présente (une carte que tu ne possèdes pas n'en a pas), l'extension ajoute juste en dessous jusqu'à six propositions : le libellé de la catégorie de la carte, le sous-type principal pour une personne, puis ses métiers connus de Wikidata, chacun sur un seul mot ou une courte expression, sans doublon et sans jamais reproposer une étiquette déjà posée sur la carte. Une carte dont Wikidata ne connaît rien d'utile ne reçoit aucune proposition. Tant que les faits de la carte n'ont pas répondu, la zone affiche "recherche…" à la place des propositions : sans ce mot, une zone vide se lit comme une carte sans rien à proposer alors qu'elle est seulement en cours de recherche. Le mot est remplacé par les propositions dès qu'elles arrivent.

Par défaut, un clic sur une proposition sélectionne son texte, pour que tu puisses le copier (Ctrl+C ou Cmd+C) et le coller toi-même dans le champ du site. Rien n'est écrit sur le site par ce clic : c'est une aide à la copie, rien de plus. Seul effet de bord à connaître, il remplace la sélection de texte que tu avais peut-être ailleurs dans la page.

Un second réglage, "Remplir l'étiquette au clic", change ce comportement : coché, un clic sur une proposition écrit directement l'étiquette dans le champ du site et la valide, de la façon exacte dont le site lit ta propre frappe. Ce réglage est désactivé par défaut, et volontairement séparé du précédent : afficher des propositions n'écrit jamais sur le site, quel que soit ce second réglage, et lui seul décide si un clic va plus loin qu'une sélection de texte. Les règles de wiki-masters.com interdisent "tout outil visant à jouer, ouvrir des paquets, échanger ou interagir à votre place", avec un bannissement possible comme sanction : ce réglage revient à interagir à ta place au moment du clic, donc à activer en connaissance de cause, jamais par défaut pour quelqu'un d'autre que toi.

Cette fonctionnalité suit le réglage "Étiquettes suggérées" de la page d'options. Désactivée, les propositions sont retirées immédiatement, et la seconde option n'a alors plus aucun effet.

### Options

Un clic sur l'icône de l'extension ouvre sa page d'options (également accessible depuis `chrome://extensions`, bouton "Détails" puis "Options de l'extension").

Section "Fonctionnalités" : sept cases à cocher, cinq activées par défaut et deux désactivées par défaut (celle qui masque des statistiques du site et celle qui remplit l'étiquette au clic, voir plus haut).

| Réglage | Ce qu'il active |
| --- | --- |
| Badge de catégorie | La pastille de catégorie sur les cartes et la ligne "Catégorie" dans la modale de détail |
| Lien Letterboxd | Le lien vers Letterboxd dans la modale de détail, et le petit logo sous la photo sur la carte |
| Images manquantes | L'image de Wikimedia Commons posée sur les cartes que le site laisse sans illustration, et la ligne de crédit dans la modale de détail |
| Cartes sur la page d'échange | Les cartes dessinées à la place des noms tronqués dans les offres de la page des échanges |
| Masquer les statistiques des cartes | Les valeurs d'attaque et de défense, sur les cartes et dans la modale de détail |
| Étiquettes suggérées | Les propositions d'étiquette dans la modale de détail, pour les cartes que tu possèdes |
| Remplir l'étiquette au clic | Écrit et valide la proposition cliquée dans le champ du site, au lieu de seulement sélectionner son texte |

Un changement est enregistré immédiatement et un petit message "Enregistré" le confirme. Si l'enregistrement échoue, la page relit les réglages réellement stockés, les affiche et signale l'erreur : ce qui est coché correspond toujours à ce qui est réellement stocké, y compris quand une autre case a été cochée entre-temps.

Les onglets du site déjà ouverts suivent le changement sans rechargement : une fonctionnalité désactivée voit ses éléments retirés tout de suite, et réactivée elle les repose immédiatement. Quand le badge, le lien Letterboxd, les images manquantes, les cartes de la page d'échange et les étiquettes suggérées sont tous désactivés, l'extension n'envoie plus aucune requête de catégorisation : aucun appel ne part vers Wikipédia ni Wikidata. Les deux réglages restants n'envoient eux-mêmes jamais la moindre requête, qu'ils soient cochés ou non : masquer les statistiques ne fait que peindre la page différemment, et remplir l'étiquette au clic écrit directement dans le champ du site, sans appel réseau.

Section "Données locales" : le nombre de cartes en cache de catégorisation, de classes Wikidata en cache et d'adresses d'images en cache, avec une action qui demande une confirmation sur place.

- "Vider le cache de catégorisation" efface les faits Wikidata gardés par carte, les catégories gardées par classe et les adresses gardées par image. Les cartes seront redemandées à `fr.wikipedia.org` et à `query.wikidata.org` la prochaine fois que tu les affiches. Les réglages et les pauses en cours sur un hôte ne sont pas touchés.

Une version précédente de l'extension tenait un index de ta collection. Il a été retiré, et sur une installation mise à jour un second bouton, "Supprimer les données de l'ancien index", apparaît le temps de supprimer ses deux entrées restantes. Il disparaît dès qu'elles ne sont plus là, et une installation neuve ne le voit jamais.

Section "Confidentialité" : le même texte que la section ci-dessous, rappelé dans la page.

La seule réponse au besoin de filtre qui reste ouverte est la synergie avec les étiquettes natives du site : l'extension te propose les étiquettes dans la modale de détail (voir plus haut), et c'est toi qui les poses, à l'unité ou avec la sélection en lot du site.

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
- Les résultats sont mis en cache localement dans le stockage de l'extension (`chrome.storage.local`), sur ta machine uniquement : 90 jours pour une carte résolue, 7 jours pour une carte introuvable, 90 jours pour la catégorie d'une classe Wikidata.
- Les réglages de la page d'options sont stockés au même endroit, sur ta machine uniquement.
- La page d'options est une page de l'extension : elle lit et efface uniquement ce qui est stocké localement, et ne fait aucun appel réseau.
- Les images manquantes sont chargées par ton navigateur depuis `commons.wikimedia.org` et les serveurs de vignettes de Wikimedia, sans référent (`referrerpolicy="no-referrer"`) : Wikimedia reçoit une demande de fichier, jamais la page qui l'affiche. Ce sont des requêtes de ton navigateur, comme pour n'importe quelle image d'un article de Wikipédia.
- La résolution de l'adresse de ces images est, elle, un appel de l'extension : il part vers `fr.wikipedia.org`, sans cookie, exactement comme celui qui résout les titres des cartes. Seuls des noms de fichiers publics de Wikimedia Commons y sont envoyés. Aucun autre hôte n'est contacté.
- Si tu désactives les quatre fonctionnalités qui en ont besoin dans les options (badge, lien Letterboxd, images manquantes et étiquettes suggérées), plus aucun titre ne part vers Wikipédia ni Wikidata.
- L'option qui masque les statistiques des cartes n'envoie jamais rien, qu'elle soit activée ou non : elle agit uniquement par une feuille de style locale, sans le moindre appel réseau.
- L'option qui remplit l'étiquette au clic n'envoie elle non plus aucune requête réseau : le clic écrit directement, sur ta machine, dans le champ que le site affiche déjà pour les étiquettes.

## Contrainte fondamentale

Cette extension est un overlay en lecture seule sur wiki-masters.com, à une seule exception près : le réglage "Remplir l'étiquette au clic" (voir la section "Étiquettes suggérées"), désactivé par défaut, que tu actives toi-même en connaissance de cause. En dehors de ce cas précis, elle ne clique jamais, ne scrolle pas, ne saisit rien, n'intercepte pas le trafic réseau et n'appelle pas les API du site. Les règles de wiki-masters.com interdisent "tout outil visant à jouer, ouvrir des paquets, échanger ou interagir à votre place", et annoncent le bannissement du compte, sans préavis, comme sanction. Activer ce réglage revient à interagir à ta place au moment du clic, et le site ne peut pas distinguer cela de ta propre frappe au clavier : c'est TON compte wiki-masters.com qui est en jeu, et toi seul peux décider de prendre ce risque.

Elle ajoute uniquement ses propres éléments (badge, ligne de catégorie, lien Letterboxd et son petit logo sur la carte, image sur les cartes sans illustration et sa ligne de crédit, feuille de style qui masque les statistiques, propositions d'étiquette dans la modale de détail) et ne modifie jamais un élément du site : aucune classe, aucun attribut ni aucun style n'est posé sur un noeud du site, et rien n'y est déplacé ni supprimé, à la seule exception du champ d'étiquette du site lui-même, et seulement quand tu cliques une proposition avec le remplissage automatique activé. La feuille de style qui masque les statistiques demande de distinguer deux plans, car elle touche au second sans toucher au premier : rien n'est écrit sur un noeud du site, et pourtant l'affichage de deux nombres du site change. C'est un élément qui n'appartient qu'à l'extension, ajouté dans l'en-tête de la page plutôt que dans la page elle-même, et qui se contente de dire au navigateur de ne pas peindre ces deux nombres à l'écran. Le site, lui, garde exactement le document qu'il a construit, et la retirer (en décochant l'option) fait réapparaître les deux nombres aussitôt. Tout ce qui est posé au-dessus d'une carte laisse passer les clics (`pointer-events: none`), de sorte que les interactions du site restent exactement celles qu'il prévoit, à une seule exception près : le petit logo Letterboxd de la carte (voir la section "Lien Letterboxd"), qui empêche son propre clic d'ouvrir en plus la modale de détail. Les seuls clics écoutés sont ceux que tu fais sur les boutons de l'extension, et aucun clic du site n'est par ailleurs intercepté ni bloqué. Tous les éléments ajoutés sont retirés quand l'extension est rechargée, désactivée, ou quand la fonctionnalité correspondante est décochée dans la page d'options.

Le remplissage automatique de l'étiquette est la seule écriture que l'extension fait jamais sur un noeud du site, et elle reste étroitement gardée : un clic sur une proposition n'écrit dans le champ du site que si ce clic est réellement le tien (jamais un script qui simulerait un clic) et que le réglage est actif au moment même du clic, pas seulement quand la proposition a été affichée. Dans ce seul cas, l'étiquette est écrite dans le champ puis validée, de la façon exacte dont le site lit une frappe au clavier suivie d'un appui sur Entrée. Une différence à connaître : taper insère à l'endroit du curseur, alors que ce remplissage REMPLACE ce que le champ contenait déjà. Décoché, ou pour tout clic non fiable, ce même bouton se contente de sélectionner son texte, sans rien écrire nulle part.
