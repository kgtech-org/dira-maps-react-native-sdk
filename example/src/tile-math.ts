/**
 * Conversion `[lng, lat]` → tuile `z/x/y`.
 *
 * Volontairement DANS l'exemple et non dans le SDK : une application n'a pas
 * besoin de calculer des tuiles, c'est le composant de carte qui le fait. Le
 * banc d'essai, lui, doit savoir quelle tuile demander pour vérifier qu'elle
 * contient bien quelque chose — et, quand aucun composant de carte ne veut
 * démarrer, les poser lui-même.
 */

/** Côté d'une tuile, en pixels. La grille XYZ n'en connaît pas d'autre. */
export const TILE_SIZE = 256;

/**
 * Position FRACTIONNAIRE dans la grille de tuiles.
 *
 * La partie entière donne la tuile, la partie décimale la position DANS cette
 * tuile. C'est cette seconde moitié qui permet de placer un point au bon pixel
 * plutôt qu'au coin de sa tuile — un marqueur arrondi à la tuile serait faux de
 * plus d'un kilomètre au zoom 14.
 */
export function tilePosition(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n,
  };
}

export function tileForLngLat(lng: number, lat: number, z: number): { x: number; y: number } {
  const { x, y } = tilePosition(lng, lat, z);
  return { x: Math.floor(x), y: Math.floor(y) };
}
