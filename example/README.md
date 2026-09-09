# Banc d'essai du SDK Dira Maps

Une application Expo qui exerce **toutes** les fonctionnalités du SDK, et le même diagnostic en ligne de commande — sans appareil ni simulateur.

Son but n'est pas de faire une démonstration flatteuse : c'est de **dire ce qui marche et ce qui ne marche pas** sur un déploiement Dira Maps donné, et pourquoi c'est gênant.

## En ligne de commande

C'est la voie la plus rapide, et la seule utilisable en intégration continue.

```sh
cd example && npm install
npm run check                                        # contre https://maps.dira.llc/api
EXPO_PUBLIC_MAPS_URL=http://localhost:8080/api npm run check
npm run check:offline                                # vérifications pures seulement
```

Sortie type :

```
✓ Conversion de coordonnées
    Lomé converti et reconverti sans dérive
! Couverture du fond
    3/5 tuiles portent des données (tailles : 24310, 18022, 402, 402, 15660 o) — emprise d'import trop étroite
    en jeu : Hors de l'emprise importée la carte est VIDE, pas moins détaillée. …
```

Trois états, et la nuance compte : `✓` passe, `✗` échoue (code de sortie 1), **`!` avertit sans faire échouer** — « le moteur de routage n'est pas configuré » est un état de déploiement légitime, pas une régression. Faire échouer là-dessus rendrait le banc d'essai inutilisable en développement.

## Dans un navigateur

```sh
npm run web        # http://localhost:8081
```

Le diagnostic est **complet** sur le web : c'est la moitié qui répond à « ce déploiement fonctionne-t-il ? », et elle ne dépend d'aucune API native.

La carte, elle, ne s'y affiche pas — et c'est cohérent avec la règle du SDK plutôt qu'une lacune : le **sol** d'une carte Dira vient du composant natif du téléphone, or un navigateur n'en a pas à prêter et le SDK n'en fournit aucun. Le volet carte affiche donc ce que le SDK sait produire ici — le tracé, ses points, leur provenance — et dit franchement ce qui manque.

Les deux implémentations sont séparées **par extension de fichier** (`MapPane.tsx` / `MapPane.web.tsx`) : le bundler choisit, et `react-native-maps` n'entre jamais dans le bundle web, où son module natif échouerait à l'import.

## Sur un appareil

```sh
npm start          # puis « a » (Android), « i » (iOS), ou scanner le QR code
```

**Scanner le QR code avec un téléphone est le chemin le plus court** vers la carte complète — il n'exige ni Xcode ni émulateur.

⚠️ **Sur Android, le sol natif ne s'affiche pas dans Expo Go.** La carte de
`react-native-maps` s'y appuie sur le SDK Google Maps, dont la clé embarquée dans Expo Go est
refusée (`Authorization failure` dans `adb logcat`) : la surface ne démarre pas et ne demande même
pas ses tuiles. Le voir exige un *dev build* portant votre propre clé
(`android.config.googleMaps.apiKey`). Plutôt que d'afficher un rectangle vide qui se lirait comme
« Dira ne renvoie rien », le volet bascule alors sur les **tuiles Dira seules**.

Ce repli ne porte aucun bandeau : la carte s'affiche vraiment, et la seule limite qui compte —
**hors de l'emprise importée, elle est blanche** — est déjà mesurée et chiffrée par la vérification
« Couverture du fond », juste en dessous. La dire deux fois l'aurait affaiblie. Ce qu'on perd
vraiment sans le sol natif : l'emprise mondiale, le déplacement et le zoom, et la fraîcheur d'une
cartographie mise à jour en continu.

L'écran a deux moitiés. **En haut**, une carte qui montre le partage des rôles du SDK : le **sol**
vient du composant natif, les couches Dira se posent dessus en tuiles, et le tracé vient de
`/api/calc/route`. Voir les trois superposés vaut mieux qu'un paragraphe de documentation. **En
bas**, le même diagnostic, exécuté depuis l'appareil — c'est là que se voient les choses qu'aucun
émulateur ne reproduit : un réseau mobile lent, un proxy d'entreprise, un certificat refusé.

Depuis que les tuiles Dira portent le sol et l'eau (migration `0006`), elles se suffisent à faire
une carte. `EXPO_PUBLIC_MAPS_NATIVE_GROUND=0` les affiche **seules**, sans aucun fond tiers : c'est
la façon de regarder ce que Dira sert vraiment, sans le sol d'un autre en dessous pour boucher les
trous.

Un repli en segments droits apparaît **en pointillé** sur la carte, pas seulement dans un bandeau : ainsi il ne peut pas se faire passer pour un itinéraire.

## Ce qui est vérifié

| Vérification | Ce que casserait un échec |
|---|---|
| Conversion de coordonnées | un marqueur au large de la Somalie, sans erreur levée |
| Polylines encodées | on n'afficherait que le parcours *prévu*, jamais le réel |
| Clé de tournée | l'itinéraire d'une course servi pour une autre |
| Itinéraire routier | des segments droits au lieu de la voirie |
| Mémoïsation de l'itinéraire | le quota du moteur de routage épuisé |
| Géocodage inverse / recherche | pas d'adresse lisible sur un point |
| Tuiles mémoïsées | QGIS rastérise à chaque déplacement de carte |
| **Couverture du fond** | **hors emprise, la carte est vide — pas moins détaillée : vide** |
| Surimpression WMS | le repli est indisponible |
| Erreurs typées | on réessaie une panne qu'il fallait contourner, ou l'inverse |

La couverture du fond est la plus utile après un import : elle échantillonne une croix de tuiles autour du centre-ville et compte celles qui portent des données. L'heuristique est assumée — une tuile sans donnée est un PNG transparent, donc minuscule — et ne prétend pas mesurer la richesse du rendu, seulement distinguer « il y a quelque chose » de « il n'y a rien ».

## Configuration

| Variable | Défaut | Rôle |
|---|---|---|
| `EXPO_PUBLIC_MAPS_URL` | `https://maps.dira.llc/api` | racine de l'API |
| `EXPO_PUBLIC_MAPS_SITE_URL` | `https://maps.dira.llc` | racine du site, pour `/ows/` |
| `EXPO_PUBLIC_MAPS_CITY` | `lome` | ville testée |
| `EXPO_PUBLIC_MAPS_LNG` / `_LAT` | Lomé | centre de la ville testée |
| `EXPO_PUBLIC_MAPS_NATIVE_GROUND` | `1` | `0` = tuiles Dira seules, sans le sol du composant natif |

Les deux premières sont **distinctes** : le serveur QGIS est servi sous `/ows/`, hors de l'API. Les confondre donne des 404 silencieux et une carte simplement vide.

## Structure

```
example/
├── App.tsx            # carte + diagnostic
├── metro.config.js    # suit le lien symbolique vers le SDK du dossier parent
├── index.ts
└── src/
    ├── MapPane.tsx      # carte native (react-native-maps)
    ├── MapPane.web.tsx  # son pendant web : pas de carte, et on le dit
    ├── TileGrid.tsx     # repli : les tuiles Dira posées à la main, sans Google
    ├── MapPane.types.ts # le contrat commun aux deux
    ├── checks.ts        # les vérifications — SANS React ni React Native
    ├── cli.ts           # le même diagnostic, sans interface
    ├── config.ts        # cibles, depuis l'environnement
    └── tile-math.ts     # [lng, lat] → z/x/y, pour savoir quelle tuile demander
```

⚠️ Ne pas ajouter de `src/MapPane.ts` : il court-circuiterait le choix par plateforme et ferait entrer `react-native-maps` dans le bundle web.

`checks.ts` ne dépend ni de React ni de React Native : c'est ce qui permet au même code de tourner sur l'appareil et dans un terminal. Une divergence entre les deux ferait douter des deux.
