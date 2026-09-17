/**
 * Carte du banc d'essai — le CHOIX DU MOTEUR, et l'implémentation native.
 *
 * Trois moteurs, un même SDK (`EXPO_PUBLIC_MAPS_ENGINE`, voir `config.ts`) :
 * MapLibre pour le thème, la carte native du téléphone, ou les tuiles Dira
 * seules. C'est ici qu'une application décide — le SDK, lui, ne rend aucune
 * vue et alimente les trois de la même façon.
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

import { CITY, CITY_CENTER, ENGINE, MAPS_API_KEY, MAPS_API_URL, TOUR, type Engine } from './config';
import type { MapPaneProps } from './MapPane.types';
import { TileGrid } from './TileGrid';
import { VectorPane } from './VectorPane';

/** Expo Go, par opposition à un *dev build* ou à une application publiée. */
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Le sol du composant natif est-il seulement disponible ici ?
 *
 * Faux dans Expo Go sur Android, où le SDK Google Maps refuse la clé de l'hôte.
 * Sur iOS, Apple Maps ne demande aucune clé : le sol y vient toujours.
 */
const GROUND_AVAILABLE = !(Platform.OS === 'android' && IS_EXPO_GO);

/**
 * Le rendu VECTORIEL du thème (MapLibre) n'existe que là où son module natif
 * est lié : un development build, jamais Expo Go. C'est le seul volet où le
 * thème change vraiment — les autres ne font que s'accorder à sa palette.
 */
const VECTOR_AVAILABLE = !IS_EXPO_GO;

/** Le moteur effectif : celui demandé, sinon le meilleur disponible ici. */
export const ENGINE_IN_USE: Engine =
  ENGINE ?? (VECTOR_AVAILABLE ? 'maplibre' : GROUND_AVAILABLE ? 'native' : 'tiles');

export function MapPane(props: MapPaneProps) {
  if (ENGINE_IN_USE === 'maplibre') return <VectorPane {...props} />;
  if (ENGINE_IN_USE === 'tiles') return <TileGrid {...props} />;
  return <NativePane {...props} />;
}

/**
 * La carte NATIVE du téléphone — Google sur Android, Apple sur iOS — et les
 * couches Dira par-dessus. Le thème Dira ne s'applique pas ici : c'est le
 * composant qui dessine le sol, avec ses couleurs. Ce que le SDK lui donne
 * est le même qu'à MapLibre : un gabarit de tuiles, un tracé en `LatLng`.
 */
function NativePane({ coordinates, approximate, style, lineColor }: MapPaneProps) {
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
      {/* Les couches Dira, EN TUILES, par-dessus le sol natif — en transparence :
          à pleine opacité, ces PNG couvriraient le sol qu'on est venu comparer. */}
      <UrlTile
        urlTemplate={diraTileTemplate({ apiUrl: MAPS_API_URL, city: CITY, apiKey: MAPS_API_KEY })}
        zIndex={1}
        opacity={0.5}
        maximumZ={19}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor={lineColor}
        strokeWidth={4}
        // Au-dessus des tuiles (zIndex 1) : sinon elles le recouvrent.
        zIndex={2}
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
