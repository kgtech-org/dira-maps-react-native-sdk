# Intégrer Dira Maps dans une application Android native (Kotlin) — spec pour Claude Code

*À déposer dans le dépôt de l'application Android, puis à donner à Claude Code : « Intègre Dira Maps
en suivant ce document ». Chaque tâche a un critère d'acceptation : Claude Code s'y arrête, il ne
passe pas à la suivante tant qu'il n'est pas vérifié.*

---

## 0. Ce qu'il faut comprendre avant d'écrire une ligne

**Dira Maps ne fournit aucune vue de carte, et n'en fournira pas** — ni composant Android, ni SDK
Kotlin. Il n'y a pas de `DiraMapView` à ajouter au layout, et ce n'est pas un manque : Dira Maps est
un SIG web dont les clients sont des applications de navigateur.

Ce que Dira Maps donne à une application Android, c'est **du JSON sur HTTP** et des **URL de tuiles** :

| besoin de l'app | ce que Dira Maps fournit | ce que l'app fait |
|---|---|---|
| tracer un itinéraire | `POST /api/calc/route` → tracé routier `[lng, lat][]` | une `Polyline` sur la carte du téléphone |
| nommer un point | `GET /api/geocode/reverse?lat=&lon=` → adresse | un texte |
| chercher une adresse | `GET /api/geocode?q=&ville=` → résultats | une liste |
| montrer le bâti, la voirie, l'eau de Dira | `/api/tiles/{ville}/{z}/{x}/{y}.png` | un `TileOverlay` par-dessus la carte |
| un fond de carte Dira (optionnel) | `/basemap/styles/…/{z}/{x}/{y}.png` (raster) ou `/api/styles/<clé>.json` (MapLibre) | à la place du fond Google |

**La carte, c'est celle du téléphone** — Google Maps SDK for Android (`com.google.android.gms:play-services-maps`)
ou, si l'app veut le fond et le **thème** Dira, **MapLibre Native** (`org.maplibre.gl:android-sdk`).
Dira Maps se pose dessus.

Il n'y a pas de SDK Kotlin : l'intégration est un **client HTTP typé** (Retrofit + kotlinx.serialization
ou Moshi) d'environ 150 lignes, écrit dans l'app, en suivant les règles ci-dessous. Le SDK React
Native (`dira-maps-react-native-sdk`, dossier `src/`) est la référence de ce que chaque fonction doit
faire ; ce document en transpose les règles.

## 1. Les règles non négociables

Claude Code doit les vérifier dans le code produit. Chacune a fait perdre du temps à quelqu'un.

1. **`[lng, lat]` sur le fil, `LatLng(lat, lng)` sur la carte.** L'API parle en GeoJSON : longitude
   d'abord. `com.google.android.gms.maps.model.LatLng` prend la latitude d'abord. La conversion passe
   par **une seule fonction** (`toLatLng` / `toLngLat` dans `DiraCoords.kt`) — jamais un
   `LatLng(p[0], p[1])` inline. À Lomé (1.22 E, 6.14 N) une inversion ne se voit pas à l'œil et
   place le point au large de la Somalie. Représenter le fil par une `value class LngLat` et la
   carte par `LatLng` : le compilateur refuse alors le mélange.
2. **`city` vient de l'API métier** (`delivery.city`, `ride.city`…), jamais d'une déduction locale.
   Codes valides : `dakar`, `lome`, `conakry`.
3. **Un repli est toujours signalé.** Si le moteur de routage est indisponible (503), l'app trace des
   segments droits entre les étapes **et le dit** (pointillé + bandeau). Une ligne droite présentée
   comme un itinéraire fait rouler quelqu'un dans un mur.
4. **Une requête d'itinéraire par tournée**, pas par position GPS. Mémoriser le tracé par clé de
   tournée (ville + étapes ordonnées) ; ne pas réinterroger à chaque `onLocationChanged`. Les échecs
   ne sont pas mémorisés.
5. **La clé API vient de la configuration** (`BuildConfig.DIRA_MAPS_API_KEY`, alimenté par
   `local.properties` / les secrets CI), jamais d'une constante dans le code. Envoyée en `X-Api-Key`
   par un intercepteur OkHttp ; ajoutée en `?key=` sur les URL de tuiles (un `TileProvider` n'a pas
   d'en-têtes).
6. **`auth` (401/403) et `quota` (429) ne sont pas des pannes** : ce sont des configurations à
   corriger (clé absente, révoquée, service désactivé, quota atteint — `Retry-After` dit quand). Pas
   de repli en segments droits sur ces erreurs — les afficher.
7. **`lon` et non `lng`** sur `/api/geocode/reverse` : c'est la seule exception de la plateforme.
   Sur `/api/calc/route`, le champ s'appelle **`ville`** (pas `city`) et les points **`coordinates`**.
8. **Ne pas utiliser `/ows/`** (WMS direct) : non exposé en production, volontairement.

## 2. Configuration

| clé | valeur en production | rôle |
|---|---|---|
| `DIRA_MAPS_API_URL` | `https://maps.dira.llc/api` | racine de l'**API** — client et tuiles |
| `DIRA_MAPS_SITE_URL` | `https://maps.dira.llc` | racine du **site** — fond de carte, style |
| `DIRA_MAPS_API_KEY` | `dira_live_…` | clé de l'application, créée dans le portail (`/admin/` → Clés) |

Dans `build.gradle.kts`, exposées en `BuildConfig` depuis `local.properties` (jamais commité) :

```kotlin
android {
    buildFeatures { buildConfig = true }
    defaultConfig {
        val props = Properties().apply { rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use(::load) }
        buildConfigField("String", "DIRA_MAPS_API_URL", "\"${props.getProperty("dira.maps.apiUrl", "https://maps.dira.llc/api")}\"")
        buildConfigField("String", "DIRA_MAPS_SITE_URL", "\"${props.getProperty("dira.maps.siteUrl", "https://maps.dira.llc")}\"")
        buildConfigField("String", "DIRA_MAPS_API_KEY", "\"${props.getProperty("dira.maps.apiKey", "")}\"")
    }
}
```

## 3. Les contrats HTTP, exactement

Tout ce que le client doit connaître. Les noms de champs sont ceux du fil — ne pas les traduire.

**Itinéraire** — `POST {api}/calc/route`

```json
// requête
{ "ville": "lome", "coordinates": [[1.2216, 6.1425], [1.2312, 6.1352]], "mode": "driving", "alternatives": false }
// réponse 200
{ "routes": [ { "geometry": { "type": "LineString", "coordinates": [[1.2216, 6.1425], …] },
               "distance_m": 1420.0, "duration_s": 240.0, "steps": [ … ] } ],
  "source": "engine" }          // ou "redis" : servi depuis le cache
// 503 : moteur non configuré → repli signalé (règle 3)
```

**Géocodage inverse** — `GET {api}/geocode/reverse?lat=6.1425&lon=1.2216` (note le **`lon`**)

```json
{ "results": [ { "formatted_address": "Rue Khra, Fréau-Jardin, Lomé", "geometry": { "location": { "lat": 6.1425, "lng": 1.2216 } } } ],
  "status": "OK" }              // "ZERO_RESULTS" = pas d'adresse, pas une erreur
```

**Recherche** — `GET {api}/geocode?q=pharmacie&ville=lome&limit=5` — même forme.

**Tuiles Dira** — `GET {api}/tiles/{ville}/{z}/{x}/{y}.png?key={clé}` — PNG transparent hors données.
En-têtes de réponse : `X-Dira-Cache: hit|miss`, `Cache-Control: max-age=300` + `ETag`.

**Fond raster** — `GET {site}/basemap/styles/basic-preview/{z}/{x}/{y}.png?key={clé}`.
**Style MapLibre** — `GET {site}/api/styles/{clé}.json?apparence=clair|sombre` (jour ou nuit ; sans
`apparence`, l'apparence par défaut du thème).

**Erreurs** : `401` clé absente/inconnue/révoquée · `403` service désactivé pour la clé ·
`429` quota (en-tête `Retry-After`, secondes) · `503` moteur indisponible · autres `4xx` = appel
invalide · `5xx` = réessayer plus tard. Le corps est `{ "detail": "…" }`.

## 4. Tâches, dans l'ordre

### Tâche 1 — Le client HTTP (`dira/DiraMapsClient.kt`)

Retrofit + OkHttp + kotlinx.serialization (ou Moshi), un intercepteur pour la clé, un mapping des
erreurs vers une `sealed class`. Pas de logique métier ici.

```kotlin
@JvmInline value class LngLat(val v: DoubleArray) { val lng get() = v[0]; val lat get() = v[1] }

object DiraCoords {                                         // LE seul endroit où l'ordre s'inverse
    fun LngLat.toLatLng() = LatLng(lat, lng)
    fun LatLng.toLngLat() = LngLat(doubleArrayOf(longitude, latitude))
}

sealed class DiraError(message: String) : Exception(message) {
    class Network(cause: Throwable) : DiraError("Dira Maps injoignable")
    object RoutingUnavailable : DiraError("moteur de routage indisponible")   // 503 → repli signalé
    class Auth(val status: Int) : DiraError("clé API refusée ($status)")      // 401/403 → configuration
    class Quota(val retryAfterS: Int?) : DiraError("quota atteint")           // 429
    class Request(val status: Int, val detail: String?) : DiraError("appel invalide")
    class Server(val status: Int) : DiraError("erreur serveur")
}

@Serializable data class RouteRequest(val ville: String, val coordinates: List<List<Double>>,
                                      val mode: String = "driving", val alternatives: Boolean = false)
@Serializable data class RouteResponse(val routes: List<Route>, val source: String? = null)
@Serializable data class Route(val geometry: Geometry, @SerialName("distance_m") val distanceM: Double? = null,
                               @SerialName("duration_s") val durationS: Double? = null)
@Serializable data class Geometry(val coordinates: List<List<Double>>)
@Serializable data class GeocodeResponse(val results: List<GeocodeResult>, val status: String)
@Serializable data class GeocodeResult(@SerialName("formatted_address") val formattedAddress: String, val geometry: GeoGeometry? = null)
@Serializable data class GeoGeometry(val location: GeoLocation)
@Serializable data class GeoLocation(val lat: Double, val lng: Double)

interface DiraMapsApi {
    @POST("calc/route") suspend fun route(@Body body: RouteRequest): RouteResponse
    @GET("geocode/reverse") suspend fun reverse(@Query("lat") lat: Double, @Query("lon") lon: Double): GeocodeResponse
    @GET("geocode") suspend fun geocode(@Query("q") q: String, @Query("ville") ville: String?, @Query("limit") limit: Int = 8): GeocodeResponse
}

class ApiKeyInterceptor(private val key: String?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val req = chain.request().newBuilder().apply { if (!key.isNullOrBlank()) header("X-Api-Key", key) }.build()
        return chain.proceed(req)
    }
}
```

La traduction HTTP → `DiraError` se fait en un seul endroit (un `runCatching` autour de chaque appel
ou un `CallAdapter`) : `HttpException` 503 → `RoutingUnavailable`, 401/403 → `Auth`, 429 → `Quota`
(lire `Retry-After`), `IOException` → `Network`. Délai : 8 s (réseaux mobiles lents).

**Acceptation** : un test unitaire (MockWebServer) par code : 200 parse la géométrie en `[lng, lat]`,
503 → `RoutingUnavailable`, 401 → `Auth`, 429 avec `Retry-After: 3600` → `Quota(3600)`, coupure →
`Network`. Un test vérifie que `X-Api-Key` est présent avec une clé et absent sans.

### Tâche 2 — Le service d'itinéraire (`dira/RouteService.kt`)

Encode les règles 3 et 4 : mémorisation par tournée, repli signalé.

```kotlin
data class RouteResult(val coordinates: List<LatLng>, val approximate: Boolean, val distanceM: Double?, val durationS: Double?)

class RouteService(private val api: DiraMapsApi) {
    private val cache = mutableMapOf<String, RouteResult>()

    suspend fun resolve(ville: String, stops: List<LngLat>): RouteResult {
        val key = "$ville|" + stops.joinToString("|") { "${it.lng},${it.lat}" }   // ville + étapes ORDONNÉES
        cache[key]?.let { return it }
        val result = try {
            val first = api.route(RouteRequest(ville, stops.map { listOf(it.lng, it.lat) })).routes.first()
            RouteResult(first.geometry.coordinates.map { LngLat(it.toDoubleArray()).toLatLng() }, approximate = false, first.distanceM, first.durationS)
        } catch (e: DiraError.RoutingUnavailable) {
            approximate(stops)                                   // règle 3 : en droite, ET marqué
        }                                                        // toute autre DiraError remonte (règle 6)
        cache[key] = result                                      // les échecs ne sont pas mémorisés
        return result
    }
    fun approximate(stops: List<LngLat>) = RouteResult(stops.map { it.toLatLng() }, approximate = true, null, null)
    fun clear() = cache.clear()                                  // fin de course, changement de tournée
}
```

**Acceptation** : deux `resolve` identiques → un seul appel réseau ; une tournée dont l'ordre des
étapes diffère → un nouvel appel ; 503 → `approximate = true` avec les étapes ; `Auth` n'est **pas**
transformée en droite.

### Tâche 3 — L'écran de carte (Google Maps SDK)

```kotlin
googleMap.addTileOverlay(TileOverlayOptions().tileProvider(object : UrlTileProvider(256, 256) {
    override fun getTileUrl(x: Int, y: Int, zoom: Int) =
        URL("${BuildConfig.DIRA_MAPS_API_URL}/tiles/${delivery.city}/$zoom/$x/$y.png?key=${BuildConfig.DIRA_MAPS_API_KEY}")
}).zIndex(1f))

lifecycleScope.launch {
    val result = routeService.resolve(delivery.city, stops)      // stops en LngLat, depuis l'API métier
    googleMap.addPolyline(PolylineOptions().addAll(result.coordinates).width(10f).color(0xFF7A1F2B.toInt())
        .pattern(if (result.approximate) listOf(Dash(20f), Gap(12f)) else null))     // règle 3
    if (result.approximate) banner.show("Itinéraire approximatif — moteur de routage indisponible")
}
```

Points à respecter : les `stops` viennent de l'API métier en `[lng, lat]` → `LngLat` ; les marqueurs
et la caméra utilisent `toLatLng()` ; le tracé de repli est dessiné **avant** la réponse réseau
(`routeService.approximate(stops)`) pour que la carte ne soit jamais vide.

**Acceptation** : sur un appareil, le tracé suit la voirie, le bâti Dira apparaît au zoom 15+ ;
réseau coupé → pointillé + bandeau. Google Maps SDK exige sa propre clé (`com.google.android.geo.API_KEY`
dans le manifeste) — c'est un prérequis de l'app, pas de Dira Maps.

### Tâche 4 — Géocodage

`api.reverse(lat, lon)` → `results.firstOrNull()?.formattedAddress ?: "Adresse inconnue"` — `ZERO_RESULTS`
n'est pas une erreur. `api.geocode(text, ville)` pour la saisie assistée ; `geometry.location` est
en `{lat, lng}` → `LatLng(lat, lng)` directement (ici Google et l'API sont d'accord).

**Acceptation** : le centre de Lomé (`6.1319, 1.2228`) rend une adresse ; « Lomé » rend un résultat.

### Tâche 5 — (optionnel) Le fond et le thème Dira avec MapLibre Native

Si l'app veut le fond Dira **aux couleurs du thème** du compte, c'est un autre composant de carte :
`org.maplibre.gl:android-sdk` (Maven Central). Le thème ne s'applique pas à Google Maps.

```kotlin
// Jour ou nuit : un état de VOTRE app (un bouton, un réglage). Un thème Dira a les deux
// palettes ; l'app dit laquelle, et rappelle setStyle quand elle change — la carte se redessine.
// (Pour suivre le système à la place : isSystemInDarkTheme() en Compose, ou
// resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK.)
val apparence = if (modeNuit) "sombre" else "clair"

mapView.getMapAsync { map ->
    map.setStyle(Style.Builder().fromUri("${BuildConfig.DIRA_MAPS_SITE_URL}/api/styles/${BuildConfig.DIRA_MAPS_API_KEY}.json?apparence=$apparence")) { style ->
        style.addSource(RasterSource("dira", TileSet("2.2.0",
            "${BuildConfig.DIRA_MAPS_API_URL}/tiles/${city}/{z}/{x}/{y}.png?key=${BuildConfig.DIRA_MAPS_API_KEY}"), 256))
        style.addLayer(RasterLayer("dira", "dira"))
        // itinéraire : GeoJsonSource + LineLayer, coordonnées en [lng, lat] — Point.fromLngLat(lng, lat)
    }
}
```

MapLibre parle en `[lng, lat]` (`Point.fromLngLat`) comme l'API : pas de `toLatLng` ici. Le fond
Dira ne couvre que ≈ 13 km autour de chaque ville ; hors de là il est vide — garder Google Maps pour
les écrans qui peuvent en sortir. Détails : `integration-themes.md`.

**Acceptation** : la carte affiche Lomé aux couleurs du thème réglé dans le portail ; basculer
`modeNuit` dans l'app et rappeler `setStyle` la passe de jour en nuit sans relance ; changer une
couleur dans le portail se voit après relance (cache 5 min).

## 5. Pièges connus

- **`lon` sur `/geocode/reverse`**, `ville` et `coordinates` sur `/calc/route` : ne pas « corriger »
  les noms de champs.
- **`UrlTileProvider` n'a pas d'en-têtes** : la clé va en `?key=` ; ne pas l'oublier, ne pas la
  mettre dans une constante.
- **Cache des tuiles** : après un import côté serveur, une tuile déjà vue reste ancienne jusqu'à
  5 min (`max-age=300` + `ETag`). Normal.
- **Émulateur sans Google Play** : Google Maps SDK n'affiche rien — tester sur une image avec Play
  Services ou sur un appareil. Ce n'est pas Dira Maps.
- **`RouteService` est par tournée** : `clear()` en fin de course, pas à chaque écran.

## 6. Vérifier sans appareil

Le banc d'essai du SDK React Native diagnostique le **déploiement** (itinéraire, cache, géocodage,
tuiles, couverture) sans simulateur — il vaut pour une app Android puisque c'est la même API :

```sh
git clone https://github.com/kgtech-org/dira-maps-react-native-sdk && cd dira-maps-react-native-sdk/example
npm install && EXPO_PUBLIC_MAPS_URL=https://maps.dira.llc/api EXPO_PUBLIC_MAPS_API_KEY=dira_live_… npm run check
```

Attendu : tout vert sauf « Surimpression WMS » (avertissement) et « Couverture du fond » 4/5 à Lomé
(tuile en mer). Si « Itinéraire routier » n'est pas vert, le problème est côté serveur : s'arrêter et
le signaler.

## 7. Ce que Claude Code doit rendre

- `dira/DiraMapsClient.kt` (tâche 1), `dira/RouteService.kt` (tâche 2), l'écran de carte (tâche 3),
  le géocodage là où l'app en a besoin (tâche 4).
- Les trois clés dans `local.properties.example`, documentées ; `BuildConfig` câblé.
- Tests unitaires verts (MockWebServer) ; une capture de l'écran de carte avec un tracé qui suit la
  voirie et le bâti Dira visible.
- Les règles de la section 1, cochées une par une dans la PR.

## Références

- Référence de comportement : le SDK React Native, `src/client.ts`, `src/route-service.ts`,
  `src/coords.ts`, `src/errors.ts` — https://github.com/kgtech-org/dira-maps-react-native-sdk
- API : `https://maps.dira.llc/docs` (OpenAPI).
- Thèmes : `docs/integration-themes.md`. Portail : `https://maps.dira.llc/admin/`.
