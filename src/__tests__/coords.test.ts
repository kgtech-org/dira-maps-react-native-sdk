import { describe, expect, it } from 'vitest';

import { isValidLngLat, toLatLng, toLatLngList, toLngLat } from '../coords';

describe('coords', () => {
  // Lomé est le pire cas possible : 1.22 E et 6.14 N sont deux petits nombres
  // positifs, donc une inversion reste « plausible » à l'œil et au typage
  // structurel. Elle place pourtant le point au large de la Somalie.
  it('convertit Lomé sans inverser les axes', () => {
    expect(toLatLng([1.2216, 6.1425])).toEqual({ latitude: 6.1425, longitude: 1.2216 });
  });

  it('fait l’aller-retour sans perte', () => {
    const wire = [1.2216, 6.1425] as const;
    expect(toLngLat(toLatLng(wire))).toEqual([1.2216, 6.1425]);
  });

  it('convertit une polyline entière', () => {
    expect(toLatLngList([[1, 6], [2, 7]])).toEqual([
      { latitude: 6, longitude: 1 },
      { latitude: 7, longitude: 2 },
    ]);
  });

  it('rejette une latitude hors bornes, cas typique d’une inversion lointaine', () => {
    expect(isValidLngLat([-17.44, 14.69])).toBe(true); // Dakar
    expect(isValidLngLat([14.69, -17.44])).toBe(true); // inversée mais valide : non détectable ici
    expect(isValidLngLat([6.14, 122.16])).toBe(false); // latitude impossible
    expect(isValidLngLat([Number.NaN, 6.14])).toBe(false);
  });
});
