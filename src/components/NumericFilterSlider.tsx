import { useRef, useState } from 'react';
import { View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { Radius, Spacing } from '../constants/theme';
import { CompareOp, NumericFilter, NumericRange, opSymbol } from '../utils/movieFilters';

interface Props {
  label: string; // nombre del filtro para lectores de pantalla ("Duración")
  range: NumericRange | null;
  filter: NumericFilter | null;
  defaultOp: CompareOp;
  emptyMessage: string;
  formatValue: (v: number) => string;
  onChange: (next: NumericFilter | null) => void;
}

// Filtro numérico: operador (≤ / ≥) + barra nativa entre el mínimo y el
// máximo de la lista. La barra nativa no compite con el scroll vertical del
// feed (solo arranca con gesto horizontal) y es accesible (TalkBack /
// VoiceOver). Mientras se arrastra solo cambia la etiqueta local: el filtro
// se aplica al soltar, sin recalcular el grid en cada paso.
export function NumericFilterSlider({
  label,
  range,
  filter,
  defaultOp,
  emptyMessage,
  formatValue,
  onChange,
}: Props) {
  const theme = useTheme();
  const [pendingOp, setPendingOp] = useState<CompareOp>(filter?.op ?? defaultOp);
  const [draftValue, setDraftValue] = useState<number | null>(null);
  // true entre onSlidingStart y onSlidingComplete (arrastre o toque).
  const slidingRef = useRef(false);
  const currentOp = filter?.op ?? pendingOp;

  if (!range) {
    return (
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant, paddingVertical: 6, paddingHorizontal: 4 }}
      >
        {emptyMessage}
      </Text>
    );
  }

  const handleOpPress = (op: CompareOp) => {
    setPendingOp(op);
    if (filter && filter.op !== op) onChange({ op, value: filter.value });
  };

  const commit = (value: number) => onChange({ op: currentOp, value: Math.round(value) });

  const activeValue = draftValue ?? filter?.value ?? null;
  const hasValue = activeValue !== null;
  // ≤ resalta el tramo izquierdo de la barra; ≥, el derecho.
  const activeTrack = hasValue ? theme.colors.primary : theme.colors.surfaceVariant;
  const idleTrack = theme.colors.surfaceVariant;
  const opWords = currentOp === 'lte' ? 'como máximo' : 'como mínimo';

  return (
    <View style={{ gap: Spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {(['lte', 'gte'] as CompareOp[]).map((op) => {
          const active = currentOp === op;
          return (
            <TouchableRipple
              key={op}
              onPress={() => handleOpPress(op)}
              borderless
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={op === 'lte' ? 'Menor o igual que' : 'Mayor o igual que'}
              style={{
                width: 44,
                height: 34,
                borderRadius: Radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? theme.colors.primaryContainer : theme.colors.elevation.level3,
              }}
            >
              <Text
                variant="titleMedium"
                style={{
                  color: active ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant,
                  fontWeight: '700',
                }}
              >
                {opSymbol(op)}
              </Text>
            </TouchableRipple>
          );
        })}

        <Text
          variant="labelLarge"
          style={{
            marginLeft: 'auto',
            color: hasValue ? theme.colors.primary : theme.colors.onSurfaceVariant,
            fontWeight: hasValue ? '700' : '400',
          }}
        >
          {hasValue ? `${opSymbol(currentOp)} ${formatValue(activeValue)}` : 'Desliza la barra'}
        </Text>
      </View>

      <Slider
        style={{ height: 40 }}
        minimumValue={range.min}
        maximumValue={range.max}
        step={1}
        // Escrito, no controlado: sin filtro la bolita espera en el centro.
        value={filter?.value ?? Math.round((range.min + range.max) / 2)}
        tapToSeek
        minimumTrackTintColor={currentOp === 'lte' ? activeTrack : idleTrack}
        maximumTrackTintColor={currentOp === 'gte' ? activeTrack : idleTrack}
        thumbTintColor={hasValue ? theme.colors.primary : theme.colors.outline}
        onSlidingStart={() => {
          slidingRef.current = true;
        }}
        onValueChange={(v) => {
          if (slidingRef.current) setDraftValue(Math.round(v));
          // Fuera de un arrastre solo llega por lector de pantalla (subir /
          // bajar): no hay "soltar", así que se aplica directamente.
          else commit(v);
        }}
        onSlidingComplete={(v) => {
          slidingRef.current = false;
          setDraftValue(null);
          commit(v);
        }}
        accessibilityLabel={`${label}, ${opWords}`}
        accessibilityValue={{ text: hasValue ? formatValue(activeValue) : 'sin filtro' }}
      />

      {/* Extremos: mínimo y máximo de la lista */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 }}>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {formatValue(range.min)}
        </Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {formatValue(range.max)}
        </Text>
      </View>
    </View>
  );
}
