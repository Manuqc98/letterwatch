import { List, Surface, Switch, useTheme } from 'react-native-paper';
import { PLATFORMS, PlatformKey } from '../constants/platforms';
import { Radius } from '../constants/theme';

interface Props {
  platforms: Record<PlatformKey, boolean>;
  onToggle: (key: PlatformKey) => void;
}

// Grupo redondeado estilo Google 2025. La fila entera hace toggle
// (el Switch solo mide ~32dp; el List.Item garantiza el touch target).
export function PlatformList({ platforms, onToggle }: Props) {
  const theme = useTheme();
  return (
    <Surface
      mode="flat"
      style={{
        borderRadius: Radius.xl,
        overflow: 'hidden',
        backgroundColor: theme.colors.elevation.level1,
      }}
    >
      {(Object.keys(PLATFORMS) as PlatformKey[]).map((key) => (
        <List.Item
          key={key}
          title={PLATFORMS[key].name}
          onPress={() => onToggle(key)}
          right={() => <Switch value={platforms[key]} onValueChange={() => onToggle(key)} />}
        />
      ))}
    </Surface>
  );
}
