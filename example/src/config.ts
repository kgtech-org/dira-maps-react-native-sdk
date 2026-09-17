/**
 * Cibles du banc d'essai.
 *
 * Les trois services Dira se déploient séparément : une seule variable pour
 * plusieurs interdirait d'en déplacer un. `EXPO_PUBLIC_` est le préfixe qu'Expo
 * expose au bundle ; le même est lu par l'exécuteur en ligne de commande.
 */
const env = (key: string, fallback: string): string =>
  (typeof process !== 'undefined' && process.env?.[key]) || fallback;

/** Racine de l'API Dira Maps — `/api` compris. */
export const MAPS_API_URL = env('EXPO_PUBLIC_MAPS_URL', 'https://maps.dira.llc/api');

/**
 * Clé API de l'application, créée dans le portail Dira Maps (`/admin/`).
 * Vide : appels anonymes — acceptés tant que Dira Maps ne rend pas la clé
 * obligatoire, et comptés comme tels dans la console.
 */
export const MAPS_API_KEY = env('EXPO_PUBLIC_MAPS_API_KEY', '') || undefined;

/** Racine du SITE, pour le WMS direct (`/ows/`), hors de l'API. */
export const MAPS_SITE_URL = env('EXPO_PUBLIC_MAPS_SITE_URL', 'https://maps.dira.llc');

/** Ville testée, dans le vocabulaire des projets QGIS. */
export const CITY = env('EXPO_PUBLIC_MAPS_CITY', 'lome');

/** Centre de la ville testée, en `[lng, lat]`. */
export const CITY_CENTER: [number, number] = [
  Number(env('EXPO_PUBLIC_MAPS_LNG', '1.2228')),
  Number(env('EXPO_PUBLIC_MAPS_LAT', '6.1319')),
];

/**
 * Le moteur de carte — LE choix d'une application, et il se fait chez elle,
 * pas dans le SDK, qui ne rend aucune vue et alimente les trois pareil :
 *
 *  - `maplibre` : le fond vectoriel Dira aux couleurs du thème, jour et nuit
 *    (`@maplibre/maplibre-react-native` — un development build) ;
 *  - `native`   : la carte du téléphone, Google sur Android (sa clé dans
 *    `app.config.js`), Apple sur iOS, tuiles Dira par-dessus
 *    (`react-native-maps`) — le thème ne s'y applique pas ;
 *  - `tiles`    : les tuiles Dira seules, sans aucun fond tiers — ce que Dira
 *    sert VRAIMENT, sans le sol d'un autre pour boucher les trous.
 *
 * Vide : `maplibre` en development build, sinon `native` là où son sol vient
 * (Expo Go sur Android refuse la clé Google) et `tiles` ailleurs.
 */
export type Engine = 'maplibre' | 'native' | 'tiles';
const engine = env('EXPO_PUBLIC_MAPS_ENGINE', '');
export const ENGINE: Engine | null =
  engine === 'maplibre' || engine === 'native' || engine === 'tiles' ? engine : null;

/** Une course plausible à Lomé : Tokoin → Bè, deux points distants d'environ 2 km. */
export const TOUR: [number, number][] = [
  [1.2216, 6.1425],
  [1.2312, 6.1352],
  [1.2405, 6.1289],
];
