import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { openURL } from 'expo-linking';
import { StorageService } from '../src/services/storage';
import { TMDBService } from '../src/services/tmdb';
import { DEFAULT_PLATFORMS, PlatformKey } from '../src/constants/platforms';
import { Radius, Spacing } from '../src/constants/theme';
import { PlatformList } from '../src/components/PlatformList';
import { useSnackbar } from '../src/components/SnackbarProvider';

export default function Onboarding() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const showSnackbar = useSnackbar();
  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [platforms, setPlatforms] = useState<Record<PlatformKey, boolean>>(DEFAULT_PLATFORMS);
  const [userError, setUserError] = useState(false);
  const [keyError, setKeyError] = useState(false);
  const [keyErrorMsg, setKeyErrorMsg] = useState('');
  const [platformError, setPlatformError] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Posición (dentro del scroll) de cada sección, para llevar al usuario
  // al campo con error en vez de a un offset fijo.
  const sectionY = useRef({ user: 0, key: 0 });

  // Precarga lo que ya hubiera guardado (p. ej. un usuario de una versión
  // sin clave de TMDB): incluidas sus plataformas, para no pisarlas con los
  // defaults al guardar. Solo rellena lo que el usuario aún no ha tocado.
  useEffect(() => {
    async function loadExisting() {
      try {
        const [storedUser, storedKey, storedPlatforms] = await Promise.all([
          StorageService.getUsername(),
          StorageService.getTmdbApiKey(),
          StorageService.getPlatforms(),
        ]);
        if (storedUser) setUsername((prev) => prev || storedUser);
        if (storedKey) setApiKey((prev) => prev || storedKey);
        // togglePlatform crea un objeto nuevo: seguir siendo DEFAULT_PLATFORMS
        // significa que no se ha tocado ningún switch.
        if (storedPlatforms) setPlatforms((prev) => (prev === DEFAULT_PLATFORMS ? storedPlatforms : prev));
      } catch (e) {
        console.error('Error cargando datos guardados:', e);
      }
    }
    loadExisting();
  }, []);

  const scrollToSection = (section: 'user' | 'key') => {
    // El paddingTop del contenido incluye el inset superior: se descuenta
    // para que el título de la sección no quede bajo la status bar.
    const y = Math.max(0, sectionY.current[section] - insets.top - Spacing.sm);
    scrollRef.current?.scrollTo({ y, animated: true });
  };

  const togglePlatform = (key: PlatformKey) => {
    setPlatformError(false);
    setPlatforms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpenTmdb = async () => {
    try {
      await openURL('https://www.themoviedb.org/settings/api');
    } catch (e) {
      console.error('No se pudo abrir el enlace de TMDB:', e);
    }
  };

  const handleSave = async () => {
    const trimmedUser = username.trim();
    const trimmedKey = apiKey.trim();
    const userMissing = !trimmedUser;
    const keyMissing = !trimmedKey;
    const platformMissing = !Object.values(platforms).some((v) => v);

    if (userMissing) setUserError(true);
    if (keyMissing) {
      setKeyError(true);
      setKeyErrorMsg('Introduce tu API Key de TMDB');
    }
    if (platformMissing) setPlatformError(true);

    if (userMissing || keyMissing || platformMissing) {
      // Al primer campo con error. El de plataformas vive junto al botón:
      // si es el único, ya está a la vista y no se mueve el scroll.
      if (userMissing) scrollToSection('user');
      else if (keyMissing) scrollToSection('key');
      return;
    }

    setIsValidating(true);
    setKeyError(false);
    try {
      const keyProblem = await TMDBService.checkKey(trimmedKey);
      if (keyProblem) {
        setKeyError(true);
        setKeyErrorMsg(keyProblem);
        scrollToSection('key');
        return;
      }

      try {
        await StorageService.saveSetup(trimmedUser, trimmedKey, platforms);
      } catch (e) {
        console.error('Error guardando la configuración:', e);
        showSnackbar('No se pudo guardar la configuración. Inténtalo de nuevo.');
        return;
      }
      TMDBService.setApiKey(trimmedKey);

      router.replace('/');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{
        padding: Spacing.lg,
        paddingTop: insets.top + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        gap: Spacing.sm,
      }}
    >
      <Text variant="displaySmall" style={{ marginTop: Spacing.lg }}>
        Bienvenido a LetterWatch
      </Text>
      <Text
        variant="bodyLarge"
        style={{ color: theme.colors.onSurfaceVariant, marginBottom: Spacing.lg }}
      >
        Encuentra qué películas de tu watchlist están incluidas en tus plataformas de streaming.
      </Text>

      <Text
        variant="titleMedium"
        style={{ marginTop: Spacing.xs }}
        onLayout={(e) => {
          sectionY.current.user = e.nativeEvent.layout.y;
        }}
      >
        1. Tu cuenta de Letterboxd
      </Text>
      <TextInput
        mode="outlined"
        label="Usuario de Letterboxd"
        placeholder="p. ej. manuelqueiro"
        value={username}
        onChangeText={(text) => {
          setUserError(false);
          setUsername(text);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        error={userError}
        left={<TextInput.Icon icon="account" />}
        outlineStyle={{ borderRadius: Radius.md }}
      />
      <HelperText type="error" visible={userError}>
        Introduce tu usuario de Letterboxd
      </HelperText>

      <Text
        variant="titleMedium"
        style={{ marginTop: Spacing.sm }}
        onLayout={(e) => {
          sectionY.current.key = e.nativeEvent.layout.y;
        }}
      >
        2. API Key de The Movie Database (TMDB)
      </Text>
      <TextInput
        mode="outlined"
        label="API Key de TMDB (v3 auth)"
        placeholder="p. ej. a1b2c3d4e5f6..."
        value={apiKey}
        onChangeText={(text) => {
          setKeyError(false);
          setApiKey(text);
        }}
        secureTextEntry={!showApiKey}
        autoCapitalize="none"
        autoCorrect={false}
        error={keyError}
        left={<TextInput.Icon icon="key-variant" />}
        right={
          <TextInput.Icon
            icon={showApiKey ? 'eye-off' : 'eye'}
            onPress={() => setShowApiKey(!showApiKey)}
          />
        }
        outlineStyle={{ borderRadius: Radius.md }}
      />
      {keyError ? (
        <HelperText type="error" visible={keyError}>
          {keyErrorMsg}
        </HelperText>
      ) : (
        <HelperText type="info" visible>
          Necesaria para consultar disponibilidad y carátulas de streaming.
        </HelperText>
      )}

      <View style={{ alignItems: 'flex-start', marginTop: -Spacing.xs }}>
        <Button
          mode="text"
          icon="open-in-new"
          compact
          onPress={handleOpenTmdb}
          contentStyle={{ flexDirection: 'row-reverse' }}
        >
          ¿Cómo consigo mi clave gratuita de TMDB?
        </Button>
      </View>

      <Text variant="titleMedium" style={{ marginTop: Spacing.md }}>
        3. Tus plataformas de streaming
      </Text>
      <PlatformList platforms={platforms} onToggle={togglePlatform} />
      <HelperText type="error" visible={platformError}>
        Selecciona al menos una plataforma
      </HelperText>

      <Button
        mode="contained"
        icon="arrow-right"
        loading={isValidating}
        disabled={isValidating}
        onPress={handleSave}
        contentStyle={{ height: 56, flexDirection: 'row-reverse' }}
        labelStyle={{ fontSize: 16 }}
        style={{ borderRadius: Radius.xl, marginTop: Spacing.md }}
      >
        {isValidating ? 'Validando clave…' : 'Empezar'}
      </Button>
    </ScrollView>
  );
}
