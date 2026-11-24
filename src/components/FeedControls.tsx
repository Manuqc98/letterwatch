import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Chip, Text, useTheme } from 'react-native-paper';
import { TMDB_GENRES } from '../constants/genres';
import { Radius, Spacing } from '../constants/theme';
import {
  AvailableFilterOptions,
  CompareOp,
  formatRatingTenths,
  formatRuntime,
  MovieFilterState,
  NumericFilter,
  NumericFilterKey,
  NumericRange,
  opSymbol,
  SORT_OPTIONS,
  SortField,
  SortState,
} from '../utils/movieFilters';
import { NumericFilterSlider } from './NumericFilterSlider';

type FilterCategory = 'genre' | NumericFilterKey;

const SORT_ICONS: Record<SortField, string> = {
  rating: 'star-outline',
  runtime: 'clock-outline',
  year: 'calendar-outline',
};

interface NumericFilterConfig {
  key: NumericFilterKey;
  label: string;
  summaryPrefix: string; // "Nota ≥ 7,5" vs "≤ 1h 45m"
  visible: boolean;
  range: NumericRange | null;
  defaultOp: CompareOp;
  emptyMessage: string;
  formatValue: (v: number) => string;
}

interface Props {
  options: AvailableFilterOptions;
  filters: MovieFilterState;
  activeFilterCount: number;
  sort: SortState;
  onSelectSort: (field: SortField) => void;
  onToggleGenre: (id: number) => void;
  onClearGenres: () => void;
  onChangeNumeric: (key: NumericFilterKey, next: NumericFilter | null) => void;
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
  onChangeNumeric,
  onClearAllFilters,
}: Props) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<FilterCategory | null>(null);

  const toggleExpanded = (cat: FilterCategory) => {
    setExpanded((prev) => (prev === cat ? null : cat));
  };

  const showGenres = options.genres.length > 0 || options.missingGenresCount > 0;

  // Duración siempre visible: sin datos, su panel invita a actualizar.
  const numericFilters: NumericFilterConfig[] = [
    {
      key: 'runtime',
      label: 'Duración',
      summaryPrefix: '',
      visible: true,
      range: options.runtimeRange,
      defaultOp: 'lte',
      emptyMessage: 'Pulsa Actualizar para cargar la duración de tus películas.',
      formatValue: formatRuntime,
    },
    {
      key: 'year',
      label: 'Época',
      summaryPrefix: '',
      visible: options.yearRange !== null,
      range: options.yearRange,
      defaultOp: 'gte',
      emptyMessage: 'No hay años disponibles en tu lista.',
      formatValue: String,
    },
    {
      key: 'rating',
      label: 'Nota',
      summaryPrefix: 'Nota ',
      visible: options.ratingTenthsRange !== null,
      range: options.ratingTenthsRange,
      defaultOp: 'gte',
      emptyMessage: 'No hay puntuaciones disponibles.',
      formatValue: formatRatingTenths,
    },
  ];

  const expandedNumeric = numericFilters.find((f) => f.key === expanded);
  const activeExpanded: FilterCategory | null =
    expanded === 'genre' ? (showGenres ? 'genre' : null) : expandedNumeric?.visible ? expanded : null;

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

  const numericSummary = (config: NumericFilterConfig, filter: NumericFilter | null) =>
    filter
      ? `${config.summaryPrefix}${opSymbol(filter.op)} ${config.formatValue(filter.value)}`
      : config.label;

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

        {numericFilters
          .filter((config) => config.visible)
          .map((config) => {
            const filter = filters[config.key];
            return (
              <Chip
                key={config.key}
                mode="flat"
                selected={filter !== null}
                showSelectedCheck={false}
                icon={activeExpanded === config.key ? 'chevron-up' : 'chevron-down'}
                onPress={() => toggleExpanded(config.key)}
                onClose={filter !== null ? () => onChangeNumeric(config.key, null) : undefined}
                style={chipStyle(filter !== null, activeExpanded === config.key)}
                textStyle={chipTextStyle(filter !== null)}
              >
                {numericSummary(config, filter)}
              </Chip>
            );
          })}

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

          {expandedNumeric && activeExpanded === expandedNumeric.key && (
            <NumericFilterSlider
              // key: cada filtro arranca con su propio operador y valor.
              key={expandedNumeric.key}
              label={expandedNumeric.label}
              range={expandedNumeric.range}
              filter={filters[expandedNumeric.key]}
              defaultOp={expandedNumeric.defaultOp}
              emptyMessage={expandedNumeric.emptyMessage}
              formatValue={expandedNumeric.formatValue}
              onChange={(next) => onChangeNumeric(expandedNumeric.key, next)}
            />
          )}
        </View>
      )}
    </View>
  );
}
