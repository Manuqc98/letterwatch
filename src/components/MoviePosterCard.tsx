import { View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { Image } from 'expo-image';
import { openURL } from 'expo-linking';
import type { VisibleMovie } from '../context/WatchlistContext';
import { PLATFORMS, TMDB_LOGO_BASE } from '../constants/platforms';
import { Radius } from '../constants/theme';

// Abre la ficha de la película: la app de Letterboxd si está instalada
// (esquema letterboxd://), y si el sistema lo rechaza, la web.
async function openInLetterboxd(slug: string) {
  try {
    await openURL(`letterboxd://film/${slug}`);
  } catch {
    try {
      await openURL(`https://letterboxd.com/film/${slug}/`);
    } catch (e) {
      console.error('No se pudo abrir Letterboxd:', e);
    }
  }
}

interface Props {
  movie: VisibleMovie;
  width: number;
  // News: "desde 12/09" (primary) · WatchOut: "hasta 20/09" (error)
  subtitle?: { text: string; tone: 'primary' | 'error' };
  badge?: string; // WatchOut: "Única plataforma"
}

const MAX_LOGOS = 3;

export function MoviePosterCard({ movie, width, subtitle, badge }: Props) {
  const theme = useTheme();
  const logos = movie.matched.slice(0, MAX_LOGOS);
  const extra = movie.matched.length - logos.length;

  // Una sola parada de TalkBack por tarjeta, con todo el contexto.
  const a11yLabel = [
    `${movie.title}${movie.year ? `, ${movie.year}` : ''}`,
    movie.voteAverage != null ? `nota ${movie.voteAverage.toFixed(1).replace('.', ',')}` : null,
    movie.matched.length > 0 ? `en ${movie.matched.map((k) => PLATFORMS[k].name).join(', ')}` : null,
    subtitle?.text ?? null,
    badge ?? null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <TouchableRipple
      onPress={() => openInLetterboxd(movie.id)}
      borderless
      style={{ width, borderRadius: Radius.sm }}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="Abre la película en Letterboxd"
    >
      <View>
      <View>
        <Image
          source={movie.posterUrl ?? undefined}
          style={{
            width,
            height: Math.round(width * 1.5),
            borderRadius: Radius.sm,
            backgroundColor: theme.colors.surfaceVariant,
          }}
          contentFit="cover"
          transition={200}
        />
        {badge && (
          <Text
            variant="labelSmall"
            numberOfLines={1}
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              maxWidth: width - 12,
              backgroundColor: theme.colors.error,
              color: theme.colors.onError,
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
              overflow: 'hidden',
            }}
          >
            {badge}
          </Text>
        )}
      </View>

      <Text variant="labelMedium" numberOfLines={1} maxFontSizeMultiplier={1.5} style={{ marginTop: 6 }}>
        {movie.title}
      </Text>
      {subtitle && (
        <Text
          variant="labelSmall"
          numberOfLines={1}
          maxFontSizeMultiplier={1.5}
          style={{ color: subtitle.tone === 'error' ? theme.colors.error : theme.colors.primary }}
        >
          {subtitle.text}
        </Text>
      )}

      {/* Los textos de esta fila limitan el fontScale y encogen antes que
          desbordar los ~104dp de tarjeta con fuentes de accesibilidad. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, minHeight: 18 }}>
        {movie.voteAverage != null && (
          <>
            <Icon source="star" size={12} color={theme.colors.primary} />
            <Text
              variant="labelSmall"
              numberOfLines={1}
              maxFontSizeMultiplier={1.5}
              style={{ color: theme.colors.onSurfaceVariant, marginLeft: 2, flexShrink: 1 }}
            >
              {movie.voteAverage.toFixed(1).replace('.', ',')}
            </Text>
          </>
        )}
        <View style={{ flex: 1 }} />
        {logos.map((key) => (
          <Image
            key={key}
            source={`${TMDB_LOGO_BASE}${PLATFORMS[key].logoPath}`}
            style={{ width: 18, height: 18, borderRadius: 4, marginLeft: 3 }}
          />
        ))}
        {extra > 0 && (
          <Text
            variant="labelSmall"
            numberOfLines={1}
            maxFontSizeMultiplier={1.5}
            style={{ color: theme.colors.onSurfaceVariant, marginLeft: 3 }}
          >
            +{extra}
          </Text>
        )}
      </View>
      </View>
    </TouchableRipple>
  );
}
