# Générateurs d'images

Les trois scripts qui dessinent les images du dépôt. Aucun n'est appelé par le
build ni par la CI : ils se lancent à la main, le jour où une image doit
changer, et leur résultat est versionné.

| Script | Écrit | Quand le relancer |
| --- | --- | --- |
| `make-icons.py` | `public/icon/{16,32,48,128}.png` | La marque de l'extension change |
| `make-promo.py` | `docs/store/{5-promo-440x280,6-promo-1400x560}.png` | La marque ou le texte des bannières change |
| `make-screenshots.py` | `docs/store/{1..4}-*.png` | De nouvelles captures du site sont prises |

`icon.py` n'est pas un script : c'est le dessin de la marque, un W à
empattements sur la tuile sombre avec le plus qui dit "Extended", importé par
les deux premiers pour qu'ils ne puissent pas la dessiner différemment.

## Prérequis

Python 3.11 ou supérieur et [Pillow](https://pypi.org/project/Pillow/) :

```bash
pip install Pillow
```

Les polices sont lues à des chemins Windows : Cambria Bold pour le W, Roboto
pour les bannières. Cambria est livrée avec Windows et avec Office ; Roboto
s'installe depuis Google Fonts. Changer de fonte change le dessin, donc une
icône se regénère avec la même, ou toutes les tailles se regénèrent d'un coup.

## Utilisation

```bash
python tools/make-icons.py
python tools/make-promo.py
python tools/make-screenshots.py <dossier des captures brutes>
```

Les captures brutes ne sont pas versionnées : elles montrent une collection
réelle et des pseudonymes réels, comme tout ce qui vit dans
`tests/fixtures/raw/`. Les zones rognées et pixelisées de `make-screenshots.py`
sont mesurées sur les captures du 21 septembre 2026, dans leurs pixels à elles :
un nouveau jeu de captures demande de les remesurer, pas de les réutiliser.

## Ce que le manifeste attend

WXT résout son dossier public depuis la racine du projet, jamais depuis
`srcDir` : `src/public/` n'est jamais copié, `public/` l'est. Il y trouve seul
les `<taille>.png` sous `icon/` et remplit le champ `icons` du manifeste, donc
rien de tout cela n'est déclaré dans `wxt.config.ts`.
