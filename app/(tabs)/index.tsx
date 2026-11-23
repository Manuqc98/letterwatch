import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { IconButton, Searchbar, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useWatchlist, type VisibleMovie } from '../../src/context/WatchlistContext';
import { STALE_AFTER_DAYS } from '../../src/services/storage';
import { MovieGrid } from '../../src/components/MovieGrid';
import { FeedControls } from '../../src/components/FeedControls';
import { NoticeCard } from '../../src/components/NoticeCard';
import { EmptyState } from '../../src/components/EmptyState';
import { ProgressCard } from '../../src/components/ProgressCard';
import { ScanFab } from '../../src/components/ScanFab';
import { Spacing } from '../../src/constants/theme';
import {
  countActiveFilters,
  createEmptyFilters,
  DEFAULT_SORT,
  extractAvailableOptions,
  filterAndSortMovies,
  formatRuntime,
  MovieFilterState,
  NumericFilter,
  sanitizeFilters,
  SORT_OPTIONS,
  SortField,
  SortState,
} from '../../src/utils/movieFilters';

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export default function ReadyToWatch() {
  const theme = useTheme();
  const router = useRouter();
  const { readyMovies, allMovies, lastUpdated, truncated, isStale, isLoading } = useWatchlist();
  // Filtros y ordenación rápidos de sesión (no se persisten).
  const [filters, setFilters] = useState<MovieFilterState>(createEmptyFilters);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [searchOpen, setSearchOpen] = useState(false);

  const options = useMemo(() => extractAvailableOptions(readyMovies), [readyMovies]);

  // Interseca selecciones con lo disponible para evitar filtros fantasma tras re-escanear.
  const activeFilters = useMemo(() => sanitizeFilters(filters, options), [filters, options]);
  const activeFilterCount = useMemo(() => countActiveFilters(activeFilters), [activeFilters]);

  const displayedMovies = useMemo(
    () => filterAndSortMovies(readyMovies, activeFilters, sort),
    [readyMovies, activeFilters, sort]
  );

  // Películas de caché antigua sin género o duración cuando se usan en el filtro/orden actual.
  const legacyMissing = useMemo(() => {
    const needGenre = activeFilters.genres.size > 0 && options.missingGenresCount > 0;
    const needRuntime =
      (sort.field === 'runtime' || activeFilters.runtime !== null) && options.missingRuntimeCount > 0;
    if (!needGenre && !needRuntime) return null;

    const label =
      needGenre && needRuntime ? 'género ni duración' : needGenre ? 'género' : 'duración';
    const count = readyMovies.filter(
      (m) => (needGenre && m.genreIds === undefined) || (needRuntime && m.runtime === undefined)
    ).length;

    return { count, label };
  }, [activeFilters, sort.field, options, readyMovies]);

  const handleSelectSort = useCallback((field: SortField) => {
    setSort((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDir = SORT_OPTIONS.find((o) => o.field === field)?.defaultDir ?? 'desc';
      return { field, direction: defaultDir };
    });
  }, []);

  const handleToggleGenre = useCallback((id: number) => {
    setFilters((prev) => ({ ...prev, genres: toggleInSet(prev.genres, id) }));
  }, []);

  const handleClearGenres = useCallback(() => {
    setFilters((prev) => ({ ...prev, genres: new Set() }));
  }, []);

  const handleChangeRuntime = useCallback((runtime: NumericFilter | null) => {
    setFilters((prev) => ({ ...prev, runtime }));
  }, []);

  const handleChangeYear = useCallback((year: NumericFilter | null) => {
    setFilters((prev) => ({ ...prev, year }));
  }, []);

  const handleChangeRating = useCallback((rating: NumericFilter | null) => {
    setFilters((prev) => ({ ...prev, rating }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setFilters(createEmptyFilters());
    setSearchOpen(false);
  }, []);

  const handleToggleSearch = useCallback(() => {
    setSearchOpen((prev) => {
      if (prev) {
        setFilters((f) => (f.query ? { ...f, query: '' } : f));
      }
      return !prev;
    });
  }, []);

  const showRuntimeHint = sort.field === 'runtime' || activeFilters.runtime !== null;
  const showYearHint = sort.field === 'year' || activeFilters.year !== null;

  const getSubtitle = useMemo(() => {
    if (!showRuntimeHint && !showYearHint) return undefined;
    return (movie: VisibleMovie) => {
      const parts: string[] = [];
      if (showYearHint && movie.year) parts.push(movie.year);
      if (showRuntimeHint && movie.runtime != null) parts.push(formatRuntime(movie.runtime));
      return parts.length > 0 ? { text: parts.join(' · '), tone: 'muted' as const } : undefined;
    };
  }, [showRuntimeHint, showYearHint]);

  const showSearchBar = (searchOpen || filters.query.length > 0) && readyMovies.length > 0;

  const listHeader = (
    <View style={{ gap: Spacing.sm, marginBottom: Spacing.md }}>
      <View
        style={{
          marginTop: Spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: Spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          {lastUpdated ? (
            <>
              <Text variant="headlineSmall">
                {displayedMovies.length} {displayedMovies.length === 1 ? 'disponible' : 'disponibles'}
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                de {allMovies.length} en tu watchlist · {new Date(lastUpdated).toLocaleDateString('es-ES')}
              </Text>
            </>
          ) : isLoading ? (
            <>
              <Text variant="headlineSmall">Escaneando tu watchlist…</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                La primera vez puede tardar un poco.
              </Text>
            </>
          ) : (
            <>
              <Text variant="headlineSmall">Sin datos todavía</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Pulsa Actualizar para escanear tu watchlist.
              </Text>
            </>
          )}
        </View>

        {readyMovies.length > 0 && (
          <IconButton
            icon={showSearchBar ? 'close' : 'magnify'}
            mode="contained-tonal"
            selected={showSearchBar}
            accessibilityLabel={showSearchBar ? 'Cerrar búsqueda' : 'Buscar película'}
            onPress={handleToggleSearch}
            style={{ width: 44, height: 44, margin: 0 }}
          />
        )}
      </View>

      {readyMovies.length > 0 && (
        <FeedControls
          options={options}
          filters={activeFilters}
          activeFilterCount={activeFilterCount}
          sort={sort}
          onSelectSort={handleSelectSort}
          onToggleGenre={handleToggleGenre}
          onClearGenres={handleClearGenres}
          onChangeRuntime={handleChangeRuntime}
          onChangeYear={handleChangeYear}
          onChangeRating={handleChangeRating}
          onClearAllFilters={handleClearAllFilters}
        />
      )}

      {legacyMissing && (
        <NoticeCard
          icon="update"
          text={`${legacyMissing.count} película(s) de un escaneo antiguo aún no tienen ${legacyMissing.label}. Pulsa Actualizar para completarlas.`}
          tone="secondary"
        />
      )}
      {truncated && (
        <NoticeCard
          icon="content-cut"
          text={`Tu watchlist es muy grande: solo se han analizado las primeras ${allMovies.length} películas.`}
          tone="secondary"
        />
      )}
      {isStale && !isLoading && (
        <NoticeCard
          icon="clock-alert-outline"
          text={`Estos datos tienen más de ${STALE_AFTER_DAYS} días. Los catálogos cambian: pulsa Actualizar.`}
          tone="tertiary"
        />
      )}
      <ProgressCard />
    </View>
  );

  const listEmpty = !isLoading && lastUpdated ? (
    activeFilterCount > 0 && readyMovies.length > 0 ? (
      <EmptyState
        icon="filter-off-outline"
        title="Sin resultados"
        body="Ninguna película disponible coincide con los filtros actuales."
        actionLabel="Limpiar filtros"
        onAction={handleClearAllFilters}
      />
    ) : (
      <EmptyState actionLabel="Revisar plataformas" onAction={() => router.push('/settings')} />
    )
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      {/* Fuera del ListHeaderComponent para que el teclado no pierda el foco al filtrar. */}
      {showSearchBar && (
        <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs }}>
          <Searchbar
            placeholder="Buscar por título o año…"
            value={filters.query}
            onChangeText={(query) => setFilters((prev) => ({ ...prev, query }))}
            autoFocus={searchOpen && filters.query.length === 0}
            style={{ backgroundColor: theme.colors.elevation.level2 }}
          />
        </View>
      )}
      <MovieGrid
        movies={displayedMovies}
        listHeader={listHeader}
        listEmpty={listEmpty}
        getSubtitle={getSubtitle}
      />
      <ScanFab />
    </View>
  );
}
