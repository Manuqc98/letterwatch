import { MD3LightTheme, MD3DarkTheme, adaptNavigationTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import {
  DefaultTheme as NavigationLight,
  DarkTheme as NavigationDark,
} from '@react-navigation/native';
import { themeFromSourceColor, argbFromHex, hexFromArgb } from '@material/material-color-utilities';

// Color semilla del tema ("naranja cine", el naranja de Letterboxd).
// Las paletas tonales M3 light/dark completas se derivan de aquí.
export const SEED_COLOR = '#FF8000';

const material = themeFromSourceColor(argbFromHex(SEED_COLOR));

const hex = (argb: number) => hexFromArgb(argb);
const neutral = (tone: number) => hex(material.palettes.neutral.tone(tone));

function rgba(hexColor: string, alpha: number): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildColors(scheme: 'light' | 'dark') {
  const roles = Object.fromEntries(
    Object.entries(material.schemes[scheme].toJSON()).map(([key, value]) => [key, hex(value as number)])
  ) as Record<string, string>;
  const dark = scheme === 'dark';
  return {
    ...roles,
    surfaceDisabled: rgba(roles.onSurface, 0.12),
    onSurfaceDisabled: rgba(roles.onSurface, 0.38),
    backdrop: rgba(neutral(20), 0.4),
    // Surface containers de M3 (Paper v5 los expone como elevation.levelN).
    // En dark el surface base es tono 10, por eso la escalera empieza en 17.
    elevation: {
      level0: 'transparent',
      level1: dark ? neutral(17) : neutral(96),
      level2: dark ? neutral(20) : neutral(94),
      level3: dark ? neutral(22) : neutral(92),
      level4: dark ? neutral(24) : neutral(91),
      level5: dark ? neutral(26) : neutral(90),
    },
  };
}

// roundness se queda en 4: los componentes MD3 lo multiplican (Dialog x7,
// FAB x4...). Los radios "Expressive" grandes se aplican por estilo local
// con los tokens Radius de abajo.
export const AppLightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 4,
  colors: { ...MD3LightTheme.colors, ...buildColors('light') },
};

export const AppDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 4,
  colors: { ...MD3DarkTheme.colors, ...buildColors('dark') },
};

// Temas para el Stack de expo-router (fondo de escenas y header nativo).
const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationLight,
  reactNavigationDark: NavigationDark,
  materialLight: AppLightTheme,
  materialDark: AppDarkTheme,
});
export const NavLightTheme = { ...LightTheme, fonts: NavigationLight.fonts };
export const NavDarkTheme = { ...DarkTheme, fonts: NavigationDark.fonts };

export const Radius = { xs: 6, sm: 12, md: 16, lg: 20, xl: 28 } as const;
export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
