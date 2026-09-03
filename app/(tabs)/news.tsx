import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useWatchlist, fmtDay, NewsMovie } from '../../src/context/WatchlistContext';
import { MovieGrid } from '../../src/components/MovieGrid';
import { NoticeCard } from '../../src/components/NoticeCard';
import { EmptyState } from '../../src/components/EmptyState';
import { ProgressCard } from '../../src/components/ProgressCard';
import { ScanFab } from '../../src/components/ScanFab';
import { Spacing } from '../../src/constants/theme';

export default function News() {
  const theme = useTheme();
  const { newsMovies, jwAvailable, jwStale, jwFetchFailed, isLoading } = useWatchlist();

  const listHeader = (
    <View style={{ gap: Spacing.sm, marginBottom: Spacing.md }}>
      <Text variant="bodyMedium" style={{ marginTop: Spacing.sm, color: theme.colors.onSurfaceVariant }}>
        Películas de tu watchlist añadidas a tus plataformas en los últimos 14 días.
      </Text>
      {jwStale && (
        <NoticeCard
          icon="cloud-alert"
          text="No se pudieron actualizar las novedades; se muestran los últimos datos disponibles."
          tone="secondary"
        />
      )}
      <ProgressCard />
    </View>
  );

  const listEmpty = isLoading ? null : !jwAvailable ? (
    <EmptyState
      icon="bell-outline"
      title="Sin datos de novedades"
      body={
        jwFetchFailed
          ? 'La fuente de novedades no está disponible ahora mismo. Vuelve a intentarlo más tarde.'
          : 'Pulsa Actualizar para consultar las novedades de tus plataformas.'
      }
    />
  ) : (
    <EmptyState
      icon="bell-outline"
      title="Sin novedades"
      body="Ninguna película de tu watchlist ha llegado a tus plataformas en los últimos días."
    />
  );

  return (
    <View style={{ flex: 1 }}>
      <MovieGrid<NewsMovie>
        movies={newsMovies}
        listHeader={listHeader}
        listEmpty={listEmpty}
        getSubtitle={(movie) => ({ text: `desde ${fmtDay(movie.availableFrom)}`, tone: 'primary' })}
      />
      <ScanFab />
    </View>
  );
}
