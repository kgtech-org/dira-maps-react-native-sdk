import { describe, expect, it, vi } from 'vitest';

import { DiraMapsClient } from '../client';
import { DiraMapsError } from '../errors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const ROUTE_BODY = {
  routes: [{ geometry: { coordinates: [[1.2216, 6.1425], [1.2312, 6.1352]] }, distance: 1420 }],
  source: 'engine',
};


/** Capte l'erreur d'une promesse et échoue si elle aboutit. */
async function captureError(promise: Promise<unknown>): Promise<DiraMapsError> {
  try {
    await promise;
  } catch (error) {
    return error as DiraMapsError;
  }
  throw new Error('attendu : un rejet, obtenu : une réponse');
}

function clientWith(fetchImpl: typeof fetch) {
  return new DiraMapsClient({ baseUrl: 'https://maps.dira.llc/api/', fetch: fetchImpl });
}

describe('DiraMapsClient.route', () => {
  it('poste la ville sous le nom attendu par le serveur et rend le tracé', async () => {
    const fetchImpl = vi.fn(async () => json(ROUTE_BODY)) as unknown as typeof fetch;
    const result = await clientWith(fetchImpl).route({
      city: 'lome',
      coordinates: [[1.2216, 6.1425], [1.2312, 6.1352]],
    });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    // La barre finale de baseUrl ne doit pas produire un double slash.
    expect(url).toBe('https://maps.dira.llc/api/calc/route');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      ville: 'lome',
      coordinates: [[1.2216, 6.1425], [1.2312, 6.1352]],
      mode: 'driving',
      // Une tournée imposée n'a pas de variantes utiles : faux par défaut.
      alternatives: false,
    });
    expect(result.route.coordinates).toHaveLength(2);
    expect(result.route.distanceM).toBe(1420);
    expect(result.approximate).toBe(false);
    expect(result.source).toBe('engine');
  });

  it('refuse une tournée d’un seul point sans toucher au réseau', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      clientWith(fetchImpl).route({ city: 'lome', coordinates: [[1.22, 6.14]] }),
    ).rejects.toThrow(DiraMapsError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  // 503 = aucun moteur configuré. Réessayer en boucle n'y changerait rien :
  // c'est le seul cas où se replier sur des segments droits est la conduite.
  it('classe le 503 comme « se replier », pas comme une panne passagère', async () => {
    const fetchImpl = vi.fn(async () => json({ detail: 'x' }, 503)) as unknown as typeof fetch;
    const error = await captureError(
      clientWith(fetchImpl).route({ city: 'lome', coordinates: [[1.22, 6.14], [1.23, 6.13]] }),
    );

    expect(error).toBeInstanceOf(DiraMapsError);
    expect(error.kind).toBe('routing_unavailable');
    expect(error.shouldFallBackToStraightLines).toBe(true);
  });

  it('distingue une panne réseau d’un refus du serveur', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const error = await captureError(
      clientWith(fetchImpl).route({ city: 'lome', coordinates: [[1.22, 6.14], [1.23, 6.13]] }),
    );

    expect(error.kind).toBe('network');
    expect(error.shouldFallBackToStraightLines).toBe(false);
  });
});

describe('DiraMapsClient — clé API', () => {
  const tour = { city: 'lome', coordinates: [[1.22, 6.14], [1.23, 6.13]] as [number, number][] };

  it('envoie la clé en X-Api-Key sur chaque appel, et rien sans clé', async () => {
    const fetchImpl = vi.fn(async () => json(ROUTE_BODY)) as unknown as typeof fetch;
    await new DiraMapsClient({
      baseUrl: 'https://maps.dira.llc/api',
      apiKey: 'dira_live_abc',
      fetch: fetchImpl,
    }).route(tour);
    const init = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]![1];
    expect(new Headers(init.headers).get('X-Api-Key')).toBe('dira_live_abc');
    // Le Content-Type du POST n'a pas été perdu en ajoutant l'en-tête.
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');

    await clientWith(fetchImpl).route(tour);
    const sans = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[1]![1];
    expect(new Headers(sans.headers).get('X-Api-Key')).toBeNull();
  });

  it('classe 401 et 403 comme « auth » : une configuration à corriger, pas à réessayer', async () => {
    for (const status of [401, 403]) {
      const fetchImpl = vi.fn(async () => json({ detail: 'x' }, status)) as unknown as typeof fetch;
      const error = await captureError(clientWith(fetchImpl).route(tour));
      expect(error.kind).toBe('auth');
      expect(error.shouldFallBackToStraightLines).toBe(false);
    }
  });

  it('classe 429 comme « quota » et rapporte quand réessayer', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('{}', {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
        }),
    ) as unknown as typeof fetch;
    const error = await captureError(clientWith(fetchImpl).route(tour));
    expect(error.kind).toBe('quota');
    expect(error.retryAfterS).toBe(3600);
  });
});

describe('DiraMapsClient.reverseGeocode', () => {
  // Seul endroit de la plateforme où le paramètre s'appelle `lon` : le client
  // normalise pour que les appelants écrivent `lng` partout.
  it('traduit lng en lon, que l’API seule attend', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ results: [{ formatted_address: 'Tokoin, Lomé' }] }),
    ) as unknown as typeof fetch;

    const result = await clientWith(fetchImpl).reverseGeocode([1.2216, 6.1425]);

    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toContain('lat=6.1425');
    expect(url).toContain('lon=1.2216');
    expect(url).not.toContain('lng=');
    expect(result?.formattedAddress).toBe('Tokoin, Lomé');
  });

  it('rend null sur ZERO_RESULTS : un point sans adresse n’est pas une erreur', async () => {
    const fetchImpl = vi.fn(async () => json({ results: [], status: 'ZERO_RESULTS' })) as unknown as typeof fetch;
    await expect(clientWith(fetchImpl).reverseGeocode([1.22, 6.14])).resolves.toBeNull();
  });
});
