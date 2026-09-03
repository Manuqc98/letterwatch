import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SnackbarProvider } from '../src/components/SnackbarProvider';
import { AppLightTheme, AppDarkTheme, NavLightTheme, NavDarkTheme } from '../src/constants/theme';

// El guard de onboarding vive en app/(tabs)/_layout.tsx (<Redirect />).
// Ajustes y onboarding quedan en el Stack raíz: se apilan POR ENCIMA de la
// tab bar y el back de Android los saca limpiamente.
export default function Layout() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const theme = dark ? AppDarkTheme : AppLightTheme;
  const navTheme = dark ? NavDarkTheme : NavLightTheme;

  return (
    <PaperProvider theme={theme}>
      <ThemeProvider value={navTheme}>
        <SnackbarProvider>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.colors.surface },
              headerTintColor: theme.colors.onSurface,
              headerTitleStyle: { fontWeight: '600' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="onboarding"
              options={{ title: 'Bienvenido', headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen name="settings" options={{ title: 'Ajustes' }} />
          </Stack>
          <StatusBar style="auto" />
        </SnackbarProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}
