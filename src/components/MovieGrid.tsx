import type { ReactElement } from 'react';
import { FlatList, useWindowDimensions } from 'react-native';
import type { VisibleMovie } from '../context/WatchlistContext';
import { MoviePosterCard } from './MoviePosterCard';
import { Spacing } from '../constants/theme';

const NUM_COLUMNS = 3;
const GRID_GAP = Spacing.sm;

interface Props<T extends VisibleMovie> {
  movies: T[];
  listHeader?: ReactElement | null;
  listEmpty?: ReactElement | null;
  getSubtitle?: (movie: T) => { text: string; tone: 'primary' | 'error' } | undefined;
  getBadge?: (movie: T) => string | undefined;
}

// Grid de 3 columnas compartido por los 3 tabs. Ancho de tarjeta calculado
// (no flex:1): así una última fila de 1-2 pósters no se estira. El orden
// de los datos se pinta izquierda→derecha, fila a fila.
export function MovieGrid<T extends VisibleMovie>({
  movies,
  listHeader,
  listEmpty,
  getSubtitle,
  getBadge,
}: Props<T>) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - Spacing.md * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS);

  return (
    <FlatList
      data={movies}
      numColumns={NUM_COLUMNS}
      keyExtractor={(movie) => movie.id}
      columnWrapperStyle={{ gap: GRID_GAP }}
      // paddingBottom deja hueco al FAB; la tab bar ya absorbe el inset.
      contentContainerStyle={{ padding: Spacing.md, paddingBottom: 88, gap: GRID_GAP + 4 }}
      renderItem={({ item }) => (
        <MoviePosterCard
          movie={item}
          width={cardWidth}
          subtitle={getSubtitle?.(item)}
          badge={getBadge?.(item)}
        />
      )}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
    />
  );
}
