/**
 * Le volet de carte VECTORIEL : MapLibre rend le style du thème.
 *
 * C'est ici que le thème change vraiment — les rues, l'eau, le bâti, le sol
 * prennent les couleurs réglées dans le portail, parce que c'est MapLibre qui
 * les dessine à partir du style servi par Dira Maps. Rien n'est recoloré à la
 * main ; changer de thème, c'est donner une autre URL à `mapStyle`.
 *
 * Ce volet exige un module natif : il n'existe pas dans Expo Go, seulement
 * dans un development build (`npx expo run:android`). `MapPane` choisit.
 */
import { Camera, LineLayer, MapView, MarkerView, RasterLayer, RasterSource, ShapeSource } from '@maplibre/maplibre-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { diraTileTemplate, toLngLat } from '@kgtech-org/dira-maps-react-native';

import { CITY, MAPS_API_KEY, MAPS_API_URL, TOUR } from './config';
import type { MapPaneProps } from './MapPane.types';

export function VectorPane({ coordinates, approximate, style, lineColor, styleUrl }: MapPaneProps) {
  // MapLibre parle en [lng, lat], comme l'API : on repasse du LatLng de la
  // carte native au fil, par LA fonction prévue pour ça.
  const line = coordinates.map((c) => [...toLngLat(c)] as [number, number]);
  const lngs = line.map((p) => p[0]);
  const lats = line.map((p) => p[1]);
  // Un cadrage plus large que la tournée : le thème se juge sur un quartier,
  // pas sur trois rues. Le padding recule la caméra d'environ un niveau.
  const bounds = {
    sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
    ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
    paddingLeft: 90,
    paddingRight: 90,
    paddingTop: 120,
    paddingBottom: 120,
  };

  return (
    <View style={[style, styles.pane]}>
      <MapView style={styles.map} mapStyle={styleUrl} logoEnabled={false} attributionEnabled>
        <Camera bounds={bounds} animationDuration={0} />

        {/*
          Les couches Dira (bâti, voirie, eau, sol de QGIS) PAR-DESSUS le fond
          thémé — en transparence : ce sont des PNG aux couleurs des projets
          QGIS, pas du thème, et à pleine opacité elles couvriraient le fond
          qu'on est venu regarder. Une application choisit son dosage.
        */}
        <RasterSource
          id="dira"
          tileUrlTemplates={[diraTileTemplate({ apiUrl: MAPS_API_URL, city: CITY, apiKey: MAPS_API_KEY })]}
          tileSize={256}
          maxZoomLevel={19}
        >
          <RasterLayer id="dira" sourceID="dira" style={{ rasterOpacity: 0.35 }} />
        </RasterSource>

        <ShapeSource id="trace" shape={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } }}>
          <LineLayer
            id="trace"
            style={{
              lineColor,
              lineWidth: 4,
              lineCap: 'round',
              lineJoin: 'round',
              // Le repli en segments droits se voit AUSSI sur la carte, en pointillé.
              ...(approximate ? { lineDasharray: [2, 1.5] } : {}),
            }}
          />
        </ShapeSource>

        {TOUR.map((point, index) => (
          <MarkerView key={index} coordinate={[point[0], point[1]]}>
            <View style={[styles.marker, { backgroundColor: lineColor }]}>
              <Text style={styles.markerLabel}>{index + 1}</Text>
            </View>
          </MarkerView>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: { overflow: 'hidden' },
  map: { flex: 1 },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerLabel: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
});
