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
| Comment se charge `/collection` ? | Pagination (Précédent, Suivant). Le site a déjà tri, filtre par rareté, filtre par étiquette et gestion d'étiquettes en lot. La liste de souhaits est un filtre de `/global-collection`, pas de `/collection` (confirmé par l'utilisateur) |
| Où apparaissent les cartes ? | `/pulls` (une à la fois), `/collection`, `/marketplace` (lots de 40, "Charger la suite"), modale de détail. Probablement aussi `/trades`, `/battle`, `/profile`, `/global-collection` |
| Le pipeline tient-il sur de vraies cartes ? | Oui. 43 sur 43 titres résolus, 42 sur 43 avec un P31, 1,8 s au total |
| Y a-t-il un ensemble fini de cartes ? | Oui, mais immense : `/global-collection` liste 2 773 461 cartes (tout frwiki ou presque) sur 55 470 pages de 50, avec le total par rareté en en-tête (L 1761, UR 12368, SR 66788, R 179657, PC 516762, C 1996125). Aucun marqueur de possession sur les cartes du catalogue |
| Y a-t-il d'autres langues que frwiki ? | Aucun indice. Le lien de la modale porte le sous-domaine de langue, ce qui permettra de le gérer si besoin |

Reste à capturer : `/collection` une fois chargée (DOM des étiquettes natives). `/global-collection` a été capturée le 2026-09-20.

## 3. Verdict de faisabilité

| Idée | Verdict | Commentaire |
| --- | --- | --- |
| 1. Catégorisation (badge sur carte, stats locales) | Faisable, validé sur cartes réelles | Coût réseau faible, cache très efficace |
| 1. Filtres et tri dans la collection | Faisable mais limité par la pagination | Un filtre DOM ne voit que la page courante. Trois réponses complémentaires, voir phase 4 |
| 1. Taux de complétion par catégorie | Infaisable tel quel | Le catalogue compte 2,77 millions de cartes sur 55 470 pages et l'extension ne navigue jamais seule : impossible de connaître le nombre de cartes par catégorie, et le taux serait de toute façon proche de zéro. Livré à la place : complétion par rareté (index local contre les totaux affichés en en-tête du catalogue, phase 4d). Variante possible plus tard : complétion par catégorie limitée aux légendaires (1761 cartes, 36 pages) si l'utilisateur les parcourt. La répartition de la collection par catégorie, sans dénominateur, est livrée (phase 4c) |
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
| Film | P6127 `/film/<id>/`, sinon P4947 `/tmdb/<id>/`, sinon `/search/<titre sans parenthèse>/` (P345 retiré le 2026-09-21, voir phase 5d) |
| Personne avec métier cinéma | ID du métier dominant (réalisateur P12383 `/director/`, acteur P6119 `/actor/`, scénariste P14583 `/writer/`, producteur P14196 `/producer/`), sinon ID d'un autre métier de cinéma de la personne, sinon `/search/<nom>/` |
| Studio | P13273 `/studio/<id>/` (vérifié), sinon pas de lien |
| Série TV | P6127 `/film/<id>/` si Letterboxd la référence, sinon pas de lien (corrigé le 2026-09-20, voir ci-dessous) |
| Personne hors cinéma avec un ID Letterboxd | Pas de lien |

Condition d'affichage pour une personne : au moins un métier de cinéma dans P106 (pas forcément le principal). Phil Collins, acteur occasionnel, a donc un lien. Einstein et Macron n'en ont pas.

Précisions apportées par les données réelles :

- Un "film" est une carte Cinéma et TV dont une classe décisive atteint "film" (Q11424) ou "série de films" (Q24856). Une série TV a aussi un identifiant IMDb, qui ne mène à rien sur Letterboxd : sans cette distinction elle recevrait un lien cassé. Le cache par classe garde donc les racines atteintes, pas seulement la catégorie
- Le métier dominant se lit dans la description de la carte, comme le sous-type principal (Tarantino : "réalisateur, scénariste..." donne `/director/`). Seuls comptent les métiers dont le sous-type est Cinéma : "présentateur de journal" est une sous-classe d'"acteur" dans Wikidata, mais ne fait pas d'une journaliste une actrice
- Les identifiants Wikidata sont traités comme non fiables : format strict exigé, origine `https://letterboxd.com/` imposée par construction et revérifiée avant de poser le lien
- Wikidata connaît peu d'identifiants Letterboxd de personnes (absents pour Michael Mann ou Bryan Singer) : la recherche par nom est donc le cas courant pour les personnes. Sur 100 cartes réelles : 22 liens, dont 12 directs et 10 par recherche
- Correction du 2026-09-20, signalée par l'utilisateur sur la carte "The Backrooms (film, 2022)" : un identifiant P6127 valide l'emporte désormais sur la règle "film". L'article redirige vers "Backrooms (web-série)", item Q125131315, dont le P31 est "web-série" (Q526877) : la carte atteint donc "Cinéma et TV" par une racine de série, `isFilm` est faux, et le lien était coupé alors que Wikidata porte `P6127 = the-backrooms-found-footage` et que la page existe. Letterboxd n'attribue un identifiant de film qu'à ce qu'il référence : c'est Letterboxd lui-même qui dit que la page existe, il n'y a aucune supposition. La propriété était déjà récupérée par la requête SPARQL pour tous les items, sa valeur était simplement ignorée
- Les replis restent derrière `isFilm`, inchangés : sur une série, un identifiant TMDb ou IMDb ne redirige vers aucune page Letterboxd et la recherche par titre trouve la mauvaise oeuvre. Un identifiant mal formé continue de se comporter comme un identifiant absent, donc une série au P6127 invalide ne reçoit toujours aucun lien

Emplacements :

- Modale de détail : bouton à côté de "Voir l'article sur Wikipédia". C'est l'emplacement principal, stable et sans contrainte de place
- Carte grand format : icône facultative dans la colonne en haut à droite, sous le bouton favori
- Carte format grille : rien, trop petit

Fonction pure, sans effet de bord, donc entièrement testable.

### Cache

- Clé : titre frwiki. Valeur : les faits bruts `{ qid, classIds, parentClassIds, occupationIds, externalIds (Letterboxd, IMDb, TMDb), fetchedAt, status }`, environ 300 à 500 octets. La catégorie n'est pas stockée, elle est recalculée à la lecture
- TTL : 90 jours pour une carte résolue, 7 jours pour une carte non résolue. Une erreur réseau n'est jamais mise en cache
- Cache par classe : `{ target, label, matchedRootIds, rootsVersion, fetchedAt }`, invalidé par le numéro de version des listes de racines et par une durée de vie de 90 jours (voir la revue du 2026-09-21 plus bas)
- Stockage : `chrome.storage.local` (quota de 10 Mo, 10 000 cartes = 3 à 5 Mo). `unlimitedStorage` seulement si le besoin apparaît

### Garde-fous liés aux règles du site

- Lecture seule du DOM rendu. Aucun clic, aucun scroll automatique, aucune saisie
- Aucune interception réseau : pas de patch de `fetch` ou `XMLHttpRequest`, pas de `webRequest`
- Aucun appel à l'API du site ni à Supabase, aucune lecture du token de session
- Seuls appels sortants : fr.wikipedia.org et query.wikidata.org, depuis le service worker uniquement, sans cookies (www.wikidata.org, envisagé au départ, n'a pas été nécessaire)
- Permissions minimales, état réel : `storage` et ces deux hôtes. wiki-masters.com n'apparaît que dans les motifs du content script, pas dans les permissions d'hôte ; `unlimitedStorage` n'a pas été nécessaire
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
| Périmètre de l'overlay | wiki-masters.com uniquement en v1 | L'overlay sur fr.wikipedia.org ("vous possédez cette carte") est une fonctionnalité distincte, et sans index local elle demanderait une autre source pour savoir ce que l'utilisateur possède |
| Séries TV sur Letterboxd | Pas de lien en v1 | Couverture trop faible, risque de liens morts |
| UI du content script | TypeScript sans framework | Poids injecté minimal. React seulement si une page d'options ou de stats le justifie |

Décisions prises par l'utilisateur le 2026-09-20, après la phase 7a :

| Décision | Choix | Pourquoi |
| --- | --- | --- |
| Index de collection | Tout retirer (phase 8a) | L'extension ne peut pas voir une carte quitter la collection (défausse, enchère, échange) sans interagir avec le site ou deviner. Une supposition supprimerait ou garderait les mauvaises cartes en silence. Des chiffres qui dérivent valent moins que pas de chiffres |
| Cartes des paquets dans l'index | Abandonné | Conséquence de la décision précédente. Le travail était spécifié, il n'a pas été lancé |
| Étiquettes suggérées dans la modale | Faire (phase 8b) | L'extension sait déjà de quoi parle la carte. Proposer des étiquettes reste de la lecture seule |
| Remplissage de l'étiquette au clic | Faire, mais réglage désactivé par défaut | Écrire dans le champ du site, c'est "interagir à votre place", ce que les règles du site interdisent, bannissement annoncé comme sanction. L'utilisateur assume ce risque sur son compte et prévient les auteurs du site. Désactivé par défaut pour que personne d'autre ne l'active sans le savoir, et isolé dans un seul fichier pour rester relisable |
| Rendre le remplissage indétectable | Refusé | Les événements émis par une extension portent `isTrusted: false`, lisible en une ligne par le site. Imiter une frappe humaine ou masquer les noeuds de l'extension n'entre pas dans ce projet |

## 6. Plan par phases

### Phase 0 : reconnaissance des pages connectées (faite à 80 %)

- Fait : [DOM_NOTES.md](DOM_NOTES.md), 4 fixtures anonymisées dans `tests/fixtures/`, extraction prototype validée sur 41 cartes du marché sans faux positif, pipeline validé sur 43 cartes réelles
- Reste : export de `/collection` chargée (DOM des étiquettes natives). `/global-collection` capturée le 2026-09-20, voir DOM_NOTES

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

#### Phase 3a : la relance d'une catégorisation ratée déclenche un scan (faite le 2026-09-21)

- Constat en situation réelle : pendant une panne du service de requêtes Wikidata (502 et timeouts de 30 s mesurés depuis la machine le 2026-09-21, entrecoupés de réponses normales), une carte ouverte sur `/pulls` restait en `status: "error"` sans jamais être redemandée. Ni catégorie, ni image, ni étiquettes proposées
- Cause : `handleScan` libère bien les titres ratés au bout de 60 s, mais rien ne redemande un titre que personne ne scanne. Une page qui a cessé de muter ne lève aucun scan, et une modale ouverte sur une carte immobile est exactement ce cas. La libération était donc une relance en théorie seulement
- Correctif : l'overlay enveloppe le `scheduleRetry` qu'il reçoit et relit la page juste après la libération. Les cartes sont relues plutôt que reprises du scan qui a échoué, parce qu'une minute a passé et que la page peut montrer tout autre chose
- Rien n'est relancé quand rien n'a échoué : `handleScan` n'arme un retry que s'il a des titres à libérer, donc le scan supplémentaire n'a lieu que pour un lot réellement raté
- Piège trouvé dans le harnais de test de l'overlay : il exécutait les retries immédiatement. Une fois le scan branché dessus, toute fixture portant une carte sans résultat (deux des trois cartes de `placeholder-cards.html`) partait en boucle infinie. Les retries sont désormais conservés et déclenchés par le test qui les vérifie, ce qui est aussi plus proche du timer réel

### Phase 4 : UI catégorisation

#### Phase 4a : badge, ligne dans la modale, mise en évidence par page (faite le 2026-09-20, revue indépendante passée, mise en évidence RETIRÉE le 2026-09-20, voir phase 10b)

- Badge sur chaque carte catégorisée : pastille de couleur et libellé court ("Personne · Cinéma", "Lieu"...), en bas à gauche, `pointer-events: none`. Aucun badge pour une carte introuvable, en erreur ou pas encore catégorisée. Rétréci et descendu le 2026-09-20 à la demande de l'utilisateur : il chevauche désormais la ligne entre la photo et le texte au lieu de se tenir au-dessus, et sa pastille de couleur suit la taille du texte au lieu d'être fixe. Pas entièrement sous la ligne : la carte ne garde que 12 px de marge avant son titre en format grille, moins que la hauteur du badge
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

Reste à faire par l'utilisateur : contrôle visuel dans Chrome (lisibilité du badge sur les petites cartes de la grille) et validation des choix de présentation. La part qui portait sur l'emplacement du panneau est sans objet depuis la phase 10b.

#### Phase 4c : index local de la collection et fenêtre de statistiques (faite le 2026-09-20, RETIRÉE le 2026-09-20, voir phase 8a)

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

Question close le 2026-09-20 : la liste de souhaits n'existe pas sur `/collection`. C'est un filtre de `/global-collection`, page qui n'alimente jamais l'index. Tout ce qui s'affiche sur `/collection` est donc possédé.

Reste à faire par l'utilisateur : contrôle visuel de la fenêtre dans Chrome.

#### Phase 4d : complétion par rareté (faite le 2026-09-20, RETIRÉE le 2026-09-20, voir phase 8a)

- Décision de l'utilisateur après l'analyse du catalogue : pas de taux de complétion par catégorie (2,77 millions de cartes, 55 470 pages, aucun marqueur de possession), mais une complétion par rareté
- Quand l'utilisateur ouvre lui-même `/global-collection`, le content script lit les six totaux par rareté affichés dans le bloc d'en-tête `div.card-frame`. Le service worker les garde dans une clé versionnée de `chrome.storage.local` avec la date du relevé. Rien n'est téléchargé, l'extension ne navigue jamais seule, aucun noeud n'est ajouté au site
- Lecture stricte, par le texte et non par les classes Tailwind : les six raretés exactement une fois chacune, et leur somme égale au total général affiché dans le même bloc. Sinon rien n'est relevé : un dénominateur faux serait pire qu'absent. Cas réel confirmé par l'utilisateur : pendant une recherche, le site remplace le bloc par une notice ("Recherche active : pas de décompte par rareté ni de total exact"), le lecteur ne relève alors rien et les totaux déjà connus sont conservés
- La fenêtre de statistiques affiche, par rareté, les cartes de l'index contre le total du catalogue ("L 3 / 1 761") avec la part en pourcentage et la date du relevé. Sans relevé : l'affichage d'avant, plus une invitation à ouvrir la page "Toutes les cartes"
- Le relevé suit le réglage "index de collection". Il survit au vidage du cache de catégorisation et à la remise à zéro de l'index : ce sont des faits du catalogue, pas des données personnelles
- Limite assumée : le numérateur est le nombre de cartes VUES sur `/collection`, il sous-estime la collection tant que toutes ses pages n'ont pas été affichées
- Le premier scan qui suit un changement de route ne relève rien, comme pour l'index : l'URL peut déjà nommer le catalogue alors que le DOM lu est encore celui de la page quittée, et le lecteur accepterait n'importe quel bloc de même forme
- Une part non nulle qui s'arrondirait à zéro s'affiche "< 0,01 %" : 88 communes sur 1 996 125 ne doivent pas se lire "0 %", qui reste réservé à "aucune carte"

#### Suite de la phase 4

Plan initial, avec l'état de chaque point :

- Badge de catégorie sur chaque carte (toutes pages) et catégorie détaillée dans la modale : fait (4a)
- La collection étant paginée, trois réponses complémentaires au besoin de filtre, par ordre de coût :
  1. Mise en évidence par catégorie sur la page courante (atténuer les cartes hors catégorie). Simple, mais limité à la page affichée : fait (4a), RETIRÉE le 2026-09-20 (phase 10b)
  2. Vue "Ma collection par catégorie" dans l'extension (popup ou page dédiée), alimentée par l'index local des cartes déjà vues. Tri, filtres et regroupements sans limite de page : fait (4c), sous forme de popup
  3. Synergie avec les étiquettes natives : l'extension indique la catégorie, l'utilisateur pose lui-même l'étiquette avec la sélection en lot du site. Le filtre natif marche alors sur toutes les pages, côté serveur. L'extension ne clique jamais à la place de l'utilisateur. Le badge donne déjà l'information ; rien de plus à coder tant que le DOM des étiquettes natives n'a pas été observé (export de `/collection` attendu)
- Popup de stats : nombre de cartes par catégorie et sous-type : fait (4c)
- Taux de complétion par catégorie : infaisable contre le catalogue entier (2,77 millions de cartes, voir le verdict de faisabilité). Remplacé par la complétion par rareté : fait (4d). Variante non retenue pour l'instant : complétion par catégorie limitée aux légendaires
- Vérification : scénarios manuels de la section 7

### Phase 5 : lien Letterboxd (faite le 2026-09-20)

Écarts assumés : le lien n'est posé que dans la modale de détail (voir la phase 5b pour le bouton de la carte elle-même). L'URL est calculée par le service worker et renvoyée avec la catégorie. L'extension ne contacte jamais Letterboxd, elle construit seulement un lien. Jeu de référence : 100 cartes réelles avec l'URL attendue, produit par un prototype indépendant.

- Résolveur de lien (fonction pure), bouton sur la carte, ouverture en nouvel onglet avec `rel="noopener noreferrer"`
- Vérification : tests unitaires couvrant chaque ligne du tableau de résolution, dont le cas Einstein

#### Phase 5b : bouton Letterboxd sur la carte elle-même (faite le 2026-09-20, revue indépendante passée)

- Demande de l'utilisateur : un petit logo Letterboxd cliquable sur la carte, pas sur la photo, en dessous. Jusque-là le lien n'existait que dans la modale, ce qui coûtait un clic pour le découvrir
- Emplacement : le milieu vide de la ligne de statistiques, seul espace libre sous la photo. Le titre peut passer sur deux lignes et atteindre le bord droit, la description est tronquée à trois lignes, mais la ligne ATK/DEF est en `justify-between` sur les deux formats de carte, son centre est donc toujours libre. Dégagement mesuré : environ 6,8 px de chaque côté sur la carte la plus étroite (320 px de fenêtre), environ 19 px dès 375 px
- Positionnement absolu contre la zone texte, jamais en flux : un enfant absolument positionné n'est pas un élément flex, il ne consomme aucun espace, ne décale aucun frère et ne change pas le calcul du `mt-auto` de la ligne de statistiques. Rien du site ne bouge
- Repli vérifié plutôt que supposé : si la zone texte perdait `position: absolute`, le bouton se placerait contre la racine de carte, qui est `relative`. Comme la zone texte porte `bottom-0 left-0 right-0`, les deux boîtes partagent bord bas et largeur, donc `bottom: 4px; left: 50%` désigne le même pixel dans les deux cas. Le repli est invisible, pas seulement acceptable
- Une balise `a` et non un `div` avec un gestionnaire : elle donne gratuitement l'activation au clavier, le clic milieu, le menu contextuel et l'aperçu de l'adresse dans la barre d'état. Elle est aussi invisible pour le scanner, qui lit le premier `h3` et le premier `p` d'une racine `div[class*="glow-"]`
- Le logo est dessiné en CSS, trois pastilles de couleur dans une pilule sombre. Aucun fichier, aucune image encodée, aucune requête : Letterboxd n'apprend rien tant que l'utilisateur n'a pas cliqué lui-même
- Le clic est la seule exception assumée à la règle "le site est maître de ses propres événements" : le gestionnaire appelle `stopPropagation()`, sans quoi un clic sur le bouton ouvrirait Letterboxd ET la modale derrière. `preventDefault()` est volontairement absent, l'ancre garde son comportement natif, et la garde `event.isTrusted` laisse repartir un clic synthétique du site comme n'importe quel autre. Vérifié par mutation en revue : sans `stopPropagation()`, l'écouteur de la racine de carte est bien appelé
- C'est aussi le seul noeud de l'extension posé sur une carte qui accepte un clic : tout le reste de ce que l'extension dessine est en `pointer-events: none`
- Zéro écriture quand la carte porte déjà le bon bouton, la clé de comparaison étant l'adresse. Le `WeakSet` est consulté AVANT toute recherche DOM, à l'inverse de celui des images : la plupart des cartes n'ont pas d'adresse Letterboxd et doivent sortir à la première ligne, alors que trouver la zone texte coûte une recherche sur tout le sous-arbre
- Réglage partagé avec le lien de la modale, aucune clé nouvelle : c'est la même fonctionnalité à un second endroit. La description du réglage nomme désormais les deux
- Conséquence assumée : la modale de détail affiche elle-même une copie complète de la carte, le petit logo y apparaît donc aussi, sous la vignette, à côté du lien texte. Les deux noeuds portent des attributs différents et aucun sélecteur ne peut atteindre l'autre
- Aucune requête de plus, aucun message de plus, manifest identique

#### Phase 5c : marque Letterboxd redessinée et calée en bas à droite (faite le 2026-09-20)

- Demande de l'utilisateur, image de référence à l'appui : "fait le comme ça le letterboxd, bien aligné". Puis, après un premier essai : "j'ai l'impression que le orange est plus haut"
- Le défaut était géométrique. Les trois pastilles étaient trois `span` empilés en absolu, chacun à 60 % de la largeur d'un cercle de 16 px : à cette taille ils se recouvraient presque entièrement et seul le dernier peint, le bleu, restait visible. La marque se lisait comme un point bleu
- Les deux zones blanches du vrai logo sont les INTERSECTIONS des disques, et une intersection ne s'exprime pas avec des boîtes empilées. La marque est donc dessinée en SVG : trois disques de rayon 20 espacés de 30 dans un viewBox `0 0 100 40`, soit un recouvrement d'un quart de diamètre, puis les deux lentilles peintes par-dessus, chacune tracée par les deux arcs qui la ferment. Les drapeaux `large-arc=0 sweep=1` ont été vérifiés centre par centre, pas supposés
- Pas d'`id` ni de `clipPath` : un `id` est global au document et toutes les cartes porteraient le même. Les lentilles sont des `path`, donc chaque marque est autonome
- Construite par `createElementNS`, jamais par `innerHTML`, comme tout ce que l'extension ajoute
- Position : coin bas droite, dans la bande que la zone texte (`p-3`) laisse sous la ligne de statistiques. Ce n'est ni le centre de cette ligne ni son extrémité droite, qui porte la valeur de défense dès que les statistiques sont affichées. La bande du dessous est le seul endroit libre à droite quel que soit l'état des statistiques, question tranchée avec l'utilisateur plutôt que devinée
- La carte est en `rounded-2xl overflow-hidden` : l'arc du coin mange cette bande, environ 6,7 px de retrait à 3 px du bord bas. La marque est calée en dehors de l'arc, calculs dans le commentaire du CSS
- Tailles en pixels entiers, et plus un `clamp` sur le viewport : la bande est un padding `p-3`, donc 12 px quels que soient l'écran et le format de carte. Le clamp n'apportait rien et garantissait des positions fractionnaires, donc un antialiasing différent d'un disque à l'autre. C'est ce que l'utilisateur voyait comme un décalage vertical, alors que les trois disques partagent le même `cy` et qu'un décalage vertical est impossible : les trois ne diffèrent que par leur x, donc chaque ligne de pixels reçoit la même couverture

#### Phase 5d : retrait du repli IMDb (faite le 2026-09-21)

- Signalé par l'utilisateur depuis `/pulls` : la carte "La Main dans le sac (film, 1916)" renvoyait sur `letterboxd.com/imdb/tt0427485/`, où Letterboxd répond "No-one has added tt0427485 yet"
- Mesure sur Wikidata le 2026-09-21, échantillon d'un seizième du corpus par hachage (4 802 films de frwiki portant un identifiant IMDb) : 95,1 % portent aussi P6127 et 96,0 % portent P4947. Le repli IMDb ne se déclenchait donc que pour 186 films sur 4 802, soit 3,9 %
- Et ces 3,9 % sont exactement les films que Letterboxd n'a pas : son catalogue vient de TMDB, donc un film sans P4947 n'y figure presque jamais. Q60833146, le film signalé, ne porte ni P6127 ni P4947, et la page de Letterboxd invite d'ailleurs à l'ajouter sur TMDB. Ce maillon ne pouvait quasiment marcher que là où il ne servait pas
- Choix de l'utilisateur entre trois options mesurées : le repli devient la recherche par titre, qui dit la même chose qu'une page vide quand le film est absent et le trouve quand Wikidata n'a simplement jamais posé l'identifiant. C'est déjà le dernier recours d'un film sans aucun identifiant, donc aucune règle nouvelle
- P345 n'avait plus aucun lecteur : retiré de `ExternalIds`, de la requête SPARQL (une valeur optionnelle de moins par élément) et des faits mis en cache. Cache des faits de carte en version 7, cette fois pour un vrai changement de forme

### Phase 6 : finitions et diffusion

#### Phase 6a : réglages, page d'options, entretien du cache (faite le 2026-09-20, revue indépendante passée)

- Quatre réglages, tous actifs par défaut : badges de catégorie (carte et modale), mise en évidence par page, lien Letterboxd, index de collection. Une seule clé versionnée dans `chrome.storage.local` ; une valeur absente, partielle ou corrompue retombe sur les valeurs par défaut
- Le content script suit les réglages en direct, sans rechargement de l'onglet : une fonctionnalité coupée retire aussitôt ses noeuds et ne synchronise plus rien ; une fonctionnalité rallumée relance d'elle-même la catégorisation et repose ses noeuds, sans attendre une mutation du site. Tout coupé : plus aucune demande de catégorisation, donc plus aucun trafic vers Wikimedia
- Page d'options intégrée (TypeScript sans framework) : cases à cocher enregistrées immédiatement, relecture du stockage si un enregistrement échoue, nombre de cartes et de classes en cache et de cartes dans l'index, "Vider le cache de catégorisation" et "Réinitialiser l'index de collection" avec confirmation, rappel de confidentialité. La fenêtre de statistiques gagne un accès "Options"
- Vider le cache retire les faits par carte et les rattachements par classe, et rien d'autre : réglages, index de collection et délai d'attente imposé par Wikidata sont conservés
- Manifest : seule l'entrée `options_ui` est ajoutée, permissions inchangées, aucun appel réseau dans cette phase
- Cette section décrit ce qui a été livré ce jour-là. La liste des réglages a changé depuis : "index de collection" est parti avec la phase 8a, "images manquantes" est arrivé avec la phase 7a. "masquer les statistiques" est arrivé avec la phase 10a, "étiquettes suggérées" et "remplir l'étiquette au clic" avec la phase 8b, et "mise en évidence par catégorie" est parti avec la phase 10b. Ils sont six, dont quatre actifs par défaut

Écarts assumés et décisions :

- Le pipeline par scan (catégorisation, enregistrement de la collection, synchronisations) a quitté `content.ts` pour une fabrique testée, `settings/presentation/overlay.ts` : ce sont les réglages qui allument ou éteignent chaque partie, et la garantie "tout coupé : aucune requête" ne serait pas testable dans le point d'entrée
- L'enregistreur de collection voit tous les scans même quand son réglage est coupé : sa mémoire de la route doit continuer d'avancer, sinon le garde-fou du premier scan après un changement de route pourrait être contourné au moment de la réactivation
- Compter et vider passent par un port étroit `CategorizationCacheMaintenance`, distinct des ports de lecture et d'écriture : le cas d'usage de catégorisation ne peut toujours pas vider un cache. Une seule énumération des clés par opération, pour les deux niveaux de cache à la fois. `chrome.storage.local.getKeys()` (Chrome 130 et plus) éviterait de charger les valeurs, mais le faux navigateur des tests ne l'implémente pas : la branche n'aurait jamais été exercée, elle n'a donc pas été écrite
- Les deux nouveaux messages n'ont pas de charge utile, donc pas de branche "requête invalide" : elle serait du code mort
- Le thème sombre est partagé entre la fenêtre et la page d'options (`src/core/ui/extension-page.css`) et n'entre jamais dans la feuille de style injectée dans le site
- Deux lectures des réglages : celle du content script retombe sur les valeurs par défaut en cas d'échec (l'overlay doit démarrer), celle de la page d'options propage l'échec. Afficher des valeurs par défaut dans les options ferait écraser les choix enregistrés au premier clic : la page affiche alors une erreur et aucune case
- La zone d'état "Enregistré" (`role="status"`) est créée une seule fois hors de la partie redessinée : une zone créée avec son texte n'est pas annoncée par les lecteurs d'écran

#### Reste de la phase 6

- Icônes de l'extension (aucune pour l'instant, Chrome affiche l'icône par défaut)
- Licence du dépôt : décision de l'utilisateur
- `pnpm zip` pour l'archive de publication, fiche du Chrome Web Store, politique de confidentialité publiée
- Contact avec le développeur de WikiMasters avant toute publication (voir "Garde-fous")
- Contrôles manuels dans Chrome des phases 4a, 4c et 6a

### Phase 7 : images manquantes

#### Phase 7a : image de Wikimedia Commons sur les cartes sans illustration (faite le 2026-09-20, revue indépendante passée)

- Demande de l'utilisateur : beaucoup de cartes n'ont pas d'illustration, le site y affiche son logo. Relevé sur les exports réels : 7 cartes sur 41 au marché, 12 sur 50 parmi les légendaires du catalogue
- Source : Wikidata. `pageimages` de frwiki ne renvoie rien pour ces cartes (0 sur 19, même avec `pilicense=any`) : si l'article avait une image exploitable, le site l'aurait déjà. Les propriétés image de Wikidata en trouvent environ une sur quatre (5 sur 19) : surtout des personnes, des logos, des drapeaux. Presque jamais les films et les séries, dont les affiches ne sont pas libres
- Aucune requête de plus : la requête SPARQL des faits, déjà envoyée pour chaque carte, gagne six propriétés facultatives, dans l'ordre de priorité P18 (image), P154 (logo), P3383 (affiche), P41 (drapeau), P94 (blason), P2716 (collage). Seul le nom de fichier voyage, validé (caractères interdits par MediaWiki, plages de substitution, extension dans une liste fermée) ; l'URI renvoyée par Wikidata n'est jamais réutilisée telle quelle, chaque adresse est reconstruite
- Affichage : un noeud de l'extension ajouté dans la zone image de la carte, par-dessus le logo, `pointer-events: none`, invisible tant que l'image n'est pas chargée (si le chargement échoue, le logo du site reste visible). Photos recadrées vers le haut, logos et drapeaux entiers. La carte de la modale est une carte ordinaire : elle reçoit la même image sans code particulier
- L'image est chargée par le navigateur depuis `commons.wikimedia.org` (`Special:FilePath?width=500`, redirigé vers le serveur de vignettes), sans referrer et sans `crossorigin` (les redirections n'ont pas d'en-tête CORS). Le site n'envoie ni CSP ni COEP. Le service worker ne contacte toujours que fr.wikipedia.org et query.wikidata.org ; permissions et manifest inchangés (empreinte identique)
- Crédit : les images de Commons demandent une attribution. La modale de détail gagne une ligne "Image : Wikimedia Commons (auteur et licence)" qui ouvre la page du fichier
- Cinquième réglage "Images manquantes", actif par défaut
- Coût unique : le schéma du cache par carte passe en version 2, donc les faits de chaque carte sont redemandés une fois

Écarts assumés et décisions :

- Option écartée : demander l'URL de la vignette à l'API de frwiki (`prop=imageinfo`). Elle donne une URL directe du serveur de vignettes, mais demande un message, un niveau de cache et une source de plus. `Special:FilePath` ne coûte aucun code réseau ; à reconsidérer si les deux redirections se révèlent lentes
- L'extension ajoute pour la première fois une balise `img` dans une racine de carte. La règle "uniquement `div` et `span`" protège la lecture du titre (`h3`) et de la description (`p`) ; une `img` ne les touche pas, et la détection du logo ignore ce qui se trouve dans un noeud de l'extension
- La ligne de crédit s'affiche dès qu'une image est connue, même si son chargement échoue ensuite : conditionner l'affichage au chargement coûterait une passe de synchronisation de plus par modale
- `SAMPLE` choisit une valeur parmi plusieurs sans ordre défini : un article portant plusieurs P18 peut changer d'image après expiration du cache
- Coût des six propriétés dans la requête SPARQL, mesuré le 2026-09-20 sur 50 cartes réelles du catalogue, en alternant les deux formes sur les mêmes QID, six tirages par taille, délai d'attente à 90 s :

| Taille du lot | Sans images | Avec images |
| --- | --- | --- |
| 10 | médiane 17,9 s, 0 échec | médiane 19,4 s, 1 échec (minimum 0,9 s) |
| 25 | médiane 2,6 s, 3 échecs | médiane 3,4 s, 2 échecs (maximum 4,0 s contre 40,1 s) |
| 50 | médiane 24,8 s, 2 échecs | médiane 10,7 s, 1 échec |

Aucune pénalité attribuable aux six propriétés n'en ressort : l'écart entre les deux formes est plus petit que l'écart d'un tirage à l'autre de la même forme, et à 50 cartes la forme avec images a même la meilleure médiane. Le service était dégradé ce jour-là (une requête triviale entre 1,4 s et 45 s, des 502 en série), ce qui explique des médianes très au-dessus des 1,1 s relevés en phase 3. La mesure vaut donc comme comparaison, pas comme référence absolue : à refaire sur un service sain
- Piste écartée en revue : envelopper chaque propriété image dans `{ SELECT ... LIMIT 1 }` pour borner le produit cartésien. Une sous-requête SPARQL n'est pas corrélée, ce `LIMIT 1` renverrait une seule ligne pour tout le lot, donc une seule carte sur cinquante aurait son image

#### Phase 7b : marque "Commons" sur les images ajoutées (faite le 2026-09-20, revue indépendante passée)

- Demande de l'utilisateur : quand une image vient de l'extension et non du site, l'utilisateur doit pouvoir le voir sur la carte elle-même, sans ouvrir la modale
- Une `span` de l'extension dans le coin bas droit de notre conteneur d'image, `pointer-events: none`, affichée seulement une fois l'image chargée (attribut `data-wme-image-loaded` posé par notre propre écouteur `load`). Une carte illustrée par le site ne porte donc jamais cette marque
- Une pastille d'environ 14 px portant la lettre "C", et non le mot "Commons". Le mot était assez large pour partager sa ligne avec le badge de catégorie, aligné à gauche et dessiné par-dessus la nôtre : un libellé long recouvrait le début de la marque sur une carte de grille étroite. Deux issues ont été écartées, remonter la marque d'une ligne (l'utilisateur la veut dans le coin) et rétrécir le badge (cela aurait coûté des points de suspension à toutes les cartes pour régler le cas des seules cartes illustrées par l'extension). Une pastille de 14 px laisse au badge toute la largeur qu'il avait
- Pastille pleine, jamais une lettre dans un anneau fin : un C cerclé est le glyphe du copyright, et ces fichiers sont sous licence libre. La forme dirait le contraire de la vérité
- La source complète, avec auteur et licence, reste écrite en toutes lettres dans la ligne de crédit de la modale de détail, seul endroit qui en a la place
- Même police et même graisse que le badge de catégorie, pour que les deux marques de l'extension se lisent comme un seul ensemble
- Aucune requête de plus, aucun message de plus, manifest identique

#### Phase 7c : état de chargement et adresse de vignette mise en cache (faite le 2026-09-20)

- Demande de l'utilisateur : un indicateur de chargement pendant qu'une image arrive, et plus d'attente les fois suivantes
- Mesure qui motive la phase, relevée le 2026-09-20 sur une carte réelle : l'adresse construite par l'extension (`Special:FilePath?width=500`) répond 302 avec `cache-control: private, max-age=0, must-revalidate` et `expires` en 1970. Le navigateur n'a donc pas le droit de la mettre en cache et refait les deux redirections à chaque affichage : 0,22 s à 0,32 s pour la chaîne, contre 0,044 s pour la vignette finale, elle, mise en cache normalement. Ce n'est pas l'image qui coûte, c'est la résolution de son adresse
- Résolution une seule fois par fichier, dans le service worker, par l'API de frwiki (`prop=imageinfo`, `iiprop=url`, `iiurlwidth`), par lots de la même taille que les titres et par la même tuyauterie (`fetchJson` : délai d'attente, reprises, pauses imposées, aucun identifiant). Aucun hôte nouveau, aucune permission nouvelle, manifest identique
- Trois pièges de cette API, vérifiés en direct le 2026-09-20, dont chacun casse une implémentation naïve : un fichier hébergé sur Commons revient avec `"missing": true` ET un bloc `imageinfo` complet (il manque à frwiki tout en existant sur Commons), donc la décision se prend uniquement sur la présence d'une vignette exploitable ; les pages reviennent dans un ordre quelconque, jamais celui demandé, donc l'appariement se fait par titre et jamais par indice ; `File:` est normalisé en `Fichier:` et l'API le signale dans `query.normalized`
- L'adresse reçue est conservée telle quelle, paramètres de suivi compris, jamais reconstruite. Elle finit dans un `src`, elle est donc traitée comme n'importe quelle donnée non fiable : liste fermée des hôtes de vignettes Wikimedia, comparée sur l'hôte entier et jamais par suffixe (`upload.wikimedia.org.evil.example` se termine par un nom de la liste et appartient à quelqu'un d'autre), protocole `https` obligatoire, aucune information d'authentification dans l'adresse. Le contrôle est rejoué à chaque frontière traversée : la source, le cache, le message, le DOM
- Troisième niveau de cache, `wme:image:`, schéma 1, 90 jours pour une adresse résolue et 7 jours pour une absence. L'absence est mémorisée comme telle : sans cela chaque affichage redemanderait les fichiers sans vignette. Ce niveau est compté et vidé avec les deux autres par la page d'options, sans toucher aux réglages ni aux pauses en cours
- Un échec de cette étape ne coûte jamais sa catégorie à une carte : lecture de cache, requête et écriture de cache sont chacune rattrapées, journalisées en `warn`, et la carte retombe sur l'adresse que le content script construit lui-même. C'est le chemin qui existait avant cette phase, simplement plus lent
- État de chargement : tant que notre conteneur ne porte ni `data-wme-image-loaded` ni `data-wme-image-failed`, un voile sombre léger balayé par un reflet occupe la zone image, en pseudo-élément (aucun noeud de plus), `pointer-events: none`, remplacé par une teinte fixe sous `prefers-reduced-motion: reduce`. Le logo du site reste visible dessous
- `data-wme-image-failed` est posé par un écouteur `error` sur notre propre `img`, le pendant de l'écouteur `load` volontairement absent en phase 7a. Il retire tout ce que l'extension avait posé : il ne reste que le logo du site, exactement comme sur une carte pour laquelle l'extension ne connaît rien. Un échec ne doit jamais ressembler à une carte cassée
- Les deux marques sont écrites une fois, par nos propres événements, sur notre propre noeud. `showsImage` ne les compare pas, et ne compare pas non plus l'adresse : un conteneur reconstruit parce qu'il vient d'être marqué se remarquerait aussitôt et la synchronisation ne s'arrêterait jamais

Écarts assumés et décisions :

- `CardImage` a été scindé en `CommonsFile` (ce que Wikidata sait, persisté avec les faits de la carte) et `CardImage` (le même fichier plus l'adresse résolue, transporté vers le DOM). Ajouter l'adresse au type persisté aurait invalidé toutes les entrées existantes par un nouveau changement de schéma, et rangé la même valeur dans deux caches aux durées de vie différentes. Le schéma 2 des faits par carte reste intact
- `parseTitleMappings` a quitté `title-resolver.ts` pour `core/mediawiki/` : les deux résolveurs en avaient besoin à l'identique, le partage ne tord ni l'un ni l'autre
- `origin=*` ajouté à la requête, par parité avec la résolution des titres (mode CORS anonyme). Non prévu par la spécification
- Les quatre tests du cas d'usage ont été rebâtis sur la carte factice et non sur les cartes de référence : la fixture `entity-facts.json` est antérieure aux propriétés d'image de la phase 7a, aucune carte de référence ne porte d'image, donc aucune requête ne partait dans ces tests. Les fixtures étant hors périmètre, elles n'ont pas été régénérées
- Comportement connu : l'`img` porte `loading="lazy"`, une carte hors écran reste donc dans l'état "chargement" tant que le navigateur n'a pas déclenché la requête. Sans conséquence visible (l'utilisateur ne découvre la carte qu'en arrivant dessus), mais c'est bien l'état lu dans le DOM

#### Phase 7d : seconde source d'image, le fichier que l'article porte lui-même (faite le 2026-09-20, revue indépendante passée)

- Demande de l'utilisateur : "la fonctionnalité pour récupérer les images a bien marché sur Parti québécois mais pas sur les autres". Mesure sur 13 cartes réelles de sa collection : Wikidata ne connaît une image que pour 2 cartes sur 12. La phase 7a ne pouvait donc rien faire pour la grande majorité des cartes sans illustration
- Règle retenue, volontairement étroite : le fichier que l'article utilise et qui porte exactement le nom de l'article, sa parenthèse finale retirée. Mesure de ce qui arrive si on élargit : prendre n'importe quel fichier de l'article met un téléphone Nokia sur "Affaire Romand", un Kandinsky sur "501c", une icône Netflix sur "Agent Kim Reactivated" et le portrait d'un avocat sur "Affaire Daval". Une image sans rapport est pire que pas d'image
- Sur le même échantillon, la règle du nom exact donne 3 correspondances dont 2 fausses, et les 2 fausses sont des pages d'homonymie (`pageprops.disambiguation`). En les excluant : 1 correspondance sur 1, correcte. D'où la garde d'homonymie, qui n'est pas une précaution théorique mais le correctif de 2 erreurs mesurées sur 3
- Deuxième garde, découverte en mesurant : frwiki sert ses propres fichiers non libres depuis `upload.wikimedia.org`, exactement l'hôte de la liste blanche de la phase 7c. La liste des hôtes ne suffit donc pas à établir la licence. Une seconde requête (`prop=imageinfo`) confirme `imagerepository === "shared"`, c'est-à-dire un hébergement sur Wikimedia Commons. Comparaison stricte, jamais "différent de local" : une valeur inconnue doit échouer, pas passer
- Coût : une requête frwiki par lot de titres candidats, plus une seconde, plus petite, uniquement s'il y a au moins un candidat. Le cas courant est donc une seule requête, la plupart des cartes ne produisant aucun candidat. Aucun hôte nouveau, aucune permission nouvelle, manifest identique
- Piège mesuré le 2026-09-20, qui condamnait la phase dans sa première écriture : `imlimit=max` plafonne la réponse entière à 500 lignes de fichiers, partagées entre tous les titres du lot, et non 500 par titre. Sur 50 titres, 3 pages seulement sur 50 recevaient une liste de fichiers, avec `continue.imcontinue` posé. Sur 13 titres, 194 lignes et aucune continuation. Le lot a donc sa propre constante, 20, dérivée de la moyenne mesurée d'environ 15 fichiers par article visée à 60 % du plafond, et non la taille de lot des titres (50)
- Corollaire : une réponse tronquée coupe aussi la liste d'UNE page en son milieu, et les pages reviennent dans un ordre quelconque, donc aucune liste d'une telle réponse n'est connue pour être complète. Un titre qui n'y trouve rien est laissé non résolu, jamais mémorisé comme sans image. Une réponse tronquée ne coûte qu'une nouvelle tentative plus tard, jamais une fausse absence retenue 90 jours
- La réponse négative est mémorisée : nouveau champ `articleImageTried` sur les faits de la carte, schéma 4. Sans lui, environ 70 % des cartes sans image (celles que Wikidata ignore et dont l'article ne porte pas de fichier au bon nom) repartaient en requête vers frwiki à chaque chargement de page, là où un cache chaud ne coûtait rien auparavant. Seule une réponse certaine, positive ou négative, marque une carte comme essayée
- L'image trouvée est rangée dans les faits déjà en cache, sans niveau de cache supplémentaire. Cette écriture d'enrichissement repart à zéro sur la durée de vie de 90 jours, ce qui est assumé : elle n'arrive qu'une fois par carte, puisqu'une carte essayée n'est plus jamais interrogée, et les faits gardés un peu plus longtemps sont ceux que ce même lot vient de confirmer
- Comme pour toute donnée franchissant une frontière, la source ne peut rien imposer hors de sa commande : seuls les titres effectivement demandés peuvent recevoir une image, ce qui vaut pour l'affichage comme pour l'écriture en cache
- Un échec de cette étape, comme en 7c, ne coûte jamais sa catégorie à une carte : la carte garde simplement le logo du site

#### Phase 7e : nom de fichier qualifié par un mot (faite le 2026-09-20)

- Signalé par l'utilisateur sur une carte précise : "sur cette carte j'ai pas d'image, pourtant la page wikipedia en a une", The Backrooms (film, 2022)
- Diagnostic fait sur les API avant de toucher au code : Wikidata (Q125131315) ne porte aucune propriété image, et l'article, qui redirige vers "Backrooms (web-série)", affiche `Backrooms Logo.png`, bien hébergé sur Commons. La règle du nom exact cherchait "Backrooms" et ne pouvait pas le trouver
- La règle accepte désormais, en second recours, le titre suivi d'UN seul mot qui désigne l'image : logo, logotype, affiche, poster, cover, couverture, banner, titre, title. Liste fermée et non préfixe libre : "Paris Hilton.jpg" commence par le titre de l'article "Paris", et un préfixe libre poserait le portrait de quelqu'un d'autre sur cette carte
- Le nom exact est cherché sur TOUS les fichiers avant qu'un nom qualifié ne soit envisagé : un fichier portant le titre seul, c'est l'article qui dit "c'est moi", et il prime quel que soit l'ordre de la réponse
- Cache des faits de carte en version 5. Aucune forme ne change : c'est la règle qui change, donc une carte mémorisée comme sans image d'article garderait cette réponse pour rien
- `pageimages` a été envisagée comme source supplémentaire, mesurée, puis écartée : elle ne renvoie rien pour Backrooms, L'Esquive, Paprika, Corinne Hermès, Fonds souverain, ni même pour Parti québécois que la règle de nom trouve pourtant. Trop inégale sur frwiki pour valoir une source
- Vérifié sur les cartes que l'utilisateur voyait sans image : trois de leurs articles n'affichent aucune image (champ `image` de l'infobox vide ou absent) et le quatrième, Paprika, porte une affiche hébergée en local sur frwiki sous exception de fichier non libre, que la règle 5 refuse et doit continuer de refuser

#### Phase 7f : l'illustration que Wikipédia désigne elle-même (faite le 2026-09-21)

- Signalé par l'utilisateur sur la page des échanges : "parfois j'ai pas l'image alors que je devrais (ex janet jackson)". La carte "Discographie de Janet Jackson" restait sans image alors que le site, lui, en affiche une
- Diagnostic fait sur l'API avant de toucher au code : l'article utilise 18 fichiers, dont 16 drapeaux et une icône, et aucun ne porte son nom. La règle du nom exact comme celle du nom qualifié ne peuvent rien y trouver. Mais `pageprops.page_image_free` nomme exactement la photographie que le site affiche, et elle est sur Commons
- La phase 7e avait mesuré `pageimages` puis l'avait écartée comme "trop inégale". La mesure était juste, la conclusion trop large : les articles cités (Paprika, Parti québécois, L'Esquive, Corinne Hermès) n'ont pas d'illustration LIBRE, et leur affiche ou leur logo, hébergé sur frwiki sous exception de fichier non libre, est de toute façon refusé par la règle 5. Là où cette source ne répond rien, l'extension ne pouvait de toute façon rien afficher
- Nouvelle mesure, 2026-09-21, sur 22 articles de cartes réelles (celles des captures de l'utilisateur et les contre-exemples de la 7e) : 10 articles ont une illustration libre, 9 sur Commons et 1 en local (Severance, refusée), et aucune ne montre un sujet étranger à son article. Les deux pièges de la 7d, "Affaire Romand" et "Affaire Daval", ne renvoient rien ici, là où "n'importe quel fichier" y posait un téléphone Nokia et le portrait d'un avocat
- Propriété demandée : `page_image_free` et jamais `page_image`. La variante libre par construction, l'autre nommant aussi les fichiers non libres que frwiki héberge lui-même
- Coût : zéro requête de plus. La propriété est ajoutée au `ppprop` de la requête qui existait déjà, à côté de `disambiguation`, et revient dans la même réponse
- Règle 7, dernière essayée : le nom exact puis le nom qualifié passent avant, un fichier qui porte le nom de l'article étant l'article qui dit "c'est moi", là où l'illustration principale est la lecture que MediaWiki fait de l'article
- Garde reprise des règles voisines : l'illustration n'est retenue que si la liste de fichiers reçue la contient. Une réponse tronquée ne porte pas la liste complète d'une page, et un titre qui n'y trouve rien reste non résolu plutôt que mémorisé sans image. Les noms de `pageprops` sont écrits avec des soulignés, ceux des listes de fichiers avec des espaces : conversion à la lecture, les deux étant le même titre pour MediaWiki
- Cache des faits de carte en version 6. Aucune forme ne change : comme en 7e, c'est la règle qui change, donc une carte mémorisée "sans image d'article" garderait cette réponse pour rien

#### Phase 7g : l'image de l'ensemble dont la carte est une édition (faite le 2026-09-21)

- Signalé par l'utilisateur sur une offre d'échange : "on voit bien janet jackson mais d'autre ont encore des soucis (la solution doit marcher pour toute les cartes on peux pas faire de cas par cas)". Deux cartes de la capture restaient vides, "Coupe de France féminine de football 2014-2015" et "Trophée des champions 2005"
- Mesure faite avant de toucher au code, sur les 29 cartes sans image des exports de pages de l'utilisateur plus les deux cartes de la capture, soit 31 cartes : l'extension en illustre déjà 9 (7 par Wikidata, 2 par l'article), 3 sont des pages d'homonymie écartées par la règle 2, et 19 restent vides
- Ce que ces 19 cartes ont réellement à offrir, vérifié article par article : 16 n'ont aucune image de leur sujet nulle part. Pas de catégorie Commons portant un fichier, aucune illustration libre sur l'article anglais, et dans l'article lui-même rien que des drapeaux, des pictogrammes de portail et des photographies d'autre chose : un avocat sur "Affaire Daval", un casino sur "Smoke on the Water". Aucune règle ne peut les remplir, et en fabriquer une reviendrait à poser l'image sans rapport que la phase 7d a mesurée comme pire que pas d'image
- Restent deux leviers, tous deux mesurés : l'image de l'ensemble dont la carte est une édition (2 cartes sur 19) et les fichiers non libres hébergés par frwiki elle-même (3 cartes sur 19, décision maintenue plus bas)
- Règle 8, la dernière essayée : quand Wikidata et l'article ne donnent rien, la carte montre l'image de l'ensemble dont elle est UNE édition. Deux liens seulement, P179 (fait partie de la série) et P3450 (saison d'une ligue ou d'une compétition). "Trophée des champions 2005" reçoit la photographie du trophée, "Saison 3 de Grown-ish" le logo de la série
- Liens volontairement exclus, mesurés le 2026-09-21 : P361 (partie de) poserait l'image d'une région sur une ville, et P664 (organisateur) pose le siège de la Fédération française de football sur une finale de coupe. Les deux liens retenus disent "cet élément est un épisode de celui-là", ce qui fait de l'image de l'ensemble une image de la carte elle-même
- Deux propriétés d'image seulement sur l'ensemble, P18 et P154 : une série, une franchise ou une compétition porte une photographie ou un logo, jamais un drapeau, des armoiries, une affiche de film ou un photomontage
- Coût : zéro requête de plus. Les deux valeurs voyagent dans la requête d'entités qui existait déjà, par un chemin `(wdt:P179|wdt:P3450)/wdt:P18`. Mesuré le 2026-09-21 sur 50 éléments de cartes réelles : 32 Ko et une médiane autour de 0,7 s, l'écart avec la forme précédente restant sous la dispersion du service d'une exécution à l'autre
- Ordre des recours inchangé : l'image de Wikidata, puis le fichier que l'article porte lui-même, puis seulement l'image de l'ensemble. C'est pourquoi elle occupe un champ à part, `seriesImage`, et non le champ `image` : fondue dedans, elle empêcherait la recherche de la phase 7d de partir
- Étape purement calculatoire, la seule des trois étapes d'image à l'être : aucune requête, aucune écriture de cache, aucun échec possible. Une carte qui a déjà une image la garde, une carte non catégorisée n'est pas touchée, son image devant rester nulle
- Cache des faits de carte en version 8. La forme change cette fois : aucune entrée antérieure n'a demandé ce fait à Wikidata
- Décision maintenue sur les fichiers non libres, vérifiée le 2026-09-21 : "Coupe de France féminine de football 2014-2015", "Paprika (film, 2006)" et "Fear Street, partie 2 : 1978" ont bien une illustration, mais elle est hébergée en local sur frwiki et catégorisée "Image non libre de logo" et "Wikipédia:Exceptions au droit d'auteur". L'exception couvre Wikipédia, pas une réutilisation ailleurs. La règle 5 continue de les refuser et ces cartes restent sans image

### Phase 8 : étiquettes

#### Phase 8a : retrait de l'index de collection (faite le 2026-09-20, revue indépendante passée)

- Décision de l'utilisateur, voir le tableau de la section 5. L'extension ne peut pas voir une carte quitter la collection sans interagir avec le site ou deviner ; des chiffres qui dérivent valent moins que pas de chiffres
- Retirés : la fonctionnalité `collection-index` en entier, la fenêtre de statistiques (le popup), la complétion par rareté, le réglage correspondant, les deux enregistreurs du content script et les messages associés. 6 362 lignes en moins, 35 fichiers supprimés
- Le bouton de la barre d'outils reste, sans popup : un clic ouvre la page d'options. WXT dérivant toute l'entrée `action` du popup, elle est désormais déclarée à la main dans `wxt.config.ts`, sinon l'icône disparaissait avec lui
- Mise à jour d'une installation existante : la clé `collectionIndex` laissée dans les réglages est simplement ignorée (la normalisation n'itère que sur les réglages connus) et disparaît au premier enregistrement. Les deux clés de données, `wme:collection-index:v1` et `wme:catalogue-totals:v1`, ne partent pas toutes seules : la page d'options affiche un bouton de suppression unique, visible seulement tant qu'au moins l'une des deux est présente, qui les vise nommément et jamais par préfixe
- Conservé : catégories, mise en évidence, lien Letterboxd, images manquantes, réglages, page d'options, les deux caches et leur entretien. Permissions et hôtes inchangés

Écarts assumés :

- `RARITIES_RAREST_FIRST` a été supprimé bien que la spec le range dans ce qui doit rester : après le retrait il n'avait plus aucun consommateur, et "aucun code mort" et "knip sort à 0" ne pouvaient pas tenir en même temps que lui. Le reste de `rarity.ts` (type `Rarity`, `RARITIES`, `isRarity`, lecture de la classe `glow-*`) est intact et toujours utilisé
- `isValidTitle`, `CATEGORY_IDS` et `PERSON_SUBTYPE_IDS` ne sont plus exportés, pour la même raison : leurs seuls consommateurs externes étaient dans l'index. Les fonctions et les constantes restent, à l'intérieur de leur module

#### Phase 8b : étiquettes suggérées dans la modale de détail (faite le 2026-09-20, revue indépendante passée)

- Demande de l'utilisateur : proposer des étiquettes sous la zone "Étiquettes" de la modale, l'utilisateur cliquant sur une proposition pour l'ajouter
- C'est la phase qui franchit la ligne tenue depuis le début : jusqu'ici l'extension n'ajoutait que ses propres noeuds. Les règles du site interdisent "tout outil visant à jouer, ouvrir des paquets, échanger ou interagir à votre place" et annoncent le bannissement du compte sans préavis. La réponse de conception est une séparation stricte, pas une atténuation
- Afficher les propositions est en lecture seule et actif par défaut. Écrire dans le champ du site est un SECOND réglage, `tagAutoFill`, désactivé par défaut. Par défaut, un clic sélectionne le texte de la proposition pour qu'il puisse être copié : l'extension telle qu'installée ne touche jamais le site
- Toutes les écritures sur un noeud du site tiennent dans un seul fichier, `data/fill-tag-field.ts`, dont l'en-tête le dit. La revue a vérifié cette affirmation sur l'ensemble de `src/`, pas seulement sur cette fonctionnalité : `dispatchEvent` et `focus()` sur un noeud du site n'existent nulle part ailleurs
- Deux gardes, aux deux niveaux : clic réellement fait par l'utilisateur, et réglage lu AU MOMENT DU CLIC et non capturé à la construction du bouton. Le module d'écriture les revérifie plutôt que de faire confiance à son appelant, parce qu'il est la dernière ligne avant le site
- Troisième garde, ajoutée après la revue : refuser tout ce qu'un clavier n'aurait pas pu faire. Un champ désactivé, en lecture seule, ou retiré de la page, et une étiquette plus longue que le `maxlength` du champ, que le setter natif ignore complètement. Sans elle, l'extension écrivait là où l'utilisateur lui-même n'aurait pas pu, ce qui contredisait la promesse "comme si tu l'avais tapée"
- La valeur passe par le setter natif de `HTMLInputElement` : un champ contrôlé par React intercepte une affectation ordinaire et ne voit rien passer. Absent, la fonction ne fait rien plutôt que de deviner une autre voie
- L'extension ne lit jamais la réponse du site, donc ne simule aucune confirmation : la proposition disparaît à la synchronisation suivante si l'étiquette a bien été posée, et reste sinon
- Le test de possession est la présence du champ d'étiquette, et il n'y en a pas d'autre : le site n'offre pas ce champ sur une carte qui n'est pas la vôtre. Le champ est reconnu par son rôle de combobox ET le préfixe de son placeholder, ce dernier étant ce qui décide dans quel champ on écrit le jour où la modale en porte un second
- Les étiquettes déjà posées sont lues sur l'`aria-label` des boutons de retrait, seul endroit où le site les écrit en toutes lettres. Le préfixe est `Retirer l'étiquette ` en entier : la modale porte aussi un bouton `Retirer des favoris`, que le mot `Retirer` seul aurait lu comme une étiquette nommée "des favoris"
- Aucune requête nouvelle, aucune propriété SPARQL nouvelle : les libellés de métier étaient déjà récupérés pour départager les occupations et jetés ensuite. Manifest inchangé, à l'exception de sa description, qui disait "en lecture seule" et dit désormais "en lecture seule par défaut" : c'est le seul texte que lit quelqu'un qui n'ouvre jamais la page d'options
- Défaut de couverture connu, faute de capture : aucune fixture d'une carte NON possédée. Le cas est fabriqué en mémoire à partir d'une carte possédée. Si le site rendait un champ désactivé plutôt qu'absent sur une carte d'autrui, le test de possession tomberait, et c'est alors la garde `disabled` ci-dessus qui protégerait

#### Phase 8c : état d'attente des étiquettes suggérées (faite le 2026-09-21)

- Demande de l'utilisateur : "Mettre un loading pour montrer que c'est en train de les charger, on dirait qu'il se passe rien sinon"
- La zone restait vide pendant toute la requête, et une zone vide est exactement ce qu'affiche une carte sans proposition : les deux situations se ressemblaient alors qu'elles n'ont rien à voir
- Le mot "recherche…" est écrit à la place des propositions tant que la carte n'a aucun résultat, quelle qu'en soit la raison (lot en vol, ou lot échoué attendant sa temporisation de 60 s). Dès qu'un résultat arrive, quel que soit son statut, l'état se résout tout seul
- Même noeud, même clé de comparaison, donc les mêmes garanties. L'état fait partie de la clé et non des étiquettes, sinon une carte dont la seule proposition serait ce mot garderait le noeud d'attente. Une sync qui retrouve la même attente n'écrit rien
- Le mot respire par une animation CSS, qui ne touche pas au DOM et ne peut donc pas relancer l'observateur, et s'arrête sur `prefers-reduced-motion`. Il porte `role="status"` : son apparition puis son remplacement sont exactement le changement qu'un lecteur d'écran manquerait

#### Phase 8d : sujet lu sur les racines Wikidata (faite le 2026-09-21)

- Demande de l'utilisateur, capture à l'appui : "Pour les voitures, on propose pas etiquette Voitures". La carte "Alfa Romeo 147" ne proposait que "Technique"
- Le libellé de catégorie dit "Technique" pour une voiture, un navire de guerre, un fusil et un éditeur de texte. C'est vrai, et inutile comme étiquette
- Les racines qui ont décidé la catégorie sont déjà résolues et déjà en cache pour chaque carte (`matchedRootIds`, depuis ROOTS_VERSION 3) : le mot plus précis ne coûte donc aucune requête, aucune propriété SPARQL et aucune invalidation de cache. Les étiquettes sont recalculées à chaque catégorisation à partir des faits en cache
- Mesuré sur le service en direct le 2026-09-21 : "Alfa Romeo 147" porte la seule classe Q3231690 ("modèle d'automobile"), qui atteint les racines Q3231690 et Q29048322 ("modèle de véhicule") et aucune autre. Le tableau est donc ordonné du plus précis au plus général, première correspondance gagnante
- Seules les racines de la catégorie technique portent un sujet. Toutes les autres catégories se nomment déjà bien ("Cinéma et TV", "Musique", "Sport", "Lieu"), et un second mot disant la même chose prendrait une place sur six pour rien
- Les racines lues sont celles des classes DÉCISIVES, comme `isFilm` : un parent d'une carte déjà élue ne parle pas pour elle
- Q811701 ("série de modèles") ne porte volontairement aucun sujet : c'est une série de modèles de n'importe quoi, et la carte atteint de toute façon une racine plus précise à côté quand il y en a une
- Un test garde le tableau aligné sur les listes de racines : une racine absente des groupes ne serait jamais interrogée, donc son sujet ne pourrait jamais sortir

### Phase 10 : préférences d'affichage

#### Phase 10a : option pour masquer les statistiques des cartes (faite le 2026-09-20, revue indépendante passée)

- Demande de l'utilisateur : une option pour cacher les statistiques de la carte, partout sur le site, par défaut sur non. Portée retenue : ATK et DEF, sur la carte (grille, grand format, et la copie de carte que la modale affiche d'elle-même) et dans les deux grands encadrés de la modale. Le Q-Score, les exemplaires et les vues restent hors périmètre, faute d'une demande explicite
- Première fonctionnalité qui CACHE quelque chose du site au lieu d'AJOUTER quelque chose par-dessus, et premier réglage désactivé par défaut. Les deux méritaient d'être traités comme des décisions, pas comme des détails
- Mécanisme : une feuille de style qui appartient à l'extension, ajoutée dans `document.head` quand l'option est cochée et retirée entièrement quand elle est décochée. Aucun attribut, aucune classe, aucun style et aucun texte n'est écrit sur un noeud du site, rien n'est déplacé ni supprimé : c'est la cascade qui décide de ce qui est peint. Le site garde exactement le document qu'il a construit
- `document.head` et non `document.body` : le content script observe `document.body`, donc cette feuille vit hors du sous-arbre observé et la poser ne peut jamais déclencher un scan. La dispense est structurelle, pas une précaution
- Ce sont les seules règles CSS de l'extension qui visent un noeud du site SANS CONDITION, donc elles ne vivent pas dans la feuille que le manifest injecte toujours, dont chaque sélecteur commence par un de nos attributs. Vérifié sur le paquet construit : `content.css` ne contient aucun de ces sélecteurs. La phase 11 en a ajouté une qui laisse hors du rendu la pastille du site, mais elle exige une carte à nous immédiatement devant cette pastille, donc elle ne vise rien du tout tant que sa fonctionnalité est éteinte, et peut vivre dans la feuille toujours injectée
- Sur la carte, `visibility: hidden` et jamais `display: none` : la carte est de taille fixe et effondrer la ligne ferait remonter tout ce qui est au-dessus. Dans la modale, `display: none` sur la grille qui porte les deux encadrés, et non sur chaque encadré : deux cadres vides auraient l'air d'un bug
- Sélecteurs ancrés sur les classes d'icônes lucide, jamais sur une classe Tailwind, et bornés en amont : la règle de la carte par la racine `glow-`, celle de la modale par la couche de la modale. La revue a montré que borner cette dernière par `card-frame` seul ne suffit pas : cette classe est la classe de panneau du site en général, présente aussi sur l'en-tête de `/global-collection` et sur les tuiles du marché, donc la règle non bornée emportait une grille entière de panneaux sur une route que l'extension n'a jamais observée
- Défaut à faux : une installation que personne n'a configurée doit continuer de montrer exactement ce que le site montre. C'est le premier défaut qui n'est pas vrai, donc la normalisation a été vérifiée clé par clé plutôt que supposée
- `hasEnabledFeature` ne compte pas ce réglage, qui ne consomme aucune catégorie : l'activer seul ne doit lancer aucun trafic, et le désactiver ne doit pas couper celui dont une autre option a besoin. La garantie "tous les réglages sur non, plus rien ne part" tient donc toujours, avec son miroir "ce réglage sur oui, rien ne part non plus"
- Sur les règles du site : cacher un nombre dans son propre navigateur ne donne aucun avantage, ne révèle rien et n'automatise rien. C'est une préférence d'affichage, comme un mode lecture, et un clic la défait entièrement
- Aucune requête, aucun message, aucune permission, manifest identique

#### Phase 10b : retrait de la mise en évidence par catégorie (faite le 2026-09-20)

- Demande de l'utilisateur, capture du panneau flottant à l'appui : "enleve ça". La même demande avait été faite puis annulée le même jour ("ne supprime pas les catégories"), donc la portée est tenue au plus près de ce qui est montré : le panneau et les voiles qu'il pilote partent, la catégorisation et le badge restent entiers
- Retirés : la fonctionnalité `category-highlight` en entier (panneau, voile, comptage des catégories de la page, sélection des titres voilés), sa feuille de style, son réglage `categoryHighlight` et sa ligne dans la page d'options
- Mise à jour d'une installation existante : la clé `categoryHighlight` laissée dans les réglages est simplement ignorée (la normalisation n'itère que sur les réglages connus) et disparaît au premier enregistrement, même mécanisme que `collectionIndex` en phase 8a. Aucune donnée à supprimer : l'état du panneau n'a jamais été stocké
- `hasEnabledFeature` passe de cinq clés à quatre. Conséquence assumée : une installation qui n'avait gardé QUE la mise en évidence n'envoie désormais plus rien vers Wikidata, ce qui est bien le comportement voulu puisque plus rien n'y affiche une catégorie
- Le panneau était le seul noeud que l'extension ajoutait directement dans `document.body`. Après ce retrait, tout ce qu'elle pose vit à l'intérieur d'une carte ou de la modale de détail, la seule exception étant la feuille de style de la phase 10a, qui vit dans `document.head` et n'ajoute aucun noeud visible
- Conservé : catégorisation Wikidata, badge sur les cartes, ligne de catégorie dans la modale, couleurs d'accent, lien Letterboxd, images manquantes, étiquettes suggérées, masquage des statistiques, les deux caches et leur entretien. Permissions, hôtes et manifest inchangés
- La réponse 1 au besoin de filtre de la phase 4 disparaît avec elle. Il reste la réponse 3, les étiquettes natives que l'utilisateur pose lui-même, que la phase 8b alimente en propositions

#### Phase 10c : la ligne des statistiques s'efface avec elles (faite le 2026-09-20)

- Demande de l'utilisateur : "cache cette ligne noir si on cache les stats". Une fois les deux valeurs masquées, la carte ne montrait plus qu'une bande vide fermée par un trait
- Seule la couleur du trait part, jamais le trait : `border-top-color: transparent` et non `border-top: none`. Supprimer la bordure effondrerait un pixel et ferait remonter tout ce que le site a posé au-dessus, ce que le choix de `visibility` plutôt que `display` sur les valeurs elles-mêmes cherchait déjà à éviter
- La ligne est visée par l'icône d'attaque qu'elle contient, jamais par la classe `border-t` qui la dessine, comme toutes les règles de cette fonctionnalité
- Limite connue de l'outillage, notée dans le test : happy-dom résout un `:has()` portant un combinateur de descendance plus largement qu'un navigateur. Le test atteint donc la ligne par un autre chemin (la classe du site) et vérifie qu'elle est parmi les noeuds visés, ce qui tombe bien en rouge si la règle est pointée sur un bloc de valeur. Vérifié par mutation

### Phase 11 : les cartes d'une offre d'échange (faite le 2026-09-21)

- Demande de l'utilisateur, capture de la page à l'appui : "dans les 3 onglets, ce serait bien d'afficher direct les cartes au lieu des nom, ainsi pas besoin de cliquer dessus"
- Ce que la page donne : chaque offre nomme ses cartes dans une pastille `span` qui porte le titre EXACT de l'article dans son attribut `title`, et la couleur de sa rareté dans un style en ligne. Le texte peint, lui, est tronqué ("SR · The Backrooms (fil…"), donc il n'est jamais lu
- Sélecteur `span[title][style*="--color-rarity-"]` : compté sur les exports du 2026-09-21, cette forme apparaît 54 fois sur `/trades` et zéro fois sur `/collection`, `/global-collection`, `/marketplace`, `/pulls` et la modale de détail, alors que toutes ces pages utilisent les variables de rareté. Aucun contrôle de route n'est donc nécessaire : la forme du noeud suffit, comme `glow-<rareté>` suffit pour une carte
- Les titres lus ici rejoignent le MÊME lot de catégorisation et la MÊME mémoire que les cartes de la page : un titre est un titre, d'où qu'il vienne, et une carte vue aux deux endroits n'est demandée qu'une fois. `handleScan` ne lit d'ailleurs que le `card` de ce qu'on lui donne, jamais le noeud qui le porte, ce que sa signature dit maintenant (`ScannedCard`)
- L'image vient de la source de la phase 7 (Wikidata P18, puis le fichier de l'article), donc `resolveImageUrls` est demandé dès que CETTE fonctionnalité est active, même si les images manquantes sont désactivées : une pastille ne montre aucune image, il n'y a rien à compléter, tout est à dessiner
- La pastille du site n'est jamais touchée. Elle reste dans le document telle que le site l'a écrite, et une règle de style la laisse hors du rendu : `[data-wme-trade-preview] + span`, c'est-à-dire une pastille précédée IMMÉDIATEMENT d'une carte à nous, ce qui n'existe qu'aux endroits où cette fonctionnalité vient de dessiner la même carte. Fonctionnalité désactivée, aucune carte n'existe et la règle ne vise plus rien : elle peut donc vivre dans la feuille toujours injectée, contrairement à celle de la phase 10a, qui viserait des noeuds du site en permanence
- Balayage des cartes orphelines à chaque sync : le site reconstruit une offre quand on change d'onglet, et une carte dont la pastille est partie avec l'offre resterait seule à nommer une carte que la page ne propose plus. Chaque sync garde les cartes qu'il vient de confirmer et retire les autres
- Rien ne prend le clic : la carte est en `pointer-events: none`, donc un clic dessus atteint le bouton du site qui porte toute l'offre, exactement comme un clic sur la pastille
- Fixture assainie tirée de deux offres réelles (une carte contre une, une carte contre quatre), pseudonymes remplacés. Sept pastilles, six titres distincts, dont un que les deux offres nomment
- Vérification visuelle : la fixture rendue avec la vraie feuille de style et les couleurs de rareté du site, en largeur bureau et en 375 px. Les cartes se replient sans débordement, et une image qui échoue laisse le fond plat de la rareté plutôt que le glyphe d'image cassée du navigateur, ce que la marque d'échec garantit
- Septième réglage, activé par défaut : la fonctionnalité ajoute des noeuds qui lui appartiennent et ne retire rien du site
- Reprise du dessin le même jour, sur retour de l'utilisateur ("le résultat est sympa mais devrait plus ressembler à ça", capture d'une carte du site à l'appui). La vignette prend la forme d'une carte du site, relevée sur ses propres exports : format portrait d'environ 1 pour 1,4, image dans les 45 % du haut sous le voile `bg-black/20` du site, badge de rareté dans le coin de cette image avec son encre `rgb(13, 17, 23)` et son halo, titre en dessous en gras sur le fond de la rareté, et le double halo des règles `glow-<rareté>` autour du tout
- Le fond de l'image est celui de la phase 7, clair pour un emblème et sombre pour une photographie : le même fichier ne doit pas ressembler à deux cartes différentes d'une page à l'autre. Le cadrage suit la même règle, et c'est aussi celle du site, qui montre une photographie en `object-cover` et un emblème en `object-contain`
- Le site peint le fond de ses cartes avec un visuel de rareté qui lui appartient (`super_rare.png` et ses voisins), que rien ne nous autorise à charger : c'est un dégradé de la couleur de la rareté qui le lit à sa place, clair là où l'image se pose et pleine couleur au pied
- Changement de feuille de style seulement : aucun noeud, aucune clé et aucune ligne de code touchés, donc rien de ce qui garantit une sync sans écriture ne bouge
- Vérification visuelle refaite : les six raretés côte à côte, un emblème, une photographie, une carte dont aucune image n'est connue et une image en échec, en largeur bureau et en 375 px

## 7. Scénarios de test proposés (à valider ou compléter)

1. should show "Personne / Cinéma" and a `/director/quentin-tarantino/` link when the card is "Quentin Tarantino"
2. should show "Personne / Science" and no Letterboxd link when the card is "Albert Einstein"
3. should link to `/film/pulp-fiction/` when the card is "Pulp Fiction"
4. should fall back to a title search when a film has neither P6127 nor P4947
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
18. should show one badge "Personne · Cinéma" on the "Quentin Tarantino" card and no badge on a card whose article was not found
19. Retiré avec la phase 10b : portait sur la mise en évidence par catégorie
20. should write nothing to the DOM when a sync runs on an unchanged page
21. Retiré avec la phase 8a : portait sur l'enregistrement d'une carte dans l'index local
22. Retiré avec la phase 8a : portait sur le décompte des cartes non catégorisées dans le popup
23. should remove every badge at once when "Badge de catégorie" is switched off in the options, and bring them back when switched on again without reloading the tab
24. should send no categorization request when the four settings are off
25. should show an image from Commons on a card the site left without one, and leave a card that has a picture untouched
26. should show no image and no credit line when Wikidata knows no image for the article
27. should refuse a file name carrying a forbidden character, a lone surrogate or an extension outside the allowed list
28. should show the "Commons" mark only once the image added by the extension has loaded, and never on a card illustrated by the site
29. should show a loading state while the image is on its way, and leave only the site logo when it cannot be loaded
30. should refuse a thumbnail address whose host merely ends with a Wikimedia host name
31. should show the picture of the competition on the card of one of its editions, and keep the file the article itself uses when there is one

Note : le scénario 17 décrit le plan initial. Depuis la phase 3, les parents P279 votent et "Hutte" devient "Monument et bâtiment" (voir Catégories v1, règle 3).

## 8. Risques

| # | Risque | Impact | Parade |
| --- | --- | --- | --- |
| R1 | Confirmé : collection paginée, un filtre DOM ne voit que la page courante | Filtres sur page peu utiles seuls | Assumé, et tranché : la mise en évidence par page a été retirée le 2026-09-20 (phase 10b). Le badge donne la catégorie carte par carte, et les étiquettes natives que l'utilisateur pose lui-même, alimentées en propositions par la phase 8b, prennent le relais pour le filtrage |
| R6 | Retiré avec la phase 8a : portait sur l'index local incomplet | | |
| R2 | Changement du DOM à chaque déploiement du site | Détection cassée | Détection structurelle, sélecteurs centralisés, fixtures, mode dégradé silencieux |
| R3 | Interprétation stricte des règles par le site | Bannissement du compte | Lecture seule stricte, aucun avantage de jeu, accord du développeur avant publication |
| R4 | Indisponibilité ou limitation de query.wikidata.org | Cartes non catégorisées temporairement | Cache, backoff, file d'attente, P31 brut via `wbgetclaims` en dernier recours |
| R5 | Classes P31 exotiques mal rattachées | Catégorie "Autre" ou erronée | Table statique enrichie au fil de l'eau, ordre de priorité des racines, jeu de référence en test |
