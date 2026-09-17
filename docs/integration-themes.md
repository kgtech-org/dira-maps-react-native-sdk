# Intégrer les thèmes de carte Dira Maps — spec pour les frontends

*Pour les équipes web et mobile qui affichent une carte Dira. À déposer dans le dépôt de l'application
et à donner à Claude Code : « Applique le thème Dira Maps en suivant ce document ». Chaque tâche a un
critère d'acceptation.*

---

## 0. Ce qu'est un thème, et ce qu'il n'est pas

Un **thème** est réglé dans le portail Dira Maps (`/admin/` → Thèmes) par le compte de l'application :
**deux palettes**, jour (`clair`) et nuit (`sombre`), de six valeurs chacune — fond, et cinq couleurs
(routes, eau, bâti, sol, libellés). Il est **assigné à une clé API**. Le serveur en dérive un **style
MapLibre** complet par apparence, servi à :

```
GET {site}/api/styles/{clé}.json?apparence=clair|sombre
```

**C'est l'application qui choisit** jour ou nuit, et qui le dit dans l'URL — un bouton, un réglage
de l'utilisateur, l'heure, ou le mode du téléphone si elle le veut : `apparence` est un état de
l'app, pas une lecture du système. Changer d'apparence, c'est changer d'URL de style ; la carte
bascule sans redémarrer. Sans `apparence`, le thème rend son **apparence par défaut** (réglée dans
le portail ; `dira` est de nuit par défaut). Le style porte `metadata["dira:apparence"]` et
`metadata["dira:palette"]`.

Ce style décrit comment dessiner le **fond de carte vectoriel** de Dira (`/basemap/data/v3/…`,
schéma OpenMapTiles, tuiles Sénégal – Togo – Guinée). Le rendu se fait **côté client**, par MapLibre.
Le serveur ne rastérise rien de plus : les tuiles restent les mêmes pour tout le monde, seule la
feuille de style change.

Trois conséquences à garder en tête :

1. **Le thème s'applique au fond, pas aux couches métier.** Les tuiles Dira (`/api/tiles/…` : bâti,
   voirie, eau, sol importés d'OSM) sont des PNG rastérisés par QGIS ; leur apparence est celle des
   projets QGIS, pas du thème. On les superpose au fond thémé.
2. **Il faut un moteur MapLibre.** Sur le web, `maplibre-gl`. Sur mobile, `@maplibre/maplibre-react-native`.
   **`react-native-maps` (Google/Apple) ne peut pas appliquer un style MapLibre** — pour lui, le thème n'a
   pas d'effet ; on garde le fond natif ou le fond raster Dira (`/basemap/styles/…`).
3. **Le fond Dira ne couvre que ≈ 13 km autour de chaque ville desservie** ; hors de là il est vide —
   pas moins détaillé, vide. Une application qui peut sortir de l'emprise garde un repli (voir §4).

## 1. Règles

1. **La clé vient de la configuration** de l'app (`EXPO_PUBLIC_MAPS_API_KEY`, `VITE_MAPS_API_KEY`…),
   jamais d'une constante dans le code. Le style est **le sien** : changer de clé change de thème.
2. **Ne pas reconstruire le style côté client.** L'URL suffit ; la palette, les couches, les polices
   viennent du serveur. Modifier le thème dans le portail doit se voir dans l'app **sans redéploiement**
   (le style est mis en cache 5 minutes).
3. **Ne pas copier le JSON du style dans le dépôt.** Il changerait à chaque réglage du portail.
4. **Une seule origine.** Les URL du style sont relatives à son origine quand l'app est servie par le
   même site (la carte web de Dira), absolues (`https://maps.dira.llc/…`) sinon. Ne pas les réécrire.
5. **Attribution** : « © OpenMapTiles © OpenStreetMap contributors » — déjà dans le style
   (`sources.openmaptiles.attribution`) ; laisser MapLibre l'afficher.

## 2. Configuration

| variable | valeur en production | rôle |
|---|---|---|
| `MAPS_SITE_URL` | `https://maps.dira.llc` | racine du **site** — style et fond |
| `MAPS_API_URL` | `https://maps.dira.llc/api` | racine de l'**API** — tuiles Dira, itinéraires |
| `MAPS_API_KEY` | `dira_live_…` | la clé de l'application, avec un thème assigné dans le portail |

## 3. Tâches

### Tâche 1 — Assigner un thème à la clé (portail)

Dans `/admin/` avec un utilisateur du compte : **Thèmes** → créer ou copier un préréglage (`dira`,
`classique`), ajuster les couleurs des deux volets, **Jour** et **Nuit** — chaque aperçu suit en
direct ; « Dériver du jour / de la nuit » calcule l'autre côté depuis celui qu'on a réglé (même
teinte, luminosité du rôle sur l'autre fond) —, choisir l'**apparence par défaut**, enregistrer.
Un volet jamais réglé reste « dérivé » : il suit l'autre. **Clés** → colonne Thème → choisir le
thème. Sans thème assigné, la clé sert le préréglage `dira`.

**Acceptation** : `curl "$MAPS_SITE_URL/api/styles/$MAPS_API_KEY.json?apparence=sombre"` rend un
JSON avec `"name": "Dira — <nom du thème>"`, `metadata["dira:apparence"] == "sombre"` et
`layers[0].paint.background-color` = la couleur de sol de la palette de nuit ; `?apparence=clair`,
celle de jour. `404` = clé inconnue ou révoquée ; `403` = service `fond` désactivé pour cette clé ;
`422` = apparence autre que `clair`/`sombre`.

### Tâche 2 — Web (`maplibre-gl`)

```ts
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { diraStyleUrl } from "@kgtech-org/dira-maps-react-native"; // fonctionne aussi sur le web
// ou, sans le SDK : `${MAPS_SITE_URL}/api/styles/${MAPS_API_KEY}.json`

// Jour ou nuit : l'état de VOTRE app (un bouton, un réglage). Basculer, c'est
// `map.setStyle(styleUrl("dark"))` — la carte se redessine, rien à recolorer.
// (Pour suivre le navigateur à la place : `matchMedia("(prefers-color-scheme: dark)")`.)
const styleUrl = (colorScheme: "light" | "dark") =>
  diraStyleUrl({ siteUrl: MAPS_SITE_URL, apiKey: MAPS_API_KEY, colorScheme });

const map = new maplibregl.Map({
  container: "map",
  style: styleUrl("light"),
  center: [1.2228, 6.1319], // Lomé, [lng, lat]
  zoom: 13,
});

// Les couches Dira (bâti, voirie, eau, sol de QGIS) par-dessus le fond thémé :
map.on("load", () => {
  map.addSource("dira", {
    type: "raster",
    tiles: [`${MAPS_API_URL}/tiles/lome/{z}/{x}/{y}.png?key=${MAPS_API_KEY}`],
    tileSize: 256,
    maxzoom: 19,
  });
  map.addLayer({ id: "dira", type: "raster", source: "dira" });
});
```

Changer de thème à chaud (par exemple un mode nuit qui bascule sur une autre clé) :
`map.setStyle(nouvelleUrl)` — puis ré-ajouter les sources et couches métier dans `on("style.load")`,
MapLibre les jette avec l'ancien style.

**Acceptation** : la carte affiche Lomé aux couleurs du thème ; changer une couleur dans le portail
et recharger la page (après 5 min, ou avec un cache-buster `?v=…` sur l'URL du style) la change.

### Tâche 3 — Mobile, avec MapLibre (`@maplibre/maplibre-react-native`)

```tsx
import { useState } from "react";
import { MapView, RasterSource, RasterLayer, Camera } from "@maplibre/maplibre-react-native";
import { diraStyleUrl, diraTileTemplate } from "@kgtech-org/dira-maps-react-native";

// Jour ou nuit : un état de VOTRE app — un bouton, un réglage de l'utilisateur.
// Quand il change, l'URL change, et MapLibre recharge le style — rien à recolorer.
// (`useColorScheme()` de react-native rend la même chose si vous préférez suivre le téléphone.)
const [colorScheme, setColorScheme] = useState<"light" | "dark">("light");

<MapView style={{ flex: 1 }} mapStyle={diraStyleUrl({ siteUrl: MAPS_SITE_URL, apiKey: MAPS_API_KEY, colorScheme })}>
  <Camera centerCoordinate={[1.2228, 6.1319]} zoomLevel={13} />
  <RasterSource
    id="dira"
    tileUrlTemplates={[diraTileTemplate({ apiUrl: MAPS_API_URL, city: delivery.city, apiKey: MAPS_API_KEY })]}
    tileSize={256}
  >
    <RasterLayer id="dira" sourceID="dira" />
  </RasterSource>
  {/* itinéraire, marqueurs : ShapeSource + LineLayer, coordonnées en [lng, lat] — c'est du GeoJSON */}
</MapView>
```

Attention aux coordonnées : MapLibre parle en **`[lng, lat]`** (GeoJSON) comme l'API Dira — ici, pas
de `toLatLng`. C'est `react-native-maps` qui veut `{ latitude, longitude }`.

**Acceptation** : la carte affiche Lomé aux couleurs du thème sur l'appareil ; le bâti Dira apparaît
au zoom 15+.

### Tâche 4 — Mobile, avec `react-native-maps` (pas de thème)

Le thème ne s'applique pas. Deux choix, à faire consciemment :

- **fond natif** (Google/Apple) + tuiles Dira par-dessus : `<UrlTile urlTemplate={diraTileTemplate(…)} />` —
  la voie décrite dans `integration-react-native.md`. Correct partout, y compris hors emprise.
- **fond raster Dira** : `<UrlTile urlTemplate={diraBasemapTemplate({ siteUrl, apiKey })} />` sous les
  tuiles Dira, avec `mapType="none"` sur Android. Couleurs fixes (celles du style `basic-preview`),
  pas celles du thème.

Vouloir le thème sur mobile, c'est passer à MapLibre (tâche 3). Ce n'est pas un réglage, c'est un
autre composant de carte.

**Acceptation** : la décision est écrite dans le code (un commentaire au choix du composant) et dans
la PR.

## 4. Hors de l'emprise

Le fond vectoriel Dira couvre trois pays entiers (Sénégal, Togo, Guinée), mais les **couches Dira**
(`/api/tiles`) seulement ≈ 13 km autour de chaque ville. Une application dont les utilisateurs sortent
de ces pays doit prévoir un fond de secours : sur le web, un second style (OSM public ou fond natif)
sélectionné selon la position ; sur mobile, garder `react-native-maps` avec le fond natif pour ces
écrans. Ne pas laisser un écran vide.

## 5. Vérifier

```sh
curl -s "https://maps.dira.llc/api/styles/$MAPS_API_KEY.json" | jq '{name, sol: .layers[0].paint["background-color"], tiles: .sources.openmaptiles.tiles}'
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "https://maps.dira.llc/basemap/data/v3/12/2061/1978.pbf"   # 200 application/x-protobuf
```

L'aperçu du portail (`/api/styles/apercu.json?fond=…&routes=…`) construit le style depuis une palette
passée en paramètres : c'est le même constructeur, utile pour tester une palette sans clé.

## 6. Ce que Claude Code doit rendre

- Le composant de carte qui charge le style par `diraStyleUrl` (ou l'URL brute) depuis la configuration,
  avec les couches Dira superposées.
- La bascule de style à chaud si l'app a un mode nuit (deux clés, ou un `setStyle`).
- Le repli hors emprise (§4), documenté.
- Une capture aux couleurs du thème du compte, et une seconde après avoir changé une couleur dans le
  portail.

## Références

- SDK : `diraStyleUrl`, `diraTileTemplate`, `diraBasemapTemplate` — https://github.com/kgtech-org/dira-maps-react-native-sdk
- Intégration React Native (itinéraires, tuiles, règles) : `docs/integration-react-native.md`
- Portail : `https://maps.dira.llc/admin/` → Thèmes, Clés.
- Style MapLibre : https://maplibre.org/maplibre-style-spec/
