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

/** Racine du SITE, pour le WMS direct (`/ows/`), hors de l'API. */
export const MAPS_SITE_URL = env('EXPO_PUBLIC_MAPS_SITE_URL', 'https://maps.dira.llc');

/** Ville testée, dans le vocabulaire des projets QGIS. */
export const CITY = env('EXPO_PUBLIC_MAPS_CITY', 'lome');

/** Centre de la ville testée, en `[lng, lat]`. */
export const CITY_CENTER: [number, number] = [
  Number(env('EXPO_PUBLIC_MAPS_LNG', '1.2228')),
  Number(env('EXPO_PUBLIC_MAPS_LAT', '6.1319')),
];

/** Une course plausible à Lomé : Tokoin → Bè, deux points distants d'environ 2 km. */
export const TOUR: [number, number][] = [
  [1.2216, 6.1425],
  [1.2312, 6.1352],
  [1.2405, 6.1289],
];
