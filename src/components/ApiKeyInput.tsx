import { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, TextInput } from 'react-native-paper';
import { openURL } from 'expo-linking';
import { Radius } from '../constants/theme';

const TMDB_API_SETTINGS_URL = 'https://www.themoviedb.org/settings/api';

interface Props {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  errorMsg: string | null; // null = sin error: se muestra `hint`
  hint: string;
  linkLabel: string;
}

// Campo de API Key de TMDB compartido por onboarding y Ajustes: entrada
// oculta con ver/ocultar, error o ayuda debajo y enlace a la página de TMDB
// donde se consigue la clave. La visibilidad vive aquí: en el diálogo de
// Ajustes se reinicia sola al desmontarse con cada cierre.
export function ApiKeyInput({ label, placeholder, value, onChangeText, errorMsg, hint, linkLabel }: Props) {
  const [visible, setVisible] = useState(false);

  const openTmdb = async () => {
    try {
      await openURL(TMDB_API_SETTINGS_URL);
    } catch (e) {
      console.error('No se pudo abrir el enlace de TMDB:', e);
    }
  };

  return (
    <>
      <TextInput
        mode="outlined"
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        error={!!errorMsg}
        left={<TextInput.Icon icon="key-variant" />}
        right={<TextInput.Icon icon={visible ? 'eye-off' : 'eye'} onPress={() => setVisible(!visible)} />}
        outlineStyle={{ borderRadius: Radius.md }}
      />
      {errorMsg ? (
        <HelperText type="error" visible>
          {errorMsg}
        </HelperText>
      ) : (
        <HelperText type="info" visible>
          {hint}
        </HelperText>
      )}
      <View style={{ alignItems: 'flex-start' }}>
        <Button
          mode="text"
          icon="open-in-new"
          compact
          onPress={openTmdb}
          contentStyle={{ flexDirection: 'row-reverse' }}
        >
          {linkLabel}
        </Button>
      </View>
    </>
  );
}
