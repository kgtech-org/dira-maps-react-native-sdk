/**
 * Carte du banc d'essai — implémentation WEB.
 *
 * Il n'y a pas de carte du système à emprunter dans un navigateur, et le SDK
 * n'en fournit aucune : c'est précisément sa règle d'en-tête. Plutôt que de
 * tirer une bibliothèque de carte web pour la forme, on affiche ce que le SDK
 * SAIT produire ici — le tracé, ses points, leur provenance — et on dit
 * franchement ce qui manque.
 *
 * Le diagnostic, lui, est complet sur le web : c'est la moitié qui répond à
 * « ce déploiement fonctionne-t-il ? ».
 */
import { StyleSheet, Text, View } from 'react-native';

import { CITY, MAPS_API_URL } from './config';
import type { MapPaneProps } from './MapPane.types';

export function MapPane({ coordinates, approximate, style, lineColor }: MapPaneProps) {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  return (
    <View style={[style, styles.pane]}>
      <Text style={styles.title}>Carte native indisponible sur le web</Text>
      <Text style={styles.body}>
        Le sol d’une carte Dira vient du composant natif du téléphone — un navigateur n’en a pas à
        prêter, et le SDK n’en fournit aucun. Lancez sur un appareil (Expo Go) pour voir les tuiles
        Dira posées sur ce sol.
      </Text>
      <View style={[styles.rule, { backgroundColor: lineColor }]} />
      <Text style={styles.body}>
        Le SDK a néanmoins fait son travail : {coordinates.length} points de tracé
        {approximate ? ' (repli en segments droits)' : ' suivant la voirie'}
        {first && last
          ? `, de ${first.latitude.toFixed(4)}, ${first.longitude.toFixed(4)} à ${last.latitude.toFixed(4)}, ${last.longitude.toFixed(4)}`
          : ''}
        .
      </Text>
      <Text style={styles.meta}>
        {MAPS_API_URL} · {CITY}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: { padding: 20, justifyContent: 'center', backgroundColor: '#f4f2ee' },
  title: { fontSize: 15, fontWeight: '700', color: '#16161a', marginBottom: 8 },
  body: { fontSize: 13, color: '#4a4a4a', lineHeight: 19 },
  rule: { height: 3, borderRadius: 2, marginVertical: 12, width: 120 },
  meta: { fontSize: 11, color: '#8a8a8a', marginTop: 10 },
});
