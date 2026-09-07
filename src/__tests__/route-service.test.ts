import { describe, expect, it, vi } from 'vitest';

import { DiraMapsClient } from '../client';
import { DiraMapsError } from '../errors';
import { RouteService, approximateRoute, tourKey } from '../route-service';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const TOUR = {
  city: 'lome',
  coordinates: [[1.2216, 6.1425], [1.2312, 6.1352], [1.2405, 6.1289]],
} as const;

const ROAD = {
  routes: [{ geometry: { coordinates: [[1.2216, 6.1425], [1.225, 6.139], [1.2405, 6.1289]] } }],
};

function serviceWith(fetchImpl: typeof fetch) {
  return new RouteService(new DiraMapsClient({ baseUrl: 'https://maps.dira.llc/api', fetch: fetchImpl }));
}

describe('RouteService', () => {
  it('rend le tracé routier et ne le marque pas approximatif', async () => {
    const service = serviceWith(vi.fn(async () => json(ROAD)) as unknown as typeof fetch);
    const result = await service.resolve({ ...TOUR });
    expect(result.route.coordinates).toHaveLength(3);
    expect(result.approximate).toBe(false);
  });

  // Une requête par tournée, pas par position GPS : le tracé ne change pas
  // parce que le livreur avance dessus, et l'API est limitée en débit.
  it('n’interroge le serveur qu’une fois pour la même tournée', async () => {
    const fetchImpl = vi.fn(async () => json(ROAD)) as unknown as typeof fetch;
    const service = serviceWith(fetchImpl);

    await Promise.all([service.resolve({ ...TOUR }), service.resolve({ ...TOUR })]);
    await service.resolve({ ...TOUR });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('réinterroge quand la tournée change', async () => {
    const fetchImpl = vi.fn(async () => json(ROAD)) as unknown as typeof fetch;
    const service = serviceWith(fetchImpl);

    await service.resolve({ ...TOUR });
    // Une collecte validée : la tournée n'a plus le même départ.
    await service.resolve({ city: 'lome', coordinates: [TOUR.coordinates[1], TOUR.coordinates[2]] });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('se replie en segments droits quand aucun moteur n’est configuré, et le dit', async () => {
    const service = serviceWith(vi.fn(async () => json({}, 503)) as unknown as typeof fetch);
    const result = await service.resolve({ ...TOUR });

    expect(result.approximate).toBe(true);
    expect(result.route.coordinates).toEqual(TOUR.coordinates.map((p) => [p[0], p[1]]));
  });

  // Une coupure passagère ne doit pas condamner la course : la remonter permet
  // à l'appelant de réessayer, et l'échec ne reste pas en cache.
  it('remonte une panne réseau au lieu de la mémoriser', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const service = serviceWith(fetchImpl);

    await expect(service.resolve({ ...TOUR })).rejects.toBeInstanceOf(DiraMapsError);
    await expect(service.resolve({ ...TOUR })).rejects.toBeInstanceOf(DiraMapsError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('tourKey', () => {
  it('distingue deux tournées dont l’ordre des étapes diffère', () => {
    const a = tourKey({ city: 'lome', coordinates: [[1, 6], [2, 7]] });
    const b = tourKey({ city: 'lome', coordinates: [[2, 7], [1, 6]] });
    expect(a).not.toBe(b);
  });

  it('distingue deux villes', () => {
    expect(tourKey({ city: 'lome', coordinates: [[1, 6], [2, 7]] })).not.toBe(
      tourKey({ city: 'dakar', coordinates: [[1, 6], [2, 7]] }),
    );
  });
});

describe('approximateRoute', () => {
  it('est marqué approximatif : une droite présentée comme un itinéraire trompe', () => {
    expect(approximateRoute([[1, 6], [2, 7]]).approximate).toBe(true);
  });
});
