import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PLATFORMS, PlatformKey } from '../constants/platforms';
import { WatchlistMovie } from './letterboxd';
import { JustWatchEntry } from './justwatch';

const USERNAME_KEY = '@letterwatch_username';
const PLATFORMS_KEY = '@letterwatch_platforms';
const CACHE_KEY = '@letterwatch_cache';
const TMDB_API_KEY_STORAGE = '@letterwatch_tmdb_api_key';

// A partir de esta edad los datos se consideran desactualizados y la UI
// sugiere refrescar. No se borran: sirven para el refresh incremental
// (el tmdbId de una película no cambia nunca).
export const STALE_AFTER_DAYS = 7;

export interface CachedMovie extends WatchlistMovie {
  tmdbId: number | null; // null = no encontrada en TMDB
  posterUrl: string | null;
  flatrateProviderIds: number[]; // todos los providers flatrate de ES
  // Nota del público en TMDB; se refresca en cada escaneo. Puede faltar
  // (undefined) en cachés anteriores a este campo: se ordenan al final
  // hasta el siguiente escaneo.
  voteAverage?: number | null;
  // Géneros TMDB; se refrescan en cada escaneo. Puede faltar (undefined)
  // en cachés anteriores: esas películas no matchean filtros de género
  // hasta el siguiente escaneo.
  genreIds?: number[];
}

export interface CachedData {
  username: string; // a quién pertenece la watchlist cacheada
  movies: CachedMovie[];
  timestamp: number;
  truncated: boolean;
  // Datos de JustWatch para News/WatchOut. null = aún no obtenidos
  // (cachés antiguas o fallo de la fuente); nunca invalidan la caché.
  news?: JustWatchEntry[] | null;
  leaving?: JustWatchEntry[] | null;
}

// JSON.parse defensivo: un valor corrupto en disco (escritura interrumpida,
// formato antiguo) se borra y se trata como "no hay dato", nunca crashea.
async function readJson(key: string): Promise<any | null> {
  const data = await AsyncStorage.getItem(key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

// Época de la caché: clearAll la incrementa. Un escaneo en vuelo captura la
// época al empezar y no persiste si cambió — evita que un escaneo huérfano
// resucite datos tras "Borrar datos", incluso reintroduciendo el mismo usuario.
let cacheEpoch = 0;

export const StorageService = {
  getCacheEpoch(): number {
    return cacheEpoch;
  },
  async getUsername(): Promise<string | null> {
    return AsyncStorage.getItem(USERNAME_KEY);
  },
  async setUsername(username: string): Promise<void> {
    return AsyncStorage.setItem(USERNAME_KEY, username);
  },
  async getPlatforms(): Promise<Record<PlatformKey, boolean> | null> {
    const parsed = await readJson(PLATFORMS_KEY);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    // Merge con los defaults por si se añaden plataformas nuevas a la app
    // después de que el usuario guardara su selección.
    return { ...DEFAULT_PLATFORMS, ...parsed };
  },
  async setPlatforms(platforms: Record<PlatformKey, boolean>): Promise<void> {
    return AsyncStorage.setItem(PLATFORMS_KEY, JSON.stringify(platforms));
  },
  async getCache(): Promise<CachedData | null> {
    const parsed = await readJson(CACHE_KEY);
    if (!parsed) return null;
    // Descarta cachés con formato antiguo o incompleto.
    const valid =
      typeof parsed.username === 'string' &&
      typeof parsed.timestamp === 'number' &&
      Array.isArray(parsed.movies) &&
      parsed.movies.every((m: CachedMovie) => Array.isArray(m?.flatrateProviderIds));
    if (!valid) {
      await AsyncStorage.removeItem(CACHE_KEY);
      return null;
    }
    return {
      ...parsed,
      truncated: parsed.truncated === true,
      // Normalización retrocompatible: un campo JW raro nunca tira la caché.
      news: Array.isArray(parsed.news) ? parsed.news : null,
      leaving: Array.isArray(parsed.leaving) ? parsed.leaving : null,
    };
  },
  async setCache(
    username: string,
    movies: CachedMovie[],
    truncated: boolean,
    news: JustWatchEntry[] | null,
    leaving: JustWatchEntry[] | null
  ): Promise<void> {
    const data: CachedData = {
      username,
      movies,
      truncated,
      news,
      leaving,
      timestamp: Date.now(),
    };
    return AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
  },
  async clearCache(): Promise<void> {
    cacheEpoch++;
    return AsyncStorage.removeItem(CACHE_KEY);
  },
  async getTmdbApiKey(): Promise<string | null> {
    const stored = await AsyncStorage.getItem(TMDB_API_KEY_STORAGE);
    if (stored && stored.trim().length > 0) return stored.trim();
    // Fallback a la clave del .env SOLO en desarrollo: en un build
    // distribuido la clave del desarrollador no debe precargarse en el
    // onboarding ni sobrevivir a "Borrar todo".
    if (!__DEV__) return null;
    const envKey = process.env.EXPO_PUBLIC_TMDB_API_KEY;
    return envKey && envKey.trim().length > 0 ? envKey.trim() : null;
  },
  async setTmdbApiKey(apiKey: string): Promise<void> {
    return AsyncStorage.setItem(TMDB_API_KEY_STORAGE, apiKey.trim());
  },
  // Guarda la configuración del onboarding en una sola escritura: un fallo
  // a medias no deja un usuario sin clave (o al revés) en disco.
  async saveSetup(
    username: string,
    apiKey: string,
    platforms: Record<PlatformKey, boolean>
  ): Promise<void> {
    return AsyncStorage.multiSet([
      [USERNAME_KEY, username],
      [TMDB_API_KEY_STORAGE, apiKey.trim()],
      [PLATFORMS_KEY, JSON.stringify(platforms)],
    ]);
  },
  async clearTmdbApiKey(): Promise<void> {
    return AsyncStorage.removeItem(TMDB_API_KEY_STORAGE);
  },
  async clearAll(): Promise<void> {
    cacheEpoch++;
    return AsyncStorage.multiRemove([USERNAME_KEY, PLATFORMS_KEY, CACHE_KEY, TMDB_API_KEY_STORAGE]);
  },
};
