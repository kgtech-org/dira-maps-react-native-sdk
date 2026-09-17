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
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { DiraMapsClient, RouteService, useRoute } from '@kgtech-org/dira-maps-react-native';

import { ENGINE_IN_USE, MapPane } from './src/MapPane';
import { CHECKS, runCheck, type CheckResult } from './src/checks';
import { CITY, MAPS_API_KEY, MAPS_API_URL, TOUR } from './src/config';
import { PREREGLAGES, apparence, fetchKeyTheme, type Theme } from './src/theme';

const COLORS = {
  ok: '#1f7a4d',
  warn: '#9a6b00',
  ko: '#a32020',
  idle: '#8a8a8a',
  ink: '#16161a',
  line: '#7a1f2b', // maroon Dira
};

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Un gris — blanc et noir compris — n'est pas une couleur d'accent. */
function isGrey(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(r!, g!, b!) - Math.min(r!, g!, b!) < 24;
}

export default function App() {
  const client = useMemo(
    () => new DiraMapsClient({ baseUrl: MAPS_API_URL, apiKey: MAPS_API_KEY }),
    [],
  );

  // Les thèmes : celui de la clé, lu depuis le serveur, puis les préréglages.
  // Le thème de la clé arrive après un aller-retour ; en attendant, `dira`.
  const [themes, setThemes] = useState<Theme[]>(PREREGLAGES);
  const [themeId, setThemeId] = useState<Theme['id']>('dira');
  useEffect(() => {
    fetchKeyTheme()
      .then((theme) => {
        if (!theme) return;
        setThemes([theme, ...PREREGLAGES]);
        setThemeId('cle');
      })
      .catch(() => undefined); // sans thème lisible, les préréglages suffisent
  }, []);
  const theme = themes.find((t) => t.id === themeId) ?? PREREGLAGES[0]!;
  // Jour ou nuit : un ÉTAT DE L'APPLICATION — ici un bouton, chez vous un
  // réglage, l'heure, ce que vous voulez. Le serveur a les deux palettes de
  // chaque thème ; changer de mode, c'est changer d'URL de style, et la carte
  // suit d'elle-même, sans redémarrer. Tant que l'app n'a rien choisi, elle
  // suit le téléphone (`useColorScheme()`), qui n'est qu'une source parmi d'autres.
  const systeme = useColorScheme();
  const [choix, setChoix] = useState<'light' | 'dark' | null>(null);
  const scheme = choix ?? systeme;
  const app = apparence(scheme, theme.defaut);
  const palette = theme.palettes[app];
  const styleUrl = theme.styleUrl(scheme);
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
      <MapPane
        style={styles.map}
        coordinates={coordinates}
        approximate={approximate}
        // Le tracé prend la couleur des routes du thème quand elle en est une —
        // c'est ce qu'une application fait de la palette, s'accorder à sa carte.
        // Sur un thème gris (le défaut), la rue et le tracé auraient la même
        // couleur : l'accent de l'application prend le relais.
        lineColor={isGrey(palette.routes) ? COLORS.line : palette.routes}
        palette={palette}
        styleUrl={styleUrl}
      />

      <View style={[styles.themes, { backgroundColor: palette.sol }]}>
        {themes.map((t) => {
          const active = t.id === themeId;
          const accent = isGrey(t.palettes[app].routes) ? '#888' : t.palettes[app].routes;
          return (
            <Pressable
              key={t.id}
              onPress={() => setThemeId(t.id)}
              style={[styles.themeChip, { borderColor: accent }, active && { backgroundColor: accent }]}
            >
              <Text style={[styles.themeChipText, { color: active ? '#fff' : palette.libelles }]}>
                {t.id === 'cle' ? `clé · ${t.nom}` : t.nom}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setChoix(app === 'sombre' ? 'light' : 'dark')}
          style={[styles.themeChip, { borderColor: palette.libelles }]}
        >
          <Text style={[styles.themeChipText, { color: palette.libelles }]}>
            {app === 'sombre' ? '☀ passer en jour' : '☾ passer en nuit'}
          </Text>
        </Pressable>
        <Text style={[styles.themeNote, { color: palette.libelles }]} numberOfLines={2}>
          {app === 'sombre' ? 'nuit' : 'jour'}
          {choix ? " (choix de l'app)" : scheme ? ' (mode du téléphone)' : ' (défaut du thème)'} —{' '}
          {themeId === 'cle' ? 'thème de la clé (/api/styles/<clé>.json?apparence=…)' : 'préréglage'}
          {ENGINE_IN_USE === 'maplibre'
            ? ' — rendu MapLibre du style'
            : ENGINE_IN_USE === 'native'
              ? ' — carte native : le thème ne s’applique pas au sol, seulement au tracé'
              : IS_EXPO_GO
                ? ' — Expo Go : palette sur le tracé et les marqueurs seulement ; le fond thémé demande un development build'
                : ' — tuiles Dira seules : palette sur le tracé et les marqueurs'}
        </Text>
      </View>

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
  map: { height: '38%' },
  themes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  themeChip: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  themeChipText: { fontSize: 12, fontWeight: '600' },
  themeNote: { fontSize: 10, flexBasis: '100%', opacity: 0.8 },
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
