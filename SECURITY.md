# Politique de sécurité

## Versions suivies

Seul le dernier état de `main` est corrigé. Le projet ne publie pas de version
antérieure et ne rétroporte rien.

## Signaler une faille

Passe par le signalement privé de GitHub : onglet **Security** du dépôt, bouton
**Report a vulnerability**. N'ouvre pas d'issue publique pour une faille, et ne
la décris pas dans une pull request.

Une réponse est visée sous 7 jours. Le correctif part sur `main` avec le reste,
et le signalement est crédité dans la pull request sauf demande contraire.

## Ce qui compte comme une faille

L'extension s'exécute dans la page de wiki-masters.com, avec les permissions
`storage`, `fr.wikipedia.org` et `query.wikidata.org`. Sont des failles :

- une écriture de l'extension sur un élément du site (classe, attribut, style,
  texte, clic, saisie), parce qu'elle rompt l'invariant de lecture seule et
  expose le compte de l'utilisateur à un bannissement ;
- du contenu venu de Wikipédia ou de Wikidata exécuté comme du code dans la
  page, ou inséré autrement que comme du texte ;
- une donnée locale (réglages, cache, comptes de tirage) envoyée ailleurs que
  vers les deux hôtes Wikimedia déclarés ;
- une adresse construite à partir de données distantes qui sort de
  `commons.wikimedia.org`, `upload.wikimedia.org`, `thumb.wikimedia.org`,
  `fr.wikipedia.org`, `query.wikidata.org` ou `letterboxd.com` ;
- un élargissement des permissions du manifeste qui n'est pas justifié dans la
  pull request qui l'introduit.

## Hors périmètre

- Les failles du site wiki-masters.com lui-même : elles se signalent à ses
  auteurs, pas ici.
- Une carte mal classée, une image absente ou un lien Letterboxd qui ne mène
  nulle part : ce sont des bugs, une issue publique suffit.
- Les données publiques de Wikipédia, de Wikidata et de Wikimedia Commons.
