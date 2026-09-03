import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useWatchlist } from '../../src/context/WatchlistContext';
import { STALE_AFTER_DAYS } from '../../src/services/storage';
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

  const listHeader = (
    <View style={{ gap: Spacing.sm, marginBottom: Spacing.md }}>
      <View style={{ marginTop: Spacing.sm }}>
        {lastUpdated ? (
          <>
            <Text variant="headlineSmall">
              {readyMovies.length} {readyMovies.length === 1 ? 'disponible' : 'disponibles'}
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

  return (
    <View style={{ flex: 1 }}>
      <MovieGrid
        movies={readyMovies}
        listHeader={listHeader}
        listEmpty={
          !isLoading && lastUpdated ? (
            <EmptyState actionLabel="Revisar plataformas" onAction={() => router.push('/settings')} />
          ) : null
        }
      />
      <ScanFab />
    </View>
  );
}
