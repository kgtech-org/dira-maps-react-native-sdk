# @kgtech-org/dira-maps-react-native

Client React Native de **Dira Maps** : itinéraires sur le réseau routier réel, géocodage, et les primitives de carte qui manquent toujours (conversion de coordonnées, polylines encodées).

---

## À lire en premier : Dira Maps n'a **aucune vue** à intégrer

Ce n'est pas une limitation de ce paquet, c'est ce qu'est Dira Maps. C'est un **SIG web**, et ses trois clients sont des applications de navigateur :

| Client | Technologie | Cible |
|---|---|---|
| `client/web` | `maplibre-gl` + `react-dom` | navigateur (canvas WebGL) |
| `client/qwc2` | QWC2 / OpenLayers | navigateur |
| `client/admin` | back-office TypeScript | navigateur |

Le dépôt Dira Maps ne contient **pas une occurrence de `react-native`**. `maplibre-gl` et `react-dom` se montent sur le DOM : ils ne peuvent pas s'exécuter dans une application React Native. Il n'existe ni composant embarquable, ni vue à réutiliser — et **ce paquet n'en exposera jamais**.

### N'affichez pas Dira Maps dans une `WebView`

C'est l'idée qui a l'air raisonnable et qui coûte cher. Cinq raisons cumulatives :

1. Ce qui s'afficherait est un **visualiseur SIG** — couches par ville, mesure, tracé, bascule 2D/3D — pas une vue de livraison.
2. La position de l'utilisateur et l'état de l'application vivent **côté natif** ; il faudrait les faire traverser un pont JavaScript à chaque battement GPS, pour obtenir ce que la carte native fait sans rien.
3. Un canvas WebGL plus le téléchargement des tuiles, **sur appareil d'entrée de gamme et réseau mobile**.
4. **Aucune histoire hors-ligne.** La carte native garde ses tuiles en cache ; une WebView repart de zéro à chaque perte de réseau — au pire moment.
5. Gestes, inertie, retour haptique : tout ce qui rend une carte utilisable d'une main est perdu.

### Et le « fond de carte Dira », alors ?

Nuance importante, parce que la question revient : le serveur QGIS de Dira Maps **publie bien des données cartographiques** — `occupation_sol`, `eau`, `batiments`, `routes`, `points_interet`, importées d'OpenStreetMap dans PostGIS, par ville. `diraTileTemplate()` en construit l'URL de tuiles, à poser sur la carte native.

Depuis la migration `0006` de Dira Maps, deux couches de **sol** s'ajoutent — `eau` et `occupation_sol` — et les rues portent leurs **étiquettes de nom**. Ces tuiles peuvent donc servir de fond à part entière, ce qui n'était pas vrai auparavant.

Deux conditions demeurent, et elles sont **opérationnelles, pas logicielles** :

- **Les données doivent avoir été réimportées** (`app.etl.import_osm`) et **les projets QGIS régénérés** (`build_project.py`). Sans cela, `occupation_sol` et `eau` sont vides et le rendu retombe sur un plan flottant qu'il faut poser sur un sol tiers.
- **L'emprise reste bornée à ce qui a été importé** : ≈ 13 km de côté par ville depuis l'élargissement, contre 2,6 km auparavant. Au-delà, la carte est **vide** — pas moins détaillée : vide.

En cas de doute, gardez le fond natif du téléphone : il est toujours correct, partout, et les couches Dira se posent dessus sans rien changer d'autre.

**Le cache de tuiles existe désormais côté serveur** (`GET /api/tiles/{ville}/{z}/{x}/{y}.png`) : chaque tuile est calculée une fois puis servie depuis Redis, et le client ne joint jamais QGIS Server. C'est `diraTileTemplate()` qu'il faut utiliser — `{z}/{x}/{y}` est compris par n'importe quel composant de carte, là où le WMS exige un composant spécialisé.

```tsx
<UrlTile urlTemplate={diraTileTemplate({ apiUrl: MAPS_URL, city: delivery.city })} />
```

`diraOverlayTemplate()` (WMS direct) reste pour les déploiements dont le backend ne sert pas encore `/api/tiles`. Les deux premières limites, elles, demeurent : ces couches ne font pas un fond, et l'emprise reste bornée à l'import — ≈ 13 km de côté depuis l'élargissement, contre 2,6 km auparavant.

### Le partage réel des rôles

**Le sol vient de la carte native du téléphone. Dira Maps fournit ce qu'on dessine dessus.**

Ce n'est pas un pis-aller : la carte web de Dira Maps fait exactement la même chose — elle pose ses données sur des tuiles OpenStreetMap. Son serveur QGIS publie des **couches thématiques par ville** (`dira_lome`, `dira_cotonou`, `dira_abidjan`, `dira_dakar`), jamais un fond de carte. Une application native avec le fond du système et le tracé de Dira Maps par-dessus **est** la carte Dira, dans la forme qui convient à un téléphone.

| Besoin | Qui le sert |
|---|---|
| Fond de carte | `expo-maps` / `react-native-maps` — **jamais** Dira Maps |
| Couches Dira en surimpression | **ce paquet** → `diraTileTemplate()`, avec les réserves ci-dessus |
| Tracé routier réel | **ce paquet** → `RouteService` |
| Adresse d'un point | **ce paquet** → `client.reverseGeocode()` |
| Position de l'utilisateur | GPS du téléphone |
| Guidage virage par virage | l'application de navigation du téléphone |

---

## Installation

Deux voies. Les versions publiées sont listées dans [CHANGELOG.md](CHANGELOG.md).

### Depuis GitHub Packages (recommandé)

Le paquet est publié sur le registre npm de GitHub à chaque tag `v*`.

**La lecture exige un jeton, même si le dépôt est public** — c'est une
contrainte de GitHub Packages, pas un choix de ce paquet. Créez un
[jeton personnel](https://github.com/settings/tokens) avec la seule portée
`read:packages`, puis, dans le `.npmrc` du projet consommateur :

```ini
@kgtech-org:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```sh
npm install @kgtech-org/dira-maps-react-native
```

Ne mettez pas le jeton en clair dans le `.npmrc` versionné : `${GITHUB_TOKEN}`
est résolu depuis l'environnement, ce qui marche aussi bien en local qu'en CI.

### Depuis git, sans jeton

Utile pour un essai rapide, ou si vous ne voulez pas gérer d'authentification.
**Épinglez un tag** :

```sh
npm install github:kgtech-org/dira-maps-react-native-sdk#v0.2.0
```

Sans le `#v0.2.0`, npm suit la branche par défaut : la version installée change
alors sans que rien ne le dise dans votre `package-lock.json`, et deux machines
de la même équipe peuvent compiler des paquets différents.

`dist/` n'étant pas versionné, npm compile le paquet à l'installation via son
script `prepare`. C'est vrai des deux voies.

Aucune dépendance à l'exécution. `react` est une dépendance de pair — requise, le hook étant réexporté par l'index.

### Compatibilité React Native

Le paquet est du **CommonJS** : Metro le charge sans configuration. Il n'utilise ni DOM, ni module natif, ni `URLSearchParams` (partiellement implémenté selon les versions de React Native), et ne s'appuie que sur `fetch` et `AbortController`, présents dans React Native depuis 0.60. Aucune étape de liaison native, aucun `pod install`.

## Prise en main

```tsx
import { DiraMapsClient, RouteService, toLatLng, useRoute } from '@kgtech-org/dira-maps-react-native'

const client = new DiraMapsClient({ baseUrl: process.env.EXPO_PUBLIC_MAPS_URL! })
const routes = new RouteService(client)

function DeliveryMap({ delivery }) {
  const { coordinates, approximate, loading } = useRoute(routes, {
    city: delivery.city,                       // servi par l'API, à ne pas deviner
    coordinates: [driverPosition, ...delivery.pickups.map((p) => p.geo), delivery.dropoff.geo],
  })

  return (
    <>
      <MapView>
        <Polyline coordinates={coordinates} />
        <Marker coordinate={toLatLng(delivery.dropoff.geo)} />
      </MapView>
      {approximate && <Banner>Itinéraire approximatif — tracé direct entre les étapes</Banner>}
      {loading && <Spinner />}
    </>
  )
}
```

`baseUrl` pointe la racine de l'API, par exemple `https://maps.dira.llc/api`. Elle doit être **configurable indépendamment** de l'API métier et du service de suivi : ce sont trois services déployables séparément.

## Ce que le paquet prend en charge pour vous

### La conversion de coordonnées

Toute la plateforme Dira parle **`[lng, lat]`** (ordre GeoJSON) ; les cartes mobiles parlent **`{ latitude, longitude }`**. `toLatLng` / `toLngLat` sont le seul endroit où l'inversion a lieu.

À Lomé — 1.22 E, 6.14 N — une inversion ne lève aucune erreur, ne déclenche aucun avertissement, et place le marqueur au large de la Somalie. Les types `LngLat` et `LatLng` sont distincts pour que le compilateur attrape ce que l'œil ne rattrape pas.

### Le repli, dit à voix haute

Quand aucun moteur de routage n'est configuré côté serveur (503), `RouteService` relie les étapes en **segments droits** et marque le résultat `approximate: true`. Affichez-le. Une ligne droite reste utile pour situer les étapes ; présentée comme un itinéraire, elle ferait rouler quelqu'un dans un mur.

### Une requête par tournée

`RouteService` mémorise par tournée — ville, mode et suite exacte des étapes. Le tracé ne change pas parce qu'on avance dessus ; l'API est limitée en débit et chaque appel non caché consomme le quota du moteur de routage. Les échecs, eux, ne sont **pas** mémorisés : une coupure passagère ne condamne pas la course.

### Les polylines encodées

`decodePolyline` / `encodePolyline` (algorithme Google, précision 5). Le parcours **réellement effectué** d'une course est figé sous cette forme par `dira-tracking` et servi dans `delivery.traveled_polyline` : sans décodeur, une application ne peut redessiner que ce qui était prévu.

### Les erreurs, classées par ce qu'il faut en faire

`DiraMapsError.kind` vaut `network`, `timeout`, `routing_unavailable`, `request` ou `server`. Un code HTTP nu ne dit pas s'il faut réessayer, se replier ou prévenir un exploitant ; `shouldFallBackToStraightLines` répond directement.

### Le paramètre `lon`

`GET /geocode/reverse` attend `lon` là où tout le reste de la plateforme écrit `lng`. Le client normalise : vous écrivez `lng` partout.

## API

| Export | Rôle |
|---|---|
| `DiraMapsClient` | `route`, `reverseGeocode`, `geocode` |
| `RouteService` | itinéraire d'une tournée, repli signalé, mémorisation |
| `useRoute(service, request \| null)` | hook React : `{ coordinates, approximate, loading, error }` |
| `toLatLng` · `toLngLat` · `toLatLngList` · `toLngLatList` | conversions d'ordre |
| `isValidLngLat` | garde-fou de bornes |
| `decodePolyline` · `encodePolyline` | polylines encodées |
| `diraTileTemplate` | URL de tuiles `{z}/{x}/{y}` mémoïsées — **voie recommandée** |
| `diraOverlayTemplate` | URL de tuiles WMS directes, sans cache — repli |
| `approximateRoute` · `tourKey` | repli et clé de mémorisation, exposés |
| `DiraMapsError` | erreur typée par conduite à tenir |

## Développement

```sh
npm install
npm test          # vitest
npm run typecheck
npm run build     # dist/
```

Les tests ne demandent ni appareil ni simulateur : tout le paquet est du TypeScript pur, ce qui est précisément ce que Dira Maps peut offrir à une application mobile.
