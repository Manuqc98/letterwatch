import { TMDB_GENRES } from '../constants/genres';
import type { CachedMovie } from '../services/storage';

export type SortField = 'rating' | 'runtime' | 'year';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

export const DEFAULT_SORT: SortState = {
  field: 'rating',
  direction: 'desc',
};

export const SORT_OPTIONS: {
  field: SortField;
  label: string;
  defaultDir: SortDirection;
}[] = [
  { field: 'rating', label: 'Nota', defaultDir: 'desc' },
  { field: 'runtime', label: 'Duración', defaultDir: 'asc' },
  { field: 'year', label: 'Año', defaultDir: 'desc' },
];

// Inclusivos: "≤ 2h" incluye las que duran justo 2h, y con la barra en un
// extremo no se excluye la propia película que lo marca.
export type CompareOp = 'lte' | 'gte';

export function opSymbol(op: CompareOp): string {
  return op === 'lte' ? '≤' : '≥';
}

export type NumericFilterKey = 'runtime' | 'year' | 'rating';

export interface NumericFilter {
  op: CompareOp;
  value: number;
}

// Sin el texto de búsqueda: va en su propio estado (diferido) para que
// teclear no cambie este objeto ni re-renderice los controles de filtro.
export interface MovieFilterState {
  genres: Set<number>;
  runtime: NumericFilter | null; // minutos (ej. 88)
  year: NumericFilter | null; // año (ej. 1999)
  rating: NumericFilter | null; // décimas de nota (ej. 75 = 7,5)
}

export function createEmptyFilters(): MovieFilterState {
  return {
    genres: new Set(),
    runtime: null,
    year: null,
    rating: null,
  };
}

export interface NumericRange {
  min: number;
  max: number;
}

export interface AvailableFilterOptions {
  genres: [number, number][];
  runtimeRange: NumericRange | null;
  yearRange: NumericRange | null;
  ratingTenthsRange: NumericRange | null;
  missingGenresCount: number;
  missingRuntimeCount: number;
}

export function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatRatingTenths(tenths: number): string {
  return (tenths / 10).toFixed(1).replace('.', ',');
}

function ratingTenths(movie: CachedMovie): number | null {
  return movie.voteAverage != null ? Math.round(movie.voteAverage * 10) : null;
}

function parseYear(year?: string): number | null {
  if (!year) return null;
  const n = parseInt(year, 10);
  return Number.isNaN(n) ? null : n;
}

export function extractAvailableOptions(movies: CachedMovie[]): AvailableFilterOptions {
  const genreCounts = new Map<number, number>();

  let minRuntime = Infinity;
  let maxRuntime = -Infinity;
  let minYear = Infinity;
  let maxYear = -Infinity;
  let minRating = Infinity;
  let maxRating = -Infinity;
  let missingGenresCount = 0;
  let missingRuntimeCount = 0;

  for (const movie of movies) {
    if (movie.genreIds === undefined) {
      missingGenresCount++;
    } else {
      for (const id of movie.genreIds) {
        if (TMDB_GENRES[id]) genreCounts.set(id, (genreCounts.get(id) ?? 0) + 1);
      }
    }

    if (movie.runtime === undefined) {
      missingRuntimeCount++;
    } else if (movie.runtime !== null) {
      if (movie.runtime < minRuntime) minRuntime = movie.runtime;
      if (movie.runtime > maxRuntime) maxRuntime = movie.runtime;
    }

    const y = parseYear(movie.year);
    if (y !== null) {
      if (y < minYear) minYear = y;
      if (y > maxYear) maxYear = y;
    }

    const r = ratingTenths(movie);
    if (r !== null) {
      if (r < minRating) minRating = r;
      if (r > maxRating) maxRating = r;
    }
  }

  return {
    genres: [...genreCounts.entries()].sort(
      (a, b) => b[1] - a[1] || TMDB_GENRES[a[0]].localeCompare(TMDB_GENRES[b[0]], 'es')
    ),
    runtimeRange: minRuntime <= maxRuntime ? { min: minRuntime, max: maxRuntime } : null,
    yearRange: minYear <= maxYear ? { min: minYear, max: maxYear } : null,
    ratingTenthsRange: minRating <= maxRating ? { min: minRating, max: maxRating } : null,
    missingGenresCount,
    missingRuntimeCount,
  };
}

// Interseca géneros con lo disponible para evitar filtros fantasma tras re-escanear.
export function sanitizeFilters(
  filters: MovieFilterState,
  options: AvailableFilterOptions
): MovieFilterState {
  const availableGenres = new Set(options.genres.map(([id]) => id));
  return {
    genres: new Set([...filters.genres].filter((id) => availableGenres.has(id))),
    runtime: filters.runtime,
    year: options.yearRange ? filters.year : null,
    rating: options.ratingTenthsRange ? filters.rating : null,
  };
}

export function countActiveFilters(filters: MovieFilterState, query: string): number {
  let count = 0;
  if (query.trim().length > 0) count++;
  if (filters.genres.size > 0) count++;
  if (filters.runtime !== null) count++;
  if (filters.year !== null) count++;
  if (filters.rating !== null) count++;
  return count;
}

function normalizeText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Títulos normalizados por id, calculados una vez por lista: la búsqueda no
// repite normalize() + regex de cada título en cada pulsación.
export function buildSearchIndex(movies: CachedMovie[]): Map<string, string> {
  return new Map(movies.map((movie) => [movie.id, normalizeText(movie.title)]));
}

function matchesNumeric(actual: number | null | undefined, filter: NumericFilter): boolean {
  if (actual == null) return false;
  return filter.op === 'lte' ? actual <= filter.value : actual >= filter.value;
}

// Compara dos valores numéricos opcionales colocando SIEMPRE los nulos al final,
// independientemente de si el orden es ascendente o descendente.
function compareNullableNumber(
  a: number | null,
  b: number | null,
  direction: SortDirection
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === 'asc' ? a - b : b - a;
}

// Orden por defecto (y desempate de los demás): nota desc → año reciente →
// alfabético. Lo comparten Ready, News y WatchOut.
export function compareByRating(a: CachedMovie, b: CachedMovie): number {
  const byRating = compareNullableNumber(ratingTenths(a), ratingTenths(b), 'desc');
  if (byRating !== 0) return byRating;
  const byYear = compareNullableNumber(parseYear(a.year), parseYear(b.year), 'desc');
  if (byYear !== 0) return byYear;
  return a.title.localeCompare(b.title, 'es');
}

export function compareMovies(a: CachedMovie, b: CachedMovie, sort: SortState): number {
  let primary = 0;
  switch (sort.field) {
    case 'rating':
      primary = compareNullableNumber(ratingTenths(a), ratingTenths(b), sort.direction);
      break;
    case 'runtime':
      primary = compareNullableNumber(a.runtime ?? null, b.runtime ?? null, sort.direction);
      break;
    case 'year':
      primary = compareNullableNumber(parseYear(a.year), parseYear(b.year), sort.direction);
      break;
  }
  if (primary !== 0) return primary;
  return compareByRating(a, b);
}

export function sortMovies<T extends CachedMovie>(movies: T[], sort: SortState): T[] {
  return [...movies].sort((a, b) => compareMovies(a, b, sort));
}

// Aplica todos los filtros activos (AND entre categorías, OR dentro de
// géneros). Conserva el orden de entrada: se filtra sobre la lista ya
// ordenada, así escribir en el buscador no reordena nada.
export function filterMovies<T extends CachedMovie>(
  movies: T[],
  filters: MovieFilterState,
  query: string,
  searchIndex: Map<string, string>
): T[] {
  const normalizedQuery = normalizeText(query.trim());

  return movies.filter((movie) => {
    if (normalizedQuery.length > 0) {
      const title = searchIndex.get(movie.id) ?? normalizeText(movie.title);
      const yearMatch = movie.year ? movie.year.includes(normalizedQuery) : false;
      if (!title.includes(normalizedQuery) && !yearMatch) return false;
    }

    if (filters.genres.size > 0) {
      if (!movie.genreIds?.some((id) => filters.genres.has(id))) return false;
    }

    if (filters.runtime !== null) {
      if (!matchesNumeric(movie.runtime, filters.runtime)) return false;
    }

    if (filters.year !== null) {
      if (!matchesNumeric(parseYear(movie.year), filters.year)) return false;
    }

    if (filters.rating !== null) {
      if (!matchesNumeric(ratingTenths(movie), filters.rating)) return false;
    }

    return true;
  });
}
