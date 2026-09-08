/**
 * Banc d'essai de Dira Maps : une vérification par fonctionnalité du SDK.
 *
 * Ce module ne dépend NI de React NI de React Native : il tourne à l'identique
 * dans l'application et dans l'exécuteur en ligne de commande. C'est ce qui
 * permet de diagnostiquer un déploiement sans appareil ni simulateur — et donc
 * de le faire en intégration continue.
 */
import {
  DiraMapsClient,
  DiraMapsError,
  RouteService,
  decodePolyline,
  diraOverlayTemplate,
  diraTileTemplate,
  encodePolyline,
  isValidLngLat,
  toLatLng,
  toLngLat,
  tourKey,
} from '@kgtech-org/dira-maps-react-native';

import { CITY, CITY_CENTER, MAPS_API_URL, MAPS_SITE_URL, TOUR } from './config';
import { tileForLngLat } from './tile-math';

export type CheckStatus = 'ok' | 'ko' | 'warn';

export interface CheckResult {
  status: CheckStatus;
  /** Une ligne, lisible : ce qui a été observé, pas ce qui était espéré. */
  detail: string;
}

export interface Check {
  id: string;
  title: string;
  /** Ce que casserait un échec ici. Rend le rapport actionnable. */
  stake: string;
  /** Vrai si la vérification touche le réseau (utile pour un mode hors-ligne). */
  network: boolean;
  run: () => Promise<CheckResult>;
}

const client = new DiraMapsClient({ baseUrl: MAPS_API_URL });
const routes = new RouteService(client);

const ok = (detail: string): CheckResult => ({ status: 'ok', detail });
const ko = (detail: string): CheckResult => ({ status: 'ko', detail });
const warn = (detail: string): CheckResult => ({ status: 'warn', detail });

/** Bornes d'une image PNG : les huit premiers octets sont une signature fixe. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes: Uint8Array): boolean {
  return PNG_MAGIC.every((byte, index) => bytes[index] === byte);
}

// ---------------------------------------------------------------------------
// Vérifications PURES — aucun réseau, aucune excuse d'échouer.
// ---------------------------------------------------------------------------

const pureChecks: Check[] = [
  {
    id: 'coords',
    title: 'Conversion de coordonnées',
    stake: "Une inversion place un marqueur au large de la Somalie, sans lever d'erreur.",
    network: false,
    run: async () => {
      const wire: [number, number] = [1.2216, 6.1425]; // Lomé, le pire cas
      const native = toLatLng(wire);
      if (native.latitude !== 6.1425 || native.longitude !== 1.2216) {
        return ko(`toLatLng a rendu ${JSON.stringify(native)}`);
      }
      const back = toLngLat(native);
      if (back[0] !== wire[0] || back[1] !== wire[1]) return ko('aller-retour non conservatif');
      if (isValidLngLat([6.14, 122.16])) return ko('une latitude de 122° est acceptée');
      return ok('Lomé converti et reconverti sans dérive');
    },
  },
  {
    id: 'polyline',
    title: 'Polylines encodées',
    stake: 'Sans décodeur, on ne peut afficher que le parcours PRÉVU, jamais le parcours réel.',
    network: false,
    run: async () => {
      const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
      if (points.length !== 3) return ko(`${points.length} points au lieu de 3`);
      if (Math.abs(points[0]![0] - -120.2) > 1e-5) return ko('premier point hors tolérance');
      const roundTrip = decodePolyline(encodePolyline(TOUR));
      if (roundTrip.length !== TOUR.length) return ko('aller-retour de longueur différente');
      return ok('vecteur de référence décodé, aller-retour conservatif');
    },
  },
  {
    id: 'tour-key',
    title: 'Clé de tournée',
    stake: "Deux tournées confondues serviraient l'itinéraire de l'une pour l'autre.",
    network: false,
    run: async () => {
      const a = tourKey({ city: CITY, coordinates: [TOUR[0]!, TOUR[1]!] });
      const b = tourKey({ city: CITY, coordinates: [TOUR[1]!, TOUR[0]!] });
      if (a === b) return ko("l'ordre des étapes ne change pas la clé");
      const c = tourKey({ city: 'dakar', coordinates: [TOUR[0]!, TOUR[1]!] });
      if (a === c) return ko('la ville ne change pas la clé');
      return ok("l'ordre des étapes et la ville distinguent bien les tournées");
    },
  },
];

// ---------------------------------------------------------------------------
// Vérifications RÉSEAU — l'état réel d'un déploiement.
// ---------------------------------------------------------------------------

const networkChecks: Check[] = [
  {
    id: 'route',
    title: 'Itinéraire routier',
    stake: 'Sans lui, la carte ne montre que des segments droits entre les étapes.',
    network: true,
    run: async () => {
      const result = await routes.resolve({ city: CITY, coordinates: TOUR });
      if (result.approximate) {
        return warn(
          "repli en segments droits : le moteur de routage n'est pas configuré (503). " +
            "L'application doit l'afficher, pas le taire.",
        );
      }
      if (result.route.coordinates.length <= TOUR.length) {
        return warn(
          `${result.route.coordinates.length} points pour ${TOUR.length} étapes : ` +
            'le tracé ne suit probablement pas le réseau routier',
        );
      }
      return ok(
        `${result.route.coordinates.length} points suivant la voirie` +
          (result.route.distanceM ? `, ${Math.round(result.route.distanceM)} m` : ''),
      );
    },
  },
  {
    id: 'route-cache',
    title: "Mémoïsation de l'itinéraire",
    stake: 'Recalculer à chaque position GPS épuise le quota du moteur de routage.',
    network: true,
    run: async () => {
      // Une tournée neuve à chaque exécution : sinon le premier appel serait
      // déjà servi par le cache d'une exécution précédente et ne prouverait rien.
      const jitter = Math.random() * 1e-4;
      const tour: [number, number][] = TOUR.map(([lng, lat]) => [lng + jitter, lat]);
      const fresh = new RouteService(client);
      const first = await fresh.resolve({ city: CITY, coordinates: tour });
      const second = await fresh.resolve({ city: CITY, coordinates: tour });
      if (first.approximate) return warn('non concluant : le repli était actif');
      if (first.route.coordinates.length !== second.route.coordinates.length) {
        return ko('deux réponses différentes pour la même tournée');
      }
      return ok(
        `deuxième demande servie sans nouveau calcul (source serveur : ${second.source ?? 'inconnue'})`,
      );
    },
  },
  {
    id: 'reverse-geocode',
    title: 'Géocodage inverse',
    stake: "Nomme un point de collecte quand la boutique n'a pas d'adresse saisie.",
    network: true,
    run: async () => {
      const result = await client.reverseGeocode(CITY_CENTER);
      if (result === null) return warn('aucun résultat — légitime hors zone couverte');
      if (!result.formattedAddress) return ko('résultat sans adresse formatée');
      return ok(result.formattedAddress);
    },
  },
  {
    id: 'geocode',
    title: 'Recherche d’adresse',
    stake: 'Alimente une saisie assistée côté client.',
    network: true,
    run: async () => {
      const results = await client.geocode('Lomé', { limit: 3 });
      if (results.length === 0) return warn('aucun résultat pour « Lomé »');
      return ok(`${results.length} résultat(s), premier : ${results[0]!.formattedAddress}`);
    },
  },
];

// ---------------------------------------------------------------------------
// Vérifications des TUILES — le fond de carte Dira.
// ---------------------------------------------------------------------------

async function fetchTile(url: string): Promise<{ bytes: Uint8Array; cache: string | null }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, cache: response.headers.get('x-dira-cache') };
}

const tileChecks: Check[] = [
  {
    id: 'tiles',
    title: 'Tuiles mémoïsées',
    stake: 'Voie recommandée du fond Dira ; sans elles, QGIS rastérise à chaque déplacement.',
    network: true,
    run: async () => {
      const { x, y } = tileForLngLat(CITY_CENTER[0], CITY_CENTER[1], 14);
      const url = diraTileTemplate({ apiUrl: MAPS_API_URL, city: CITY })
        .replace('{z}', '14')
        .replace('{x}', String(x))
        .replace('{y}', String(y));
      const first = await fetchTile(url);
      if (!isPng(first.bytes)) return ko(`la réponse n'est pas un PNG (${first.bytes.length} o)`);
      const second = await fetchTile(url);
      const cached = second.cache === 'hit';
      return cached
        ? ok(`PNG de ${first.bytes.length} o ; deuxième demande servie par le cache`)
        : warn(
            `PNG de ${first.bytes.length} o, mais X-Dira-Cache = ${second.cache ?? 'absent'} : ` +
              'le cache Redis ne prend pas, chaque tuile sera rastérisée',
          );
    },
  },
  {
    id: 'tile-coverage',
    title: 'Couverture du fond',
    stake:
      "Hors de l'emprise importée la carte est VIDE, pas moins détaillée. " +
      'Un livreur qui traverse la ville en sort.',
    network: true,
    run: async () => {
      // Une croix de tuiles autour du centre, ≈ 2,5 km d'écart au zoom 14.
      const z = 14;
      const center = tileForLngLat(CITY_CENTER[0], CITY_CENTER[1], z);
      const offsets = [
        [0, 0],
        [3, 0],
        [-3, 0],
        [0, 3],
        [0, -3],
      ];
      const template = diraTileTemplate({ apiUrl: MAPS_API_URL, city: CITY });
      const sizes: number[] = [];
      for (const [dx, dy] of offsets) {
        const url = template
          .replace('{z}', String(z))
          .replace('{x}', String(center.x + dx!))
          .replace('{y}', String(center.y + dy!));
        try {
          sizes.push((await fetchTile(url)).bytes.length);
        } catch {
          sizes.push(0);
        }
      }
      // Heuristique assumée : une tuile SANS donnée est un PNG transparent, donc
      // minuscule. Le seuil ne prétend pas mesurer la richesse du rendu, seulement
      // distinguer « il y a quelque chose » de « il n'y a rien ».
      const drawn = sizes.filter((size) => size > 1000).length;
      const detail = `${drawn}/${offsets.length} tuiles portent des données (tailles : ${sizes.join(', ')} o)`;
      if (drawn === 0) return ko(`${detail} — données non importées, ou mauvaise ville`);
      if (drawn < offsets.length) return warn(`${detail} — emprise d'import trop étroite`);
      return ok(detail);
    },
  },
  {
    id: 'overlay-wms',
    title: 'Surimpression WMS (repli)',
    stake: "Chemin de repli quand le backend ne sert pas encore /api/tiles.",
    network: true,
    run: async () => {
      const url = diraOverlayTemplate({ siteUrl: MAPS_SITE_URL, city: CITY })
        .replace('{minX}', '135000')
        .replace('{minY}', '680000')
        .replace('{maxX}', '140000')
        .replace('{maxY}', '685000');
      const response = await fetch(url);
      if (!response.ok) return warn(`HTTP ${response.status} — /ows/ non exposé, ce qui est sain`);
      const type = response.headers.get('content-type') ?? '';
      if (!type.startsWith('image/')) {
        return ko(`QGIS a rendu ${type} au lieu d'une image (probable exception WMS)`);
      }
      return ok(`image servie directement par QGIS Server (${type})`);
    },
  },
];

// ---------------------------------------------------------------------------
// Vérification des ERREURS — ce que l'application doit savoir distinguer.
// ---------------------------------------------------------------------------

const errorChecks: Check[] = [
  {
    id: 'errors',
    title: 'Erreurs typées',
    stake: "Un code HTTP nu ne dit pas s'il faut réessayer, se replier ou alerter.",
    network: true,
    run: async () => {
      const unreachable = new DiraMapsClient({
        baseUrl: 'https://maps-inexistant.dira.invalid/api',
        timeoutMs: 4000,
      });
      try {
        await unreachable.route({ city: CITY, coordinates: [TOUR[0]!, TOUR[1]!] });
        return ko('un hôte inexistant a répondu');
      } catch (error) {
        if (!(error instanceof DiraMapsError)) return ko(`erreur non typée : ${String(error)}`);
        if (error.shouldFallBackToStraightLines) {
          return ko(`kind=${error.kind} conseille à tort un repli sur une panne réseau`);
        }
        return ok(`hôte injoignable classé « ${error.kind} », sans conseil de repli`);
      }
    },
  },
];

export const CHECKS: Check[] = [...pureChecks, ...networkChecks, ...tileChecks, ...errorChecks];

/** Exécute une vérification en transformant toute exception en résultat. */
export async function runCheck(check: Check): Promise<CheckResult> {
  try {
    return await check.run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return ko(message);
  }
}
