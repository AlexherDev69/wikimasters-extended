# WikiMasters Extended

Extension Chrome (Manifest V3) en lecture seule pour [wiki-masters.com](https://www.wiki-masters.com).

Objectif : afficher sur chaque carte une catégorie (via Wikidata) et un lien Letterboxd pour les films et personnalités du cinéma. Elle ne clique jamais, ne scrolle pas, ne saisit rien et n'intercepte aucun trafic réseau.

État actuel (phase 1) : socle du projet et détection des cartes. L'extension se charge sur le site et journalise le nombre de cartes présentes au chargement de la page. Le suivi des cartes qui arrivent ensuite (rendu React, pagination) relève de la phase 2.

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

Les journaux apparaissent dans la console de la page (F12) avec le préfixe de l'extension. En développement, tous les niveaux sont affichés. En production, seuls `warn` et `error` le sont : le message "Cards detected" n'est donc visible qu'avec `pnpm dev`.

## Contrainte fondamentale

Cette extension est un overlay en lecture seule. Elle ne clique jamais, ne scrolle pas, ne saisit rien, n'intercepte pas le trafic réseau et n'appelle pas les API du site. Tout contournement de cette règle expose au bannissement du compte.
