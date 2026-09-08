/**
 * Banc d'essai visuel du SDK Dira Maps.
 *
 * Deux moitiés, et c'est délibéré :
 *
 *  • EN HAUT, une carte qui montre le partage des rôles du SDK — le SOL vient
 *    du composant natif, les couches Dira se posent dessus en tuiles, et le
 *    tracé vient de `/api/calc/route`. Voir les trois superposés vaut mieux que
 *    n'importe quel paragraphe de documentation.
 *  • EN BAS, le même diagnostic que `npm run check`, exécuté depuis l'appareil.
 *    C'est là que se voient les choses qu'un émulateur ne reproduit pas : un
 *    réseau mobile lent, un proxy d'entreprise, un certificat refusé.
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import {
  DiraMapsClient,
  RouteService,
  diraTileTemplate,
  toLatLng,
  useRoute,
} from '@kgtech-org/dira-maps-react-native';

import { CHECKS, runCheck, type CheckResult } from './src/checks';
import { CITY, CITY_CENTER, MAPS_API_URL, TOUR } from './src/config';

const COLORS = {
  ok: '#1f7a4d',
  warn: '#9a6b00',
  ko: '#a32020',
  idle: '#8a8a8a',
  ink: '#16161a',
  line: '#7a1f2b', // maroon Dira
};

export default function App() {
  const client = useMemo(() => new DiraMapsClient({ baseUrl: MAPS_API_URL }), []);
  const routes = useMemo(() => new RouteService(client), [client]);

  // La tournée est constante : la recréer à chaque rendu relancerait une
  // requête d'itinéraire à chaque battement d'état de l'écran.
  const request = useMemo(() => ({ city: CITY, coordinates: TOUR }), []);
  const { coordinates, approximate, loading, error } = useRoute(routes, request);

  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [running, setRunning] = useState(false);

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults({});
    for (const check of CHECKS) {
      const result = await runCheck(check);
      // Rendu au fil de l'eau : sur un réseau lent, une liste qui se remplit
      // renseigne mieux qu'un écran figé jusqu'au dernier appel.
      setResults((previous) => ({ ...previous, [check.id]: result }));
    }
    setRunning(false);
  }, []);

  return (
    <View style={styles.screen}>
      <MapView
        style={styles.map}
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
          strokeColor={COLORS.line}
          strokeWidth={4}
          // Le repli en segments droits se voit AUSSI sur la carte, pas
          // seulement dans un bandeau : en pointillé, il ne peut pas se faire
          // passer pour un itinéraire.
          lineDashPattern={approximate ? [8, 6] : undefined}
        />
        {TOUR.map((point, index) => (
          <Marker key={index} coordinate={toLatLng(point)} title={`Étape ${index + 1}`} />
        ))}
      </MapView>

      {approximate ? (
        <View style={[styles.banner, { backgroundColor: COLORS.warn }]}>
          <Text style={styles.bannerText}>
            Itinéraire approximatif — tracé direct entre les étapes
          </Text>
        </View>
      ) : null}
      {error ? (
        <View style={[styles.banner, { backgroundColor: COLORS.ko }]}>
          <Text style={styles.bannerText}>
            {error.kind} — {error.message}
          </Text>
        </View>
      ) : null}

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <Text style={styles.title}>Banc d’essai Dira Maps</Text>
        <Text style={styles.subtitle}>
          {MAPS_API_URL} · {CITY}
        </Text>

        <Pressable style={styles.button} onPress={runAll} disabled={running}>
          {running ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Lancer les {CHECKS.length} vérifications</Text>
          )}
        </Pressable>

        {loading ? <Text style={styles.muted}>Itinéraire en cours…</Text> : null}

        {CHECKS.map((check) => {
          const result = results[check.id];
          const color = result ? COLORS[result.status] : COLORS.idle;
          return (
            <View key={check.id} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.cardTitle}>{check.title}</Text>
              </View>
              <Text style={styles.cardDetail}>{result?.detail ?? 'non exécutée'}</Text>
              {result && result.status !== 'ok' ? (
                <Text style={styles.cardStake}>en jeu : {check.stake}</Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  map: { height: '42%' },
  banner: { paddingHorizontal: 12, paddingVertical: 6 },
  bannerText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  panel: { flex: 1 },
  panelContent: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  subtitle: { fontSize: 12, color: COLORS.idle, marginBottom: 14 },
  button: {
    backgroundColor: COLORS.line,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  muted: { color: COLORS.idle, fontSize: 12, marginBottom: 10 },
  card: {
    borderWidth: 1,
    borderColor: '#e6e4e0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  cardTitle: { fontWeight: '600', color: COLORS.ink, flexShrink: 1 },
  cardDetail: { fontSize: 12.5, color: '#4a4a4a', lineHeight: 18 },
  cardStake: { fontSize: 11.5, color: COLORS.warn, marginTop: 6, fontStyle: 'italic' },
});
