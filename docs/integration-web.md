# Intégrer Dira Maps dans un frontend web — spec pour Claude Code

*À déposer dans le dépôt de l'application web (par exemple `docs/dira-maps.md`), puis à donner à
Claude Code : « Intègre Dira Maps en suivant `docs/dira-maps.md` ». Chaque tâche a un critère
d'acceptation : Claude Code doit s'arrêter dessus, pas passer à la suivante tant qu'il n'est pas
vérifié.*

*Frontend web = une application de navigateur — React, Vue, Svelte, ou vanilla — servie sur son
propre domaine : back-office, console de suivi, site marchand. La spec React Native est
[`integration-react-native.md`](integration-react-native.md) ; celle des thèmes,
[`integration-themes.md`](integration-themes.md).*

---

## 0. Ce qu'il faut comprendre avant d'écrire une ligne

**Dira Maps ne fournit aucun composant de carte.** Il ne fournit pas de `<DiraMap>`, pas de
plugin, pas de widget. C'est un service : **du JSON sur HTTP**, des **URL de tuiles**, et un
**style MapLibre**. La carte, c'est la bibliothèque que l'app choisit — et sur le web, ce choix est
plus simple que sur mobile :

| besoin de l'app | ce que Dira Maps fournit | ce que l'app fait |
|---|---|---|
| un fond de carte, aux couleurs de l'app, jour et nuit | `GET /api/styles/<clé>.json?apparence=clair\|sombre` (style MapLibre, fond vectoriel auto-hébergé) | `new maplibregl.Map({ style })` |
| un fond de carte, sans thème | `/basemap/styles/basic-preview/{z}/{x}/{y}.png?key=…` (raster) | une source raster (MapLibre ou Leaflet) |
| le bâti, la voirie, l'eau de Dira (PostGIS, QGIS) | `/api/tiles/{ville}/{z}/{x}/{y}.png?key=…` | une couche raster par-dessus le fond |
| tracer un itinéraire | `POST /api/calc/route` → tracé routier `[lng, lat][]` | une couche `line` (GeoJSON) |
| nommer un point | `GET /api/geocode/reverse?lat=&lon=` → adresse | un texte |
| chercher un lieu | `GET /api/geocode?q=&ville=` → résultats | une liste |

**Le moteur recommandé sur le web est MapLibre GL JS** (`maplibre-gl`, MIT, sans clé) : c'est
celui du client web de Dira Maps lui-même et de sa console, le seul qui rende le **thème** réglé
dans le portail, et il ne demande aucun compte tiers. Google Maps JavaScript API reste possible
(fond Google, tuiles Dira en `ImageMapType`) mais coûte une clé Google facturée à la vue, et le
thème Dira ne s'y applique pas. Leaflet marche pour les tuiles raster et n'a pas de thème.

**Le SDK `@kgtech-org/dira-maps-react-native` fonctionne sur le web.** Malgré son nom, il n'a
aucune dépendance à React Native : du TypeScript pur, `fetch`, zéro dépendance à l'exécution
(`react` en pair pour le seul hook `useRoute`). Le client HTTP, les erreurs typées, le service
d'itinéraire, la conversion de coordonnées, les gabarits d'URL — tout s'importe dans une app web.
Le README de son exemple tourne d'ailleurs sur le web (`npm run web`, `npm run check`).

## 1. Les règles non négociables

Claude Code doit les vérifier dans le code produit. Chacune a fait perdre du temps à quelqu'un.

1. **`[lng, lat]` partout sur le web.** L'API, le SDK, GeoJSON et MapLibre parlent tous en
   `[lng, lat]` : **aucune conversion** n'est nécessaire — et c'est un piège, parce que Leaflet et
   Google Maps veulent `[lat, lng]` / `{ lat, lng }`. Si l'app utilise l'un d'eux, la conversion
   passe **uniquement** par `toLatLng` / `toLngLat` du SDK. À Lomé (1.22 E, 6.14 N) une inversion
   ne se voit pas à l'œil et place le point au large de la Somalie.
2. **`ville` vient des données métier** (`delivery.city`, `shop.city`…), jamais d'une déduction
   locale. Codes valides : `dakar`, `lome`, `conakry` — ceux de `GET /api/villes`.
3. **La clé API vient de la configuration de build** (`VITE_MAPS_API_KEY`, `NEXT_PUBLIC_…`), jamais
   d'une constante dans le code. Une clé web est **publique par nature** (elle est dans le bundle et
   dans les URL de tuiles) : c'est prévu — elle identifie l'application, ne donne aucun droit
   d'écriture, et le portail la restreint par services et quota. Créer **une clé par application
   web**, distincte de celles des apps mobiles, pour lire ses statistiques à part et la révoquer
   seule.
4. **Un repli est toujours signalé.** Quand le moteur de routage est indisponible, le SDK rend des
   segments droits avec `approximate: true`. L'écran DOIT le montrer (pointillé + mention).
5. **Une requête d'itinéraire par tournée**, pas par position. `RouteService` mémorise par tournée.
6. **Une erreur `auth` ou `quota` n'est pas une panne** : configuration à corriger, à afficher.
7. **Jour ou nuit est un état de l'app**, pas une lecture du système : l'app passe `colorScheme` à
   `diraStyleUrl` (un bouton, un réglage, ou `prefers-color-scheme` si elle le veut) et rappelle
   `map.setStyle` quand il change. Un thème a toujours ses deux variantes.
8. **Ne pas appeler `/ows/`** (WMS direct) : non exposé en production, et c'est voulu.
9. **Ne jamais mettre en dur `maps.dira.llc`** dans le code : deux variables d'environnement (site
   et API), pour pouvoir viser un déploiement local ou de recette.

## 2. Configuration

Deux URL, distinctes exprès (le serveur de tuiles de fond et de style est servi sous le site, hors
de l'API), et une clé :

| variable (exemple Vite) | valeur en production | rôle |
|---|---|---|
| `VITE_MAPS_API_URL` | `https://maps.dira.llc/api` | racine de l'API : itinéraire, géocodage, tuiles Dira |
| `VITE_MAPS_SITE_URL` | `https://maps.dira.llc` | racine du site : style MapLibre, fond raster |
| `VITE_MAPS_API_KEY` | `dira_live_…` | clé de l'application, créée dans le portail (`/admin/` → Clés) |

Sur Next.js, préfixer `NEXT_PUBLIC_`. Les trois vont dans `.env.example`, documentées.

## 3. Tâches, dans l'ordre

### Tâche 0 — Prérequis côté Dira Maps : CORS

Un frontend web tourne sur **son** domaine (`admin.dira.llc`, `food.dira.llc`…) et appelle
`maps.dira.llc` depuis le navigateur : c'est une requête *cross-origin*, et le navigateur exige que
Dira Maps l'autorise (`Access-Control-Allow-Origin`), d'autant que la clé passe dans un en-tête
(`X-Api-Key` → *preflight* `OPTIONS`). MapLibre charge le style, les tuiles vectorielles **et les
tuiles raster** par `fetch` : sans CORS, il ne charge rien, et la carte reste vide sans message.

Vérifier avant de commencer :

```sh
curl -sI -H "Origin: https://mon-app.example" "$VITE_MAPS_API_URL/geocode?q=test&ville=lome" | grep -i access-control
curl -sI -X OPTIONS -H "Origin: https://mon-app.example" -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: x-api-key" "$VITE_MAPS_API_URL/geocode"
```

Attendu : `Access-Control-Allow-Origin: https://mon-app.example` sur les deux (le premier appel
avec `-H "X-Api-Key: $VITE_MAPS_API_KEY"`), et un `204` sur l'`OPTIONS`. **Si ce n'est pas le cas,
s'arrêter et le demander à l'équipe Dira Maps** — c'est un déploiement antérieur à `0016`. Ne pas
contourner par un proxy dans l'app « en attendant » : le proxy cache la clé côté serveur, d'accord,
mais il fait transiter chaque tuile par l'app, et il restera.

Comment Dira Maps décide : **par clé**. Une clé présentée obtient l'en-tête CORS pour l'origine qui
l'appelle ; une clé sans origines autorisées répond à n'importe quelle origine (elle est publique,
elle identifie, elle ne donne aucun droit — comme une clé Google non restreinte). En production,
**restreindre la clé aux origines de l'app** dans le portail (Clés → Origines web :
`https://mon-app.example`, plus `http://localhost:5173` pour le développement) : toute autre origine
reçoit un `403` lisible, `X-Dira-Raison: origine`. Sans clé, aucun en-tête CORS : une application
web a une clé.

Deux exceptions qui marchent sans CORS, et qui trompent : `/basemap/` (le serveur de fond répond
`*`) et une balise `<img>` ou une couche Leaflet (chargement sans `fetch`). Une carte Leaflet peut
donc afficher les tuiles Dira alors que le géocodage échoue — ce n'est pas un bug de l'app.

**Acceptation** : les deux `curl` ci-dessus rendent les en-têtes attendus pour l'origine de l'app,
en recette et en production.

### Tâche 1 — Installer le SDK et un module `dira-maps.ts` unique

```sh
npm install github:kgtech-org/dira-maps-react-native-sdk#v0.4.4   # tag : voir CHANGELOG.md du SDK
npm install maplibre-gl                                            # le moteur de carte
```

Un seul endroit construit le client et le service ; les écrans l'importent :

```ts
// src/services/dira-maps.ts
import { DiraMapsClient, RouteService } from '@kgtech-org/dira-maps-react-native';

export const MAPS_API_URL = import.meta.env.VITE_MAPS_API_URL ?? 'https://maps.dira.llc/api';
export const MAPS_SITE_URL = import.meta.env.VITE_MAPS_SITE_URL ?? 'https://maps.dira.llc';
export const MAPS_API_KEY = import.meta.env.VITE_MAPS_API_KEY || undefined;

export const diraMaps = new DiraMapsClient({ baseUrl: MAPS_API_URL, apiKey: MAPS_API_KEY });
export const diraRoutes = new RouteService(diraMaps);
```

**Acceptation** : aucun autre fichier n'instancie `DiraMapsClient` ; `tsc` vert ; le SDK n'apporte
aucune dépendance React Native dans le bundle (vérifier `npm ls react-native` : absent).

### Tâche 2 — La carte : fond thémé, jour et nuit

```ts
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { diraStyleUrl, diraTileTemplate } from '@kgtech-org/dira-maps-react-native';
import { MAPS_API_KEY, MAPS_API_URL, MAPS_SITE_URL } from './services/dira-maps';

type ColorScheme = 'light' | 'dark';

// L'apparence est un état de l'app : bouton, réglage utilisateur, ou
// `matchMedia('(prefers-color-scheme: dark)')` si elle veut suivre le navigateur.
const styleUrl = (colorScheme: ColorScheme) =>
  diraStyleUrl({ siteUrl: MAPS_SITE_URL, apiKey: MAPS_API_KEY!, colorScheme });

export function createMap(container: HTMLElement, city: { center: [number, number] }, colorScheme: ColorScheme) {
  const map = new maplibregl.Map({
    container,
    style: styleUrl(colorScheme),
    center: city.center, // [lng, lat]
    zoom: 13,
  });

  // Les couches Dira (bâti, voirie, eau, sol de QGIS) par-dessus le fond thémé,
  // en transparence : à pleine opacité ces PNG couvriraient le fond qu'on est venu voir.
  const addDiraLayers = () => {
    if (map.getSource('dira')) return;
    map.addSource('dira', {
      type: 'raster',
      tiles: [diraTileTemplate({ apiUrl: MAPS_API_URL, city: 'lome', apiKey: MAPS_API_KEY })],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© Dira Maps · © OpenStreetMap · © Overture Maps Foundation',
    });
    map.addLayer({ id: 'dira', type: 'raster', source: 'dira', paint: { 'raster-opacity': 0.35 } });
  };
  // `setStyle` vide la carte de ses sources ajoutées : les remettre à chaque style chargé.
  map.on('style.load', addDiraLayers);

  return {
    map,
    setColorScheme: (scheme: ColorScheme) => map.setStyle(styleUrl(scheme)),
  };
}
```

Le thème (couleurs, apparence par défaut) se règle dans le portail, pas dans l'app — voir
[`integration-themes.md`](integration-themes.md). Sans thème assigné à la clé, elle reçoit le
préréglage `dira` (plan de ville en gris, de nuit par défaut).

**Acceptation** : la carte affiche Lomé aux couleurs du thème de la clé ; `setColorScheme('dark')`
puis `'light'` la bascule sans rechargement, et les couches Dira sont toujours là après chaque
bascule ; `metadata['dira:apparence']` du style chargé vaut l'apparence demandée ; changer une
couleur dans le portail se voit après rechargement (cache 5 min).

### Tâche 3 — L'itinéraire

```ts
import { useRoute } from '@kgtech-org/dira-maps-react-native'; // React ; sinon `diraRoutes.route(...)`

const { coordinates, approximate, loading, error } = useRoute(diraRoutes, {
  city: delivery.city,          // des données métier, jamais déduit
  coordinates: delivery.stops,  // [lng, lat][] — tel quel pour MapLibre
});

// Une source GeoJSON, une couche `line` ; le repli en pointillé, PAS en trait plein.
map.getSource('trace')?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
map.setPaintProperty('trace', 'line-dasharray', approximate ? [2, 1.5] : [1, 0]);
```

`coordinates` est en `[lng, lat]` : **pas de conversion** pour MapLibre. La couche `trace` se
recrée à chaque `style.load`, comme les couches Dira (tâche 2). Le tracé prend une couleur d'accent
de l'app, pas celle des routes du thème : sur le thème gris par défaut, elles seraient confondues.

**Acceptation** : un tracé qui suit la voirie entre deux points de Lomé ; le repli (`approximate`)
apparaît en pointillé avec une mention visible ; une seule requête `POST /api/calc/route` par
tournée dans l'onglet Réseau, même si l'écran se redessine.

### Tâche 4 — Géocodage et recherche de lieux

```ts
const result = await diraMaps.reverseGeocode([lng, lat]);           // null = pas de résultat, pas une erreur
const results = await diraMaps.geocode(text, { city: delivery.city, limit: 5 });
// results[i].location est en [lng, lat] — directement posable sur MapLibre
```

**Ce que `geocode` cherche, dans l'ordre** — côté serveur, l'app n'a rien à faire :

1. **la base de lieux Dira** (commerces, pharmacies, écoles importés d'Overture ; repères appris)
   — restreinte à `city`, tolérante aux accents, sur le nom **et** l'adresse ; gratuite, immédiate ;
2. **Google Places** si la base est muette (et qu'une clé Google est configurée côté serveur) — la
   *recherche* de Google Maps (Text Search), biaisée sur la ville : « opera » à Lomé rend les mêmes
   boulangeries Opera que l'application Google Maps, avec `raw.name` ;
3. **Nominatim** sinon.

L'admin peut inverser les deux premières (`recherche_google_prioritaire`) ; l'app ne choisit pas et
n'appelle pas Google elle-même. Chaque résultat porte `raw.source` (`overture`, `appris`, `osm`) et
la réponse `source` (`dira`, `google`, `nominatim`). **Toujours passer `city`.**

Pour une saisie assistée, **débouncer à 300 ms** et n'envoyer qu'à partir de 3 caractères : chaque
appel est compté sur la clé, et un appel Google est facturé.

**Acceptation** : `geocode('pharmacie', { city: 'lome' })` rend des pharmacies de Lomé avec
`raw.source === 'overture'` ; une chaîne inventée ne lève pas d'erreur ; la saisie assistée ne fait
pas plus d'une requête par 300 ms (onglet Réseau).

### Tâche 5 — Les erreurs, classées par conduite à tenir

Le SDK lève `DiraMapsError` avec un `kind` :

| kind | quoi | conduite |
|---|---|---|
| `network`, `timeout` | réseau, délai | réessayer plus tard ; `useRoute` a déjà rendu les étapes en droite |
| `routing_unavailable` | 503, pas de moteur | **repli signalé** (`approximate: true`) — fait par `RouteService` |
| `auth` | 401/403 : clé absente, révoquée, service désactivé | afficher ; corriger la configuration ou la clé dans le portail |
| `quota` | 429 : quota journalier | afficher ; `error.retryAfterS` dit quand |
| `request` | 4xx : appel invalide | bug côté app (ville inconnue, moins de deux points) |
| `server` | 5xx | réessayer plus tard |

Deux cas de plus sur le web : **`network` sur tous les appels alors que `curl` passe** = CORS
(tâche 0), pas le réseau — le dire dans le message d'erreur du composant, avec l'origine de l'app ;
et **`auth` avec `X-Dira-Raison: origine`** = la clé est restreinte à d'autres origines dans le
portail (Clés → Origines web) — ajouter celle de l'app.

**Acceptation** : un test unitaire par `kind` sur le composant qui affiche le bandeau.

### Tâche 6 — (si l'app est déjà sur une autre bibliothèque)

- **Leaflet** : `L.tileLayer(diraBasemapTemplate({ siteUrl, apiKey }))` pour le fond,
  `L.tileLayer(diraTileTemplate({ apiUrl, city, apiKey }), { opacity: 0.5 })` par-dessus,
  `L.polyline(coordinates.map(toLatLng))` — **conversion obligatoire**, Leaflet parle en
  `[lat, lng]`. Pas de thème : Leaflet ne lit pas de style MapLibre.
- **Google Maps JavaScript API** : `new google.maps.ImageMapType({ getTileUrl })` avec les tuiles
  Dira par-dessus le fond Google ; `Polyline` avec `toLatLng`. Pas de thème ; clé Google facturée.

Dans les deux cas, migrer vers MapLibre le jour où l'app veut le thème ou le jour/nuit : c'est un
changement de bibliothèque, pas d'API Dira.

## 4. Pièges connus

- **CORS** (tâche 0) : la carte MapLibre reste vide sans erreur visible ; ouvrir la console du
  navigateur, l'erreur y est. Le fond `/basemap/` s'affiche quand même — ne pas en conclure que
  « Dira marche ».
- **Le style est mis en cache 5 minutes** (`Cache-Control: max-age=300`) : un thème modifié dans le
  portail n'apparaît pas à la seconde. Pour le développement, un `?v=<Date.now()>` sur l'URL du
  style le contourne — jamais en production.
- **`setStyle` vide les sources ajoutées** : tout ce que l'app ajoute (tuiles Dira, tracé, marqueurs
  en couche) se remet sur `style.load`. Les `maplibregl.Marker` (DOM) survivent, eux.
- **Le fond Dira ne couvre que ≈ 13 km autour de chaque ville** ; le fond vectoriel couvre le
  Sénégal, le Togo et la Guinée. Un écran qui peut sortir de là garde un fond de secours (OSM public,
  Google) choisi selon la position.
- **`lon` et non `lng`** sur `/geocode/reverse` si l'app appelle l'API à la main — raison de plus
  de passer par le SDK.
- **Les tuiles Dira portent `ETag` + `max-age=300`** : après un import côté serveur, une tuile déjà
  vue peut rester ancienne cinq minutes. Normal.
- **Une clé de placeholder n'est pas une clé** : `dira_live_wrong` a été vu en production. La
  valeur vient du portail (Clés → créer → copier à l'affichage) ; l'erreur `auth` le dit tout de
  suite.
- **Ne pas importer `useRoute` sans React** : le reste du SDK n'en dépend pas.

## 5. Vérifier sans écran

Le banc d'essai du SDK tourne en ligne de commande contre n'importe quel déploiement :

```sh
git clone https://github.com/kgtech-org/dira-maps-react-native-sdk && cd dira-maps-react-native-sdk/example
npm install
EXPO_PUBLIC_MAPS_URL=$VITE_MAPS_API_URL EXPO_PUBLIC_MAPS_API_KEY=$VITE_MAPS_API_KEY npm run check
```

Attendu en production : tout vert, sauf « Surimpression WMS » en avertissement et « Couverture du
fond » à 4/5 pour Lomé (la 5ᵉ tuile est en mer). Il ne teste **pas** CORS (il n'est pas un
navigateur) : la tâche 0 reste à faire à la main.

Avec une clé, la console du portail (Tableau de bord, Appels, IP) montre les appels de l'app sous
sa clé — le moyen de vérifier que c'est la bonne et que ses services sont activés.

## 6. Ce que Claude Code doit rendre à la fin

- `src/services/dira-maps.ts` (tâche 1), le composant de carte avec le jour/nuit (tâche 2),
  l'itinéraire (tâche 3), le géocodage là où l'app en a besoin (tâche 4), le composant d'erreur
  (tâche 5).
- Les trois variables dans `.env.example`, documentées ; la clé **jamais** dans le dépôt.
- `tsc` et les tests verts ; le résultat des deux `curl` de la tâche 0 collé dans la PR ; une
  capture de la carte en jour et en nuit avec le tracé et les couches Dira ; une capture d'une
  recherche « pharmacie » rendant des lieux de la base.
- La liste des règles de la section 1, cochée une par une dans la PR.

## Références

- SDK : https://github.com/kgtech-org/dira-maps-react-native-sdk — README, `CLAUDE.md`,
  `example/` (`npm run web` : le diagnostic dans un navigateur).
- Thèmes, jour et nuit : [`integration-themes.md`](integration-themes.md).
- API : `https://maps.dira.llc/docs` (OpenAPI).
- Portail des applications (clés, thèmes, statistiques) : `https://maps.dira.llc/admin/`.
- MapLibre GL JS : https://maplibre.org/maplibre-gl-js/docs/
