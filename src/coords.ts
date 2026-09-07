import type { LatLng, LngLat } from './types';

/**
 * Conversions entre l'ordre du fil et celui des cartes natives.
 *
 * Ces quatre fonctions sont le SEUL endroit du code où l'ordre des
 * coordonnées est inversé. Toute inversion écrite à la main ailleurs finit par
 * s'écarter de celle-ci le jour où quelqu'un se trompe, et le symptôme — un
 * marqueur dans le golfe de Guinée — n'apparaît qu'à l'exécution.
 */

/** `[lng, lat]` (fil) → `{ latitude, longitude }` (carte native). */
export function toLatLng(point: LngLat): LatLng {
  return { latitude: point[1], longitude: point[0] };
}

/** `{ latitude, longitude }` (carte native) → `[lng, lat]` (fil). */
export function toLngLat(point: LatLng): LngLat {
  return [point.longitude, point.latitude];
}

/** Version liste de {@link toLatLng}, pour une polyline. */
export function toLatLngList(points: readonly LngLat[]): LatLng[] {
  return points.map(toLatLng);
}

/** Version liste de {@link toLngLat}. */
export function toLngLatList(points: readonly LatLng[]): LngLat[] {
  return points.map(toLngLat);
}

/**
 * Garde-fou : rejette une coordonnée hors des bornes terrestres.
 *
 * Prise seule, elle n'attrape pas toutes les inversions — à Lomé les deux
 * valeurs sont valides dans les deux sens. Elle attrape en revanche celles qui
 * produisent une latitude hors [-90, 90], c'est-à-dire toute inversion à plus
 * de 90° de longitude, et coûte assez peu pour être posée à la frontière.
 */
export function isValidLngLat(point: LngLat): boolean {
  const [lng, lat] = point;
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}
