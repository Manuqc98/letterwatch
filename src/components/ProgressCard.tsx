import { ProgressBar, Surface, Text, useTheme } from 'react-native-paper';
import { useWatchlist } from '../context/WatchlistContext';
import { Radius, Spacing } from '../constants/theme';

// Tarjeta de progreso del escaneo (se pinta en la cabecera de los 3 tabs).
export function ProgressCard() {
  const theme = useTheme();
  const { isLoading, progress, progressMsg } = useWatchlist();
  if (!isLoading) return null;
  return (
    <Surface
      mode="flat"
      style={{
        borderRadius: Radius.md,
        backgroundColor: theme.colors.elevation.level1,
        padding: Spacing.md,
        gap: Spacing.sm + 4,
      }}
    >
      <Text variant="bodyMedium">{progressMsg}</Text>
      <ProgressBar
        progress={progress ?? 0}
        indeterminate={progress === null}
        style={{ height: 8, borderRadius: 4 }}
      />
    </Surface>
  );
}
