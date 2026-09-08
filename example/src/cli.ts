/**
 * Exécuteur en ligne de commande du banc d'essai.
 *
 * Diagnostique un déploiement Dira Maps sans appareil ni simulateur, donc aussi
 * en intégration continue. C'est le pendant sans interface de l'écran de
 * l'application : mêmes vérifications, même verdict.
 *
 *     npm run check
 *     EXPO_PUBLIC_MAPS_URL=https://maps.example.tld/api npm run check
 */
import { CHECKS, runCheck, type CheckStatus } from './checks';
import { CITY, MAPS_API_URL, MAPS_SITE_URL } from './config';

const MARK: Record<CheckStatus, string> = { ok: '✓', warn: '!', ko: '✗' };

async function main(): Promise<void> {
  const offline = process.argv.includes('--offline');
  const checks = offline ? CHECKS.filter((c) => !c.network) : CHECKS;

  console.log(`Dira Maps — banc d'essai`);
  console.log(`  API   : ${MAPS_API_URL}`);
  console.log(`  site  : ${MAPS_SITE_URL}`);
  console.log(`  ville : ${CITY}${offline ? '  (hors ligne : vérifications pures seulement)' : ''}`);
  console.log('');

  const counts: Record<CheckStatus, number> = { ok: 0, warn: 0, ko: 0 };
  for (const check of checks) {
    const result = await runCheck(check);
    counts[result.status] += 1;
    console.log(`${MARK[result.status]} ${check.title}`);
    console.log(`    ${result.detail}`);
    // L'enjeu n'est rappelé QUE sur un échec : sur un succès il ferait du bruit.
    if (result.status !== 'ok') console.log(`    en jeu : ${check.stake}`);
  }

  console.log('');
  console.log(`${counts.ok} ok · ${counts.warn} avertissement(s) · ${counts.ko} échec(s)`);
  // Un avertissement ne fait pas échouer : « le moteur de routage n'est pas
  // configuré » est un état de déploiement légitime, pas une régression.
  process.exitCode = counts.ko > 0 ? 1 : 0;
}

void main();
