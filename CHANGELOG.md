# Journal des versions

Les versions sont des **tags git** : ce paquet n'est pas publié sur npm et
s'installe depuis son dépôt (voir [README](README.md#installation)).

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
versions selon [SemVer](https://semver.org/lang/fr/).

## [0.4.1] — 2026-09-17

Docs et exemple seulement ; l'API du paquet est celle de 0.4.0.

### Modifié

- Docs : jour/nuit est **un état de l'application** — un bouton, un réglage,
  l'heure ; `useColorScheme()` n'est qu'une source parmi d'autres. Réécrit
  dans `integration-themes.md` (web et mobile), la spec RN et la spec Kotlin.
- Exemple : bouton « passer en nuit / en jour » ; le tracé survit au
  changement de style (forme redonnée à chaque `onDidFinishLoadingStyle`) ;
  l'accent de l'app remplace une couleur de routes grise ; marqueurs avec
  fond et bordure (`collapsable={false}`) ; `expo-system-ui`.

## [0.4.0] — 2026-09-17

Un thème Dira Maps a désormais **deux palettes**, jour et nuit ; c'est
l'application qui sait dans quel mode est l'écran, et qui le dit.

### Ajouté

- `diraStyleUrl({ colorScheme })` : `'light'` | `'dark'` — un état de l'app
  (bouton, réglage ; ou `useColorScheme()` tel quel pour suivre le téléphone ;
  `null`/`undefined` = l'apparence par défaut du thème, réglée dans le
  portail). L'URL porte `?apparence=clair|sombre` ; changer, c'est changer
  d'URL, et MapLibre recharge le style.
- Type `ColorScheme`.
- Banc d'essai : suit le mode du téléphone (`userInterfaceStyle: automatic`)
  et lit les deux palettes du thème de la clé ; préréglages `dira` et
  `classique`, chacun une paire.

### Modifié

- Docs : `integration-themes.md` (jour et nuit, web et mobile),
  `integration-react-native.md`, `integration-kotlin.md`
  (`?apparence=`, `isSystemInDarkTheme()`).

## [0.3.0] — 2026-09-15

Le portail des applications de Dira Maps existe : chaque application a un
**compte** et des **clés API**. Ce paquet les porte.

### Ajouté

- `DiraMapsClient({ apiKey })` : la clé de l'application, envoyée en
  `X-Api-Key` sur chaque appel. Optionnelle tant que Dira Maps accepte les
  appels anonymes — la transition douce côté serveur.
- `diraTileTemplate({ apiKey })` et `diraBasemapTemplate({ apiKey })` :
  la clé en `?key=` sur les gabarits (un gabarit n'a pas d'en-têtes).
- `diraStyleUrl({ siteUrl, apiKey })` : l'URL du **style MapLibre** de la
  clé — le fond de carte aux couleurs du thème réglé dans le portail. Pour les
  composants qui rendent en vecteur ; `react-native-maps` ne l'applique pas.
- `DiraMapsError` : deux conduites de plus. `auth` (401/403 : clé absente,
  révoquée, service désactivé) et `quota` (429, avec `retryAfterS`). Ni l'une
  ni l'autre ne conseille un repli en segments droits — ce sont des
  configurations à corriger, pas des pannes.
- Banc d'essai : le cache Redis est mesuré derrière un CDN (paramètre unique
  par requête) ; la surimpression WMS n'est plus qu'un avertissement — un
  déploiement peut légitimement ne pas exposer `/ows/`.
- Trois specs d'intégration écrites pour Claude Code, dans `docs/` :
  React Native, thèmes de carte (web et mobile), Android natif (Kotlin).
- Intégration continue : typecheck, tests, build ; exemple compilé et banc
  d'essai hors ligne.

### Modifié

- Villes desservies : `dakar`, `lome`, `conakry` (Abidjan et Cotonou retirées).
- L'exemple lit `EXPO_PUBLIC_MAPS_API_KEY`.

## [0.2.0] — 2026-09-07

Le paquet est désormais **publié sur GitHub Packages** à chaque tag `v*`.

### Changement de nom — action requise

`@kgtech/dira-maps-react-native` devient **`@kgtech-org/dira-maps-react-native`**.

Le registre npm de GitHub impose que le scope soit le **propriétaire du dépôt**
(`kgtech-org`). Sous `@kgtech`, la publication est refusée : ce n'est pas un
réglage, il n'y a pas de contournement. Le renommage est donc la condition pour
que le paquet soit publiable ailleurs que par git.

Si vous l'utilisiez déjà, changez le spécificateur d'import :

```diff
-import { useRoute } from '@kgtech/dira-maps-react-native'
+import { useRoute } from '@kgtech-org/dira-maps-react-native'
```

Aucune API ne change — mêmes quinze exports, même comportement.

### Ajouté

- Publication automatique sur `npm.pkg.github.com` au tag `v*`
  (`.github/workflows/publish-package.yml`). Le workflow **refuse de publier**
  si le tag ne correspond pas à la version du `package.json` : un numéro publié
  ne se réutilise jamais, la faute doit être arrêtée avant.
- `publishConfig.registry` dans le `package.json` : un `npm publish` lancé à la
  main ne peut plus partir par erreur sur le registre public npmjs.
- Section d'installation du README réécrite : registre (avec le jeton
  `read:packages` qu'exige GitHub Packages, **même sur un dépôt public**) ou
  git, au choix.

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

[0.3.0]: https://github.com/kgtech-org/dira-maps-react-native-sdk/releases/tag/v0.3.0
[0.2.0]: https://github.com/kgtech-org/dira-maps-react-native-sdk/releases/tag/v0.2.0
[0.1.0]: https://github.com/kgtech-org/dira-maps-react-native-sdk/releases/tag/v0.1.0
