/**
 * Contrats de données de Dira Maps.
 *
 * Règle de coordonnées valable dans TOUTE la plateforme Dira : le fil parle
 * `[lng, lat]` (ordre GeoJSON). Les composants de carte mobiles parlent
 * `{ latitude, longitude }`. Les deux types sont distincts ici pour que le
 * compilateur refuse une confusion que l'œil ne rattrape pas : à Lomé
 * (6.14 N, 1.22 E) deux petits nombres positifs inversés placent le marqueur
 * au large de la Somalie, sans erreur ni avertissement.
 */

/** Point tel qu'il circule sur le fil : [longitude, latitude]. */
export type LngLat = readonly [number, number];

/** Point tel que l'attendent les composants de carte natifs. */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Ville desservie, dans le vocabulaire de Dira Maps — ce sont les noms des
 * projets QGIS (`dira_lome.qgs`…), pas des libellés d'affichage. L'API métier
 * sert ce code sur la course (`delivery.city`) : le prendre de là plutôt que
 * de le déduire des coordonnées.
 */
export type City = 'lome' | 'cotonou' | 'abidjan' | 'dakar';

/** Modes de déplacement acceptés par le moteur de routage. */
export type TravelMode = 'driving' | 'walking' | 'cycling';

export interface RouteRequest {
  /** Code de ville ; sert de clé de cache côté serveur. */
  city: City | string;
  /** Départ, étapes intermédiaires dans l'ordre, arrivée. Au moins deux. */
  coordinates: readonly LngLat[];
  mode?: TravelMode;
  /** Faux par défaut : une tournée imposée n'a pas de variantes utiles. */
  alternatives?: boolean;
}

export interface Route {
  /** Géométrie du tracé, dans l'ordre du parcours. */
  coordinates: LngLat[];
  /** Durée estimée en secondes, quand le moteur la fournit. */
  durationS?: number;
  /** Distance en mètres, quand le moteur la fournit. */
  distanceM?: number;
}

export interface RouteResult {
  /** Itinéraire retenu. */
  route: Route;
  /** Variantes, vides si `alternatives` était faux. */
  alternatives: Route[];
  /**
   * Vrai quand le tracé ne vient PAS du réseau routier mais de segments
   * droits entre les étapes. À afficher : présenter une ligne droite comme un
   * itinéraire ferait rouler quelqu'un dans un mur.
   */
  approximate: boolean;
  /** `redis` ou `engine` selon que le serveur a servi son cache. */
  source?: string;
}

export interface GeocodeResult {
  /** Adresse formatée, telle que rendue par le fournisseur. */
  formattedAddress: string;
  location?: LngLat;
  raw: unknown;
}
