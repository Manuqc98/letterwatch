import { FAB } from 'react-native-paper';
import { useWatchlist } from '../context/WatchlistContext';
import { Radius, Spacing } from '../constants/theme';

// FAB de escaneo, una instancia por tab: el estado vive en el contexto,
// así que el escaneo sigue corriendo aunque cambies de pestaña y las tres
// instancias reflejan el mismo isLoading. La tab bar ya absorbe el inset
// inferior, por eso el bottom no suma insets.
export function ScanFab() {
  const { isLoading, refresh } = useWatchlist();
  return (
    <FAB
      icon="refresh"
      label="Actualizar"
      variant="primary"
      loading={isLoading}
      disabled={isLoading}
      onPress={refresh}
      style={{
        position: 'absolute',
        right: Spacing.md,
        bottom: Spacing.md,
        borderRadius: Radius.md,
      }}
    />
  );
}
