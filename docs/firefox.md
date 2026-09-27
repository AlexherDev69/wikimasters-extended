# Firefox et Zen

Le même code, un second paquet. WXT construit les deux depuis `src/`, et
`wxt.config.ts` n'écrit que trois choses de plus quand la cible est Firefox :
l'identifiant de l'extension, la version minimale du navigateur et la
déclaration de ce qui sort de la machine.

Zen est un Firefox : tout ce qui suit s'y applique mot pour mot, y compris le
refus des extensions non signées.

## Ce que le paquet Firefox change

| | Chrome | Firefox |
| --- | --- | --- |
| Manifeste | V3 | V3 aussi, `manifestVersion: 3` dans la config, au lieu du V2 que WXT prend par défaut |
| Arrière-plan | `service_worker` | `background.scripts`, que Firefox exécute comme *event page* : il n'y a pas de service worker d'extension chez Mozilla |
| Identifiant | attribué par le store | `browser_specific_settings.gecko.id`, écrit à la main et définitif |
| Version minimale | aucune | `128.0` |
| Données | rien à déclarer | `data_collection_permissions`, obligatoire sur AMO depuis novembre 2025 |

Deux conséquences à garder en tête :

- **L'event page s'arrête**, exactement comme le service worker de Chrome. Le
  code ne tient déjà rien en mémoire entre deux messages : les caches sont dans
  `storage.local`. Rien à changer, mais rien à ajouter non plus qui suppose une
  page permanente.
- **Les permissions d'hôte sont révocables.** Depuis Firefox 127 elles sont
  demandées à l'installation et accordées avec elle, d'où le `128.0` ; mais
  l'utilisateur peut les retirer depuis `about:addons`, ce que Chrome ne permet
  pas. Dans ce cas les appels à Wikipédia et Wikidata échouent, et l'extension
  se comporte comme devant un hôte injoignable : les cartes restent celles du
  site.

`data_collection_permissions` déclare `websiteContent`, et non `none` : les
titres des cartes sont lus sur la page puis envoyés à `fr.wikipedia.org` et
`query.wikidata.org` pour y chercher une image, donc du contenu de site traité
hors du navigateur, ce que la politique de Mozilla demande d'annoncer. Rien
n'est collecté pour nous : il n'y a pas de serveur à nous, pas de télémétrie, et
les compteurs de la fenêtre ne quittent jamais `storage.local`.

## Construire

```bash
pnpm install
pnpm build:firefox   # .output/firefox-mv3/
pnpm zip:firefox     # les deux archives, voir plus bas
```

`pnpm dev:firefox` construit dans `.output/firefox-mv3-dev/` et reconstruit à
chaque modification. Aucun navigateur n'est ouvert automatiquement
(`webExt.disabled`), pour la même raison que côté Chrome : la vérification
Turnstile du site refuse les profils automatisés.

## Charger pour tester

1. Ouvrir `about:debugging#/runtime/this-firefox`
2. "Charger un module temporaire", et choisir
   `.output/firefox-mv3/manifest.json` — le fichier, pas le dossier
3. Ouvrir [wiki-masters.com](https://www.wiki-masters.com) : le mot "Extended"
   sous le nom du site dit qu'elle est chargée

C'est **temporaire** au sens strict : l'extension disparaît à la fermeture du
navigateur, et son `storage.local` avec elle. Après un `pnpm dev:firefox` qui
reconstruit, "Recharger" sur cette même page remet le nouveau build en place.

Les journaux de l'event page se lisent avec le bouton "Inspecter" de cette page ;
ceux du script de contenu dans la console de l'onglet (F12), préfixés par le nom
de l'extension.

## Installer pour de bon : la signature AMO

Firefox et Zen refusent une extension non signée en dehors du chargement
temporaire ci-dessus. `xpinstall.signatures.required` n'y change rien sur ces
deux navigateurs : le contournement n'existe que sur les builds Developer
Edition, Nightly et ESR. Pour une installation qui survit à un redémarrage, il
faut donc passer par Mozilla — mais sans fiche publique si tu n'en veux pas.

1. Créer un compte sur
   [addons.mozilla.org](https://addons.mozilla.org/developers/) (le même compte
   Mozilla que partout ailleurs).
2. `pnpm zip:firefox`. Deux fichiers apparaissent dans `.output/` :
   `wikimasters-extended-<version>-firefox.zip`, le paquet, et
   `wikimasters-extended-<version>-sources.zip`, les sources.
3. "Envoyer une nouvelle extension", puis choisir **"Sur votre propre serveur"**
   (*self-distribution*, le canal dit *unlisted*) : Mozilla signe le paquet et te
   le rend, sans page publique, sans capture à fournir, sans texte de fiche.
4. Envoyer le `-firefox.zip`. La validation automatique passe en quelques
   minutes.
5. Envoyer le `-sources.zip` quand le formulaire le demande : il le demande,
   parce que le paquet est produit par un bundler et que le code y est minifié.
   Le champ de notes attend les commandes exactes pour le refaire, à recopier
   tel quel :

   ```
   Node 22.12+, pnpm 10 (corepack enable pnpm)
   pnpm install --frozen-lockfile
   pnpm build:firefox
   Le paquet envoyé est le contenu de .output/firefox-mv3/
   ```

6. Télécharger le `.xpi` signé depuis la page de la version, puis l'installer
   dans Zen : `about:addons`, la roue dentée, "Installer un module depuis un
   fichier". Un glisser-déposer du `.xpi` dans la fenêtre marche aussi.

L'extension est alors installée comme n'importe quelle autre, et y reste.

### Mettre à jour

Le canal *self-distribution* ne met rien à jour tout seul : à chaque version, on
refait les étapes 2 à 6 et on installe le nouveau `.xpi` par-dessus. L'ancien est
remplacé sans perdre les réglages, tant que l'identifiant (`GECKO_ID` dans
`wxt.config.ts`) ne change pas — c'est lui qui fait que Firefox reconnaît la même
extension, et c'est la raison pour laquelle il est définitif.

Pour des mises à jour automatiques sans fiche publique, il faudrait ajouter un
`update_url` au manifeste et héberger le `updates.json` qui va avec, sur GitHub
Pages par exemple. Ce n'est pas fait ici : la fiche publique règle le même
problème en mieux.

### Passer en fiche publique plus tard

C'est prévu et ça ne casse rien. AMO accepte les deux canaux sur une même
extension : on garde l'identifiant, les versions déjà signées en
*self-distribution* restent où elles sont, et on envoie simplement une nouvelle
version dans le canal **"Sur ce site"**. Une seule contrainte, le numéro de
version doit être unique entre les deux canaux : si `0.1.3` est déjà partie en
*self-distribution*, la première version publique est `0.1.4`.

La fiche publique demande en plus une description, une catégorie, des captures et
une revue humaine. Les textes de [docs/store/fiche.md](store/fiche.md) et les
images de [docs/store/](store/README.md) sont écrits pour le Chrome Web Store,
mais la description, le résumé et les captures se réutilisent tels quels ; AMO
n'impose pas de taille de capture, donc les `1280x800` conviennent. Les
personnes qui avaient installé le `.xpi` signé passent alors aux mises à jour
automatiques d'AMO d'elles-mêmes.

## Ce qui se vérifie à la main

Le paquet se construit, les tests passent et aucun d'eux ne touche une API propre
à un navigateur. Restent trois endroits où Firefox et Chrome ne se comportent pas
forcément pareil, et qu'aucun test ne peut trancher :

- **Copier la carte.** Le bouton remet au presse-papiers une promesse d'image
  plutôt que l'image, pour que le dessin ne fasse pas expirer le geste de
  l'utilisateur. Firefox accepte `navigator.clipboard.write` avec un `image/png`
  depuis la version 126, mais sa fenêtre de geste est plus courte que celle de
  Chrome : si la copie échoue, le bouton le dit avec sa croix et la console porte
  le motif.
- **Les polices dans l'image copiée.** Elles sont relues du cache en
  `same-origin`. Firefox donne au script de contenu l'origine de la page, donc ce
  chemin y est au moins aussi permissif que dans Chrome ; une police absente du
  cache laisse sa règle de côté et le texte retombe sur la suivante.
- **La fenêtre et la page d'options.** Firefox dimensionne la fenêtre sur le
  `width: 384px` du `body` comme Chrome, et la page d'options s'affiche intégrée
  dans `about:addons` au lieu de `chrome://extensions`. Le thème sombre et la
  colonne unique ne supposent rien de l'un ni de l'autre, mais cela se regarde
  une fois.
