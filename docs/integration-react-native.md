# Intégrer Dira Maps dans une application React Native — spec pour Claude Code

*À déposer dans le dépôt de l'application (par exemple `docs/dira-maps.md`), puis à donner à Claude
Code : « Intègre Dira Maps en suivant `docs/dira-maps.md` ». Chaque tâche a un critère d'acceptation :
Claude Code doit s'arrêter dessus, pas passer à la suivante tant qu'il n'est pas vérifié.*

---

## 0. Ce qu'il faut comprendre avant d'écrire une ligne

**Dira Maps ne fournit aucune vue de carte, et n'en fournira pas.** C'est un SIG web ; ses clients sont
des applications de navigateur. Chercher un `<DiraMap>` à importer est le malentendu qui bloque
l'intégration — il n'existe pas, et ce n'est pas un manque.

Ce que Dira Maps donne à une application mobile, c'est **du JSON sur HTTP** et des **URL de tuiles** :

| besoin de l'app | ce que Dira Maps fournit | ce que l'app fait |
|---|---|---|
| tracer un itinéraire | `POST /api/calc/route` → tracé routier `[lng, lat][]` | une `<Polyline>` (carte native) ou une couche `line` (MapLibre) |
| nommer un point | `GET /api/geocode/reverse` → adresse | un texte |
| chercher un lieu | `GET /api/geocode?q=&ville=` → résultats (base Dira, puis Google Places) | une liste |
| montrer le bâti, la voirie, l'eau de Dira | `/api/tiles/{ville}/{z}/{x}/{y}.png` | un `<UrlTile>` / une `RasterSource` par-dessus la carte |
| un fond de carte aux couleurs de l'app, jour et nuit | `/api/styles/<clé>.json?apparence=clair\|sombre` (style MapLibre) | `mapStyle` d'une carte MapLibre |
| un fond de carte Dira sans thème | `/basemap/…` (raster) | à la place du fond Google/Apple |

**La carte, c'est celle que l'app monte** — et c'est son choix, pas celui du SDK (tâche 6) :
la carte **native** du téléphone (`react-native-maps` : Google Maps sur Android, Apple Maps sur
iOS), correcte partout, le défaut ; ou **MapLibre** (`@maplibre/maplibre-react-native`), la seule
qui rende le **thème** réglé dans le portail, jour et nuit. Dira Maps se pose sur l'une comme sur
l'autre, avec les mêmes appels. C'est exactement ce que fait la console d'administration Dira Food
et le simulateur de dira-tracking.

Le SDK `@kgtech-org/dira-maps-react-native` encapsule tout ça : client typé, service d'itinéraire avec
repli **signalé**, hook React, conversion de coordonnées, gabarits d'URL. Zéro dépendance à
l'exécution, zéro module natif, aucun `pod install`.

## 1. Les règles non négociables

Claude Code doit les vérifier dans le code produit. Chacune a fait perdre du temps à quelqu'un.

1. **`[lng, lat]` sur le fil, `{ latitude, longitude }` sur la carte.** L'API et le SDK parlent en
   `[lng, lat]` (GeoJSON) ; `react-native-maps` veut `{ latitude, longitude }`. La conversion passe
   **uniquement** par `toLatLng` / `toLngLat` du SDK. À Lomé (1.22 E, 6.14 N) une inversion ne se
   voit pas à l'œil et place le point au large de la Somalie. Les deux types sont distincts pour que
   TypeScript refuse le mélange : ne pas les contourner avec `as`.
2. **`city` vient de l'API métier** (`delivery.city`, `ride.city`…), jamais d'une déduction locale
   (« si la latitude est > 10 c'est Dakar »). Codes valides : `dakar`, `lome`, `conakry`, `ndjamena`, `libreville`.
3. **Un repli est toujours signalé.** Quand le moteur de routage est indisponible, le SDK rend des
   segments droits avec `approximate: true`. L'écran DOIT le montrer (pointillé + mention). Une ligne
   droite présentée comme un itinéraire fait rouler quelqu'un dans un mur.
4. **Une requête d'itinéraire par tournée**, pas par position GPS. `RouteService` mémorise par
   tournée ; on ne le contourne pas avec un `useEffect` sur la position.
5. **La clé API vient de la configuration** (`EXPO_PUBLIC_MAPS_API_KEY` ou équivalent), jamais d'une
   constante dans le code. Envoyée par le SDK ; l'app ne fabrique pas d'en-tête elle-même.
6. **Une erreur `auth` ou `quota` n'est pas une panne** : c'est une configuration à corriger (clé
   absente, révoquée, service désactivé, quota atteint). Pas de repli en segments droits sur ces
   erreurs — les afficher.
7. **Ne pas utiliser `/ows/`** (WMS direct) depuis le mobile : non exposé en production, et c'est
   voulu. `diraTileTemplate` (`/api/tiles`) est la voie.

## 2. Configuration

Trois URL, distinctes exprès (trois services déployables séparément) :

| variable | valeur en production | rôle |
|---|---|---|
| `EXPO_PUBLIC_MAPS_URL` | `https://maps.dira.llc/api` | racine de l'**API** — client et tuiles |
| `EXPO_PUBLIC_MAPS_SITE_URL` | `https://maps.dira.llc` | racine du **site** — fond de carte, style |
| `EXPO_PUBLIC_MAPS_API_KEY` | `dira_live_…` | clé de l'application, créée dans le portail Dira Maps (`/admin/` → Clés). Vide = appels anonymes, acceptés pendant la transition |

Hors Expo, adapter le préfixe (`react-native-config`, etc.) — l'important est que ça vienne de la
configuration.

## 3. Tâches, dans l'ordre

### Tâche 1 — Installer le SDK

```sh
# .npmrc du projet (le jeton vient de l'environnement, jamais en clair)
@kgtech-org:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}

npm install @kgtech-org/dira-maps-react-native
# ou, sans jeton, en épinglant un tag (le dernier : voir CHANGELOG.md du SDK) :
npm install github:kgtech-org/dira-maps-react-native-sdk#v0.4.6
```

> `apiKey`, `diraStyleUrl` et les erreurs `auth`/`quota` existent depuis **v0.3.0** ;
> `diraStyleUrl({ colorScheme })` (jour/nuit) depuis **v0.4.0**. Ne pas épingler une version
> antérieure.

`react-native-maps` doit déjà être installé et fonctionner (une `<MapView>` vide s'affiche). Si ce
n'est pas le cas, c'est un problème de l'app, pas de Dira Maps : le régler d'abord.

**Acceptation** : `import { DiraMapsClient } from '@kgtech-org/dira-maps-react-native'` compile ;
`tsc` passe.

### Tâche 2 — Un module `dira-maps.ts` unique

Un seul endroit construit le client et le service ; les écrans l'importent.

```ts
// src/services/dira-maps.ts
import { DiraMapsClient, RouteService } from '@kgtech-org/dira-maps-react-native';

export const MAPS_API_URL = process.env.EXPO_PUBLIC_MAPS_URL ?? 'https://maps.dira.llc/api';
export const MAPS_SITE_URL = process.env.EXPO_PUBLIC_MAPS_SITE_URL ?? 'https://maps.dira.llc';
export const MAPS_API_KEY = process.env.EXPO_PUBLIC_MAPS_API_KEY || undefined;

export const diraMaps = new DiraMapsClient({ baseUrl: MAPS_API_URL, apiKey: MAPS_API_KEY });
export const diraRoutes = new RouteService(diraMaps);
```

**Acceptation** : aucun autre fichier n'instancie `DiraMapsClient`.

### Tâche 3 — L'écran de carte avec l'itinéraire

Le cas de référence : un livreur, une tournée (position → points de collecte → livraison).

```tsx
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { diraTileTemplate, toLatLng, useRoute } from '@kgtech-org/dira-maps-react-native';
import { diraRoutes, MAPS_API_KEY, MAPS_API_URL } from '../services/dira-maps';

export function DeliveryMap({ delivery, driverPosition }) {
  // driverPosition et les points sont en [lng, lat] — ce que l'API métier rend.
  const stops = [driverPosition, ...delivery.pickups.map((p) => p.geo), delivery.dropoff.geo];
  const { coordinates, approximate, loading, error } = useRoute(diraRoutes, {
    city: delivery.city, // servi par l'API métier, à ne pas deviner
    coordinates: stops,
  });

  return (
    <>
      <MapView style={{ flex: 1 }} initialRegion={regionAround(coordinates)}>
        {/* Les couches Dira (bâti, voirie, eau, sol) par-dessus la carte native. */}
        <UrlTile
          urlTemplate={diraTileTemplate({ apiUrl: MAPS_API_URL, city: delivery.city, apiKey: MAPS_API_KEY })}
          zIndex={1}
          opacity={0.5}                      // à pleine opacité, ces PNG couvrent le sol
          maximumZ={19}
        />
        <Polyline
          coordinates={coordinates}          // déjà en { latitude, longitude }
          strokeWidth={4}
          strokeColor="#7a1f2b"
          zIndex={2}                         // AU-DESSUS des tuiles, sinon elles le recouvrent
          lineDashPattern={approximate ? [8, 6] : undefined}   // règle 3
        />
        {stops.map((s, i) => <Marker key={i} coordinate={toLatLng(s)} />)}
      </MapView>
      {approximate && <Banner>Itinéraire approximatif — moteur de routage indisponible</Banner>}
      {error?.kind === 'auth' && <Banner>Clé Dira Maps refusée : vérifier la configuration</Banner>}
      {error?.kind === 'quota' && <Banner>Quota Dira Maps atteint, réessai dans {error.retryAfterS} s</Banner>}
    </>
  );
}
```

Points à respecter :

- `useRoute` rend **toujours** des `coordinates` (au pire les étapes reliées en droite) : la carte
  n'est jamais vide en attendant le réseau.
- `regionAround` se calcule depuis `coordinates` (déjà en `LatLng`) — pas depuis `stops` sans passer
  par `toLatLng`.
- Passer `request: null` à `useRoute` quand il n'y a pas encore de tournée : il ne fait alors aucune
  requête.

**Acceptation** : sur un appareil, la carte native s'affiche, le tracé suit la voirie (pas des
droites entre les étapes), le bâti Dira apparaît par-dessus au zoom 15+. Couper le réseau → le
tracé repasse en pointillé avec le bandeau.

### Tâche 4 — Géocodage et recherche de lieux

```ts
// Nommer un point (ex. une boutique sans adresse saisie)
const result = await diraMaps.reverseGeocode(shop.geo); // [lng, lat]
label = result?.formattedAddress ?? 'Adresse inconnue'; // null = pas de résultat, pas une erreur

// Recherche de lieux (saisie assistée, « pharmacie », « en face du marché »…)
const results = await diraMaps.geocode(text, { city: delivery.city, limit: 5 });
// results[i].location est en [lng, lat] : toLatLng() avant de le poser sur la carte
```

**Ce que `geocode` cherche, dans l'ordre** — et l'app n'a rien à faire pour ça, c'est le serveur :

1. **la base de lieux Dira** (commerces, pharmacies, écoles importés d'Overture ; repères appris
   des livraisons) — restreinte à `city`, tolérante aux accents et à la casse, sur le nom **et
   l'adresse** (« en face de la pharmacie » trouve) ; gratuite, immédiate ;
2. **Google Places** si la base est muette (et qu'une clé Google est configurée côté serveur) —
   la *recherche* de Google Maps (Text Search), biaisée sur la ville : « opera » à Lomé rend les
   mêmes boulangeries Opera que l'application Google Maps, avec `raw.name` ;
3. **Nominatim** sinon.

L'admin peut inverser les deux premières (paramètre `recherche_google_prioritaire`) ; l'app ne
choisit pas et ne doit pas essayer de contourner l'ordre en appelant Google elle-même.

Chaque résultat dit d'où il vient : `result.raw.source` vaut `overture`, `appris` ou `osm` pour un
lieu de la base, et la réponse entière porte `source` (`dira`, `google`, `nominatim`). Un lieu de la
base a en plus `raw.name`, `raw.categorie`, `raw.telephone` — utiles pour un écran de détail, à
lire dans `raw` (le SDK ne les type pas, ils sont propres à Dira). **Toujours passer `city`** : sans
elle, la base est interrogée sur toutes les villes et Google sans biais de ville ni de pays.

**Acceptation** : `reverseGeocode` d'un point du centre de Lomé rend une adresse ; `geocode('pharmacie',
{ city: 'lome' })` rend des pharmacies de Lomé avec `raw.source === 'overture'` ; une chaîne
inventée ne lève pas d'erreur (liste vide ou résultat Google/Nominatim, selon la configuration).

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

Ne jamais `catch` en silence. Ne jamais transformer `auth` ou `quota` en ligne droite.

**Acceptation** : un test unitaire par `kind` sur le composant qui affiche le bandeau.

### Tâche 6 — Choisir son moteur de carte

Le SDK ne rend aucune vue : **le moteur est le choix de l'app**, et le SDK alimente les trois de la
même façon (tuiles, tracé, géocodage). Ce n'est pas un `useNativeMaps: true` dans le SDK — c'est un
composant monté par l'app, et pour Google, une clé dans la configuration de l'app.

| Moteur | Composant | Prendre si… | Ce qu'on perd |
|---|---|---|---|
| **natif** | `react-native-maps` (Google Android / Apple iOS) | l'app sort des villes couvertes, ou tient à la cartographie Google | le **thème** Dira et le jour/nuit : le composant dessine son sol |
| **MapLibre** | `@maplibre/maplibre-react-native` | l'app veut **sa** carte, aux couleurs du portail, jour et nuit | la couverture hors des villes (≈ 13 km autour de chacune) ; un development build |
| **tuiles Dira seules** | `UrlTile` sur `mapType="none"`, ou une grille | regarder ce que Dira sert vraiment | tout fond tiers |

Pour le natif sur Android, la clé du **SDK Google Maps** va dans `android.config.googleMaps.apiKey`
— via `app.config.js` et une variable de build (`GOOGLE_MAPS_API_KEY`), jamais commitée, jamais
préfixée `EXPO_PUBLIC_` ; Expo Go la refuse, il faut un development build. iOS (Apple Maps) n'en
demande pas. L'exemple du SDK implémente les trois derrière `EXPO_PUBLIC_MAPS_ENGINE` —
`example/src/MapPane.tsx` est le modèle à copier.

Par défaut, garder le fond natif : il est correct partout. Le fond Dira n'a de données que dans
**≈ 13 km autour de chaque ville** ; hors de là, il est vide — pas moins détaillé, vide.

Les deux voies Dira :

- **Raster, avec `react-native-maps`** : `<UrlTile urlTemplate={diraBasemapTemplate({ siteUrl, apiKey })} />`
  sous les tuiles Dira, et `mapType="none"` sur Android pour ne pas dessiner le sol Google dessous.
  Le thème de l'application ne s'applique pas ici.
- **Vecteur, avec `@maplibre/maplibre-react-native`** :
  `mapStyle={diraStyleUrl({ siteUrl, apiKey, colorScheme })}` — le fond aux couleurs du **thème**
  réglé dans le portail, en version **jour ou nuit au choix de l'app** (`colorScheme: 'light' |
  'dark'`, un état de l'app — bouton, réglage, ou `useColorScheme()` pour suivre le téléphone ;
  `null` = l'apparence par défaut du thème ; changer, c'est changer d'URL, la carte suit), le seul
  volet où le thème s'applique. C'est
  un autre composant de carte, qui exige un *development build* (module natif, absent d'Expo Go) ;
  ne pas mélanger les deux. La spec dédiée : `integration-themes.md` ; l'exemple du SDK
  (`example/src/VectorPane.tsx`) est l'implémentation de référence — tuiles Dira en `RasterSource`
  par-dessus le fond, à opacité réduite.

**Acceptation** : hors de l'emprise (ex. à 30 km de Lomé), l'écran affiche encore une carte lisible
(fond natif) — pas un vide.

## 4. Pièges connus

- **Expo Go sur Android n'affiche pas Google Maps** (la clé Google de l'hôte Expo est refusée :
  `Authorization failure` dans `adb logcat`). Ce n'est pas Dira Maps. Tester dans un *development
  build* (`npx expo run:android`), ou sur iOS, ou avec le fond Dira (tâche 6) le temps du
  développement. Le banc d'essai du SDK gère ce cas avec une grille de tuiles.
- **Expo Go se met à jour tout seul** via le Play Store et cesse alors d'ouvrir un projet d'un SDK
  antérieur (« Project is incompatible with this version of Expo Go »). Désactiver sa mise à jour
  automatique, ou installer la version du SDK du projet depuis
  `github.com/expo/expo-go-releases`.
- **Une clé de placeholder n'est pas une clé.** Une app vue en production avec `dira_live_wrong`
  recevait des 401 sur chaque tuile et un 404 sur son style : la valeur de `EXPO_PUBLIC_MAPS_API_KEY`
  vient du portail (Clés → créer → copier à l'affichage), et l'erreur `auth` du SDK est là pour le
  dire tout de suite.
- **`lon` et non `lng`** sur `/geocode/reverse` si l'app appelle l'API à la main — raison de plus de
  passer par le SDK, qui normalise.
- **Les tuiles du téléphone se mettent en cache** : après un import de données côté serveur, une tuile
  déjà vue peut rester ancienne jusqu'à 5 minutes (en-têtes `max-age=300` + `ETag`). Normal.
- **Pas d'en-têtes sur `<UrlTile>`** : la clé passe en `?key=` — c'est ce que `diraTileTemplate({ apiKey })`
  fait. Ne pas la mettre à la main dans l'URL, ni l'oublier.
- **`RouteService` mémorise par tournée** : appeler `diraRoutes.clear()` en fin de course ou au
  changement de tournée, pas à chaque écran.
- **Le tracé sous les tuiles** : dans `react-native-maps`, un `<UrlTile zIndex={1}>` recouvre une
  `<Polyline>` sans `zIndex` — elle est là, invisible. `zIndex={2}` sur le tracé.
- **MapLibre vide la carte à chaque `setStyle`** (autre thème, bascule jour/nuit) : les sources
  ajoutées à l'exécution sont remises par la bibliothèque, mais une forme poussée entre les deux se
  perd — redonner sa forme au tracé sur `onDidFinishLoadingStyle`. Ne pas remonter les sources par
  `key` : le module natif plante (`MLRNSource.getLayerAt`). Et `collapsable={false}` sur la vue d'un
  `MarkerView`, sinon Android l'aplatit et la pastille perd fond et bordure. L'exemple du SDK
  (`example/src/VectorPane.tsx`) fait les trois.
- **Metro ne voit pas toujours une modification** (bundle « 1 module » en boucle) : relancer avec
  `--clear`. Et un dev build se reconstruit après tout changement d'`app.json`/`app.config.js`.

## 5. Vérifier sans appareil

Le SDK a un banc d'essai en ligne de commande, le même que l'application d'exemple : il diagnostique
le déploiement (itinéraire, cache, géocodage, tuiles, couverture, erreurs typées) sans simulateur.

```sh
git clone https://github.com/kgtech-org/dira-maps-react-native-sdk && cd dira-maps-react-native-sdk/example
npm install
EXPO_PUBLIC_MAPS_URL=https://maps.dira.llc/api EXPO_PUBLIC_MAPS_API_KEY=dira_live_… npm run check
```

Attendu en production : tout vert, sauf « Surimpression WMS » en avertissement (repli volontairement
non exposé) et « Couverture du fond » à 4/5 pour Lomé (la 5ᵉ tuile est en mer). Si « Itinéraire
routier » n'est pas vert, le problème est côté serveur, pas côté app : s'arrêter et le signaler.

Avec une clé, le banc envoie `X-Api-Key` sur ses appels : la console du portail (Tableau de bord,
Appels) montre alors ces appels sous la clé — c'est le moyen de vérifier que la clé de l'app est la
bonne et que ses services sont activés.

## 6. Ce que Claude Code doit rendre à la fin

- `src/services/dira-maps.ts` (tâche 2), l'écran de carte (tâche 3), le géocodage là où l'app en a
  besoin (tâche 4), le composant d'erreur (tâche 5).
- Les trois variables dans `.env.example` de l'app, documentées.
- `tsc` et les tests de l'app verts ; une capture de l'écran de carte avec un tracé qui suit la voirie
  et le bâti Dira visible ; une capture d'une recherche « pharmacie » rendant des lieux de la base.
- La liste des règles de la section 1, cochée une par une dans la PR.

## Références

- SDK : https://github.com/kgtech-org/dira-maps-react-native-sdk — README, `CLAUDE.md` (la règle du
  dépôt), `example/` (application de référence : `MapPane.tsx`, `checks.ts`).
- API : `https://maps.dira.llc/docs` (OpenAPI).
- Portail des applications (clés, thèmes, statistiques) : `https://maps.dira.llc/admin/`.
