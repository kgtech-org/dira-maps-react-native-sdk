/**
 * SDK React Native de Dira Maps.
 *
 * Dira Maps n'a AUCUNE vue à intégrer : c'est un SIG web, ses clients sont des
 * applications de navigateur, et rien n'y est embarquable dans React Native.
 * Ce paquet fournit ce que Dira Maps donne réellement à une application
 * mobile — un tracé routier, des adresses — pour le poser sur la carte NATIVE
 * du téléphone. Voir le README.
 */
export { DiraMapsClient } from './client';
export type { DiraMapsClientOptions } from './client';
export { DiraMapsError } from './errors';
export type { DiraMapsErrorKind } from './errors';
export { RouteService, approximateRoute, tourKey } from './route-service';
export { toLatLng, toLatLngList, toLngLat, toLngLatList, isValidLngLat } from './coords';
export { decodePolyline, encodePolyline } from './polyline';
export { diraBasemapTemplate, diraStyleUrl, diraTileTemplate, diraOverlayTemplate } from './overlay';
export type {
  DiraBasemapOptions,
  DiraStyleOptions,
  DiraTileOptions,
  DiraOverlayOptions,
} from './overlay';
export { useRoute } from './use-route';
export type { UseRouteState } from './use-route';
export type {
  City,
  GeocodeResult,
  LatLng,
  LngLat,
  Route,
  RouteRequest,
  RouteResult,
  TravelMode,
} from './types';
