# Textes de la fiche Chrome Web Store

Ce que le formulaire demande, prêt à copier. Les captures et l'icône sont
décrites dans [README.md](README.md).

- **Titre** et **résumé** : repris du paquet, donc de `name` et `description`
  dans `wxt.config.ts`. Rien à saisir.
- **Catégorie** : Divertissement. L'extension ne sert que sur un site de jeu,
  c'est là que les gens la cherchent. "Outils" la noierait parmi les bloqueurs
  de publicité et les gestionnaires d'onglets.
- **Langue** : Français.
- **Icône du magasin** : [`public/icon/128.png`](../../public/icon/128.png).

## Description

```
WikiMasters Extended ajoute à wiki-masters.com ce que le site ne montre pas : une image sur les cartes qui n'en ont aucune, l'article de Wikipédia à un clic, le lien Letterboxd des films, et six autres choses.

Neuf réglages, tous débrayables depuis la fenêtre de l'extension ou sa page d'options, appliqués sans recharger les onglets déjà ouverts.

CE QUE L'EXTENSION AJOUTE

• Bouton Wikipédia : un bouton "W" sur chaque carte ouvre son article, sans passer par la modale de détail.
• Lien Letterboxd : un lien dans la modale et un logo sur la carte, pour les films, les studios et les personnalités du cinéma.
• Images manquantes : beaucoup de cartes n'ont pas d'illustration, et le site affiche son propre logo à la place. Quand Wikidata ou l'article de Wikipédia connaît une image, elle est posée par-dessus, avec son crédit (auteur et licence) dans la modale de détail.
• Cartes sur la page d'échange : les offres nomment les cartes dans des pastilles coupées au bout de quelques caractères. L'extension dessine la carte entière à la place, titre complet et image comprises.
• Vue compacte : un bouton réduit les cartes de la collection et du catalogue à deux tiers de leur taille, pour en voir environ deux fois plus à l'écran.
• Statistiques de tirage : la part de chaque rareté dans les cartes que tes paquets révèlent. Six nombres gardés sur ta machine, jamais le titre d'une carte.
• Masquer les statistiques des cartes : cache les valeurs ATK et DEF, sur les cartes et dans la modale. Désactivé par défaut.
• Pong pendant les chargements : une partie de Pong quand le site n'affiche que son rond qui tourne depuis plus de trois secondes.
• Son de notification : deux notes quand le compteur de la cloche du site augmente.

EN LECTURE SEULE, TOUJOURS

L'extension ne clique pas, ne scrolle pas, ne saisit rien, n'appelle aucune API du site et n'intercepte aucun trafic réseau. Elle ajoute uniquement ses propres éléments par-dessus la page et n'écrit jamais rien sur le site : ni classe, ni attribut, ni texte. Tout ce qu'elle ajoute disparaît quand elle est désactivée.

Les règles de wiki-masters.com interdisent tout outil qui joue, ouvre des paquets, échange ou interagit à votre place. Cette extension ne fait rien de tout cela.

CONFIDENTIALITÉ

• Ses seules requêtes partent vers fr.wikipedia.org et query.wikidata.org : des titres d'articles publics, et les noms des fichiers Wikimedia Commons dont l'adresse doit être résolue.
• Elles sont envoyées sans cookie, donc aucun compte n'est identifié.
• Rien n'est envoyé au site WikiMasters, à Letterboxd ni à aucun autre serveur.
• Aucune télémétrie, aucune analyse d'usage, aucune donnée personnelle collectée.
• Les réglages et les caches restent dans le stockage local de l'extension, sur votre machine. La page d'options affiche ce qui est stocké et permet de l'effacer.
• En désactivant les trois fonctionnalités qui consultent Wikidata, plus aucune requête ne part.

CODE OUVERT

Le code est public, sous licence MIT : https://github.com/AlexherDev69/wikimasters-extended

Projet indépendant, sans aucun lien avec wiki-masters.com, Wikipédia, Wikimedia, Wikidata ou Letterboxd.
```

## Onglet "Pratiques de confidentialité"

- **Objectif unique** : enrichir l'affichage des cartes de wiki-masters.com avec
  des données publiques de Wikipédia et Wikidata, en lecture seule.
- **`storage`** : enregistre les neuf réglages et le cache des résultats
  Wikidata et Wikipédia sur la machine de l'utilisateur. Rien n'en sort.
- **`fr.wikipedia.org`** : résout les titres des cartes en articles, récupère
  l'image de tête et l'adresse des fichiers Wikimedia Commons affichés sur les
  cartes sans illustration.
- **`query.wikidata.org`** : demande ce qu'est la carte (film, personne,
  studio) pour construire le lien Letterboxd et trouver une image.
- **Code exécuté à distance** : aucun. Tout le code est dans le paquet.
- **Collecte de données** : aucune catégorie à cocher.
- **Politique de confidentialité**, si une adresse est exigée : la section "Ce
  que l'extension respecte" du README, à
  `https://github.com/AlexherDev69/wikimasters-extended#ce-que-lextension-respecte`.
