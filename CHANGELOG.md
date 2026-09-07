# Journal des versions

Les versions sont des **tags git** : ce paquet n'est pas publié sur npm et
s'installe depuis son dépôt (voir [README](README.md#installation)).

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
versions selon [SemVer](https://semver.org/lang/fr/).

## [0.1.0] — 2026-09-07

Première version. Le SDK rend des **données** à poser sur la carte native de
l'application : Dira Maps est un SIG web et n'expose aucune vue à intégrer —
c'est expliqué en tête du README, avec les raisons de ne pas passer par une
`WebView`.

### Ajouté

- **`DiraMapsClient`** — client HTTP de Dira Maps : délais d'attente,
  annulation (`AbortController`) et erreurs typées (`DiraMapsError`).
- **`RouteService` et `useRoute`** — itinéraires sur le réseau routier réel,
  et le hook React correspondant. `approximateRoute` sert de repli quand le
  service ne répond pas : une distance à vol d'oiseau vaut mieux qu'un écran
  vide.
- **Primitives de coordonnées** — `toLatLng` / `toLngLat`, leurs variantes de
  liste (`toLatLngList` / `toLngLatList`) et `isValidLngLat`. Elles existent parce que l'inversion `[lng, lat]` ↔ `{latitude,
  longitude}` est la faute la plus fréquente entre un backend GeoJSON et un
  composant de carte, et qu'elle place les points au mauvais endroit sans
  jamais lever d'erreur.
- **`encodePolyline` / `decodePolyline`** — polylines encodées Google, le
  format dans lequel les itinéraires voyagent.
- **`diraTileTemplate`** — gabarit `{z}/{x}/{y}` des tuiles Dira mémoïsées
  (`GET /api/tiles/{ville}/{z}/{x}/{y}.png`). **Voie recommandée** : les
  tuiles sont calculées une fois puis servies depuis Redis, et le format est
  compris par n'importe quel composant de carte.
- **`diraOverlayTemplate`** — gabarit WMS équivalent, conservé pour les
  déploiements dont le backend ne sert pas encore `/api/tiles`. Il frappe QGIS
  Server à chaque image et exige un composant WMS.
- **`tourKey`** — clé stable d'une tournée, pour mémoïser un itinéraire.

### À savoir avant d'intégrer

- Les couches Dira sont une **surimpression**, pas un fond de carte. Depuis la
  migration 0006 de dira-maps (sol, eau, étiquettes de rue) elles *peuvent*
  servir de fond, à deux conditions opérationnelles : données réimportées et
  projets QGIS régénérés. En cas de doute, gardez le fond natif du téléphone —
  il est correct partout, et les couches Dira se posent dessus.
- L'emprise reste **bornée à ce qui a été importé**, ≈ 13 km de côté par ville.
  Au-delà, la carte est **vide** — pas moins détaillée.
- Le paquet est du **CommonJS**, sans dépendance à l'exécution ni module
  natif : Metro le charge sans configuration, et il n'y a ni liaison native ni
  `pod install`.

[0.1.0]: https://github.com/kgtech-org/dira-maps-react-native-sdk/releases/tag/v0.1.0
