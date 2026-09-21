# WikiMasters Extended

Extension Chrome (Manifest V3) qui enrichit [wiki-masters.com](https://www.wiki-masters.com),
où chaque carte à collectionner est un article de Wikipédia.

Elle ajoute uniquement ses propres éléments par-dessus la page : elle ne clique
pas, ne scrolle pas, ne saisit rien et n'écrit jamais rien sur le site.

## Installation

Elle n'est pas publiée sur le Chrome Web Store : elle se charge en mode
développeur, ce qui prend une minute et ne demande aucun compte.

1. Télécharger le fichier `.zip` de la
   [dernière release](https://github.com/AlexherDev69/wikimasters-extended/releases/latest)
2. Le décompresser dans un dossier que tu gardes : Chrome le relit à chaque
   démarrage, donc supprimer ce dossier désinstalle l'extension
3. Ouvrir `chrome://extensions` et activer le "Mode développeur", en haut à droite
4. Cliquer sur "Charger l'extension non empaquetée" et sélectionner le dossier
   décompressé
5. Ouvrir [wiki-masters.com](https://www.wiki-masters.com) : le mot "Extended"
   sous le nom du site dit que l'extension est bien chargée

Pour mettre à jour : retélécharger, remplacer le contenu du dossier, puis
cliquer sur la flèche de rechargement de l'extension dans `chrome://extensions`.

## Fonctionnalités

Neuf réglages, tous activables depuis la popup de la barre d'outils ou la page
d'options, appliqués sans recharger les onglets ouverts.

| Fonctionnalité | Ce qu'elle fait |
| --- | --- |
| Bouton Wikipédia | Un bouton "W" sur la carte ouvre son article, sans passer par la modale de détail |
| Lien Letterboxd | Un lien dans la modale et un logo sur la carte, pour les films, les studios et les personnalités du cinéma |
| Images manquantes | Pose une image de Wikimedia Commons sur les cartes que le site laisse sans illustration, avec son crédit dans la modale |
| Cartes sur la page d'échange | Dessine la carte entière à la place des noms tronqués des offres ("SR · The Backrooms (fil…") |
| Bouton vue compacte | Un bouton qui réduit les cartes de la collection et du catalogue à deux tiers de leur taille, pour en voir deux fois plus |
| Statistiques de tirage | La part de chaque rareté dans les cartes que tes paquets révèlent, six nombres stockés et rien d'autre |
| Masquer les statistiques des cartes | Cache les valeurs ATK et DEF, sur les cartes et dans la modale (désactivé par défaut) |
| Pong pendant les chargements | Une partie de Pong quand le site n'affiche que son rond qui tourne depuis plus de trois secondes |
| Son de notification | Deux notes quand le compteur de la cloche du site augmente |

S'y ajoute la signature de l'extension, sans réglage : le mot "Extended" écrit
sous le nom du site, partout où le site écrit son nom.

## Ce que l'extension respecte

**Les règles du site.** Elles interdisent "tout outil visant à jouer, ouvrir des
paquets, échanger ou interagir à votre place", sous peine de bannissement sans
préavis. L'extension est un overlay en lecture seule : aucune classe, aucun
attribut, aucun style et aucun texte n'est posé sur un élément du site, aucune
API du site n'est appelée, aucun trafic réseau n'est intercepté. Deux options
(masquer les statistiques, vue compacte) changent bien le rendu du site, mais
par une feuille de style qui appartient à l'extension et vit dans l'en-tête de
la page : le document que le site a construit reste intact. Tout ce que
l'extension ajoute disparaît quand elle est désactivée.

**Les licences de Wikimedia.** Seuls les fichiers hébergés par Wikimedia Commons
sont affichés, jamais ceux que Wikipédia héberge sous son exception de droit
d'auteur. La modale de détail crédite l'image qu'elle montre par un lien vers la
page du fichier, où figurent son auteur et sa licence. Les données de Wikidata
sont sous CC0.

**Ta vie privée.** Les seules requêtes de l'extension partent vers
`fr.wikipedia.org` et `query.wikidata.org` : des titres d'articles publics, plus
les noms des fichiers Commons dont l'adresse doit être résolue. Elles sont
envoyées sans cookie (`credentials: 'omit'`), donc aucun compte n'est identifié.
Les images, elles, sont chargées par ton navigateur depuis les serveurs de
Wikimedia, sans référent (`referrerpolicy="no-referrer"`) : ils reçoivent une
demande de fichier, jamais la page qui l'affiche. Rien n'est envoyé au site, à
Letterboxd ni à aucun autre serveur, et il n'y a ni télémétrie ni analyse
d'usage. Réglages, caches et comptes de tirage restent dans
`chrome.storage.local`, sur ta machine, et la page d'options affiche les caches
avec de quoi les vider. L'extension ne tient aucun index de ta collection.
Désactive les trois fonctionnalités qui consultent Wikidata et plus aucune
requête ne part.

**Les marques citées.** Le projet n'est affilié ni à wiki-masters.com, ni à
Wikipédia, Wikimedia, Wikidata ou Letterboxd. Leurs noms et leurs logos ne
servent qu'à désigner la destination d'un lien, et le logo Letterboxd comme le
"W" sont dessinés par l'extension : rien n'est téléchargé chez eux.

**Le code des autres.** Les fixtures de test sont des extraits assainis, sans
pseudonyme réel ; les exports bruts de pages ne sont jamais versionnés. Le code
de l'extension est sous licence [MIT](LICENSE).

Pour signaler une faille : [SECURITY.md](SECURITY.md).

## Stack

| Couche | Choix |
| --- | --- |
| Langage | TypeScript 6 en mode strict, zéro `any` |
| Framework | [WXT](https://wxt.dev) 0.21 (Manifest V3), aucune dépendance à l'exécution |
| Tests | Vitest 5 et happy-dom, plus de mille tests |
| Qualité | ESLint (typescript-eslint strict), Knip, `tsc --noEmit` |
| Outils | pnpm 10, Node 22, GitHub Actions |

L'architecture suit une clean architecture simplifiée : `src/core` pour ce qui
ne connaît pas le site, `src/features/<feature>/{domain,data,presentation}` pour
le reste, et `src/entrypoints` pour le seul câblage. Le manifeste ne demande que
`storage`, les deux hôtes Wikimedia et son script de contenu sur
wiki-masters.com.

## Développement

Node.js 22.12 ou supérieur, pnpm 10 ou supérieur.

```bash
pnpm install && pnpm build
```

Le dossier à charger dans Chrome est alors `.output/chrome-mv3/`, en suivant les
étapes 3 et 4 ci-dessus : il n'y a ni zip à télécharger ni archive à
décompresser. `pnpm dev` construit dans `.output/chrome-mv3-dev/` et reconstruit
à chaque modification ; aucun navigateur n'est ouvert automatiquement, car la
vérification Turnstile du site refuse les profils automatisés.

Une release se publie à la main : `pnpm zip`, puis le tag et l'archive
`.output/wikimasters-extended-<version>-chrome.zip` jointe à la release GitHub.
Rien dans la CI ne le fait à ta place.

Les journaux apparaissent dans la console de la page (F12), préfixés par le nom
de l'extension : tous les niveaux en développement, `warn` et `error` seulement
en production. Ceux du service worker se lisent depuis `chrome://extensions`,
lien "Service worker".

## Scripts

| Commande | Description |
| --- | --- |
| `pnpm dev` | Développement avec rechargement automatique |
| `pnpm build` | Build de production dans `.output/chrome-mv3/` |
| `pnpm zip` | Archive de distribution, celle qui est jointe aux releases |
| `pnpm typecheck` | TypeScript sans émission |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (`pnpm test:watch` en mode watch) |
| `pnpm knip` | Code mort et exports orphelins |

## Documentation

- [docs/PLAN.md](docs/PLAN.md) : feuille de route, analyses de faisabilité et
  mesures qui justifient chaque choix
- [docs/DOM_NOTES.md](docs/DOM_NOTES.md) : ce que le site rend, et les sélecteurs
  stables sur lesquels l'extension s'appuie
- [docs/IDEAS.md](docs/IDEAS.md) : pistes non retenues, et pourquoi

## Mot du dev

Je développe des extensions et des applications par passion, sur mon temps
libre. Si celle-ci te sert, tu peux retrouver mes autres projets et me soutenir
sur [ko-fi.com/alexher](https://ko-fi.com/alexher).
