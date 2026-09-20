# WikiMasters Extended : analyse de faisabilité et plan

Date de l'analyse : 2026-09-20. Idées sources : [IDEAS.md](IDEAS.md).

## 1. Ce qui a été analysé

### Site wiki-masters.com (partie publique uniquement)

| Élément | Constat |
| --- | --- |
| Stack | Next.js App Router (Turbopack) sur Vercel, Tailwind, icônes lucide, Supabase (auth et données), Capacitor (apps mobiles), Turnstile à l'inscription, Stripe |
| Routes applicatives | `/pulls` (page d'accueil connectée), `/collection`, `/profile`, `/leaderboard`, `/marketplace`, `/trades`, `/battle`, `/friends`, `/guild`, `/dms`. Toutes redirigent vers `/login` ou `/signup` sans session |
| En-têtes | Pas de Content-Security-Policy, pas de X-Frame-Options. Aucun obstacle à l'injection d'un content script ni aux fetch sortants |
| DOM d'une carte (landing) | Conteneur `div` en `aspect-[5/7]`, badge de rareté (C, PC, R, SR, UR, L), `h3` = titre, `p` = description, attaque (icône `lucide-swords`), défense (icône `lucide-shield`) |
| Identifiants dans le DOM | Aucun : pas de `data-*`, pas de lien vers l'article, pas de QID, pas de classes stables (utilitaires Tailwind uniquement) |
| Titre de carte | Titre exact de l'article frwiki, parenthèses comprises ("Saturne (planète)", "Cléopâtre VII"). C'est la clé de résolution |
| Description | Description Wikidata en français |
| Fonction existante | Le site propose déjà des tags manuels sur la collection ("Sciences", "Histoire", "À échanger"). La catégorisation automatique est complémentaire |
| Langue | `lang: fr` dans le manifest. Aucune trace d'autres langues |

### Règles du site (contrainte structurante)

Règles de la communauté, section 3, et CGU section 6 :

- Interdits : bots, scripts, macros ou "tout outil visant à jouer, ouvrir des paquets, échanger ou interagir à votre place"
- Interdite : "modification, rétro-ingénierie ou interception du trafic du Service pour obtenir un avantage"
- Sanction possible : bannissement sans préavis

Conséquence : l'extension doit être un overlay en lecture seule. Voir section 4, garde-fous.

### Wikidata et Wikipédia (mesures réelles depuis l'origine wiki-masters.com)

| Approche testée | Résultat | Verdict |
| --- | --- | --- |
| `wbgetentities` avec `props=claims` | 1 Mo pour 8 cartes | Rejetée, trop lourd |
| API frwiki `action=query&prop=pageprops&redirects=1` | 20 titres vers QID en 195 ms, gère redirections et normalisation, 50 titres par requête | Retenue (étape 1) |
| SPARQL direct (P31, P106, IDs Letterboxd, IMDb, TMDb) | 20 cartes en 1,2 s, 6 Ko | Retenue (étape 2) |
| SPARQL `P31/P279*` par carte vers des racines génériques | 5,5 s pour 20 cartes et résultats faux (Saint-Malo classée "organisation", Bataille de Waterloo, Titanic, Origami sans catégorie) | Rejetée |
| SPARQL `P279*` par classe avec racines enrichies et hint `gearing forward` | 12 classes en 1,6 s, résultats corrects | Retenue (fallback, cache par classe) |

CORS : OK avec `origin=*` sur les API MediaWiki, OK nativement sur query.wikidata.org.

### Letterboxd (vérifié par navigation)

| URL | Résultat |
| --- | --- |
| `/film/<P6127>/` | OK (`pulp-fiction`) |
| `/director/<P12383>/` | OK (`quentin-tarantino`) |
| `/actor/<P6119>/` | OK (`marion-cotillard`, vu dans les résultats de recherche) |
| `/imdb/<P345>/` | Redirige vers la fiche film |
| `/tmdb/<P4947>/` | Redirige vers la fiche film |
| `/search/<texte>/` | OK, la bonne fiche sort en premier |

Propriétés Wikidata disponibles : P6127 (film), P6119 (acteur), P12383 (réalisateur), P14583 (scénariste), P14196 (producteur), P13273 (studio). Les URL `/writer/`, `/producer/`, `/studio/` restent à vérifier.

Piège confirmé : Albert Einstein et Emmanuel Macron ont un ID Letterboxd "acteur" et un ID IMDb (apparitions dans des documentaires). La présence d'un ID ne prouve pas que la carte est "cinéma". Le filtrage par P31 et P106 est obligatoire, ce qui confirme la dépendance de l'idée 2 envers l'idée 1.

## 2. Pages connectées : ce qui est acquis et ce qui manque

Le navigateur intégré est bloqué par Turnstile à la connexion. L'analyse s'appuie donc sur des exports HTML fournis par l'utilisateur. Détail complet dans [DOM_NOTES.md](DOM_NOTES.md).

| Question | Réponse |
| --- | --- |
| Le composant carte est-il exploitable ? | Oui. Même composant partout, racine identifiable par la classe `glow-<rareté>`, titre dans `h3`, description facultative dans `p` |
| Y a-t-il un identifiant d'article ? | Pas sur la carte. Dans la modale de détail, oui : lien `https://fr.wikipedia.org/wiki/<titre>` |
| Comment se charge `/collection` ? | Pagination (Précédent, Suivant). Le site a déjà tri, filtre par rareté, filtre par étiquette, liste de souhaits et gestion d'étiquettes en lot |
| Où apparaissent les cartes ? | `/pulls` (une à la fois), `/collection`, `/marketplace` (lots de 40, "Charger la suite"), modale de détail. Probablement aussi `/trades`, `/battle`, `/profile`, `/global-collection` |
| Le pipeline tient-il sur de vraies cartes ? | Oui. 43 sur 43 titres résolus, 42 sur 43 avec un P31, 1,8 s au total |
| Y a-t-il un ensemble fini de cartes ? | Inconnu. La page `/global-collection` ("Toutes les cartes") existe mais n'a pas été capturée |
| Y a-t-il d'autres langues que frwiki ? | Aucun indice. Le lien de la modale porte le sous-domaine de langue, ce qui permettra de le gérer si besoin |

Reste à capturer : `/collection` une fois chargée et `/global-collection`.

## 3. Verdict de faisabilité

| Idée | Verdict | Commentaire |
| --- | --- | --- |
| 1. Catégorisation (badge sur carte, stats locales) | Faisable, validé sur cartes réelles | Coût réseau faible, cache très efficace |
| 1. Filtres et tri dans la collection | Faisable mais limité par la pagination | Un filtre DOM ne voit que la page courante. Trois réponses complémentaires, voir phase 4 |
| 1. Taux de complétion par catégorie | À clarifier | Dépend de `/global-collection`. À défaut : répartition de la collection par catégorie, sans dénominateur |
| 2. Lien Letterboxd | Faisable | 3 niveaux de fallback pour les films, 2 pour les personnes. Emplacement idéal trouvé : la modale de détail, à côté du lien Wikipédia |

## 4. Architecture proposée

### Flux de données

```
content script (wiki-masters.com)
  MutationObserver -> détecte les cartes -> extrait { title, description, rarity }
  -> envoie les titres inconnus au service worker (batch, debounce ~200 ms)
  <- reçoit { category, subcategory, letterboxdUrl } -> injecte badge et bouton

service worker
  1. cache (chrome.storage.local) -> hit : réponse immédiate
  2. miss : API frwiki, 50 titres par requête -> QID (redirections gérées)
  3. SPARQL direct -> P31, P279, P106, IDs Letterboxd, IMDb, TMDb (les faits bruts sont mis en cache par carte)
  4. classes et métiers absents du cache par classe : SPARQL P279* par classe vers les racines, résultat mis en cache par classe
  5. classification recalculée à chaque lecture (fonctions pures), réponse au content script
```

Point clé : le cache se fait à deux niveaux. Par carte (titre vers faits bruts Wikidata), et par classe Wikidata (classe vers catégorie). Le nombre de classes distinctes est très inférieur au nombre de cartes et leur rattachement change rarement, donc la requête coûteuse devient rare très vite. Comme la carte stocke les faits et non la catégorie finale, modifier les listes de racines n'invalide que le cache par classe : aucune carte n'est à retélécharger.

### Catégories v1 (proposition, ajustée sur l'échantillon réel)

Personne, Cinéma et TV, Musique, Sport, Vivant, Gastronomie, Monument et bâtiment, Religion et idées, Oeuvre et culture, Lieu, Transport et technique, Évènement, Organisation, Astronomie, Science et concept, Autre. Gastronomie et Religion et idées ont été ajoutées après le premier essai sur 50 cartes réelles de la collection (validées par l'utilisateur le 2026-09-20).

Règles de classification :

1. `P31 = Q5` : catégorie Personne, sous-types via P106
2. Sinon, chaque classe P31 est rattachée à une catégorie : la première, dans l'ordre de priorité, dont une racine est atteinte par `P279*`. Vote majoritaire entre les classes de la carte, ordre de priorité en cas d'égalité. Exemple réel : "McDonald's" a une classe qui remonte vers Lieu et quatre vers Organisation
3. Si les classes P31 ne donnent aucun vote, ou s'il n'y a pas de P31, les parents P279 votent. Exemples réels : "Hutte" (pas de P31) devient Monument et bâtiment ; "Ville", "Colt M1911", "Novitchok" et "Myodésopsie" ont pour P31 une méta-classe qui ne mène nulle part ("type de maladie", "modèle d'arme à feu") alors que leurs parents mènent à la bonne catégorie
4. Toujours aucun vote : "Science et concept" si la carte est elle-même une classe (pas de P31, au moins un P279), sinon "Autre"
5. Article introuvable : statut "introuvable" sans catégorie, nouvelle tentative après expiration du cache

L'ordre de priorité compte, car une classe Wikidata atteint souvent plusieurs racines. "Monument et bâtiment" passe avant "Oeuvre et culture" (une structure architecturale est aussi une "oeuvre"), "Religion et idées" avant "Organisation" (une religion est une "organisation" dans Wikidata), "Lieu" avant "Organisation" (une commune est aussi une organisation). Une même catégorie peut apparaître deux fois dans l'ordre : "étendue d'eau" (Lieu) passe avant "Monument et bâtiment", car un lac de barrage est aussi une "structure architecturale". La racine "occurrence" a été retirée d'Évènement : trop générique, elle classait "Bouddhisme" en évènement.

Sous-types de Personne (Cinéma, Musique, Sport, Politique, Science, Littérature, Art, Médias, Autre) :

- Même mécanique que pour P31 : chaque métier est rattaché à un sous-type via `P279*` vers des racines de métiers
- Une personne garde tous ses sous-types comme tags (Kim Ji-soo : Musique et Cinéma)
- Le sous-type principal se décide avec la description de la carte, car l'ordre des P106 dans Wikidata n'a aucun sens. Exemple réel : Phil Collins sort "acteur" en premier alors que sa description dit "batteur, chanteur et auteur-compositeur". Le métier dont le libellé français (variantes masculine et féminine) apparaît le plus tôt dans la description l'emporte. Sans correspondance : vote majoritaire, puis ordre de priorité
- Deux ordres distincts pour Médias. Au niveau du métier, Médias passe avant Cinéma, car dans Wikidata "animateur de télévision" est une sous-classe d'"acteur" : sans cela les journalistes sortaient en Cinéma (et auraient reçu un lien Letterboxd). Au niveau de la personne, Médias passe en dernier en cas d'égalité de votes : Georges Mandel, homme politique et journaliste, reste en Politique
- "artiste peintre" n'atteint pas "artiste" dans Wikidata mais "artiste visuel", ajouté aux racines d'Art
- Limite connue : les tags secondaires sont bruités (Phil Collins reçoit "Science" via "autobiographe"). Sans conséquence sur le sous-type principal, et corrigeable sans retéléchargement puisque les métiers bruts sont en cache

Table statique classe vers catégorie : reportée. Les mesures montrent que la résolution en ligne suffit (2,7 s pour 49 classes, une seule fois par classe). Elle reste une optimisation possible du premier affichage : un script de build interrogerait Wikidata pour les classes les plus fréquentes avec les mêmes racines.

### Résolution du lien Letterboxd

| Type de carte | Ordre de résolution |
| --- | --- |
| Film | P6127 `/film/<id>/`, sinon P4947 `/tmdb/<id>/`, sinon P345 `/imdb/<id>/`, sinon `/search/<titre sans parenthèse>/` |
| Personne avec métier cinéma | ID du métier dominant (réalisateur P12383 `/director/`, acteur P6119 `/actor/`, scénariste P14583 `/writer/`, producteur P14196 `/producer/`), sinon ID d'un autre métier de cinéma de la personne, sinon `/search/<nom>/` |
| Studio | P13273 `/studio/<id>/` (vérifié), sinon pas de lien |
| Série TV | Pas de lien en v1 (Letterboxd couvre très peu de séries) |
| Personne hors cinéma avec un ID Letterboxd | Pas de lien |

Condition d'affichage pour une personne : au moins un métier de cinéma dans P106 (pas forcément le principal). Phil Collins, acteur occasionnel, a donc un lien. Einstein et Macron n'en ont pas.

Précisions apportées par les données réelles :

- Un "film" est une carte Cinéma et TV dont une classe décisive atteint "film" (Q11424) ou "série de films" (Q24856). Une série TV a aussi un identifiant IMDb, qui ne mène à rien sur Letterboxd : sans cette distinction elle recevrait un lien cassé. Le cache par classe garde donc les racines atteintes, pas seulement la catégorie
- Le métier dominant se lit dans la description de la carte, comme le sous-type principal (Tarantino : "réalisateur, scénariste..." donne `/director/`). Seuls comptent les métiers dont le sous-type est Cinéma : "présentateur de journal" est une sous-classe d'"acteur" dans Wikidata, mais ne fait pas d'une journaliste une actrice
- Les identifiants Wikidata sont traités comme non fiables : format strict exigé, origine `https://letterboxd.com/` imposée par construction et revérifiée avant de poser le lien
- Wikidata connaît peu d'identifiants Letterboxd de personnes (absents pour Michael Mann ou Bryan Singer) : la recherche par nom est donc le cas courant pour les personnes. Sur 100 cartes réelles : 22 liens, dont 12 directs et 10 par recherche

Emplacements :

- Modale de détail : bouton à côté de "Voir l'article sur Wikipédia". C'est l'emplacement principal, stable et sans contrainte de place
- Carte grand format : icône facultative dans la colonne en haut à droite, sous le bouton favori
- Carte format grille : rien, trop petit

Fonction pure, sans effet de bord, donc entièrement testable.

### Cache

- Clé : titre frwiki. Valeur : les faits bruts `{ qid, classIds, parentClassIds, occupationIds, externalIds (Letterboxd, IMDb, TMDb), fetchedAt, status }`, environ 300 à 500 octets. La catégorie n'est pas stockée, elle est recalculée à la lecture
- TTL : 90 jours pour une carte résolue, 7 jours pour une carte non résolue. Une erreur réseau n'est jamais mise en cache
- Cache par classe : `{ target, label, rootsVersion }`, sans TTL, invalidé par le numéro de version des listes de racines
- Stockage : `chrome.storage.local` (quota de 10 Mo, 10 000 cartes = 3 à 5 Mo). `unlimitedStorage` seulement si le besoin apparaît

### Garde-fous liés aux règles du site

- Lecture seule du DOM rendu. Aucun clic, aucun scroll automatique, aucune saisie
- Aucune interception réseau : pas de patch de `fetch` ou `XMLHttpRequest`, pas de `webRequest`
- Aucun appel à l'API du site ni à Supabase, aucune lecture du token de session
- Seuls appels sortants : fr.wikipedia.org, www.wikidata.org, query.wikidata.org
- Permissions minimales : `storage`, `unlimitedStorage`, et les hôtes ci-dessus plus wiki-masters.com
- Conséquence assumée : l'index local ne connaît que les cartes déjà affichées à l'écran par l'utilisateur
- Recommandé avant toute publication : prévenir le développeur de WikiMasters et obtenir son accord

### Robustesse de l'intégration DOM

Le site n'expose aucun attribut `data-*` et chaque déploiement peut changer les classes Tailwind. Il existe toutefois quelques classes sémantiques maison, plus stables : `glow-<rareté>` sur la racine de carte et `card-frame` sur la modale.

- Détection par `div[class*="glow-"]` contenant un `h3`, avec secours structurel (présence conjointe des icônes swords et shield)
- Tous les sélecteurs dans un seul fichier, couverts par des tests sur des fixtures HTML réelles
- Injection dans un Shadow DOM pour isoler les styles, réappliquée par le MutationObserver quand React re-rend
- Navigation client Next.js : surveiller les changements d'URL, pas seulement le chargement initial
- Mode dégradé silencieux : si aucune carte n'est détectée, l'extension ne fait rien

## 5. Décisions à trancher, avec recommandation

| Décision | Recommandation | Pourquoi |
| --- | --- | --- |
| Manifest V3 ou userscript | Manifest V3 avec WXT, TypeScript strict, logique métier en modules purs sans dépendance à `chrome.*` | La partie difficile (DOM et pipeline Wikidata) est identique dans les deux cas. MV3 apporte un stockage isolé du site, un service worker pour le batch, des permissions déclarées et une distribution propre. Les modules purs gardent la porte ouverte à un build userscript |
| Périmètre de l'overlay | wiki-masters.com uniquement en v1 | L'overlay sur fr.wikipedia.org ("vous possédez cette carte") est une fonctionnalité distincte. Elle sera facile ensuite grâce à l'index local |
| Séries TV sur Letterboxd | Pas de lien en v1 | Couverture trop faible, risque de liens morts |
| UI du content script | TypeScript sans framework | Poids injecté minimal. React seulement si une page d'options ou de stats le justifie |

## 6. Plan par phases

### Phase 0 : reconnaissance des pages connectées (faite à 80 %)

- Fait : [DOM_NOTES.md](DOM_NOTES.md), 4 fixtures anonymisées dans `tests/fixtures/`, extraction prototype validée sur 41 cartes du marché sans faux positif, pipeline validé sur 43 cartes réelles
- Reste : exports de `/collection` chargée et de `/global-collection`. Non bloquant pour les phases 1 à 3 et 5, nécessaire avant la phase 4

### Phase 1 : socle du projet (faite le 2026-09-20, revue indépendante passée)

Versions retenues : WXT 0.21, Vitest 5 avec happy-dom, ESLint 10, Knip 6, TypeScript 6.0 (et non 7, car typescript-eslint 8 ne le supporte pas encore). Reste à faire par l'utilisateur : contrôle manuel dans Chrome avec `pnpm dev`, voir README.

- `git init`, branche de travail, pnpm, WXT, TypeScript strict, Vitest, ESLint, Knip, logger structuré
- Structure : `src/core` (config, constantes, logger, storage) et `src/features/{card-detection,categorization,letterboxd}` avec `domain`, `data`, `presentation`
- CI GitHub Actions : lint, test, build, knip
- Vérification : l'extension se charge sur le site et journalise le nombre de cartes détectées

### Phase 2 : détection des cartes (content script) (faite le 2026-09-20)

Écarts assumés par rapport à la ligne ci-dessous :

- Le timer du MutationObserver n'est pas réarmé par les mutations suivantes (un scan au plus toutes les 200 ms). Un debounce classique ne se déclencherait jamais sur une page qui mute en continu, comme les comptes à rebours du marché
- Pas de code dédié à la navigation client : l'observateur posé sur `body` voit déjà le changement de DOM
- Pas de secours par `img[alt]` pour le titre : la détection exige déjà un `h3`, le secours serait du code mort

- `selectors.ts`, extracteur `{ title, description, rarity }`, MutationObserver avec debounce, suivi de la navigation client
- Vérification : tests sur fixtures de la phase 0, contrôle manuel sur `/collection` et `/pulls`

### Phase 3 : pipeline Wikidata (service worker) (faite le 2026-09-20)

Écarts assumés par rapport aux lignes ci-dessous :

- Pas de table statique classe vers catégorie : la résolution en ligne par classe est assez rapide et n'a lieu qu'une fois par classe. Une classe qui est elle-même une racine est résolue localement, sans requête
- Forme de la requête des racines imposée par les mesures : `?class wdt:P279* ?root` avec `hint:Prior hint:gearing "forward"` puis `FILTER(?root IN (...))`, soit 2,7 s pour 49 classes. La forme `VALUES ?root` prenait 88 s (dont une requête à 64 s, au-delà de la limite de 60 s du service) et la forme sans indice 38 s
- Sans P31, les parents P279 votent comme des classes ("Hutte" devient Monument et bâtiment au lieu de Science et concept)
- Le cache par carte stocke les faits bruts et non la catégorie, voir la section Cache
- Les IDs externes (Letterboxd, IMDb, TMDb) sont déjà récupérés et mis en cache, car ils viennent de la même requête. Ils ne servent qu'à partir de la phase 5
- Le résultat n'est que journalisé par le content script. Une carte dont la catégorisation échoue est redemandée au plus tôt 60 s plus tard : certaines pages mutent en continu, une relance immédiate bombarderait Wikimedia pendant une panne
- Respect du `Retry-After` de Wikidata : s'il dépasse le plafond d'attente, l'extension ne réessaie pas et suspend tout appel vers cet hôte jusqu'à l'échéance (un 429 réel a été observé pendant la mise au point). L'échéance est stockée dans `chrome.storage.local`, car le service worker MV3 est arrêté bien avant et perdrait un état en mémoire

Essai réel du 2026-09-20 sur une page de `/collection` : 50 cartes catégorisées en un seul lot, aucune erreur réseau, environ 40 résultats justes. Les 10 ratés ont été diagnostiqués sur Wikidata et corrigés par les listes de racines et la règle 3 (voir Catégories v1). Le jeu de référence compte désormais 100 titres réels : les 50 du marché et les 50 de cette page.

- Résolveur de titres (lots de 50, redirections, normalisation), client SPARQL en POST (lots de 50), retry avec backoff sur 429 et 5xx
- Table statique classe vers catégorie (JSON versionné), fallback `P279*` par classe, cache à deux niveaux
- Vérification : tests unitaires avec fetch mocké sur réponses enregistrées (`tests/fixtures/wikidata/`), plus un jeu de référence de 100 titres réels avec catégories attendues, produit indépendamment du code

### Phase 4 : UI catégorisation

#### Phase 4a : badge, ligne dans la modale, mise en évidence par page (faite le 2026-09-20, revue indépendante passée)

- Badge sur chaque carte catégorisée : pastille de couleur et libellé court ("Personne · Cinéma", "Lieu"...), en bas à gauche de la zone image, `pointer-events: none`. Aucun badge pour une carte introuvable, en erreur ou pas encore catégorisée
- Modale de détail : une ligne "Catégorie : ..." après le lien Wikipédia (et après le lien Letterboxd quand il existe), avec les autres sous-types d'une personne ("aussi : ...")
- Panneau flottant en bas à gauche, replié par défaut ("Catégories (N)") : catégories présentes sur la page avec leur nombre de cartes (titres distincts), clic pour filtrer. Les cartes hors catégorie reçoivent un voile, qui est un noeud de l'extension posé dans la carte : aucun noeud du site n'est restylé
- Le filtre choisi survit à la pagination du site. Une page sans carte de la catégorie est entièrement voilée, et le panneau le dit toujours : libellé du filtre dans le bouton, ligne à 0, bouton "Tout afficher" visible même panneau replié. L'état du panneau n'est jamais stocké, il repart de zéro au rechargement

Écarts assumés et décisions :

- Pas de Shadow DOM (prévu dans "Robustesse de l'intégration DOM") : un badge doit vivre dans la racine de la carte pour la suivre et se positionner par rapport à elle. L'isolation passe par des sélecteurs tous préfixés par nos attributs `data-wme-*`, sans sélecteur d'élément ni règle globale. La feuille de style est déclarée dans le manifest (seul changement : une entrée `css`, permissions inchangées)
- Nos noeuds sont invisibles pour la détection des cartes : uniquement des `div` et `span` dans une carte (un `p` de notre part serait lu comme la description d'une carte qui n'en a pas), aucune classe contenant `glow-`. Testé : le scan donne la même carte avant et après nos ajouts
- Zéro écriture DOM quand l'état est déjà le bon, prouvé par des tests avec MutationObserver : l'observateur du content script voit nos propres écritures, une synchronisation qui écrirait toujours bouclerait sans fin. La couleur d'une pastille n'est écrite que si la catégorie change (le navigateur normalise les couleurs, les relire ne permet pas de comparer)
- Noeud de carte réutilisé par React : le badge, le voile et la ligne de modale sont recalculés depuis le titre courant à chaque scan
- Pas de `stopPropagation()` sur les clics de notre panneau (retiré après revue) : bloquer un écouteur que le site a posé sur le document serait une interception, alors que laisser remonter le clic ne donne au site que ce qu'il reçoit déjà pour tout clic sur la page
- Panneau absent tant qu'aucune carte n'est détectée, et aucun voile sans panneau : un filtre sans moyen visible de le quitter laisserait la page assombrie
- Nettoyage complet quand le contexte du content script est invalidé (rechargement, désactivation ou désinstallation de l'extension) : badges, voiles, panneau, ligne de modale et lien Letterboxd. WXT ne détecte la désactivation que si `ctx.isInvalid` est lu : il l'est à chaque scan
- Coût par scan linéaire : nos noeuds sont cherchés parmi les enfants directs de la carte, en partant du dernier, et la modale n'est recherchée qu'une fois par passe
- Couplage accepté : la ligne de catégorie de la modale connaît le sélecteur du lien Letterboxd pour se placer après lui (dépendance à sens unique, sans cycle)
- La mémoire des résultats (`rememberCategories`) a rejoint `categorization/presentation` et la recherche de la modale `card-detection/data` : elles servent désormais à plusieurs fonctionnalités

Reste à faire par l'utilisateur : contrôle visuel dans Chrome (lisibilité du badge sur les petites cartes de la grille, emplacement du panneau) et validation des choix de présentation.

#### Phase 4c : index local de la collection et fenêtre de statistiques (faite le 2026-09-20, revue indépendante passée)

- Index local : les cartes détectées sur la page `/collection` sont mémorisées par le service worker, `{ rareté, première vue, dernière vue }` par titre, dans une seule clé versionnée de `chrome.storage.local` (environ 80 octets par carte). Les autres pages (marché, échanges, tirages, collection globale) n'alimentent jamais l'index : ces cartes ne sont pas possédées
- L'extension ne navigue jamais à la place de l'utilisateur : l'index ne grandit qu'avec les pages de collection affichées. La fenêtre indique le nombre de cartes vues et la date de la dernière mise à jour (parade du risque R6)
- Fenêtre de statistiques (popup de l'extension, TypeScript sans framework) : cartes par catégorie avec part en pourcentage, sous-types des personnes, répartition par rareté, cartes non catégorisées, liste des cartes d'une catégorie avec lien vers l'article Wikipédia, remise à zéro de l'index avec confirmation
- Aucun appel réseau : le résumé est calculé uniquement depuis l'index et les deux caches existants. Le cas d'usage ne reçoit aucun port réseau, ouvrir la fenêtre ne peut donc pas interroger Wikimedia. Une carte dont les faits sont absents, expirés ou introuvables compte comme "non catégorisée" jusqu'à son prochain affichage sur le site
- La catégorie n'est pas stockée dans l'index : elle est recalculée à la lecture par les mêmes fonctions pures que les badges (étape commune extraite dans `classify-cached-card.ts`). Retoucher les listes de racines ne demande donc aucune reconstruction de l'index

Écarts assumés et décisions :

- Seul le chemin exact `/collection` alimente l'index (et non ses sous-chemins, comme prévu au départ) : aucune sous-route n'a été observée, et une carte enregistrée à tort ne pourrait plus être distinguée des autres. La règle ne sera élargie que sur preuve
- Le premier scan qui suit un changement de route n'enregistre rien : le scan est différé de 200 ms et l'URL peut déjà être `/collection` alors que le DOM lu est encore celui du marché. Les scans suivants enregistrent la page
- Un titre que le service worker refuserait (caractère `|`, plus de 300 caractères) n'est jamais envoyé, et un lot est découpé en messages de 500 cartes au plus : un lot refusé en bloc serait sinon renvoyé à l'identique toutes les 60 s, sans fin
- Approximation connue : l'index ne garde pas la description des cartes, le sous-type principal d'une personne y est donc décidé par vote majoritaire. Il peut différer du badge pour quelques personnes aux métiers multiples. Les personnes sans sous-type reconnu apparaissent sur une ligne "Autre"
- Manifest : seule l'entrée `action` (popup) est ajoutée, permissions inchangées. Le polyfill `modulepreload` de Vite est désactivé : il embarquait un `fetch` inutile dans la fenêtre, Chrome gérant `modulepreload` nativement
- Points de revue acceptés sans changement : l'index est réécrit en entier à chaque lot (le quota de 10 Mo correspond à environ 125 000 cartes) ; un titre déjà envoyé n'est pas renvoyé avant le rechargement de l'onglet, un changement de rareté n'est donc vu qu'à la session suivante

Question ouverte pour l'utilisateur : la page `/collection` propose un filtre "liste de souhaits". S'il affiche des cartes non possédées sous la même URL, elles entreraient dans l'index. À vérifier sur le site ; un export HTML de cette vue permettrait de la détecter.

Reste à faire par l'utilisateur : contrôle visuel de la fenêtre dans Chrome.

#### Suite de la phase 4

Plan initial, avec l'état de chaque point :

- Badge de catégorie sur chaque carte (toutes pages) et catégorie détaillée dans la modale : fait (4a)
- La collection étant paginée, trois réponses complémentaires au besoin de filtre, par ordre de coût :
  1. Mise en évidence par catégorie sur la page courante (atténuer les cartes hors catégorie). Simple, mais limité à la page affichée : fait (4a)
  2. Vue "Ma collection par catégorie" dans l'extension (popup ou page dédiée), alimentée par l'index local des cartes déjà vues. Tri, filtres et regroupements sans limite de page : fait (4c), sous forme de popup
  3. Synergie avec les étiquettes natives : l'extension indique la catégorie, l'utilisateur pose lui-même l'étiquette avec la sélection en lot du site. Le filtre natif marche alors sur toutes les pages, côté serveur. L'extension ne clique jamais à la place de l'utilisateur. Le badge donne déjà l'information ; rien de plus à coder tant que le DOM des étiquettes natives n'a pas été observé (export de `/collection` attendu)
- Popup de stats : nombre de cartes par catégorie et sous-type : fait (4c)
- Taux de complétion par catégorie : à faire, demande le catalogue de `/global-collection` (export attendu, voir Phase 0)
- Vérification : scénarios manuels de la section 7

### Phase 5 : lien Letterboxd (faite le 2026-09-20)

Écarts assumés : le lien n'est posé que dans la modale de détail (pas d'icône sur la carte grand format en v1). L'URL est calculée par le service worker et renvoyée avec la catégorie. L'extension ne contacte jamais Letterboxd, elle construit seulement un lien. Jeu de référence : 100 cartes réelles avec l'URL attendue, produit par un prototype indépendant.

- Résolveur de lien (fonction pure), bouton sur la carte, ouverture en nouvel onglet avec `rel="noopener noreferrer"`
- Vérification : tests unitaires couvrant chaque ligne du tableau de résolution, dont le cas Einstein

### Phase 6 : finitions et diffusion

- Page d'options (activer ou non chaque fonctionnalité, vider le cache), icônes, note de confidentialité (seuls des titres d'articles partent vers Wikimedia)
- `pnpm lint`, `pnpm build`, `pnpm knip`, zip de release
- Contact avec le développeur de WikiMasters avant publication sur le Chrome Web Store

## 7. Scénarios de test proposés (à valider ou compléter)

1. should show "Personne / Cinéma" and a `/director/quentin-tarantino/` link when the card is "Quentin Tarantino"
2. should show "Personne / Science" and no Letterboxd link when the card is "Albert Einstein"
3. should link to `/film/pulp-fiction/` when the card is "Pulp Fiction"
4. should fall back to `/imdb/<id>/` when a film has no P6127 but has P345
5. should classify "Saint-Malo" as "Lieu" and not "Organisation"
6. should classify "Hibou" as "Vivant" (classe Q55983715)
7. should resolve a renamed article through the frwiki redirect
8. should return "Autre" and retry after 7 days when the article does not exist
9. should make zero network call when all visible cards are in cache
10. should send one frwiki request and one SPARQL request when 50 unknown cards appear at once
11. should re-inject badges after a React re-render or a client-side navigation
12. should do nothing and log no error when the page contains no card
13. should classify "McDonald's" as "Organisation" by majority vote when one of its classes maps to "Lieu"
14. should pick "Musique" as primary subtype for "Phil Collins" using the card description, and still show a Letterboxd link
15. should extract title, rarity and an empty description from the `card-large-no-description.html` fixture
16. should read the article title from the Wikipedia link when the detail modal is open
17. should classify "Hutte" as "Science et concept" when the item has P279 but no P31

## 8. Risques

| # | Risque | Impact | Parade |
| --- | --- | --- | --- |
| R1 | Confirmé : collection paginée, un filtre DOM ne voit que la page courante | Filtres sur page peu utiles seuls | Vue par catégorie dans l'extension depuis l'index local, et étiquettes natives posées par l'utilisateur (phase 4) |
| R6 | Index local incomplet : il ne contient que les cartes déjà affichées | Stats et vue par catégorie partielles | Indicateur "n cartes indexées", remplissage naturel en parcourant la collection, aucun scroll ni pagination automatique |
| R2 | Changement du DOM à chaque déploiement du site | Détection cassée | Détection structurelle, sélecteurs centralisés, fixtures, mode dégradé silencieux |
| R3 | Interprétation stricte des règles par le site | Bannissement du compte | Lecture seule stricte, aucun avantage de jeu, accord du développeur avant publication |
| R4 | Indisponibilité ou limitation de query.wikidata.org | Cartes non catégorisées temporairement | Cache, backoff, file d'attente, P31 brut via `wbgetclaims` en dernier recours |
| R5 | Classes P31 exotiques mal rattachées | Catégorie "Autre" ou erronée | Table statique enrichie au fil de l'eau, ordre de priorité des racines, jeu de référence en test |
