# Notes DOM des pages connectées (phase 0)

Source : exports du 2026-09-20 dans `tests/fixtures/raw/` (non versionnés) : paquet fermé, paquet ouvert, détail de carte, marché. L'export de `/collection` n'a capturé que le spinner de chargement.

Fixtures anonymisées (composant carte seul, aucune donnée de compte) dans `tests/fixtures/` :

| Fichier | Contenu |
| --- | --- |
| `card-grid-with-description.html` | Carte format grille (marché) |
| `card-large-with-description.html` | Carte grand format (ouverture de paquet) |
| `card-large-no-description.html` | Carte grand format sans description |
| `card-detail-modal.html` | Modale de détail complète, avec le lien Wikipédia |
| `global-collection-page.html` | Bloc d'en-tête du catalogue (totaux par rareté) et trois cartes |
| `placeholder-cards.html` | Deux cartes sans illustration (logo du site) et une carte illustrée |

## Routes découvertes

`/pulls`, `/collection`, `/global-collection` ("Toutes les cartes", catalogue avec recherche), `/trades`, `/marketplace`, `/marketplace/<uuid>`, `/profile`, `/guild`, `/friends`, `/dms`, `/battle`, `/achievements`, `/settings`, `/leaderboard`.

## Structure générale

- `body > div.flex.h-dvh` contient la `nav` latérale et `main.overflow-y-auto`. Le conteneur de scroll est `main`, pas `window`
- La modale de détail est ajoutée en fin de `body` : `div.fixed.inset-0.z-50 > div.card-frame`
- Classes sémantiques maison repérées (plus stables que les utilitaires Tailwind) : `glow-<rareté>`, `card-frame`, `animate-card-flip`, `animate-fade-in-up`

## Composant carte (identique sur toutes les pages connectées)

Racine : un `div` portant la classe `glow-<rareté>` avec `c`, `pc`, `r`, `sr`, `ur` ou `l`, plus `relative rounded-2xl overflow-hidden`. Seules les dimensions changent : `w-72 h-[420px]` en grand format, `w-[clamp(8.4rem,43vw,10rem)]` en grille.

Enfants, dans l'ordre :

1. `img[alt=""]` : fond de rareté (`commun.png`, `peu_commun.png`, etc.)
2. `div` dégradé décoratif
3. Zone image `div.absolute.top-0.h-[45%]` contenant `img[alt="<titre>"]`
4. Badge de rareté `div.absolute.top-2.left-2` avec le texte C, PC, R, SR, UR ou L
5. Grand format uniquement : `div.absolute.top-2.right-2.z-30.flex.flex-col.items-end.gap-1` contenant `button[aria-label="Ajouter aux favoris"]`
6. Zone texte `div.absolute.top-[45%]` : `h3` (titre), `p` (description, absente sur certaines cartes), puis ligne de stats avec `svg.lucide-swords` et `svg.lucide-shield`

Extraction recommandée :

| Donnée | Source principale | Secours |
| --- | --- | --- |
| Détection | `div[class*="glow-"]` contenant un `h3` | Présence conjointe de `svg.lucide-swords` et `svg.lucide-shield` |
| Titre | `h3.textContent` | `img[alt]` non vide |
| Rareté | Suffixe de la classe `glow-*` | Texte du badge |
| Description | `p` de la zone texte | Aucune (facultative) |

Carte sans illustration (relevé du 2026-09-20 sur les exports bruts : 7 cartes sur 41 au marché, 12 sur 50 parmi les légendaires du catalogue) : la zone image contient alors `div > div > img[alt="WikiMasters"]`, le logo du site servi par `/_next/image?url=%2Flogo.png` (présent dans `src` et dans `srcset`), avec les classes `object-contain opacity-70`. Une vraie illustration est un `img[alt="<titre>"][crossorigin="anonymous"]` direct, suivi d'un dégradé. Les deux variantes sont dans la fixture `tests/fixtures/placeholder-cards.html`. La zone image se retrouve par la structure (l'ancêtre du logo qui est enfant direct de la racine), pas par ses classes Tailwind.

En-têtes du site (page publique, 2026-09-20) : aucun `Content-Security-Policy`, aucun `Cross-Origin-Embedder-Policy`. Une balise `img` ajoutée par l'extension peut donc charger une image de Wikimedia. `Special:FilePath` de Commons répond par deux redirections sans en-tête CORS : l'image de l'extension ne doit pas porter `crossorigin`.

La carte de la landing publique est différente (`aspect-[5/7]`, pas de `glow-*`). Elle n'est pas ciblée.

## Modale de détail

Dans `.card-frame` : `h2` (titre), libellé de rareté, onglets "Détails" et "Marché" (PRO), champ "Étiquettes" (`input[role="combobox"]`), ATK, DEF, Q-Score, Exemplaires, Vues (30j), signalement d'image, actions "Mettre aux enchères" et "Défausser".

Élément clé : `a[href^="https://fr.wikipedia.org/wiki/"]` ("Voir l'article sur Wikipédia"). Il donne le titre exact de l'article et le sous-domaine de langue. C'est le point d'ancrage naturel du bouton Letterboxd et de l'affichage de la catégorie.

## Pages

| Page | Constat |
| --- | --- |
| `/pulls` | Paquet fermé : aucune carte, et un `div.card-frame` qui porte "n / 10", "paquets disponibles" et le compte à rebours du suivant, lequel change chaque seconde. Paquet ouvert : une carte à la fois, carrousel "Carte n / 5", carte grand format dans un wrapper `animate-card-flip` déplaçable. Le compteur est un `div` de trois `span` ("Carte", le numéro, "/ 5"), donc son `textContent` vaut "Carte1/ 5", et il est le voisin précédent du wrapper qui contient la carte, deux niveaux au-dessus de la racine `glow-<rareté>` (relevé le 2026-09-21). Les deux états sont exclusifs : le bloc des paquets disponibles n'est pas dans le document pendant une révélation |
| `/marketplace` | Grille de `div#marketplace-auction-<uuid> > a.card-frame`. Environ 40 cartes par lot, bouton "Charger la suite" (ajout au DOM). Natif : recherche, tri, filtre par rareté. 45 424 enchères au moment de l'export |
| `/collection` | Pagination (confirmé par l'utilisateur). D'après les textes d'interface : tri (date d'ajout, nom, rareté, ATK, DEF, favoris), filtre par rareté, filtre par étiquette, gestion d'étiquettes y compris en lot sur une sélection, boutons Précédent et Suivant |
| `/global-collection` | Capturée le 2026-09-20 (export brut non versionné). Catalogue de TOUTES les cartes du jeu : 2 773 461 cartes, 50 par page, "Page 1 / 55470". Bloc d'en-tête `div.card-frame` avec le total par rareté (L 1761, UR 12368, SR 66788, R 179657, PC 516762, C 1996125). Natif : recherche "par titre ou catégorie", tri, filtre par rareté, bouton "Liste de souhaits" (icône bookmark). Même composant carte qu'ailleurs (`glow-<rareté>`, `h3`, `p`), donc détecté et badgé sans changement. AUCUN marqueur de possession sur les cartes du catalogue : toutes les racines portent exactement les mêmes classes. Certaines cartes portent une pastille avec l'icône `lucide-users` et un pseudo de joueur : un ami qui possède cette carte (confirmé par l'utilisateur). Ce sont des `span`, sans effet sur l'extraction du titre et de la description. Pendant une recherche, le site remplace le contenu du bloc d'en-tête par une notice ("Recherche active : pas de décompte par rareté ni de total exact") : les six totaux et le total général disparaissent (confirmé par l'utilisateur, capture du 2026-09-20) |

## Validation du pipeline sur un échantillon réel

43 cartes réelles (41 du marché, 2 des paquets), non choisies :

| Mesure | Résultat |
| --- | --- |
| Titres résolus en QID | 43 sur 43, aucune redirection nécessaire |
| Cartes avec au moins un P31 | 42 sur 43 ("Hutte" n'a que du P279) |
| Temps | 184 ms (frwiki) puis 1,6 s (SPARQL en POST) |
| Fallback par classe, 43 classes distinctes | 41 rattachées du premier coup, 9 s, une seule fois par classe |
| Classes non rattachées | "microarchitecture", "modèle d'automobile" (racines à ajouter) |

Enseignements :

1. Le titre de carte est bien le titre frwiki exact, parenthèses d'homonymie comprises ("Damien Girard (homme politique)")
2. Les classes P31 sont très variées ("étape de plaine", "duo musical", "type d'avion", "saison de série télévisée"). Une table écrite à la main ne suffira pas, le fallback par classe est indispensable
3. Une carte a souvent plusieurs P31 contradictoires. "McDonald's" sort en Lieu pour une classe et en Organisation pour quatre : il faut un vote majoritaire au niveau de la carte, puis l'ordre de priorité en cas d'égalité
4. L'ordre des P106 n'a aucun sens. Phil Collins sort "acteur" en premier. La description de la carte ("batteur, chanteur et auteur-compositeur") donne le bon ordre et sert de départage
5. Sans P31, se rabattre sur P279 et classer en "Science et concept"

## Reste à capturer

- `/collection` une fois les cartes affichées (grille, contrôles de tri et de filtre, pagination, mode sélection)
- `/global-collection` : fait. Le catalogue est fini mais compte 2,77 millions de cartes sur 55 470 pages, sans marqueur de possession : il ne peut pas servir de dénominateur par catégorie (voir PLAN, verdict de faisabilité). La liste de souhaits est un filtre de cette page, pas de `/collection`
