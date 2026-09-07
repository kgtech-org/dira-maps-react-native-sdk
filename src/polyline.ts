import type { LngLat } from './types';

/**
 * Polylines encodées (algorithme Google, précision 5).
 *
 * Nécessaire parce que le parcours RÉELLEMENT effectué d'une course est figé
 * sous cette forme : `delivery.traveled_polyline`, produit par dira-tracking à
 * la complétion. Sans décodeur, une application ne peut pas redessiner ce
 * qu'un livreur a parcouru — seulement ce qu'il devait parcourir.
 */

const PRECISION = 1e5;

/** Décode une polyline en points `[lng, lat]`. Chaîne vide → liste vide. */
export function decodePolyline(encoded: string): LngLat[] {
  const points: LngLat[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    lat += decodeSignedValue(encoded, index, (next) => (index = next));
    lng += decodeSignedValue(encoded, index, (next) => (index = next));
    points.push([lng / PRECISION, lat / PRECISION]);
  }
  return points;
}

/**
 * Lit une valeur signée à partir de `start` et rend la position suivante par
 * `commit`. Les deux composantes d'un point se lisent avec la même boucle,
 * d'où l'extraction : la dupliquer inviterait à ne corriger qu'une des deux.
 */
function decodeSignedValue(
  encoded: string,
  start: number,
  commit: (next: number) => void,
): number {
  let result = 0;
  let shift = 0;
  let index = start;
  let chunk: number;

  do {
    chunk = encoded.charCodeAt(index++) - 63;
    result |= (chunk & 0x1f) << shift;
    shift += 5;
  } while (chunk >= 0x20 && index < encoded.length);

  commit(index);
  // Bit de poids faible = signe, le reste est décalé d'un cran.
  return result & 1 ? ~(result >> 1) : result >> 1;
}

/** Encode des points `[lng, lat]`. Inverse de {@link decodePolyline}. */
export function encodePolyline(points: readonly LngLat[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let out = '';

  for (const [lng, lat] of points) {
    const roundedLat = Math.round(lat * PRECISION);
    const roundedLng = Math.round(lng * PRECISION);
    out += encodeSignedValue(roundedLat - lastLat);
    out += encodeSignedValue(roundedLng - lastLng);
    lastLat = roundedLat;
    lastLng = roundedLng;
  }
  return out;
}

function encodeSignedValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  out += String.fromCharCode(v + 63);
  return out;
}
