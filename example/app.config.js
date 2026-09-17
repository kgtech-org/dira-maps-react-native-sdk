/**
 * Configuration Expo : `app.json`, plus ce qui ne doit PAS y être écrit.
 *
 * La clé du SDK Google Maps (moteur `native`, Android) vient de l'environnement
 * de BUILD — `GOOGLE_MAPS_API_KEY` au moment de `expo prebuild` / `expo run` —,
 * jamais d'un fichier commité : prebuild l'écrit dans `android/` (ignoré par
 * git), et elle ne passe pas par le bundle JS (pas de préfixe `EXPO_PUBLIC_`).
 * Sans elle, le sol Google reste vide sur Android ; iOS (Apple Maps) n'en
 * demande aucune.
 */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...(config.android?.config ?? {}),
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '' },
    },
  },
});
