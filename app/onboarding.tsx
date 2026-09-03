import { useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StorageService } from '../src/services/storage';
import { DEFAULT_PLATFORMS, PlatformKey } from '../src/constants/platforms';
import { Radius, Spacing } from '../src/constants/theme';
import { PlatformList } from '../src/components/PlatformList';

export default function Onboarding() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [platforms, setPlatforms] = useState<Record<PlatformKey, boolean>>(DEFAULT_PLATFORMS);
  const [userError, setUserError] = useState(false);
  const [platformError, setPlatformError] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const togglePlatform = (key: PlatformKey) => {
    setPlatformError(false);
    setPlatforms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!username.trim()) {
      setUserError(true);
      // El error vive junto al input, arriba: que no se quede fuera de pantalla.
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    if (!Object.values(platforms).some(v => v)) {
      setPlatformError(true);
      return;
    }

    await StorageService.setUsername(username.trim());
    await StorageService.setPlatforms(platforms);

    router.replace('/');
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      // iOS: amplía el rango de scroll cuando el teclado está abierto
      // (en Android lo resuelve el softwareKeyboardLayoutMode=resize por defecto)
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

      <Text variant="titleMedium" style={{ marginTop: Spacing.sm }}>
        Tus plataformas
      </Text>
      <PlatformList platforms={platforms} onToggle={togglePlatform} />
      <HelperText type="error" visible={platformError}>
        Selecciona al menos una plataforma
      </HelperText>

      <Button
        mode="contained"
        icon="arrow-right"
        onPress={handleSave}
        contentStyle={{ height: 56, flexDirection: 'row-reverse' }}
        labelStyle={{ fontSize: 16 }}
        style={{ borderRadius: Radius.xl, marginTop: Spacing.md }}
      >
        Empezar
      </Button>
    </ScrollView>
  );
}
