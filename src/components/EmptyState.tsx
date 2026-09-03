import { View } from 'react-native';
import { Button, Icon, Text, useTheme } from 'react-native-paper';
import { Spacing } from '../constants/theme';

interface Props {
  icon?: string;
  title?: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'movie-open-outline',
  title = 'Nada disponible ahora mismo',
  body = 'Ninguna película de tu watchlist está incluida en tus plataformas. Los catálogos cambian cada semana: vuelve a escanear de vez en cuando.',
  actionLabel,
  onAction,
}: Props) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm }}>
      <Icon source={icon} size={64} color={theme.colors.onSurfaceVariant} />
      <Text variant="titleMedium" style={{ marginTop: Spacing.sm, textAlign: 'center' }}>
        {title}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}
      >
        {body}
      </Text>
      {actionLabel && onAction && (
        <Button mode="contained-tonal" onPress={onAction} style={{ marginTop: Spacing.sm }}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}
