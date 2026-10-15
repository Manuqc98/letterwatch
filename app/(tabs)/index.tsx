import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Chip, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useWatchlist } from '../../src/context/WatchlistContext';
import { STALE_AFTER_DAYS } from '../../src/services/storage';
import { TMDB_GENRES } from '../../src/constants/genres';
import { MovieGrid } from '../../src/components/MovieGrid';
import { NoticeCard } from '../../src/components/NoticeCard';
import { EmptyState } from '../../src/components/EmptyState';
import { ProgressCard } from '../../src/components/ProgressCard';
import { ScanFab } from '../../src/components/ScanFab';
import { Spacing } from '../../src/constants/theme';

export default function ReadyToWatch() {
  const theme = useTheme();
  const router = useRouter();
  const { readyMovies, allMovies, lastUpdated, truncated, isStale, isLoading } = useWatchlist();
  // Filtros rápidos de sesión (no se persisten).
  const [selectedGenres, setSelectedGenres] = useState<Set<number>>(new Set());

  // Géneros presentes en las películas disponibles, por frecuencia desc.
  const genreCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const movie of readyMovies) {
      for (const id of movie.genreIds ?? []) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .filter(([id]) => TMDB_GENRES[id])
      .sort((a, b) => b[1] - a[1] || TMDB_GENRES[a[0]].localeCompare(TMDB_GENRES[b[0]], 'es'));
  }, [readyMovies]);

  // La selección se interseca con lo disponible: si tras re-escanear un
  // género desaparece, no queda filtrando en fantasma.
  const activeGenres = useMemo(() => {
    const available = new Set(genreCounts.map(([id]) => id));
    return new Set([...selectedGenres].filter((id) => available.has(id)));
  }, [selectedGenres, genreCounts]);

  // Unión: la película pasa si tiene CUALQUIERA de los géneros activos.
  const filteredMovies = useMemo(
    () =>
      activeGenres.size === 0
        ? readyMovies
        : readyMovies.filter((movie) => movie.genreIds?.some((id) => activeGenres.has(id))),
    [readyMovies, activeGenres]
  );

  // Películas de caché antigua aún sin clasificar (sin genreIds).
  const unclassifiedCount = useMemo(
    () => readyMovies.filter((movie) => movie.genreIds === undefined).length,
    [readyMovies]
  );

  const toggleGenre = (id: number) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const listHeader = (
    <View style={{ gap: Spacing.sm, marginBottom: Spacing.md }}>
      <View style={{ marginTop: Spacing.sm }}>
        {lastUpdated ? (
          <>
            <Text variant="headlineSmall">
              {filteredMovies.length} {filteredMovies.length === 1 ? 'disponible' : 'disponibles'}
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

      {genreCounts.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
        >
          {genreCounts.map(([id]) => {
            const active = activeGenres.has(id);
            return (
              <Chip
                key={id}
                mode="flat"
                selected={active}
                showSelectedCheck
                onPress={() => toggleGenre(id)}
                style={{
                  backgroundColor: active ? theme.colors.secondaryContainer : theme.colors.elevation.level1,
                }}
                textStyle={{
                  color: active ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant,
                }}
              >
                {TMDB_GENRES[id]}
              </Chip>
            );
          })}
        </ScrollView>
      )}

      {activeGenres.size > 0 && unclassifiedCount > 0 && (
        <NoticeCard
          icon="tag-off-outline"
          text={`${unclassifiedCount} película(s) de un escaneo antiguo aún no tienen género. Pulsa Actualizar para clasificarlas.`}
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
    activeGenres.size > 0 && readyMovies.length > 0 ? (
      <EmptyState
        icon="filter-off-outline"
        title="Nada de estos géneros"
        body="Ninguna película disponible coincide con los géneros seleccionados."
        actionLabel="Quitar filtros"
        onAction={() => setSelectedGenres(new Set())}
      />
    ) : (
      <EmptyState actionLabel="Revisar plataformas" onAction={() => router.push('/settings')} />
    )
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      <MovieGrid movies={filteredMovies} listHeader={listHeader} listEmpty={listEmpty} />
      <ScanFab />
    </View>
  );
}
