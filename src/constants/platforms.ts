// IDs de providers de TMDB para la región ES (verificados contra
// /watch/providers/movie?watch_region=ES). Algunas plataformas tienen
// varios IDs (tiers con anuncios, sub-marcas), por eso `ids` es un array.
// `jwPackages` son los shortNames equivalentes en JustWatch (verificados
// contra su catálogo ES; los packageId de JW coinciden con los de TMDB).
// Nota: Prime with Ads (2100) no tiene package propio en JW; `prv` lo cubre.
// `logoPath` es el logo oficial que sirve TMDB (base TMDB_LOGO_BASE).
export const PLATFORMS = {
  netflix: {
    ids: [8, 1796], // 1796 = Netflix Standard with Ads
    name: 'Netflix',
    logoPath: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg',
    jwPackages: ['nfx', 'nfa'],
  },
  prime: {
    ids: [119, 2100], // 2100 = Prime Video with Ads
    name: 'Amazon Prime Video',
    logoPath: '/pvske1MyAoymrs5bguRfVqYiM9a.jpg',
    jwPackages: ['prv'],
  },
  disney: {
    ids: [337],
    name: 'Disney+',
    logoPath: '/97yvRBw1GzX7fXprcF80er19ot.jpg',
    jwPackages: ['dnp'],
  },
  hbo: {
    ids: [1899],
    name: 'HBO Max',
    logoPath: '/jbe4gVSfRlbPTdESXhEKpornsfu.jpg',
    jwPackages: ['mxx'],
  },
  skyshowtime: {
    ids: [1773],
    name: 'SkyShowtime',
    logoPath: '/h0ZYcYHicKQ4Ixm5nOjqvwni5NG.jpg',
    jwPackages: ['sst'],
  },
  movistar: {
    ids: [2241, 149], // 149 = Ficción Total
    name: 'Movistar Plus+',
    logoPath: '/jse4MOi92Jgetym7nbXFZZBI6LK.jpg',
    jwPackages: ['mp9', 'mvs'],
  },
  appletv: {
    ids: [350, 2243], // 350 = Apple TV / Apple TV+, 2243 = Apple TV Amazon Channel
    name: 'Apple TV',
    logoPath: '/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg',
    jwPackages: ['atp', 'avl'], // avl = Apple TV Amazon Channel
  },
  filmin: {
    ids: [63, 64], // 64 = Filmin Plus
    name: 'Filmin',
    logoPath: '/kO2SWXvDCHAquaUuTJBuZkTBAuU.jpg',
    jwPackages: ['fil', 'fip'],
  },
  youtube: {
    ids: [188, 192], // 188 = YouTube Premium, 192 = YouTube
    name: 'YouTube',
    logoPath: '/rMb93u1tBeErSYLv79zSTR07UdO.jpg', // logo TMDB verificado de YouTube Premium (188)
    jwPackages: ['ytr'],
  },
};

export type PlatformKey = keyof typeof PLATFORMS;

export const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

// Se piden TODOS los packages a JustWatch y se filtra por las plataformas
// del usuario al pintar (igual que Ready con flatrate): cambiar switches
// en Ajustes surte efecto sin re-escanear.
export const ALL_JW_PACKAGES = Object.values(PLATFORMS).flatMap((p) => p.jwPackages);

// Derivado de PLATFORMS: añadir una plataforma nueva solo requiere
// tocar la constante de arriba.
export const DEFAULT_PLATFORMS = Object.fromEntries(
  Object.keys(PLATFORMS).map((key) => [key, false])
) as Record<PlatformKey, boolean>;

// Devuelve las plataformas del usuario en las que está disponible una película,
// a partir de la lista completa de providers flatrate de TMDB.
export function matchPlatforms(
  providerIds: number[],
  userPlatforms: Record<PlatformKey, boolean>
): PlatformKey[] {
  return (Object.keys(PLATFORMS) as PlatformKey[]).filter(
    (key) =>
      userPlatforms[key] &&
      PLATFORMS[key].ids.some((id) => providerIds.includes(id))
  );
}
