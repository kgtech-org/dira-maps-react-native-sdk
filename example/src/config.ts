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
 * Emprunter le sol du composant natif, ou poser les tuiles Dira seules.
 *
 * Vrai par défaut : c'est le partage des rôles que le SDK enseigne, et le seul
 * correct sur un vrai téléphone. Le mettre à `0` force les tuiles Dira sans
 * aucun fond tiers — utile là où la carte native ne démarre pas (Expo Go sur
 * Android refuse la clé Google), et pour regarder ce que Dira sert VRAIMENT,
 * sans le sol d'un autre en dessous pour boucher les trous.
 */
export const NATIVE_GROUND = env('EXPO_PUBLIC_MAPS_NATIVE_GROUND', '1') !== '0';

/** Une course plausible à Lomé : Tokoin → Bè, deux points distants d'environ 2 km. */
export const TOUR: [number, number][] = [
  [1.2216, 6.1425],
  [1.2312, 6.1352],
  [1.2405, 6.1289],
];
