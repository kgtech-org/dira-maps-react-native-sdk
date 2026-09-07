# Dira Maps — SDK React Native

Client React Native de **Dira Maps** pour les applications Dira (livreur, client, marchand).

## La règle qui gouverne ce dépôt

**Dira Maps ne fournit aucune vue de carte, et ce paquet n'en exposera jamais.**

Dira Maps est un SIG web : ses clients (`maplibre-gl` + `react-dom`, QWC2/OpenLayers, back-office) sont des applications de navigateur, et son dépôt ne contient pas une occurrence de `react-native`. Rien n'y est embarquable dans React Native.

Ce qui traverse le fil jusqu'au mobile est **du JSON sur HTTP**. Le **fond de carte vient du composant natif du téléphone** — c'est d'ailleurs ce que fait la carte web de Dira Maps, qui pose ses données sur des tuiles OpenStreetMap, comme la console d'administration Dira Food et le simulateur de dira-tracking.

**Nuance à ne pas perdre** : le serveur QGIS publie de vraies données (`routes`, `batiments`, `points_interet`, importées d'OSM dans PostGIS), et `diraOverlayTemplate()` en donne l'URL de tuiles WMS. C'est une **surimpression**, jamais un fond : sans eau, occupation du sol, trait de côte ni étiquettes, et sur ≈ 2,6 km autour du centre-ville seulement. QWC2, le visualiseur de Dira Maps, configure lui-même un fond `mapnik` (OpenStreetMap) sous ces couches. Le nom de la fonction dit « overlay » exprès : c'est là que le malentendu se réintroduirait.

En conséquence, sont **hors périmètre définitif** : tout composant `<Map>`, toute `WebView` affichant un client Dira Maps, tout module natif de rendu. Une demande allant dans ce sens est un malentendu à dissiper, pas une fonctionnalité à livrer — le README ouvre là-dessus, et c'est délibéré.

## Périmètre

- Client typé des routes publiques : `POST /api/calc/route`, `GET /api/geocode`, `GET /api/geocode/reverse`.
- Primitives que toute application de carte Dira réécrirait sinon : conversion `[lng, lat]` ↔ `{ latitude, longitude }`, polylines encodées, erreurs classées par conduite à tenir.
- Règles d'usage encodées dans le code plutôt que répétées dans chaque écran : repli en segments droits **signalé**, une requête par tournée.

## Stack

TypeScript strict, **zéro dépendance à l'exécution**, `react` en dépendance de pair pour le seul hook. Tests `vitest` — tout est du TypeScript pur, aucun appareil ni simulateur requis.

```
src/
├── client.ts         # DiraMapsClient : HTTP, délais, erreurs typées
├── route-service.ts  # tournée : repli signalé + mémorisation
├── use-route.ts      # hook React
├── coords.ts         # LE seul endroit où l'ordre des coordonnées s'inverse
├── overlay.ts        # URL de tuiles WMS des couches Dira (SURIMPRESSION)
├── polyline.ts       # polylines encodées (précision 5)
├── errors.ts         # DiraMapsError, classée par conduite à tenir
└── types.ts          # LngLat (fil) vs LatLng (carte native), distincts exprès
```

## Invariants

- **`[lng, lat]` sur le fil, `{ latitude, longitude }` sur la carte.** Toute inversion passe par `coords.ts`. À Lomé (1.22 E, 6.14 N) une inversion est indétectable à l'œil et place le point au large de la Somalie : les deux types sont distincts pour que le compilateur la refuse.
- **`city` vient de l'API métier** (`delivery.city`), jamais d'une déduction locale. Les codes sont ceux des projets QGIS de Dira Maps : `lome`, `cotonou`, `abidjan`, `dakar`.
- **Un repli est toujours signalé** (`approximate: true`). Une ligne droite présentée comme un itinéraire ferait rouler quelqu'un dans un mur.
- **Une requête par tournée**, pas par position GPS. Les échecs ne sont pas mémorisés.
- **`lon` et non `lng`** sur `/geocode/reverse` — seule exception de la plateforme, normalisée par le client.
- **Aucune dépendance à l'exécution.** Chacune serait imposée à toutes les applications Dira.

## Conventions

- **Code, noms et commentaires en anglais** ; documentation en français, comme le reste de la plateforme.
- Tests sur le comportement, pas sur l'implémentation ; chaque test dit *pourquoi* la règle existe.
- Commits : Conventional Commits.

## Contexte

- `dira-maps` — le SIG. `backend/app/api/calc.py`, `geocode.py` pour les contrats servis ici.
- `.resources/specs/mobile/screens/08-driver.md` — l'usage de référence, parcours livreur.
- `dira-food-api` — sert `delivery.city` et `delivery.traveled_polyline`.
