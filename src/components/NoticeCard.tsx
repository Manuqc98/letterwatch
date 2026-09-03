import type { StyleProp, ViewStyle } from 'react-native';
import { Icon, Surface, Text, useTheme } from 'react-native-paper';
import { Radius, Spacing } from '../constants/theme';

interface Props {
  icon: string;
  text: string;
  tone?: 'secondary' | 'tertiary';
  style?: StyleProp<ViewStyle>;
}

// Aviso tonal M3 (sustituye al Banner clásico: superficie redondeada
// con icono, el patrón de las apps de Google actuales).
export function NoticeCard({ icon, text, tone = 'secondary', style }: Props) {
  const theme = useTheme();
  const background = tone === 'secondary' ? theme.colors.secondaryContainer : theme.colors.tertiaryContainer;
  const foreground = tone === 'secondary' ? theme.colors.onSecondaryContainer : theme.colors.onTertiaryContainer;
  return (
    <Surface
      mode="flat"
      style={[
        {
          borderRadius: Radius.md,
          backgroundColor: background,
          padding: Spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm + 4,
        },
        style,
      ]}
    >
      <Icon source={icon} size={20} color={foreground} />
      <Text variant="bodySmall" style={{ flex: 1, color: foreground }}>
        {text}
      </Text>
    </Surface>
  );
}
