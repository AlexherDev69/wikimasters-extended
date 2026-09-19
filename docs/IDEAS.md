# Extension Chrome WikiMasters, idées validées

Fichier de suivi. Seules les idées validées sont listées ici, par ordre de priorité.
Analyse de faisabilité et plan : voir [PLAN.md](PLAN.md).

## 1. Catégorisation automatique des cartes

Classer automatiquement chaque carte obtenue selon le type d'article dont elle vient.

- Source : entité Wikidata de l'article, propriété P31 (nature de l'élément) principalement
- Types visés : personne, film, commune, espèce, monument, oeuvre, évènement, etc.
- Sous-typage possible pour les personnes : acteur, réalisateur, sportif, politique, scientifique (P106, occupation)
- Usage : filtres et tri dans la collection, regroupements par thème, taux de complétion par catégorie
- Mise en cache locale du mapping article vers catégorie, il ne bouge quasiment jamais

Statut : faisable, pipeline Wikidata validé par des mesures réelles (2026-09-20). La partie "filtres dans la collection" dépend de la structure des pages connectées, pas encore analysées.

## 2. Lien Letterboxd sur les cartes liées au cinéma

Quand la carte correspond à un film, un acteur, un réalisateur ou assimilé, afficher un lien direct vers la fiche Letterboxd correspondante.

- Dépend de l'étape 1 pour détecter que la carte est bien cinéma
- Résolution du lien : identifiant Letterboxd présent dans Wikidata quand il existe, sinon fallback sur l'URL de recherche Letterboxd
- Affichage : petit bouton ou icône sur la carte, ouverture dans un nouvel onglet

Statut : faisable, formats d'URL vérifiés (2026-09-20). Fallback supplémentaire trouvé : redirection Letterboxd par ID IMDb ou TMDb.

## À trancher plus tard

- Périmètre : extension Manifest V3 ou userscript Tampermonkey pour la première version
  - Recommandation : Manifest V3 directement (voir PLAN.md, section Décisions)
- Où s'affiche l'overlay : sur wiki-masters.com uniquement, ou aussi sur fr.wikipedia.org
  - Recommandation : wiki-masters.com uniquement en v1
