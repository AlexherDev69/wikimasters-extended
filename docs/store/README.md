# Visuels de la fiche Chrome Web Store

Les quatre captures de la fiche, au format exact que le store exige : 1280x800,
PNG 24 bits, sans canal alpha. L'autre taille acceptée est 640x400.

| Fichier | Ce qu'il met en avant |
| --- | --- |
| `1-statistiques-de-tirage.png` | Le panneau des raretés sous les paquets disponibles |
| `2-liens-wikipedia-letterboxd.png` | Le lien Letterboxd de la modale, et les deux marques sur la carte |
| `3-vue-compacte.png` | La page entière en vue compacte, pour montrer ce qui tient à l'écran |
| `4-cartes-des-echanges.png` | Les cartes dessinées à la place des noms tronqués des offres |

L'icône 128x128 que le formulaire demande en plus est
[`public/icon/128.png`](../../public/icon/128.png), le même fichier que celui du
manifeste.

## Ce qui est flouté

Les pseudonymes des autres joueurs, sur la capture des échanges, sont pixelisés.
Ce sont leurs données et non les nôtres, et une fiche publique n'est pas l'endroit
où les republier. Le floutage s'arrête avant le statut de l'offre ("Accepté",
"Refusé"), qui reste lisible.

Les captures d'origine, non retouchées, ne sont pas versionnées : elles montrent
une collection réelle, comme tout ce qui vit dans `tests/fixtures/raw/`.
