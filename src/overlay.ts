import type { City } from './types';

/**
 * Couches Dira en surimpression sur la carte native.
 *
 * ⚠️ Ce n'est PAS un fond de carte, et le nom de ce module le dit exprès.
 * Le serveur QGIS de Dira Maps publie trois couches — `routes`, `batiments`,
 * `points_interet` — importées d'OpenStreetMap dans PostGIS. Il n'y a ni eau,
 * ni occupation du sol, ni trait de côte, ni limites administratives, ni
 * étiquettes de rue : posées seules, elles donnent un plan noir sur blanc
 * flottant dans le vide, pas une carte.
 *
 * C'est pourquoi TOUS les clients Dira posent ces couches sur un sol qui vient
 * d'ailleurs — QWC2 configure un fond `mapnik` (OpenStreetMap), la carte web et
 * la console d'administration chargent des tuiles OSM, et en mobile le sol
 * vient du composant natif. Cette fonction sert à faire la même chose.
 *
 * ## Ce que ça coûte
 *
 * - **Emprise minuscule.** L'import OSM est borné à `DIRA_OSM_IMPORT_HALF`
 *   degrés autour du centre-ville, soit **≈ 2,6 km de côté** par défaut. Au
 *   delà, la surimpression est VIDE — pas moins détaillée : vide. Un livreur
 *   qui traverse Lomé sort de la zone couverte.
 * - **Rendu à la demande.** Chaque tuile est une requête PostGIS suivie d'une
 *   rasterisation par QGIS Server, sans cache devant. Une carte qu'on déplace
 *   en déclenche des dizaines.
 * - **`/ows/` n'est pas authentifié.** L'ouvrir aux clients mobiles, c'est
 *   exposer le SIG à l'internet.
 *
 * Pour un usage soutenu, la bonne réponse est un cache de tuiles (WMTS ou XYZ)
 * devant QGIS Server, pas cet appel direct.
 */
export interface DiraOverlayOptions {
  /**
   * Racine du SITE Dira Maps — `https://maps.dira.llc`.
   *
   * ⚠️ Différente de la base de l'API (`https://maps.dira.llc/api`) : le
   * serveur QGIS est servi sous `/ows/`, hors de l'API. Passer la base de
   * l'API produirait des 404 silencieux, la carte restant simplement vide.
   */
  siteUrl: string;
  city: City | string;
  /** Couches à dessiner, dans l'ordre. Par défaut : le bâti puis la voirie. */
  layers?: readonly string[];
  /** Fond transparent, pour laisser voir la carte native dessous. Vrai par défaut. */
  transparent?: boolean;
  /** Taille de tuile demandée au serveur. 256 par défaut. */
  tileSize?: number;
}

const DEFAULT_LAYERS = ['batiments', 'routes'] as const;

/**
 * Construit le gabarit d'URL d'une tuile WMS, au format attendu par les
 * composants de tuiles WMS de React Native (`{minX}`, `{minY}`, `{maxX}`,
 * `{maxY}`, `{width}`, `{height}`).
 *
 * Le SDK ne dessine rien : il rend une chaîne. Le rendu appartient au
 * composant de carte, et cela reste vrai ici.
 *
 * ```tsx
 * <WMSTile urlTemplate={diraOverlayTemplate({ siteUrl: 'https://maps.dira.llc', city: 'lome' })} />
 * ```
 */
export function diraOverlayTemplate(options: DiraOverlayOptions): string {
  const site = options.siteUrl.replace(/\/+$/, '');
  const layers = (options.layers ?? DEFAULT_LAYERS).join(',');
  const size = options.tileSize ?? 256;
  const params = [
    'SERVICE=WMS',
    'VERSION=1.3.0',
    'REQUEST=GetMap',
    `LAYERS=${encodeURIComponent(layers)}`,
    'STYLES=',
    // EPSG:3857 : la projection des tuiles, dont l'ordre des axes est x,y —
    // celui des gabarits. En 4326, WMS 1.3.0 attend lat,lon et la carte se
    // retrouverait transposée sans qu'aucune erreur ne soit levée.
    `CRS=${encodeURIComponent('EPSG:3857')}`,
    'BBOX={minX},{minY},{maxX},{maxY}',
    `WIDTH=${size}`,
    `HEIGHT=${size}`,
    'FORMAT=image/png',
    `TRANSPARENT=${options.transparent === false ? 'FALSE' : 'TRUE'}`,
  ];
  return `${site}/ows/dira_${options.city}?${params.join('&')}`;
}
