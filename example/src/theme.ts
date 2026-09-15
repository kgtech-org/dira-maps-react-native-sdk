/**
 * Les thèmes de carte, tels que Dira Maps les sert.
 *
 * Un thème est réglé dans le portail et assigné à une clé ; le serveur en
 * dérive un style MapLibre. Ce module ne connaît que des URL de style :
 *
 *  - celui de la CLÉ : `diraStyleUrl` — ce qu'une application voit ;
 *  - ceux des préréglages : le même constructeur, appelé avec une palette en
 *    paramètres (`/api/styles/apercu.json`) — ce que l'éditeur du portail
 *    prévisualise. Les palettes sont recopiées du serveur : elles sont
 *    stables, et le sample doit pouvoir basculer sans clé.
 *
 * Le rendu est celui de MapLibre, à partir de l'URL : rien n'est recoloré à
 * la main ici. Changer de thème, c'est changer d'URL.
 */
import { diraStyleUrl } from '@kgtech-org/dira-maps-react-native';

import { MAPS_API_KEY, MAPS_SITE_URL } from './config';

export interface Palette {
  fond: 'clair' | 'sombre';
  routes: string;
  eau: string;
  bati: string;
  sol: string;
  libelles: string;
}

export interface Theme {
  /** `cle` = le thème assigné à la clé dans le portail ; sinon un préréglage. */
  id: 'cle' | 'dira' | 'clair' | 'sombre';
  nom: string;
  palette: Palette;
  /** L'URL du style MapLibre — ce que la carte charge. */
  styleUrl: string;
}

const PALETTES: Record<Exclude<Theme['id'], 'cle'>, Palette> = {
  dira: { fond: 'sombre', routes: '#8c8c8c', eau: '#3f3f3f', bati: '#606060', sol: '#4b4b4b', libelles: '#e2e2e2' },
  clair: { fond: 'clair', routes: '#ffffff', eau: '#b7d3ea', bati: '#e3ded7', sol: '#f2f0eb', libelles: '#3a3a3a' },
  sombre: { fond: 'sombre', routes: '#4a4a4a', eau: '#1f3a4d', bati: '#2c2c2c', sol: '#1c1c1c', libelles: '#d0d0d0' },
};

function apercuUrl(palette: Palette): string {
  const site = MAPS_SITE_URL.replace(/\/+$/, '');
  const params = Object.entries(palette)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `${site}/api/styles/apercu.json?${params}`;
}

export const PREREGLAGES: Theme[] = (Object.keys(PALETTES) as (keyof typeof PALETTES)[]).map((id) => ({
  id,
  nom: id,
  palette: PALETTES[id],
  styleUrl: apercuUrl(PALETTES[id]),
}));

/**
 * Le thème assigné à la clé — ou null sans clé, ou si le serveur le refuse
 * (clé inconnue : 404 ; service `fond` coupé : 403). La palette vient des
 * métadonnées du style ; l'URL est celle que l'application utilisera.
 */
export async function fetchKeyTheme(): Promise<Theme | null> {
  if (!MAPS_API_KEY) return null;
  const styleUrl = diraStyleUrl({ siteUrl: MAPS_SITE_URL, apiKey: MAPS_API_KEY });
  const response = await fetch(styleUrl);
  if (!response.ok) return null;
  const style = (await response.json()) as { name?: string; metadata?: { 'dira:palette'?: Palette } };
  const palette = style.metadata?.['dira:palette'];
  if (!palette) return null;
  return { id: 'cle', nom: (style.name ?? 'Dira').replace(/^Dira — /, ''), palette, styleUrl };
}
