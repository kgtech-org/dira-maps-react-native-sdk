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
 *
 * ## Quand le sol natif ne vient pas
 *
 * Sur Android, la carte s'appuie sur le SDK Google Maps, et la clé embarquée
 * dans Expo Go y est refusée (`Authorization failure` dans `adb logcat`) : la
 * surface reste vide. Le volet affichait alors un rectangle beige signé
 * « Google », qui se lit comme « Dira ne renvoie rien » — le pire diagnostic
 * possible, puisqu'il accuse le service qu'on est venu tester.
 *
 * La bascule se décide sur l'ENVIRONNEMENT D'EXÉCUTION, pas sur un délai
 * d'attente : `onMapReady` se déclenche même quand l'autorisation a échoué —
 * l'objet carte existe, il ne peut simplement rien peindre — donc l'attendre ne
 * distingue pas une carte lente d'une carte morte. Expo Go, lui, se reconnaît
 * de façon certaine.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { diraTileTemplate, toLatLng } from '@kgtech-org/dira-maps-react-native';

import { CITY, CITY_CENTER, MAPS_API_KEY, MAPS_API_URL, NATIVE_GROUND, TOUR } from './config';
import type { MapPaneProps } from './MapPane.types';
import { TileGrid } from './TileGrid';

/** Expo Go, par opposition à un *dev build* ou à une application publiée. */
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Le sol du composant natif est-il seulement disponible ici ?
 *
 * Faux dans Expo Go sur Android, où le SDK Google Maps refuse la clé de l'hôte.
 * Sur iOS, Apple Maps ne demande aucune clé : le sol y vient toujours.
 */
const GROUND_AVAILABLE = !(Platform.OS === 'android' && IS_EXPO_GO);

export function MapPane(props: MapPaneProps) {
  const { coordinates, approximate, style, lineColor } = props;

  if (!NATIVE_GROUND || !GROUND_AVAILABLE) return <TileGrid {...props} />;

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
        urlTemplate={diraTileTemplate({ apiUrl: MAPS_API_URL, city: CITY, apiKey: MAPS_API_KEY })}
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
