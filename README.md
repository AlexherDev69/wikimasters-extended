# WikiMasters Extended

Extension Chrome (Manifest V3) qui enrichit [wiki-masters.com](https://www.wiki-masters.com),
où chaque carte à collectionner est un article de Wikipédia.

Elle ajoute uniquement ses propres éléments par-dessus la page : elle ne clique
pas, ne scrolle pas, ne saisit rien et n'écrit jamais rien sur le site.

## Installation

Elle est sur le Chrome Web Store :
**[WikiMasters Extended](https://chromewebstore.google.com/detail/wikimasters-extended/ikoohipceahjbaheacljepkfaeelhbpj)**, un bouton et rien d'autre. Chrome la
tient à jour tout seul.

Ouvre ensuite [wiki-masters.com](https://www.wiki-masters.com) : le mot
"Extended" sous le nom du site dit qu'elle est bien chargée.

### Sans passer par le store

L'archive de chaque version est jointe à sa release, pour qui préfère voir ce
qu'il installe, ou veut une version qui n'est pas la dernière. Le chargement
est alors manuel, et Chrome ne met plus rien à jour.

1. Télécharger le fichier `.zip` de la
   [dernière release](https://github.com/AlexherDev69/wikimasters-extended/releases/latest)
2. Le décompresser dans un dossier que tu gardes : Chrome le relit à chaque
   démarrage, donc supprimer ce dossier désinstalle l'extension
3. Ouvrir `chrome://extensions` et activer le "Mode développeur", en haut à droite
4. Cliquer sur "Charger l'extension non empaquetée" et sélectionner le dossier
   décompressé

Pour mettre à jour : retélécharger, remplacer le contenu du dossier, puis
cliquer sur la flèche de rechargement de l'extension dans `chrome://extensions`.

N'installe pas les deux en même temps. Chacune poserait ses noeuds sur la même
page, et chacune reconnaît les siens à un attribut qui ne dit pas de laquelle
il vient.

## Fonctionnalités

Onze réglages, tous activables depuis la popup de la barre d'outils ou la page
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
| Carte en plein écran | Un bouton à côté de la carte de la modale l'affiche en plein écran, agrandie à la taille de l'écran |
| Copier la carte | Un bouton à côté de la carte de la modale la copie en image dans le presse-papiers, prête à coller |
| Pong pendant les chargements | Une partie de Pong quand le site n'affiche que son rond qui tourne depuis plus de trois secondes |
| Son de notification | Deux notes quand le compteur de la cloche du site augmente |

S'y ajoute la signature de l'extension, sans réglage : le mot "Extended" écrit
sous le nom du site, partout où le site écrit son nom.

## Ce que l'extension respecte

**Les [règles du site](https://www.wiki-masters.com/rules).**
Elles interdisent "tout outil visant à jouer, ouvrir des
paquets, échanger ou interagir à votre place", sous peine de bannissement sans
préavis. L'extension est un overlay en lecture seule : aucune classe, aucun
attribut, aucun style et aucun texte n'est posé sur un élément du site, aucune
API du site n'est appelée, aucun trafic réseau n'est intercepté. Trois options
(masquer les statistiques, vue compacte, carte en plein écran) changent bien le
rendu du site, mais par une feuille de style qui appartient à l'extension et vit
dans l'en-tête de la page : le document que le site a construit reste intact.
Le plein écran passe par le navigateur, qui agrandit la carte que le site
affiche déjà. Tout ce que
l'extension ajoute disparaît quand elle est désactivée.

**Les licences de Wikimedia.** Seuls les fichiers hébergés par Wikimedia Commons
sont affichés, jamais ceux que Wikipédia héberge sous son exception de droit
d'auteur. Chaque image posée par l'extension mène à la page de son fichier, où
figurent son auteur et sa licence : par la ligne de crédit de la modale de
détail pour les cartes du site, par la marque dans le coin de l'image pour les
cartes dessinées sur la page des échanges, qui n'ouvrent aucune modale. Les
données de Wikidata sont sous CC0.

**Ta vie privée.** Les seules requêtes de l'extension partent vers deux hôtes.
`fr.wikipedia.org` reçoit les titres publics des articles, puis les noms des
fichiers Commons dont l'adresse doit être résolue ; `query.wikidata.org` ne
reçoit que l'identifiant Wikidata de la carte, jamais son titre. Elles sont
envoyées sans cookie (`credentials: 'omit'`), donc aucun compte n'est identifié.
Les images, elles, sont chargées par ton navigateur depuis les serveurs de
Wikimedia, sans référent (`referrerpolicy="no-referrer"`) : ils reçoivent une
demande de fichier, jamais la page qui l'affiche. Copier une carte dessine son
image à partir de ce que la page affiche déjà : les polices sont relues dans le
cache du navigateur et nulle part ailleurs, les images dans ce cache aussi, et
une image qui n'y serait plus est redemandée, sans cookie, là où la page l'avait
prise. Rien n'est envoyé au site, à
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
| Framework | [WXT](https://wxt.dev) 0.21 (Manifest V3) |
| Dépendance à l'exécution | [html-to-image](https://github.com/bubkoo/html-to-image) (MIT), la seule, pour copier une carte en image |
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

### Tester à côté d'une version déjà installée

Le build de développement s'appelle `WikiMasters Extended (dev)` et se charge
depuis un autre dossier, donc Chrome lui donne une identité à lui. Les deux
tiennent ensemble dans `chrome://extensions`, sans rien désinstaller.

Ne les laisse pas tourner en même temps pour autant. Les deux poseraient leurs
noeuds sur la même page, et chacune reconnaît les siens à un attribut
`data-wme-*` qui ne dit pas de laquelle il vient. Chaque copie a en plus son
propre `chrome.storage.local`, donc celle de développement démarre avec les
réglages par défaut : c'est exactement le cas où les deux ne sont pas d'accord.

Le plus simple est de **désactiver** l'installée avec son interrupteur dans
`chrome://extensions`, au lieu de la désinstaller. Désactiver garde son
stockage ; désinstaller l'efface, réglages, caches et compteur de tirage
compris. Tu la réactives quand tu as fini.

Pour avoir les deux en même temps, utilise un profil Chrome séparé et ne
charge que celle de développement dedans. Crée-le depuis Chrome et pas avec un
outil : la vérification Turnstile du site refuse les profils automatisés, ce
qui est aussi la raison de `webExt.disabled` dans `wxt.config.ts`.

Le build de développement pose en bas à gauche de la page un bouton
`Pong : lancer`. Il ne lance pas la partie lui-même : il fait croire à
l'extension que la page charge, et la suite est la vraie. La patience de trois
secondes court quand même, le réglage Pong doit être activé, et un second appui
range la partie par le même chemin qu'une page qui finit par répondre. Ce
bouton n'existe que là : il est monté derrière `import.meta.env.DEV`, que Vite
remplace par `false` au build, et le paquet de production ne contient ni son
code ni son style.

Une release se publie à la main : `pnpm zip`, puis le tag et l'archive
`.output/wikimasters-extended-<version>-chrome.zip` jointe à la release GitHub.
La même archive part ensuite sur le tableau de bord du Chrome Web Store, avec
la description de [docs/store/fiche.md](docs/store/fiche.md) et les captures
de `docs/store/` quand elles ont changé, puis "Envoyer pour examen" : Chrome ne
met les joueurs à jour qu'une fois l'examen de Google passé. Rien dans la CI
ne le fait à ta place.

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
- [docs/store/fiche.md](docs/store/fiche.md) : les textes de la fiche du
  Chrome Web Store, prêts à coller dans son formulaire
- [tools/README.md](tools/README.md) : les scripts qui dessinent l'icône, les
  bannières et les captures de la fiche du store

## Mot du dev

Je développe des extensions et des applications par passion, sur mon temps
libre. Si celle-ci te sert, tu peux retrouver mes autres projets et me soutenir
sur [ko-fi.com/alexher](https://ko-fi.com/alexher).
