/**
 * Carte de REPLI : les tuiles Dira posées à la main, sans composant de carte.
 *
 * Ce n'est pas une carte au sens du SDK — on ne peut ni la déplacer ni zoomer —
 * et ce n'est surtout pas une invitation à en mettre une dans le paquet : la
 * règle d'en-tête du SDK tient, ce fichier vit dans l'EXEMPLE.
 *
 * Il existe pour une raison précise. Sur Android, la carte de `react-native-maps`
 * s'appuie sur le SDK Google Maps, dont la clé embarquée dans Expo Go est
 * refusée : la surface ne démarre jamais, et elle ne demande alors même pas ses
 * tuiles — vérifié dans les journaux du serveur, zéro requête. Le volet
 * affichait donc un rectangle beige avec un filigrane « Google », qu'on pouvait
 * lire comme « Dira ne renvoie rien » alors que Dira n'avait rien été prié de
 * renvoyer. Une panne muette qui accuse le mauvais coupable est exactement ce
 * que ce banc d'essai existe pour éviter.
 *
 * Depuis que les tuiles Dira portent le sol et l'eau (migration 0006), elles se
 * suffisent : sol peint, bâti, voirie, noms de rue. Les poser en `<Image>` sur
 * une grille demande la même arithmétique que celle déjà écrite pour vérifier
 * la couverture, et aucune dépendance de plus.
 *
 * ## Pourquoi aucun bandeau d'avertissement
 *
 * Il y en a eu un, tant que ce volet servait à excuser un rectangle vide. Une
 * carte qui s'affiche n'a plus rien à excuser, et la seule limite qui compte —
 * hors de l'emprise importée, elle est BLANCHE — est déjà mesurée, chiffrée et
 * expliquée par la vérification « Couverture du fond », trois centimètres plus
 * bas. Un avertissement permanent posé par-dessus la carte l'aurait répétée en
 * moins précis, et aurait fini par ne plus être lu.
 */
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { diraTileTemplate, toLatLng } from '@kgtech-org/dira-maps-react-native';

import { MAPS_API_URL, CITY, TOUR } from './config';
import type { MapPaneProps } from './MapPane.types';
import { TILE_SIZE, tilePosition } from './tile-math';

/** Zooms servis par `/api/tiles` (voir README de Dira Maps). */
const MIN_Z = 10;
const MAX_Z = 19;

/** Marge autour de la tournée, en pixels, pour qu'elle ne colle pas aux bords. */
const PADDING = 48;

/**
 * Au delà, on dessine moins de segments que de points : une polyligne de 165
 * vues superposées coûte plus qu'elle n'apporte sur un écran de cette taille.
 */
const MAX_SEGMENTS = 160;

/** Épaisseur du tracé, en pixels. La même que sur la carte native. */
const STROKE = 4;

interface Point {
  x: number;
  y: number;
}

/**
 * Le plus grand zoom auquel la tournée tient dans le volet.
 *
 * On part du plus fin et on recule : mieux vaut la carte la plus détaillée qui
 * montre TOUT le trajet qu'un cadrage serré qui en coupe la fin.
 */
function fitZoom(bounds: [number, number, number, number], width: number, height: number): number {
  const [west, south, east, north] = bounds;
  for (let z = MAX_Z; z > MIN_Z; z -= 1) {
    const a = tilePosition(west, north, z);
    const b = tilePosition(east, south, z);
    const spanX = Math.abs(b.x - a.x) * TILE_SIZE;
    const spanY = Math.abs(b.y - a.y) * TILE_SIZE;
    if (spanX <= width - PADDING && spanY <= height - PADDING) return z;
  }
  return MIN_Z;
}

function boundsOf(coordinates: { latitude: number; longitude: number }[]): [number, number, number, number] {
  const points = coordinates.length > 0 ? coordinates : TOUR.map(toLatLng);
  const lngs = points.map((p) => p.longitude);
  const lats = points.map((p) => p.latitude);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

/** Réduit une polyligne à au plus `max` points, en gardant toujours le dernier. */
function thin<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const kept = points.filter((_, index) => index % step === 0);
  const last = points[points.length - 1];
  if (last !== undefined && kept[kept.length - 1] !== last) kept.push(last);
  return kept;
}

export function TileGrid({ coordinates, approximate, style, lineColor }: MapPaneProps) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View style={[style, styles.pane]} onLayout={onLayout}>
      {size ? <Grid {...{ size, coordinates, approximate, lineColor }} /> : null}
    </View>
  );
}

function Grid({
  size,
  coordinates,
  approximate,
  lineColor,
}: {
  size: { width: number; height: number };
  coordinates: MapPaneProps['coordinates'];
  approximate: boolean;
  lineColor: string;
}) {
  const { width, height } = size;
  const z = fitZoom(boundsOf(coordinates), width, height);
  const template = diraTileTemplate({ apiUrl: MAPS_API_URL, city: CITY });

  // Le volet se centre sur la TOURNÉE, pas sur le centre-ville : c'est le
  // trajet qu'on est venu regarder. Tant que l'itinéraire n'est pas calculé,
  // `boundsOf` retombe sur les étapes, qui sont connues d'avance.
  const [west, south, east, north] = boundsOf(coordinates);
  const centre = tilePosition((west + east) / 2, (south + north) / 2, z);
  const origin = {
    x: centre.x - width / 2 / TILE_SIZE,
    y: centre.y - height / 2 / TILE_SIZE,
  };

  const project = (lng: number, lat: number): Point => {
    const p = tilePosition(lng, lat, z);
    return { x: (p.x - origin.x) * TILE_SIZE, y: (p.y - origin.y) * TILE_SIZE };
  };

  const tiles: { key: string; uri: string; left: number; top: number }[] = [];
  const n = 2 ** z;
  for (let tx = Math.floor(origin.x); tx * TILE_SIZE < origin.x * TILE_SIZE + width; tx += 1) {
    for (let ty = Math.floor(origin.y); ty * TILE_SIZE < origin.y * TILE_SIZE + height; ty += 1) {
      if (tx < 0 || ty < 0 || tx >= n || ty >= n) continue;
      tiles.push({
        key: `${z}/${tx}/${ty}`,
        uri: template.replace('{z}', String(z)).replace('{x}', String(tx)).replace('{y}', String(ty)),
        left: (tx - origin.x) * TILE_SIZE,
        top: (ty - origin.y) * TILE_SIZE,
      });
    }
  }

  const trace = thin(coordinates, MAX_SEGMENTS).map((c) => project(c.longitude, c.latitude));
  const steps = TOUR.map((point) => project(point[0], point[1]));

  return (
    <>
      {tiles.map((tile) => (
        <Image
          key={tile.key}
          source={{ uri: tile.uri }}
          style={[styles.tile, { left: tile.left, top: tile.top }]}
        />
      ))}

      {trace.slice(1).map((to, index) => {
        const from = trace[index]!;
        return (
          <Segment
            key={index}
            from={from}
            to={to}
            color={lineColor}
            // Le repli en segments droits se voit AUSSI sur la carte, en
            // pointillé : ainsi il ne peut pas se faire passer pour un
            // itinéraire. C'est la même règle que sur la carte native.
            dashed={approximate}
          />
        );
      })}

      {steps.map((point, index) => (
        <View key={index} style={[styles.marker, { left: point.x - 11, top: point.y - 11 }]}>
          <Text style={styles.markerLabel}>{index + 1}</Text>
        </View>
      ))}
    </>
  );
}

/** Un segment de polyligne, dessiné comme une barre tournée sur son milieu. */
function Segment({
  from,
  to,
  color,
  dashed,
}: {
  from: Point;
  to: Point;
  color: string;
  dashed: boolean;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.5) return null;
  const angle = `${(Math.atan2(dy, dx) * 180) / Math.PI}deg`;
  // Chaque barre déborde d'une demi-épaisseur de chaque côté : sans ce
  // recouvrement, un itinéraire réel (160 segments de 3 px) se lit comme un
  // pointillé, et se confondrait avec le repli en segments droits — qui, lui,
  // DOIT rester reconnaissable au premier coup d'œil.
  const drawn = dashed ? length : length + STROKE;
  const style = {
    left: from.x + dx / 2 - drawn / 2,
    top: from.y + dy / 2 - STROKE / 2,
    width: drawn,
    backgroundColor: color,
    transform: [{ rotate: angle }],
  };
  // Un pointillé se fait ici en trouant la barre : `borderStyle` ne suit pas la
  // rotation de façon fiable d'une version d'Android à l'autre.
  return dashed ? (
    <View style={[styles.segment, style, styles.segmentDashed]}>
      {Array.from({ length: Math.max(1, Math.floor(length / 14)) }).map((_, index) => (
        <View key={index} style={[styles.dash, { backgroundColor: color }]} />
      ))}
    </View>
  ) : (
    <View style={[styles.segment, style]} />
  );
}

const styles = StyleSheet.create({
  pane: { backgroundColor: '#eceae4', overflow: 'hidden' },
  tile: { position: 'absolute', width: TILE_SIZE, height: TILE_SIZE },
  segment: { position: 'absolute', height: STROKE, borderRadius: STROKE / 2 },
  segmentDashed: { backgroundColor: 'transparent', flexDirection: 'row', overflow: 'hidden' },
  dash: { width: 8, height: STROKE, borderRadius: STROKE / 2, marginRight: 6 },
  marker: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7d1128',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerLabel: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
});
