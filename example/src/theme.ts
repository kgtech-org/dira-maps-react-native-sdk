/**
 * Les thèmes de carte, tels que Dira Maps les sert.
 *
 * Un thème est réglé dans le portail et assigné à une clé ; il a DEUX
 * palettes, jour et nuit, et le serveur en dérive un style MapLibre par
 * apparence. Ce module ne connaît que des URL de style :
 *
 *  - celui de la CLÉ : `diraStyleUrl` — ce qu'une application voit, dans la
 *    variante que le téléphone demande (`colorScheme`) ;
 *  - ceux des préréglages : le même constructeur, appelé avec une palette en
 *    paramètres (`/api/styles/apercu.json`) — ce que l'éditeur du portail
 *    prévisualise. Les palettes sont recopiées du serveur : elles sont
 *    stables, et le sample doit pouvoir basculer sans clé.
 *
 * Le rendu est celui de MapLibre, à partir de l'URL : rien n'est recoloré à
 * la main ici. Changer de thème — ou passer en mode nuit —, c'est changer
 * d'URL.
 */
import { diraStyleUrl, type ColorScheme } from '@kgtech-org/dira-maps-react-native';

import { MAPS_API_KEY, MAPS_SITE_URL } from './config';

export type Apparence = 'clair' | 'sombre';

export interface Palette {
  fond: Apparence;
  routes: string;
  eau: string;
  bati: string;
  sol: string;
  libelles: string;
}

export type Palettes = Record<Apparence, Palette>;

export interface Theme {
  /** `cle` = le thème assigné à la clé dans le portail ; sinon un préréglage. */
  id: 'cle' | 'dira' | 'classique';
  nom: string;
  palettes: Palettes;
  /** Ce que le serveur rend quand le téléphone n'a pas de préférence. */
  defaut: Apparence;
  /** L'URL du style MapLibre pour une apparence — ce que la carte charge. */
  styleUrl: (scheme: ColorScheme) => string;
}

/** L'apparence qu'un `useColorScheme()` demande — ou celle du thème s'il n'en a pas. */
export function apparence(scheme: ColorScheme, defaut: Apparence): Apparence {
  return scheme === 'dark' ? 'sombre' : scheme === 'light' ? 'clair' : defaut;
}

const PREREGLAGES_SERVEUR: Record<Exclude<Theme['id'], 'cle'>, { defaut: Apparence; palettes: Palettes }> = {
  dira: {
    defaut: 'sombre',
    palettes: {
      clair: { fond: 'clair', routes: '#ffffff', eau: '#d2d2d2', bati: '#dadada', sol: '#ebebeb', libelles: '#2f2f2f' },
      sombre: { fond: 'sombre', routes: '#8c8c8c', eau: '#3f3f3f', bati: '#606060', sol: '#4b4b4b', libelles: '#e2e2e2' },
    },
  },
  classique: {
    defaut: 'clair',
    palettes: {
      clair: { fond: 'clair', routes: '#ffffff', eau: '#b7d3ea', bati: '#e3ded7', sol: '#f2f0eb', libelles: '#3a3a3a' },
      sombre: { fond: 'sombre', routes: '#4a4a4a', eau: '#1f3a4d', bati: '#2c2c2c', sol: '#1c1c1c', libelles: '#d0d0d0' },
    },
  },
};

function apercuUrl(palette: Palette): string {
  const site = MAPS_SITE_URL.replace(/\/+$/, '');
  const params = Object.entries(palette)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `${site}/api/styles/apercu.json?${params}`;
}

export const PREREGLAGES: Theme[] = (Object.keys(PREREGLAGES_SERVEUR) as (keyof typeof PREREGLAGES_SERVEUR)[]).map(
  (id) => {
    const { defaut, palettes } = PREREGLAGES_SERVEUR[id];
    return { id, nom: id, palettes, defaut, styleUrl: (scheme) => apercuUrl(palettes[apparence(scheme, defaut)]) };
  },
);

interface StyleServi {
  name?: string;
  metadata?: { 'dira:palette'?: Palette; 'dira:apparence'?: Apparence };
}

/**
 * Le thème assigné à la clé — ou null sans clé, ou si le serveur le refuse
 * (clé inconnue : 404 ; service `fond` coupé : 403). Deux lectures : sans
 * apparence, le serveur rend celle par défaut et la nomme ; puis l'autre.
 * Les palettes viennent des métadonnées ; l'URL est celle que l'application
 * utilisera, apparence comprise.
 */
export async function fetchKeyTheme(): Promise<Theme | null> {
  if (!MAPS_API_KEY) return null;
  const apiKey = MAPS_API_KEY;
  const lire = async (scheme: ColorScheme): Promise<StyleServi | null> => {
    const response = await fetch(diraStyleUrl({ siteUrl: MAPS_SITE_URL, apiKey, colorScheme: scheme }));
    return response.ok ? ((await response.json()) as StyleServi) : null;
  };
  const parDefaut = await lire(undefined);
  const defaut = parDefaut?.metadata?.['dira:apparence'];
  const palette = parDefaut?.metadata?.['dira:palette'];
  if (!parDefaut || !defaut || !palette) return null;
  const autre = await lire(defaut === 'sombre' ? 'light' : 'dark');
  const autrePalette = autre?.metadata?.['dira:palette'];
  if (!autrePalette) return null;
  const palettes = { [defaut]: palette, [defaut === 'sombre' ? 'clair' : 'sombre']: autrePalette } as Palettes;
  return {
    id: 'cle',
    nom: (parDefaut.name ?? 'Dira').replace(/^Dira — /, ''),
    palettes,
    defaut,
    styleUrl: (scheme) => diraStyleUrl({ siteUrl: MAPS_SITE_URL, apiKey, colorScheme: scheme }),
  };
}
