import axios from 'axios';

const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';

interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface MovieStatus {
  flatrateProviderIds: number[]; // todos los providers flatrate de ES
  voteAverage: number | null; // nota del público TMDB (null si no hay votos)
  posterUrl: string | null;
}

// Reintento único ante rate-limit (429), respetando Retry-After si viene.
// Vive en el servicio: si el 2º intento también falla, el error se propaga
// y el llamante conserva el dato anterior de esa película.
async function getWithRetry(url: string, params: Record<string, unknown>) {
  try {
    return await axios.get(url, { params });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      const retryAfter = Number(error.response.headers?.['retry-after']);
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return axios.get(url, { params });
    }
    throw error;
  }
}

// Los errores de red/API se propagan al llamante: un fallo de TMDB no es lo
// mismo que "película no encontrada" o "sin plataformas", y no debe cachearse
// como tal.
export const TMDBService = {
  isConfigured(): boolean {
    return !!TMDB_API_KEY;
  },

  // Resuelve título (+año) → id de TMDB. Solo hace falta para películas
  // nuevas: el id se cachea para siempre.
  // null = TMDB respondió bien pero no hay resultados.
  async searchMovie(title: string, year?: string): Promise<number | null> {
    const response = await getWithRetry(`${BASE_URL}/search/movie`, {
      api_key: TMDB_API_KEY,
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
      api_key: TMDB_API_KEY,
      language: 'es-ES',
      append_to_response: 'watch/providers',
    });

    const data = response.data;
    const flatrate: TmdbProvider[] = data['watch/providers']?.results?.ES?.flatrate ?? [];
    const hasVotes = typeof data.vote_average === 'number' && data.vote_count > 0;

    return {
      flatrateProviderIds: flatrate.map((provider) => provider.provider_id),
      voteAverage: hasVotes ? data.vote_average : null,
      posterUrl: data.poster_path ? `${POSTER_BASE_URL}${data.poster_path}` : null,
    };
  },
};
