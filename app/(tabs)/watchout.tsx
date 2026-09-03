import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useWatchlist, fmtDay, LeavingMovie } from '../../src/context/WatchlistContext';
import { MovieGrid } from '../../src/components/MovieGrid';
import { NoticeCard } from '../../src/components/NoticeCard';
import { EmptyState } from '../../src/components/EmptyState';
import { ProgressCard } from '../../src/components/ProgressCard';
import { ScanFab } from '../../src/components/ScanFab';
import { Spacing } from '../../src/constants/theme';

export default function WatchOut() {
  const theme = useTheme();
  const { leavingMovies, jwAvailable, jwStale, jwFetchFailed, isLoading } = useWatchlist();

  const listHeader = (
    <View style={{ gap: Spacing.sm, marginBottom: Spacing.md }}>
      <Text variant="bodyMedium" style={{ marginTop: Spacing.sm, color: theme.colors.onSurfaceVariant }}>
        Películas de tu watchlist que se van pronto de tus plataformas. Si es tu única
        plataforma con la película, lo verás marcado.
      </Text>
      {jwStale && (
        <NoticeCard
          icon="cloud-alert"
          text="No se pudieron actualizar las salidas; se muestran los últimos datos disponibles."
          tone="secondary"
        />
      )}
      <ProgressCard />
    </View>
  );

  const listEmpty = isLoading ? null : !jwAvailable ? (
    <EmptyState
      icon="clock-alert-outline"
      title="Sin datos de salidas"
      body={
        jwFetchFailed
          ? 'La fuente de salidas no está disponible ahora mismo. Vuelve a intentarlo más tarde.'
          : 'Pulsa Actualizar para consultar qué películas se van pronto.'
      }
    />
  ) : (
    <EmptyState
      icon="clock-check-outline"
      title="Nada se va pronto"
      body="Ninguna película de tu watchlist tiene fecha de salida próxima en tus plataformas. ¡Sin prisas!"
    />
  );

  return (
    <View style={{ flex: 1 }}>
      <MovieGrid<LeavingMovie>
        movies={leavingMovies}
        listHeader={listHeader}
        listEmpty={listEmpty}
        getSubtitle={(movie) => ({ text: `hasta ${fmtDay(movie.availableTo)}`, tone: 'error' })}
        // "Solo aquí" cabe en tarjetas de ~104dp; "Única plataforma" se truncaba
        getBadge={(movie) => (movie.singlePlatform ? 'Solo aquí' : undefined)}
      />
      <ScanFab />
    </View>
  );
}
