import { describe, expect, it } from 'vitest';

import { diraBasemapTemplate, diraOverlayTemplate, diraTileTemplate } from '../overlay';

describe('diraOverlayTemplate', () => {
  const base = { siteUrl: 'https://maps.dira.llc', city: 'lome' as const };

  it('vise /ows/dira_<ville>, hors de l’API', () => {
    // Le serveur QGIS est servi sous /ows/, pas sous /api : viser la base de
    // l'API donnerait des 404 silencieux et une surimpression simplement vide.
    expect(diraOverlayTemplate(base)).toContain('https://maps.dira.llc/ows/dira_lome?');
    expect(diraOverlayTemplate(base)).not.toContain('/api/');
  });

  it('demande EPSG:3857, dont l’ordre des axes correspond aux gabarits', () => {
    // En 4326, WMS 1.3.0 attend lat,lon : la carte serait transposée sans
    // qu'aucune erreur ne soit levée.
    const url = diraOverlayTemplate(base);
    expect(url).toContain('CRS=EPSG%3A3857');
    expect(url).toContain('BBOX={minX},{minY},{maxX},{maxY}');
  });

  it('laisse voir la carte native dessous par défaut', () => {
    expect(diraOverlayTemplate(base)).toContain('TRANSPARENT=TRUE');
    expect(diraOverlayTemplate({ ...base, transparent: false })).toContain('TRANSPARENT=FALSE');
  });

  it('dessine le bâti puis la voirie, et accepte une autre liste', () => {
    expect(diraOverlayTemplate(base)).toContain('LAYERS=batiments%2Croutes');
    expect(diraOverlayTemplate({ ...base, layers: ['points_interet'] })).toContain(
      'LAYERS=points_interet',
    );
  });

  it('tolère une barre finale sur le site', () => {
    expect(diraOverlayTemplate({ ...base, siteUrl: 'https://maps.dira.llc/' })).toContain(
      'https://maps.dira.llc/ows/dira_lome?',
    );
  });
});

describe('diraTileTemplate', () => {
  it('passe par l’API, où est le cache, et non par le serveur QGIS', () => {
    // /ows/ rend à la demande et n'est pas censé être exposé aux clients.
    const url = diraTileTemplate({ apiUrl: 'https://maps.dira.llc/api', city: 'lome' });
    expect(url).toBe('https://maps.dira.llc/api/tiles/lome/{z}/{x}/{y}.png');
    expect(url).not.toContain('/ows/');
  });

  it('laisse les gabarits {z}/{x}/{y} intacts pour le composant de carte', () => {
    const url = diraTileTemplate({ apiUrl: 'https://maps.dira.llc/api/', city: 'dakar' });
    expect(url).toContain('{z}');
    expect(url).toContain('{x}');
    expect(url).toContain('{y}');
    expect(url).not.toContain('//tiles');
  });
});

describe('diraBasemapTemplate', () => {
  it('sert le fond depuis Dira, jamais depuis les serveurs publics d’OSM', () => {
    // La politique d'usage d'OSM interdit l'usage applicatif à volume : une app
    // livreur qui taperait tile.openstreetmap.org finirait par être bloquée.
    const url = diraBasemapTemplate({ siteUrl: 'https://maps.dira.llc' });
    expect(url).toBe('https://maps.dira.llc/basemap/styles/basic-preview/{z}/{x}/{y}.png');
    expect(url).not.toContain('openstreetmap.org');
  });

  it('passe par /basemap/, hors de l’API : le cache est devant', () => {
    expect(diraBasemapTemplate({ siteUrl: 'https://maps.dira.llc/' })).not.toContain('/api/');
  });

  it('accepte un autre style', () => {
    expect(diraBasemapTemplate({ siteUrl: 'https://x.tld', style: 'dira-dark' })).toContain(
      '/basemap/styles/dira-dark/',
    );
  });
});
