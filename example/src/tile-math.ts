/**
 * Conversion `[lng, lat]` → tuile `z/x/y`.
 *
 * Volontairement DANS l'exemple et non dans le SDK : une application n'a pas
 * besoin de calculer des tuiles, c'est le composant de carte qui le fait. Le
 * banc d'essai, lui, doit savoir quelle tuile demander pour vérifier qu'elle
 * contient bien quelque chose.
 */
export function tileForLngLat(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}
