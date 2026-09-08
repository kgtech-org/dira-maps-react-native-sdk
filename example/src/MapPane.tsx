/**
 * Carte du banc d'essai — implémentation NATIVE.
 *
 * `react-native-maps` n'existe pas sur le web : il n'y a pas de carte du
 * système à emprunter dans un navigateur. Plutôt qu'un `Platform.OS === 'web'`
 * au milieu de l'écran, les deux implémentations sont séparées par EXTENSION de
 * fichier : Metro charge `MapPane.web.tsx` sur le web et celui-ci ailleurs.
 *
 * Aucun fichier `MapPane.ts` ne doit venir se placer à côté : il court-
 * circuiterait ce choix et ferait entrer `react-native-maps` dans le bundle web,
 * où son module natif échoue à l'import.
 */
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { diraTileTemplate, toLatLng } from '@kgtech-org/dira-maps-react-native';

import { CITY, CITY_CENTER, MAPS_API_URL, TOUR } from './config';
import type { MapPaneProps } from './MapPane.types';

export function MapPane({ coordinates, approximate, style, lineColor }: MapPaneProps) {
  return (
    <MapView
      style={style}
      initialRegion={{
        latitude: CITY_CENTER[1],
        longitude: CITY_CENTER[0],
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      }}
    >
      {/* Les couches Dira, EN TUILES, par-dessus le sol natif. */}
      <UrlTile
        urlTemplate={diraTileTemplate({ apiUrl: MAPS_API_URL, city: CITY })}
        zIndex={1}
        maximumZ={19}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor={lineColor}
        strokeWidth={4}
        // Le repli en segments droits se voit AUSSI sur la carte : en pointillé,
        // il ne peut pas se faire passer pour un itinéraire.
        lineDashPattern={approximate ? [8, 6] : undefined}
      />
      {TOUR.map((point, index) => (
        <Marker key={index} coordinate={toLatLng(point)} title={`Étape ${index + 1}`} />
      ))}
    </MapView>
  );
}
