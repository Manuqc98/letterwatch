import { useMemo, useRef, useState } from 'react';
import { PanResponder, ScrollView, View } from 'react-native';
import { Chip, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { TMDB_GENRES } from '../constants/genres';
import { Radius, Spacing } from '../constants/theme';
import {
  AvailableFilterOptions,
  CompareOp,
  formatRatingTenths,
  MovieFilterState,
  NumericFilter,
  NumericRange,
  SORT_OPTIONS,
  SortField,
  SortState,
} from '../utils/movieFilters';

type FilterCategory = 'genre' | 'runtime' | 'year' | 'rating';

const SORT_ICONS: Record<SortField, string> = {
  rating: 'star-outline',
  runtime: 'clock-outline',
  year: 'calendar-outline',
};

const THUMB_SIZE = 22;
const TRACK_HEIGHT = 6;

interface NumericSliderProps {
  range: NumericRange | null;
  filter: NumericFilter | null;
  defaultOp: CompareOp;
  emptyMessage: string;
  formatValue: (v: number) => string;
  onChange: (next: NumericFilter | null) => void;
}

function NumericSliderBar({
  range,
  filter,
  defaultOp,
  emptyMessage,
  formatValue,
  onChange,
}: NumericSliderProps) {
  const theme = useTheme();
  const [pendingOp, setPendingOp] = useState<CompareOp>(filter?.op ?? defaultOp);
  // Valor local mientras el dedo arrastra la barra: no dispara re-renders del
  // grid hasta soltar el dedo, evitando lag y bloqueos.
  const [draftValue, setDraftValue] = useState<number | null>(null);
  const currentOp = filter?.op ?? pendingOp;

  const trackRef = useRef<View>(null);
  const trackMetricsRef = useRef({ x: 0, width: 1 });
  const draftValueRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const opRef = useRef<CompareOp>(currentOp);
  const rangeRef = useRef<NumericRange | null>(range);
  const onChangeRef = useRef(onChange);

  opRef.current = currentOp;
  rangeRef.current = range;
  onChangeRef.current = onChange;

  const computeValueFromPageX = (pageX: number): number | null => {
    const r = rangeRef.current;
    if (!r) return null;
    const { x, width } = trackMetricsRef.current;
    if (width <= 0) return null;
    const ratio = Math.max(0, Math.min(1, (pageX - x) / width));
    return Math.round(r.min + ratio * (r.max - r.min));
  };

  const updateDraft = (pageX: number) => {
    const nextVal = computeValueFromPageX(pageX);
    if (nextVal !== null && nextVal !== draftValueRef.current) {
      draftValueRef.current = nextVal;
      setDraftValue(nextVal);
    }
  };

  const commitDraft = () => {
    const val = draftValueRef.current;
    draftValueRef.current = null;
    setDraftValue(null);
    if (val !== null) {
      onChangeRef.current({ op: opRef.current, value: val });
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          isDraggingRef.current = true;
          const pageX = evt.nativeEvent.pageX;
          trackRef.current?.measureInWindow((x, _y, width) => {
            if (width > 0) {
              trackMetricsRef.current = { x, width };
              const nextVal = computeValueFromPageX(pageX);
              if (nextVal !== null) {
                if (isDraggingRef.current) {
                  draftValueRef.current = nextVal;
                  setDraftValue(nextVal);
                } else {
                  // Tap rápido: el dedo ya se levantó antes de terminar measureInWindow.
                  draftValueRef.current = null;
                  setDraftValue(null);
                  onChangeRef.current({ op: opRef.current, value: nextVal });
                }
              }
            }
          });
        },
        onPanResponderMove: (evt) => {
          updateDraft(evt.nativeEvent.pageX);
        },
        onPanResponderRelease: () => {
          isDraggingRef.current = false;
          commitDraft();
        },
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
          commitDraft();
        },
      }),
    []
  );

  const handleOpPress = (op: CompareOp) => {
    setPendingOp(op);
    if (filter && filter.op !== op) {
      onChange({ op, value: filter.value });
    }
  };

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

  const activeValue = draftValue ?? filter?.value ?? null;
  const span = range.max - range.min;
  const displayVal = activeValue ?? Math.round((range.min + range.max) / 2);
  const clampedVal = Math.max(range.min, Math.min(range.max, displayVal));
  const ratio = span > 0 ? (clampedVal - range.min) / span : 0.5;
  const pct = ratio * 100;

  return (
    <View style={{ gap: Spacing.xs }}>
      {/* Fila superior: solo los símbolos < y > + valor seleccionado */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {(['lt', 'gt'] as CompareOp[]).map((op) => {
          const active = currentOp === op;
          const symbol = op === 'lt' ? '<' : '>';
          return (
            <TouchableRipple
              key={op}
              onPress={() => handleOpPress(op)}
              borderless
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={op === 'lt' ? 'Menor que' : 'Mayor que'}
              style={{
                width: 44,
                height: 34,
                borderRadius: Radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active
                  ? theme.colors.primaryContainer
                  : theme.colors.elevation.level3,
              }}
            >
              <Text
                variant="titleMedium"
                style={{
                  color: active
                    ? theme.colors.onPrimaryContainer
                    : theme.colors.onSurfaceVariant,
                  fontWeight: '700',
                }}
              >
                {symbol}
              </Text>
            </TouchableRipple>
          );
        })}

        <Text
          variant="labelLarge"
          style={{
            marginLeft: 'auto',
            color: activeValue !== null ? theme.colors.primary : theme.colors.onSurfaceVariant,
            fontWeight: activeValue !== null ? '700' : '400',
          }}
        >
          {activeValue !== null
            ? `${currentOp === 'lt' ? '<' : '>'} ${formatValue(activeValue)}`
            : 'Desliza la barra'}
        </Text>
      </View>

      {/* Barra deslizable horizontal entre min y max */}
      <View
        ref={trackRef}
        onLayout={(e) => {
          const width = e.nativeEvent.layout.width;
          if (width > 0) trackMetricsRef.current.width = width;
        }}
        {...panResponder.panHandlers}
        style={{
          height: 38,
          justifyContent: 'center',
          marginHorizontal: THUMB_SIZE / 2,
        }}
      >
        {/* Pista base */}
        <View
          pointerEvents="none"
          style={{
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            backgroundColor: theme.colors.surfaceVariant,
            overflow: 'hidden',
          }}
        >
          {/* Tramo activo: izquierda para <, derecha para > */}
          {activeValue !== null && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: currentOp === 'lt' ? 0 : `${pct}%`,
                right: currentOp === 'lt' ? `${100 - pct}%` : 0,
                backgroundColor: theme.colors.primary,
              }}
            />
          )}
        </View>

        {/* Indicador circular (thumb) */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${pct}%`,
            marginLeft: -(THUMB_SIZE / 2),
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: THUMB_SIZE / 2,
            backgroundColor: activeValue !== null ? theme.colors.primary : theme.colors.outline,
            borderWidth: 2,
            borderColor: theme.colors.surface,
            elevation: 2,
          }}
        />
      </View>

      {/* Etiquetas de extremos (mínimo y máximo de la lista) */}
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

interface Props {
  options: AvailableFilterOptions;
  filters: MovieFilterState;
  activeFilterCount: number;
  sort: SortState;
  onSelectSort: (field: SortField) => void;
  onToggleGenre: (id: number) => void;
  onClearGenres: () => void;
  onChangeRuntime: (next: NumericFilter | null) => void;
  onChangeYear: (next: NumericFilter | null) => void;
  onChangeRating: (next: NumericFilter | null) => void;
  onClearAllFilters: () => void;
}

export function FeedControls({
  options,
  filters,
  activeFilterCount,
  sort,
  onSelectSort,
  onToggleGenre,
  onClearGenres,
  onChangeRuntime,
  onChangeYear,
  onChangeRating,
  onClearAllFilters,
}: Props) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<FilterCategory | null>(null);

  const toggleExpanded = (cat: FilterCategory) => {
    setExpanded((prev) => (prev === cat ? null : cat));
  };

  const showGenres = options.genres.length > 0 || options.missingGenresCount > 0;
  const showYear = options.yearRange !== null;
  const showRating = options.ratingTenthsRange !== null;

  const activeExpanded: FilterCategory | null =
    expanded === 'genre' && !showGenres
      ? null
      : expanded === 'year' && !showYear
        ? null
        : expanded === 'rating' && !showRating
          ? null
          : expanded;

  const chipStyle = (active: boolean, isExpanded = false) => ({
    backgroundColor: active ? theme.colors.secondaryContainer : theme.colors.elevation.level1,
    ...(isExpanded && !active
      ? { borderWidth: 1, borderColor: theme.colors.outline }
      : undefined),
  });

  const chipTextStyle = (active: boolean) => ({
    color: active ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant,
  });

  const genreSummary =
    filters.genres.size === 0
      ? 'Género'
      : filters.genres.size === 1
        ? TMDB_GENRES[[...filters.genres][0]]
        : `Géneros (${filters.genres.size})`;

  const runtimeSummary = filters.runtime
    ? `${filters.runtime.op === 'lt' ? '<' : '>'} ${filters.runtime.value} min`
    : 'Duración';

  const yearSummary = filters.year
    ? `${filters.year.op === 'lt' ? '<' : '>'} ${filters.year.value}`
    : 'Época';

  const ratingSummary = filters.rating
    ? `Nota ${filters.rating.op === 'lt' ? '<' : '>'} ${formatRatingTenths(filters.rating.value)}`
    : 'Nota';

  return (
    <View style={{ gap: 6 }}>
      {/* Fila 1: Ordenación rápida (Nota, Duración, Año; pulsar el activo invierte ↑/↓) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
      >
        {SORT_OPTIONS.map((opt) => {
          const active = sort.field === opt.field;
          const dirLabel = sort.direction === 'asc' ? 'ascendente' : 'descendente';
          return (
            <Chip
              key={opt.field}
              mode="flat"
              selected={active}
              showSelectedCheck={false}
              icon={
                active
                  ? sort.direction === 'desc'
                    ? 'arrow-down'
                    : 'arrow-up'
                  : SORT_ICONS[opt.field]
              }
              onPress={() => onSelectSort(opt.field)}
              accessibilityLabel={
                active
                  ? `Ordenado por ${opt.label}, ${dirLabel}. Pulsa para invertir`
                  : `Ordenar por ${opt.label}`
              }
              style={{
                backgroundColor: active
                  ? theme.colors.primaryContainer
                  : theme.colors.elevation.level1,
              }}
              textStyle={{
                color: active
                  ? theme.colors.onPrimaryContainer
                  : theme.colors.onSurfaceVariant,
              }}
            >
              {opt.label}
            </Chip>
          );
        })}
      </ScrollView>

      {/* Fila 2: Filtros desplegables (Género, Duración, Época, Nota + Limpiar) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
      >
        {showGenres && (
          <Chip
            mode="flat"
            selected={filters.genres.size > 0}
            showSelectedCheck={false}
            icon={activeExpanded === 'genre' ? 'chevron-up' : 'chevron-down'}
            onPress={() => toggleExpanded('genre')}
            onClose={filters.genres.size > 0 ? onClearGenres : undefined}
            style={chipStyle(filters.genres.size > 0, activeExpanded === 'genre')}
            textStyle={chipTextStyle(filters.genres.size > 0)}
          >
            {genreSummary}
          </Chip>
        )}

        <Chip
          mode="flat"
          selected={filters.runtime !== null}
          showSelectedCheck={false}
          icon={activeExpanded === 'runtime' ? 'chevron-up' : 'chevron-down'}
          onPress={() => toggleExpanded('runtime')}
          onClose={filters.runtime !== null ? () => onChangeRuntime(null) : undefined}
          style={chipStyle(filters.runtime !== null, activeExpanded === 'runtime')}
          textStyle={chipTextStyle(filters.runtime !== null)}
        >
          {runtimeSummary}
        </Chip>

        {showYear && (
          <Chip
            mode="flat"
            selected={filters.year !== null}
            showSelectedCheck={false}
            icon={activeExpanded === 'year' ? 'chevron-up' : 'chevron-down'}
            onPress={() => toggleExpanded('year')}
            onClose={filters.year !== null ? () => onChangeYear(null) : undefined}
            style={chipStyle(filters.year !== null, activeExpanded === 'year')}
            textStyle={chipTextStyle(filters.year !== null)}
          >
            {yearSummary}
          </Chip>
        )}

        {showRating && (
          <Chip
            mode="flat"
            selected={filters.rating !== null}
            showSelectedCheck={false}
            icon={activeExpanded === 'rating' ? 'chevron-up' : 'chevron-down'}
            onPress={() => toggleExpanded('rating')}
            onClose={filters.rating !== null ? () => onChangeRating(null) : undefined}
            style={chipStyle(filters.rating !== null, activeExpanded === 'rating')}
            textStyle={chipTextStyle(filters.rating !== null)}
          >
            {ratingSummary}
          </Chip>
        )}

        {activeFilterCount > 0 && (
          <Chip
            mode="outlined"
            icon="filter-remove-outline"
            onPress={() => {
              onClearAllFilters();
              setExpanded(null);
            }}
            style={{ backgroundColor: 'transparent', borderColor: theme.colors.outlineVariant }}
            textStyle={{ color: theme.colors.onSurfaceVariant }}
          >
            Limpiar ({activeFilterCount})
          </Chip>
        )}
      </ScrollView>

      {/* Panel inline desplegable del filtro seleccionado */}
      {activeExpanded !== null && (
        <View
          style={{
            backgroundColor: theme.colors.elevation.level1,
            borderRadius: Radius.md,
            padding: Spacing.sm,
          }}
        >
          {activeExpanded === 'genre' &&
            (options.genres.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {options.genres.map(([id]) => {
                  const active = filters.genres.has(id);
                  return (
                    <Chip
                      key={id}
                      mode="flat"
                      compact
                      selected={active}
                      showSelectedCheck
                      onPress={() => onToggleGenre(id)}
                      style={{
                        backgroundColor: active
                          ? theme.colors.secondaryContainer
                          : theme.colors.elevation.level3,
                      }}
                      textStyle={chipTextStyle(active)}
                    >
                      {TMDB_GENRES[id]}
                    </Chip>
                  );
                })}
              </View>
            ) : (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, paddingVertical: 4 }}
              >
                Pulsa Actualizar para cargar los géneros.
              </Text>
            ))}

          {activeExpanded === 'runtime' && (
            <NumericSliderBar
              key="runtime"
              range={options.runtimeRange}
              filter={filters.runtime}
              defaultOp="lt"
              emptyMessage="Pulsa Actualizar para cargar la duración de tus películas."
              formatValue={(m) => `${m} min`}
              onChange={onChangeRuntime}
            />
          )}

          {activeExpanded === 'year' && (
            <NumericSliderBar
              key="year"
              range={options.yearRange}
              filter={filters.year}
              defaultOp="gt"
              emptyMessage="No hay años disponibles en tu lista."
              formatValue={(y) => String(y)}
              onChange={onChangeYear}
            />
          )}

          {activeExpanded === 'rating' && (
            <NumericSliderBar
              key="rating"
              range={options.ratingTenthsRange}
              filter={filters.rating}
              defaultOp="gt"
              emptyMessage="No hay puntuaciones disponibles."
              formatValue={formatRatingTenths}
              onChange={onChangeRating}
            />
          )}
        </View>
      )}
    </View>
  );
}
