import { DiraMapsClient } from './client';
import { DiraMapsError } from './errors';
import type { LngLat, RouteRequest, RouteResult } from './types';

/**
 * Itinéraire d'une tournée, avec repli assumé et mémorisation.
 *
 * Deux règles du parcours livreur sont appliquées ici plutôt que laissées à
 * chaque écran, parce qu'oubliées elles ne se voient pas :
 *
 *  1. **Se replier en segments droits ET le dire.** Quand le moteur de routage
 *     est absent, une ligne droite reste utile pour situer les étapes — mais
 *     présentée comme un itinéraire, elle ferait rouler quelqu'un dans un mur.
 *     `approximate` porte cette distinction jusqu'à l'écran.
 *  2. **Une requête par tournée, pas par position GPS.** Le tracé ne change pas
 *     parce qu'on avance dessus.
 */
export class RouteService {
  private readonly client: DiraMapsClient;
  private readonly cache = new Map<string, Promise<RouteResult>>();

  constructor(client: DiraMapsClient) {
    this.client = client;
  }

  /**
   * Rend le tracé de la tournée. Deux appels avec la même tournée ne
   * produisent qu'une requête, même lancés avant que la première réponde.
   */
  async resolve(request: RouteRequest, signal?: AbortSignal): Promise<RouteResult> {
    const key = tourKey(request);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const pending = this.fetchOrApproximate(request, signal);
    this.cache.set(key, pending);
    try {
      return await pending;
    } catch (error) {
      // Un échec ne doit pas être mémorisé : la tournée suivante réessaiera,
      // sinon une coupure passagère condamnerait la course entière.
      this.cache.delete(key);
      throw error;
    }
  }

  /** Oublie les tracés mémorisés (fin de course, changement de tournée). */
  clear(): void {
    this.cache.clear();
  }

  private async fetchOrApproximate(
    request: RouteRequest,
    signal?: AbortSignal,
  ): Promise<RouteResult> {
    try {
      return await this.client.route(request, signal);
    } catch (error) {
      if (error instanceof DiraMapsError && error.shouldFallBackToStraightLines) {
        return approximateRoute(request.coordinates);
      }
      throw error;
    }
  }
}

/**
 * Tracé de repli : les étapes reliées en droite, marqué `approximate`.
 *
 * Exposé parce qu'un appelant peut vouloir afficher la tournée avant même
 * d'avoir interrogé le serveur — un écran vide en attendant le réseau vaut
 * moins qu'une esquisse honnêtement étiquetée.
 */
export function approximateRoute(stops: readonly LngLat[]): RouteResult {
  return {
    route: { coordinates: stops.map((p) => [p[0], p[1]] as LngLat) },
    alternatives: [],
    approximate: true,
  };
}

/**
 * Clé d'une tournée : la ville, le mode et la suite exacte des étapes. Deux
 * tournées ne diffèrent que par là, et l'ordre compte — inverser deux collectes
 * donne un autre parcours.
 */
export function tourKey(request: RouteRequest): string {
  const points = request.coordinates.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(';');
  return `${request.city}|${request.mode ?? 'driving'}|${request.alternatives ? 'alt' : 'single'}|${points}`;
}
