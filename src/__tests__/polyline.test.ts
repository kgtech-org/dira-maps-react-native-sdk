import { describe, expect, it } from 'vitest';

import { decodePolyline, encodePolyline } from '../polyline';

describe('polyline', () => {
  // Vecteur de référence de la spécification Google, en [lng, lat].
  const ENCODED = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
  const POINTS = [
    [-120.2, 38.5],
    [-120.95, 40.7],
    [-126.453, 43.252],
  ] as const;

  it('décode le vecteur de référence', () => {
    const decoded = decodePolyline(ENCODED);
    expect(decoded).toHaveLength(3);
    decoded.forEach((point, i) => {
      expect(point[0]).toBeCloseTo(POINTS[i]![0], 5);
      expect(point[1]).toBeCloseTo(POINTS[i]![1], 5);
    });
  });

  it('encode vers le vecteur de référence', () => {
    expect(encodePolyline(POINTS.map((p) => [p[0], p[1]] as [number, number]))).toBe(ENCODED);
  });

  it('fait l’aller-retour sur un tracé de Lomé', () => {
    const route: [number, number][] = [
      [1.2216, 6.1425],
      [1.2312, 6.1352],
      [1.2405, 6.1289],
    ];
    const roundTripped = decodePolyline(encodePolyline(route));
    roundTripped.forEach((point, i) => {
      expect(point[0]).toBeCloseTo(route[i]![0], 5);
      expect(point[1]).toBeCloseTo(route[i]![1], 5);
    });
  });

  it('rend une liste vide sur une chaîne vide', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});
