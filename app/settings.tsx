import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, Dialog, List, Portal, Surface, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { StorageService } from '../src/services/storage';
import { DEFAULT_PLATFORMS, PlatformKey } from '../src/constants/platforms';
import { Radius, Spacing } from '../src/constants/theme';
import { PlatformList } from '../src/components/PlatformList';
import { useSnackbar } from '../src/components/SnackbarProvider';

export default function Settings() {
  const router = useRouter();
  const theme = useTheme();
  const showSnackbar = useSnackbar();
  const [username, setUsername] = useState('');
  const [platforms, setPlatforms] = useState<Record<PlatformKey, boolean>>(DEFAULT_PLATFORMS);
  const [confirmVisible, setConfirmVisible] = useState(false);

  useEffect(() => {
    async function loadData() {
      const storedUser = await StorageService.getUsername();
      const storedPlatforms = await StorageService.getPlatforms();
      if (storedUser) setUsername(storedUser);
      if (storedPlatforms) setPlatforms(storedPlatforms);
    }
    loadData();
  }, []);

  // Autoguardado: cada toggle persiste al instante. El invariante del
  // onboarding (al menos una plataforma activa) se mantiene bloqueando
  // el apagado de la última.
  const togglePlatform = (key: PlatformKey) => {
    const next = { ...platforms, [key]: !platforms[key] };
    if (!Object.values(next).some((v) => v)) {
      showSnackbar('Mantén al menos una plataforma activa');
      return;
    }
    setPlatforms(next);
    StorageService.setPlatforms(next).catch((e) => {
      console.error('Error guardando plataformas:', e);
      showSnackbar('No se pudo guardar el cambio. Inténtalo de nuevo.');
    });
  };

  const handleLogout = async () => {
    await StorageService.clearAll();
    // dismissAll vacía el stack hasta la raíz antes de reemplazarla:
    // así el back de Android no puede volver a una pantalla con datos borrados.
    router.dismissAll();
    router.replace('/onboarding');
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xl * 2, gap: Spacing.sm }}
    >
      <Text variant="titleMedium" style={{ marginTop: Spacing.sm }}>
        Cuenta
      </Text>
      <Surface
        mode="flat"
        style={{
          borderRadius: Radius.xl,
          overflow: 'hidden',
          backgroundColor: theme.colors.elevation.level1,
        }}
      >
        <List.Item
          title={username}
          description="Usuario de Letterboxd"
          left={(props) => <List.Icon {...props} icon="account-circle-outline" />}
        />
      </Surface>

      <Text variant="titleMedium" style={{ marginTop: Spacing.md }}>
        Tus plataformas
      </Text>
      <PlatformList platforms={platforms} onToggle={togglePlatform} />
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: Spacing.xs }}>
        Los cambios se guardan automáticamente.
      </Text>

      <Button
        mode="contained-tonal"
        icon="trash-can-outline"
        buttonColor={theme.colors.errorContainer}
        textColor={theme.colors.onErrorContainer}
        onPress={() => setConfirmVisible(true)}
        contentStyle={{ height: 48 }}
        style={{ borderRadius: Radius.xl, marginTop: Spacing.xl }}
      >
        Borrar datos y cambiar usuario
      </Button>

      <Portal>
        <Dialog visible={confirmVisible} onDismiss={() => setConfirmVisible(false)}>
          <Dialog.Icon icon="alert-outline" />
          <Dialog.Title style={{ textAlign: 'center' }}>¿Borrar todo?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Se borrarán tu usuario, tus plataformas y los datos cacheados de tu watchlist.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmVisible(false)}>Cancelar</Button>
            <Button
              textColor={theme.colors.error}
              onPress={() => {
                setConfirmVisible(false);
                handleLogout();
              }}
            >
              Sí, borrar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}
