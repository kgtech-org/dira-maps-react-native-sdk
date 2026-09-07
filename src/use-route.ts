import { useEffect, useState } from 'react';

import { DiraMapsError } from './errors';
import { approximateRoute, type RouteService } from './route-service';
import { toLatLngList } from './coords';
import type { LatLng, RouteRequest, RouteResult } from './types';

export interface UseRouteState {
  /** Tracé prêt pour une `<Polyline>` native. Jamais nul : au pire, les étapes. */
  coordinates: LatLng[];
  /**
   * Vrai quand le tracé est fait de segments droits et non du réseau routier.
   * L'écran DOIT le signaler.
   */
  approximate: boolean;
  loading: boolean;
  /** Échec autre que l'absence de moteur, qui, lui, se replie silencieusement. */
  error: DiraMapsError | null;
}

/**
 * Tracé d'une tournée, prêt à dessiner.
 *
 * Rend d'emblée les étapes reliées en droite, puis les remplace par le vrai
 * tracé dès qu'il arrive : une carte vide pendant deux secondes de réseau
 * mobile donne l'impression que l'application n'a rien compris à la course.
 *
 * Passer `request` à `null` met le tracé en pause — utile tant qu'aucune course
 * n'est acceptée.
 */
export function useRoute(service: RouteService, request: RouteRequest | null): UseRouteState {
  const [state, setState] = useState<{ result: RouteResult; loading: boolean; error: DiraMapsError | null }>(
    () => ({
      result: approximateRoute(request?.coordinates ?? []),
      loading: request !== null,
      error: null,
    }),
  );

  // La clé est la tournée elle-même : un nouvel objet `request` identique en
  // contenu ne doit pas relancer une requête à chaque rendu.
  const key = request ? keyOf(request) : null;

  useEffect(() => {
    if (!request) {
      setState({ result: approximateRoute([]), loading: false, error: null });
      return;
    }
    const controller = new AbortController();
    setState((prev) => ({
      result: prev.result.approximate ? approximateRoute(request.coordinates) : prev.result,
      loading: true,
      error: null,
    }));

    service
      .resolve(request, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setState({ result, loading: false, error: null });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          result: approximateRoute(request.coordinates),
          loading: false,
          error:
            cause instanceof DiraMapsError
              ? cause
              : new DiraMapsError('server', 'itinéraire indisponible'),
        });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, key]);

  return {
    coordinates: toLatLngList(state.result.route.coordinates),
    approximate: state.result.approximate,
    loading: state.loading,
    error: state.error,
  };
}

function keyOf(request: RouteRequest): string {
  return `${request.city}|${request.mode ?? 'driving'}|${request.coordinates
    .map((p) => `${p[0]},${p[1]}`)
    .join(';')}`;
}
