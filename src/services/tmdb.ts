import axios from 'axios';
import { StorageService } from './storage';

const BASE_URL = 'https://api.themoviedb.org/3';
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';
// Sin timeout, una conexión colgada no resuelve nunca (OkHttp de RN no
// pone ninguno) y el escaneo se queda bloqueado. Al vencer cuenta como un
// fallo más: la película conserva su dato anterior.
const TIMEOUT_MS = 10000;
const VALIDATE_TIMEOUT_MS = 6000;

// Errores que invalidan el escaneo entero, no solo una película: el llamante
// los distingue de un fallo puntual de red sin conocer los códigos HTTP.
export type TmdbErrorCode = 'INVALID_KEY' | 'NOT_CONFIGURED';

export class TmdbError extends Error {
  code: TmdbErrorCode;
  constructor(code: TmdbErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

// La clave vive solo en StorageService (con espejo en memoria): leerla en
// cada petición sigue cualquier cambio hecho en Ajustes sin sincronizar nada.
async function requireApiKey(): Promise<string> {
  const key = await StorageService.getTmdbApiKey();
  if (!key) throw new TmdbError('NOT_CONFIGURED', 'No hay API Key de TMDB configurada.');
  return key;
}

async function tmdbGet(url: string, params: Record<string, unknown>) {
  try {
    return await axios.get(url, { params, timeout: TIMEOUT_MS });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new TmdbError('INVALID_KEY', 'TMDB ha rechazado la API Key.');
    }
    throw error;
  }
}

// 401 = clave rechazada; cualquier otro error = la clave no se pudo comprobar.
async function isValidKey(apiKey: string): Promise<boolean> {
  try {
    const response = await axios.get(`${BASE_URL}/authentication`, {
      params: { api_key: apiKey },
      timeout: VALIDATE_TIMEOUT_MS,
    });
    return response.data?.success === true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return false;
    }
    throw error;
  }
}

interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface MovieStatus {
  flatrateProviderIds: number[]; // todos los providers flatrate de ES
  voteAverage: number | null; // nota del público TMDB (null si no hay votos)
  posterUrl: string | null;
  genreIds: number[]; // géneros TMDB (ver constants/genres.ts)
  runtime: number | null; // duración en minutos (null si TMDB devuelve 0 o falta)
  originalLanguage: string | null; // código ISO 639-1 (p. ej. "en", "es", "ja")
}

// Reintento único ante rate-limit (429), respetando Retry-After si viene.
// Vive en el servicio: si el 2º intento también falla, el error se propaga
// y el llamante conserva el dato anterior de esa película.
async function getWithRetry(url: string, params: Record<string, unknown>) {
  try {
    return await tmdbGet(url, params);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      const retryAfter = Number(error.response.headers?.['retry-after']);
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return tmdbGet(url, params);
    }
    throw error;
  }
}

// Los errores de red/API se propagan al llamante: un fallo de TMDB no es lo
// mismo que "película no encontrada" o "sin plataformas", y no debe cachearse
// como tal. Una clave rechazada o ausente llega como TmdbError.
export const TMDBService = {
  // Comprobación de la clave (ya recortada) para onboarding y Ajustes.
  // Devuelve el mensaje de error para el usuario, o null si es válida.
  async checkKey(apiKey: string): Promise<string | null> {
    // La página de API de TMDB muestra antes el "API Read Access Token" (v4,
    // un JWT) que la "API Key" (v3) que usa la app: es el error más común.
    if (apiKey.startsWith('eyJ') && apiKey.split('.').length === 3) {
      return 'Has pegado el "API Read Access Token". Copia la "API Key", la clave corta de 32 caracteres.';
    }
    try {
      const valid = await isValidKey(apiKey);
      return valid ? null : 'La clave no es válida en TMDB. Revisa que esté bien copiada.';
    } catch (e) {
      console.error('Error validando la clave de TMDB:', e);
      return 'No se pudo conectar con TMDB. Comprueba tu conexión a internet.';
    }
  },

  // Resuelve título (+año) → id de TMDB. Solo hace falta para películas
  // nuevas: el id se cachea para siempre.
  // null = TMDB respondió bien pero no hay resultados.
  async searchMovie(title: string, year?: string): Promise<number | null> {
    const response = await getWithRetry(`${BASE_URL}/search/movie`, {
      api_key: await requireApiKey(),
      query: title,
      language: 'es-ES',
      ...(year ? { year } : {}),
    });

    return response.data.results?.[0]?.id ?? null;
  },

  // Estado de la película en UNA petición: providers flatrate de España,
  // nota del público y póster (append_to_response combina detalles+providers).
  // El filtrado por las plataformas del usuario se hace al pintar la lista.
  async getMovieStatus(tmdbId: number): Promise<MovieStatus> {
    const response = await getWithRetry(`${BASE_URL}/movie/${tmdbId}`, {
      api_key: await requireApiKey(),
      language: 'es-ES',
      append_to_response: 'watch/providers',
    });

    const data = response.data;
    const flatrate: TmdbProvider[] = data['watch/providers']?.results?.ES?.flatrate ?? [];
    const hasVotes = typeof data.vote_average === 'number' && data.vote_count > 0;
    const runtime = typeof data.runtime === 'number' && data.runtime > 0 ? data.runtime : null;
    const originalLanguage =
      typeof data.original_language === 'string' && data.original_language.trim().length > 0
        ? data.original_language.trim().toLowerCase()
        : null;

    return {
      flatrateProviderIds: flatrate.map((provider) => provider.provider_id),
      voteAverage: hasVotes ? data.vote_average : null,
      posterUrl: data.poster_path ? `${POSTER_BASE_URL}${data.poster_path}` : null,
      genreIds: (data.genres ?? []).map((genre: { id: number }) => genre.id),
      runtime,
      originalLanguage,
    };
  },
};
