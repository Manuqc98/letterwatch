import axios from 'axios';
import * as cheerio from 'cheerio';

export interface WatchlistMovie {
  id: string; // slug de Letterboxd (p.ej. "kill-bill-vol-1")
  title: string;
  year?: string;
}

export interface WatchlistResult {
  movies: WatchlistMovie[];
  truncated: boolean; // la watchlist tiene más páginas de las que se analizan
}

export type LetterboxdErrorCode = 'USER_NOT_FOUND' | 'NETWORK';

export class LetterboxdError extends Error {
  code: LetterboxdErrorCode;
  constructor(code: LetterboxdErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

// Letterboxd muestra 28 películas por página → tope de 280.
const MAX_PAGES = 10;
// Páginas descargadas a la vez (tras la primera).
const PAGE_CONCURRENCY = 5;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

// El nombre viene como "Título (Año)"; el año puede faltar.
function parseItemName(rawName: string): { title: string; year?: string } {
  const match = rawName.match(/^(.*?)(?:\s+\((\d{4})\))?$/);
  if (!match) return { title: rawName };
  return { title: match[1], year: match[2] || undefined };
}

async function fetchPageHtml(username: string, page: number): Promise<string> {
  const url = `https://letterboxd.com/${encodeURIComponent(username)}/watchlist/page/${page}/`;
  try {
    const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new LetterboxdError('USER_NOT_FOUND', `El usuario "${username}" no existe en Letterboxd.`);
    }
    throw new LetterboxdError('NETWORK', `No se pudo leer la página ${page} de la watchlist.`);
  }
}

function parseMovies($: cheerio.CheerioAPI): WatchlistMovie[] {
  const movies: WatchlistMovie[] = [];
  // Cada película es un componente lazy con sus datos en atributos data-*.
  $('li.griditem div.react-component[data-item-slug]').each((_, el) => {
    const rawName = $(el).attr('data-item-name');
    const slug = $(el).attr('data-item-slug');
    if (rawName && slug) {
      const { title, year } = parseItemName(rawName);
      movies.push({ id: slug, title, year });
    }
  });
  return movies;
}

// Total de páginas según los números de la paginación ("… 23" incluido).
// Los <li> sin número (elipsis "…") se ignoran.
function parseTotalPages($: cheerio.CheerioAPI): number {
  let total = 1;
  $('.paginate-page').each((_, el) => {
    const n = parseInt($(el).text().trim(), 10);
    if (!Number.isNaN(n) && n > total) total = n;
  });
  return total;
}

export const LetterboxdService = {
  async fetchWatchlist(username: string): Promise<WatchlistResult> {
    const firstHtml = await fetchPageHtml(username, 1);
    const $first = cheerio.load(firstHtml);
    const movies = parseMovies($first);
    if (movies.length === 0) {
      return { movies: [], truncated: false }; // watchlist vacía o privada
    }

    const totalPages = parseTotalPages($first);
    const hasNext = $first('.pagination a.next').length > 0;

    if (totalPages === 1 && hasNext) {
      // Paginación sin números de página (markup inesperado): recorrido
      // secuencial clásico como red de seguridad.
      let page = 2;
      let more = true;
      while (more && page <= MAX_PAGES) {
        const $ = cheerio.load(await fetchPageHtml(username, page));
        const pageMovies = parseMovies($);
        if (pageMovies.length === 0) break;
        movies.push(...pageMovies);
        more = $('.pagination a.next').length > 0;
        page++;
      }
      return { movies, truncated: more && page > MAX_PAGES };
    }

    // Resto de páginas en paralelo (lotes), fusionadas en orden de página.
    const lastPage = Math.min(totalPages, MAX_PAGES);
    for (let start = 2; start <= lastPage; start += PAGE_CONCURRENCY) {
      const pages: number[] = [];
      for (let p = start; p < start + PAGE_CONCURRENCY && p <= lastPage; p++) {
        pages.push(p);
      }
      const htmls = await Promise.all(pages.map((p) => fetchPageHtml(username, p)));
      for (const html of htmls) {
        movies.push(...parseMovies(cheerio.load(html)));
      }
    }

    return { movies, truncated: totalPages > MAX_PAGES };
  },
};
