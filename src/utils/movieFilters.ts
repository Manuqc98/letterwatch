import { TMDB_GENRES } from '../constants/genres';
import type { VisibleMovie } from '../context/WatchlistContext';

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

export type CompareOp = 'lt' | 'gt';

export interface NumericFilter {
  op: CompareOp;
  value: number;
}

export interface MovieFilterState {
  query: string;
  genres: Set<number>;
  runtime: NumericFilter | null; // minutos (ej. 88)
  year: NumericFilter | null; // año (ej. 1999)
  rating: NumericFilter | null; // décimas de nota (ej. 75 = 7,5)
}

export function createEmptyFilters(): MovieFilterState {
  return {
    query: '',
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

function ratingTenths(movie: VisibleMovie): number | null {
  return movie.voteAverage != null ? Math.round(movie.voteAverage * 10) : null;
}

function parseYear(year?: string): number | null {
  if (!year) return null;
  const n = parseInt(year, 10);
  return Number.isNaN(n) ? null : n;
}

export function extractAvailableOptions(movies: VisibleMovie[]): AvailableFilterOptions {
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
    query: filters.query,
    genres: new Set([...filters.genres].filter((id) => availableGenres.has(id))),
    runtime: filters.runtime,
    year: options.yearRange ? filters.year : null,
    rating: options.ratingTenthsRange ? filters.rating : null,
  };
}

export function countActiveFilters(filters: MovieFilterState): number {
  let count = 0;
  if (filters.query.trim().length > 0) count++;
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

function matchesNumeric(actual: number | null | undefined, filter: NumericFilter): boolean {
  if (actual == null) return false;
  return filter.op === 'lt' ? actual < filter.value : actual > filter.value;
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

function compareDefaultTieBreak(a: VisibleMovie, b: VisibleMovie): number {
  const byRating = compareNullableNumber(ratingTenths(a), ratingTenths(b), 'desc');
  if (byRating !== 0) return byRating;
  const byYear = compareNullableNumber(parseYear(a.year), parseYear(b.year), 'desc');
  if (byYear !== 0) return byYear;
  return a.title.localeCompare(b.title, 'es');
}

export function compareMovies(a: VisibleMovie, b: VisibleMovie, sort: SortState): number {
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
  return compareDefaultTieBreak(a, b);
}

// Aplica todos los filtros activos (AND entre categorías, OR dentro de géneros)
// y después ordena según el criterio elegido.
export function filterAndSortMovies(
  movies: VisibleMovie[],
  filters: MovieFilterState,
  sort: SortState
): VisibleMovie[] {
  const normalizedQuery = normalizeText(filters.query.trim());

  const filtered = movies.filter((movie) => {
    if (normalizedQuery.length > 0) {
      const titleMatch = normalizeText(movie.title).includes(normalizedQuery);
      const yearMatch = movie.year ? movie.year.includes(normalizedQuery) : false;
      if (!titleMatch && !yearMatch) return false;
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

  return [...filtered].sort((a, b) => compareMovies(a, b, sort));
}
