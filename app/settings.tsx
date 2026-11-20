import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Button,
  Dialog,
  Divider,
  HelperText,
  List,
  Portal,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { openURL } from 'expo-linking';
import { StorageService } from '../src/services/storage';
import { TMDBService } from '../src/services/tmdb';
import { DEFAULT_PLATFORMS, PlatformKey } from '../src/constants/platforms';
import { Radius, Spacing } from '../src/constants/theme';
import { PlatformList } from '../src/components/PlatformList';
import { useSnackbar } from '../src/components/SnackbarProvider';

function maskApiKey(key: string): string {
  if (!key) return 'No configurada';
  if (key.length <= 8) return '••••••••';
  return `••••••••••••${key.slice(-4)}`;
}

export default function Settings() {
  const router = useRouter();
  const theme = useTheme();
  const showSnackbar = useSnackbar();
  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [platforms, setPlatforms] = useState<Record<PlatformKey, boolean>>(DEFAULT_PLATFORMS);
  // Hasta cargar, username/apiKey valen '' y las comparaciones de "no ha
  // cambiado" de los diálogos no son fiables: las filas no se pueden tocar.
  const [loaded, setLoaded] = useState(false);

  // Diálogo de edición de usuario
  const [editUserVisible, setEditUserVisible] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [userError, setUserError] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Diálogo de edición de API Key
  const [editKeyVisible, setEditKeyVisible] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [keyError, setKeyError] = useState(false);
  const [keyErrorMsg, setKeyErrorMsg] = useState('');
  const [isValidatingKey, setIsValidatingKey] = useState(false);

  // Diálogo de borrar todo
  const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [storedUser, storedPlatforms, storedKey] = await Promise.all([
          StorageService.getUsername(),
          StorageService.getPlatforms(),
          StorageService.getTmdbApiKey(),
        ]);
        if (storedUser) setUsername(storedUser);
        if (storedPlatforms) setPlatforms(storedPlatforms);
        if (storedKey) setApiKey(storedKey);
        setLoaded(true);
      } catch (e) {
        console.error('Error cargando ajustes:', e);
        showSnackbar('No se pudieron cargar tus ajustes. Vuelve a abrirlos.');
      }
    }
    loadData();
  }, [showSnackbar]);

  const togglePlatform = (key: PlatformKey) => {
    // Antes de cargar, `platforms` son los defaults: guardarlos pisaría la
    // selección real del usuario.
    if (!loaded) return;
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

  const handleOpenTmdb = async () => {
    try {
      await openURL('https://www.themoviedb.org/settings/api');
    } catch (e) {
      console.error('No se pudo abrir el enlace de TMDB:', e);
    }
  };

  const handleOpenEditUser = () => {
    setNewUsername(username);
    setUserError(false);
    setEditUserVisible(true);
  };

  const handleSaveUser = async () => {
    if (isSavingUser) return;
    const trimmed = newUsername.trim();
    if (!trimmed) {
      setUserError(true);
      return;
    }

    // Si no ha cambiado el usuario, cerramos sin vaciar la caché
    if (trimmed === username) {
      setEditUserVisible(false);
      return;
    }

    setIsSavingUser(true);
    try {
      // Primero el usuario: si clearCache fallase, la caché vieja queda
      // ligada al usuario anterior y el feed ya la ignora.
      await StorageService.setUsername(trimmed);
      await StorageService.clearCache(); // Invalida la lista anterior de películas
      setUsername(trimmed);
      setEditUserVisible(false);
      showSnackbar('Usuario actualizado. Vuelve al feed y pulsa Actualizar para cargar tu lista.');
    } catch (e) {
      console.error('Error guardando el usuario:', e);
      showSnackbar('No se pudo guardar el usuario. Inténtalo de nuevo.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleOpenEditKey = () => {
    setNewKey('');
    setShowNewKey(false);
    setKeyError(false);
    setKeyErrorMsg('');
    setEditKeyVisible(true);
  };

  const handleSaveKey = async () => {
    const trimmed = newKey.trim();
    if (!trimmed) {
      setKeyError(true);
      setKeyErrorMsg('Introduce una API Key');
      return;
    }

    if (trimmed === apiKey) {
      setEditKeyVisible(false);
      return;
    }

    setIsValidatingKey(true);
    setKeyError(false);
    try {
      const keyProblem = await TMDBService.checkKey(trimmed);
      if (keyProblem) {
        setKeyError(true);
        setKeyErrorMsg(keyProblem);
        return;
      }

      try {
        await StorageService.setTmdbApiKey(trimmed);
      } catch (e) {
        console.error('Error guardando la clave de TMDB:', e);
        setKeyError(true);
        setKeyErrorMsg('No se pudo guardar la clave. Inténtalo de nuevo.');
        return;
      }
      TMDBService.setApiKey(trimmed);
      setApiKey(trimmed);
      setEditKeyVisible(false);
      showSnackbar('API Key de TMDB actualizada correctamente.');
    } finally {
      setIsValidatingKey(false);
    }
  };

  const handleLogout = async () => {
    try {
      await StorageService.clearAll();
    } catch (e) {
      console.error('Error borrando los datos:', e);
      showSnackbar('No se pudieron borrar los datos. Inténtalo de nuevo.');
      return;
    }
    // Solo tras borrar el disco: si fallase, la clave en memoria seguiría
    // casando con la guardada.
    TMDBService.setApiKey(null);
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
        Cuenta y Conexión
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
          title={loaded ? username || 'Sin configurar' : 'Cargando…'}
          description="Usuario de Letterboxd (Toca para modificar)"
          left={(props) => <List.Icon {...props} icon="account-circle-outline" />}
          right={(props) => <List.Icon {...props} icon="pencil-outline" />}
          onPress={handleOpenEditUser}
          disabled={!loaded}
        />
        <Divider />
        <List.Item
          title={loaded ? maskApiKey(apiKey) : 'Cargando…'}
          description="API Key de TMDB (Toca para modificar)"
          left={(props) => <List.Icon {...props} icon="key-variant" />}
          right={(props) => <List.Icon {...props} icon="pencil-outline" />}
          onPress={handleOpenEditKey}
          disabled={!loaded}
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
        onPress={() => setConfirmLogoutVisible(true)}
        contentStyle={{ height: 48 }}
        style={{ borderRadius: Radius.xl, marginTop: Spacing.xl }}
      >
        Borrar todos los datos y reiniciar
      </Button>

      {/* DIÁLOGOS DE EDICIÓN CON CONFIRMACIÓN INTEGRADA */}
      <Portal>
        {/* 1. Diálogo de modificación de usuario */}
        <Dialog visible={editUserVisible} onDismiss={() => !isSavingUser && setEditUserVisible(false)}>
          <Dialog.Icon icon="account-edit-outline" />
          <Dialog.Title style={{ textAlign: 'center' }}>¿Modificar usuario?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: Spacing.md }}>
              Si cambias de usuario se borrarán las películas guardadas de tu watchlist anterior para
              cargar las de la nueva cuenta.
            </Text>
            <TextInput
              mode="outlined"
              label="Usuario de Letterboxd"
              value={newUsername}
              onChangeText={(text) => {
                setUserError(false);
                setNewUsername(text);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              error={userError}
              outlineStyle={{ borderRadius: Radius.md }}
            />
            {userError && (
              <HelperText type="error" visible={userError}>
                Introduce un nombre de usuario válido
              </HelperText>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={isSavingUser} onPress={() => setEditUserVisible(false)}>
              Cancelar
            </Button>
            <Button loading={isSavingUser} disabled={isSavingUser} onPress={handleSaveUser}>
              Guardar
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* 2. Diálogo de modificación de API Key */}
        <Dialog visible={editKeyVisible} onDismiss={() => !isValidatingKey && setEditKeyVisible(false)}>
          <Dialog.Icon icon="key-alert-outline" />
          <Dialog.Title style={{ textAlign: 'center' }}>¿Modificar API Key?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: Spacing.md }}>
              Para seguir comprobando la disponibilidad de streaming necesitas una clave válida de The Movie Database.
            </Text>
            <TextInput
              mode="outlined"
              label="Nueva API Key (v3 auth)"
              placeholder="Pega aquí tu clave"
              value={newKey}
              onChangeText={(text) => {
                setKeyError(false);
                setNewKey(text);
              }}
              secureTextEntry={!showNewKey}
              autoCapitalize="none"
              autoCorrect={false}
              error={keyError}
              outlineStyle={{ borderRadius: Radius.md }}
              right={
                <TextInput.Icon
                  icon={showNewKey ? 'eye-off' : 'eye'}
                  onPress={() => setShowNewKey(!showNewKey)}
                />
              }
            />
            {keyError ? (
              <HelperText type="error" visible={keyError}>
                {keyErrorMsg}
              </HelperText>
            ) : (
              <HelperText type="info" visible>
                Se verificará la validez de la clave con TMDB.
              </HelperText>
            )}
            <View style={{ alignItems: 'flex-start', marginTop: 4 }}>
              <Button mode="text" icon="open-in-new" compact onPress={handleOpenTmdb}>
                Obtener clave en themoviedb.org
              </Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={isValidatingKey} onPress={() => setEditKeyVisible(false)}>
              Cancelar
            </Button>
            <Button loading={isValidatingKey} disabled={isValidatingKey} onPress={handleSaveKey}>
              Validar y Guardar
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* 3. Diálogo de Borrar Todo */}
        <Dialog visible={confirmLogoutVisible} onDismiss={() => setConfirmLogoutVisible(false)}>
          <Dialog.Icon icon="alert-outline" />
          <Dialog.Title style={{ textAlign: 'center' }}>¿Borrar todo?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Se borrarán tu usuario, tu clave de TMDB, tus plataformas y los datos cacheados de tu
              watchlist. Volverás a la pantalla de bienvenida.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmLogoutVisible(false)}>Cancelar</Button>
            <Button
              textColor={theme.colors.error}
              onPress={() => {
                setConfirmLogoutVisible(false);
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
