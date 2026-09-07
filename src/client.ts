import { DiraMapsError } from './errors';
import type { GeocodeResult, LngLat, Route, RouteRequest, RouteResult } from './types';

export interface DiraMapsClientOptions {
  /**
   * Racine de l'API, par exemple `https://maps.dira.llc/api`.
   *
   * Distincte de celle de l'API métier et de celle du tracking : ce sont trois
   * services déployables séparément, et une variable pour trois interdirait
   * d'en déplacer un.
   */
  baseUrl: string;
  /** Délai maximal par requête. 8 s par défaut (réseaux mobiles lents). */
  timeoutMs?: number;
  /** Injection pour les tests ; `globalThis.fetch` par défaut. */
  fetch?: typeof fetch;
}

/**
 * Client des routes publiques de Dira Maps.
 *
 * Ce SDK ne rend AUCUNE carte, et n'en rendra pas : Dira Maps est un SIG web,
 * ses clients sont des applications de navigateur, et rien n'y est embarquable
 * dans React Native. Ce qui traverse le fil est du JSON. Le fond de carte
 * vient du composant natif du téléphone ; ce client fournit ce qu'on dessine
 * dessus.
 */
export class DiraMapsClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly doFetch: typeof fetch;

  constructor(options: DiraMapsClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 8_000;
    const injected = options.fetch ?? globalThis.fetch;
    if (!injected) {
      throw new Error('DiraMapsClient: aucun fetch disponible, en fournir un');
    }
    this.doFetch = injected;
  }

  /**
   * Itinéraire multi-étapes sur le réseau routier réel.
   *
   * À appeler UNE FOIS PAR TOURNÉE, pas à chaque position GPS : le tracé ne
   * change pas parce qu'on avance dessus, l'API est limitée en débit, et
   * chaque appel non caché consomme le quota du moteur de routage.
   */
  async route(request: RouteRequest, signal?: AbortSignal): Promise<RouteResult> {
    if (request.coordinates.length < 2) {
      throw new DiraMapsError('request', 'route: au moins deux points sont nécessaires');
    }
    const body = {
      ville: request.city,
      coordinates: request.coordinates.map((p) => [p[0], p[1]]),
      mode: request.mode ?? 'driving',
      alternatives: request.alternatives ?? false,
    };
    const payload = await this.post<RoutePayload>('/calc/route', body, signal);
    const routes = (payload.routes ?? []).map(toRoute).filter((r) => r.coordinates.length >= 2);
    const [first, ...rest] = routes;
    if (!first) {
      throw new DiraMapsError('server', 'route: le moteur a rendu un itinéraire vide');
    }
    const result: RouteResult = { route: first, alternatives: rest, approximate: false };
    if (payload.source !== undefined) result.source = payload.source;
    return result;
  }

  /**
   * Adresse d'un point.
   *
   * L'API attend `lon` là où tout le reste de la plateforme écrit `lng` : ce
   * client normalise, les appelants passent `lng` partout.
   */
  async reverseGeocode(point: LngLat, signal?: AbortSignal): Promise<GeocodeResult | null> {
    const query = queryString({ lat: point[1], lon: point[0] });
    const payload = await this.get<GeocodePayload>(`/geocode/reverse?${query}`, signal);
    return firstGeocodeResult(payload);
  }

  /** Recherche d'adresse. `city` restreint au besoin. */
  async geocode(
    q: string,
    options: { city?: string; limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<GeocodeResult[]> {
    const query = queryString({ q, ville: options.city, limit: options.limit });
    const payload = await this.get<GeocodePayload>(`/geocode?${query}`, signal);
    return (payload.results ?? []).map(toGeocodeResult);
  }

  private get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.send<T>(path, { method: 'GET' }, signal);
  }

  private post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return this.send<T>(
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      signal,
    );
  }

  private async send<T>(path: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
    // Le délai du SDK et l'annulation de l'appelant doivent tous deux couper :
    // un écran quitté ne doit pas attendre le timeout pour libérer la requête.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);

    let response: Response;
    try {
      response = await this.doFetch(this.baseUrl + path, { ...init, signal: controller.signal });
    } catch (cause) {
      // Une annulation demandée par l'appelant n'est pas une panne : on la
      // laisse remonter telle quelle, sinon un changement d'écran ressemblerait
      // à un incident réseau dans les journaux.
      if (signal?.aborted) throw cause;
      const timedOut = controller.signal.aborted;
      throw new DiraMapsError(
        timedOut ? 'timeout' : 'network',
        timedOut ? `Dira Maps: délai dépassé sur ${path}` : `Dira Maps: ${path} injoignable`,
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    if (!response.ok) throw httpError(path, response.status);
    try {
      return (await response.json()) as T;
    } catch {
      throw new DiraMapsError('server', `Dira Maps: réponse illisible sur ${path}`, response.status);
    }
  }
}

/**
 * Construit une chaîne de requête, les valeurs `undefined` étant omises.
 *
 * Écrit à la main plutôt qu'avec `URLSearchParams` : ce global n'est que
 * partiellement implémenté selon les versions de React Native, et une
 * bibliothèque destinée au mobile ne peut pas parier là-dessus.
 */
function queryString(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

function httpError(path: string, status: number): DiraMapsError {
  if (status === 503) {
    return new DiraMapsError(
      'routing_unavailable',
      `Dira Maps: aucun moteur de routage configuré (${path})`,
      status,
    );
  }
  if (status >= 400 && status < 500) {
    return new DiraMapsError('request', `Dira Maps: ${status} sur ${path}`, status);
  }
  return new DiraMapsError('server', `Dira Maps: ${status} sur ${path}`, status);
}

interface RoutePayload {
  routes?: {
    geometry?: { coordinates?: number[][] };
    duration?: number;
    distance?: number;
  }[];
  source?: string;
}

function toRoute(raw: NonNullable<RoutePayload['routes']>[number]): Route {
  const coordinates: LngLat[] = (raw.geometry?.coordinates ?? [])
    .filter((p): p is number[] => Array.isArray(p) && p.length >= 2)
    .map((p) => [p[0] as number, p[1] as number] as LngLat);
  const route: Route = { coordinates };
  if (typeof raw.duration === 'number') route.durationS = raw.duration;
  if (typeof raw.distance === 'number') route.distanceM = raw.distance;
  return route;
}

interface GeocodePayload {
  results?: { formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }[];
}

function toGeocodeResult(raw: NonNullable<GeocodePayload['results']>[number]): GeocodeResult {
  const result: GeocodeResult = { formattedAddress: raw.formatted_address ?? '', raw };
  const loc = raw.geometry?.location;
  if (typeof loc?.lat === 'number' && typeof loc?.lng === 'number') {
    result.location = [loc.lng, loc.lat];
  }
  return result;
}

function firstGeocodeResult(payload: GeocodePayload): GeocodeResult | null {
  const first = payload.results?.[0];
  // Aucun résultat est une réponse LÉGITIME (ZERO_RESULTS) : un point en pleine
  // brousse n'a pas d'adresse. Rendre null, pas une erreur.
  return first ? toGeocodeResult(first) : null;
}
