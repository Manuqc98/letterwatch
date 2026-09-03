import axios from 'axios';
import { ALL_JW_PACKAGES } from '../constants/platforms';

// API GraphQL NO OFICIAL de JustWatch (la misma que usa su web, sin auth).
// Puede cambiar o romperse sin aviso: el llamante debe capturar errores y
// degradar (News/WatchOut muestran datos cacheados o un aviso; Ready no
// depende de este servicio en absoluto).
export interface JustWatchEntry {
  tmdbId: number; // entero validado (sin sufijo ":temporada")
  providerId: number; // packageId de JW == provider id de TMDB
  date: string; // ISO: availableFromTime (NEW) | availableTo (LEAVING_SOON)
}

const ENDPOINT = 'https://apis.justwatch.com/graphql';
const TIMEOUT_MS = 8000; // JW nunca debe bloquear un escaneo
const PAGE_SIZE = 100;
const MAX_LEAVING_PAGES = 8; // tope duro ~800 títulos
const NEW_LOOKBACK_DAYS = 14;
const MAX_NEW_PAGES_PER_DAY = 3; // hay días con >100 novedades (verificado)
// Las listas de JW traen fechas fuera de rango (novedades re-listadas con
// availableFromTime antiguo, salidas hasta un año vista): se recortan a
// ventanas que respondan a "recién añadida" y "se va pronto".
const LEAVING_WINDOW_DAYS = 30;

const NEW_TITLES_QUERY = `
query GetNewTitles($country: Country!, $date: Date!, $first: Int!, $after: String, $pageType: NewPageType!, $filter: TitleFilter) {
  newTitles(country: $country, date: $date, first: $first, after: $after, pageType: $pageType, filter: $filter) {
    pageInfo { hasNextPage endCursor }
    edges {
      newOffer(platform: WEB) {
        package { packageId }
        availableTo
        availableFromTime
      }
      node {
        content(country: $country, language: "es") {
          externalIds { tmdbId }
        }
      }
    }
  }
}`;

interface PageResult {
  entries: { tmdbId: number; providerId: number; availableTo: string | null; availableFrom: string | null }[];
  hasNextPage: boolean;
  endCursor: string | null;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function queryPage(
  pageType: 'NEW' | 'LEAVING_SOON',
  date: string,
  after?: string
): Promise<PageResult> {
  const response = await axios.post(
    ENDPOINT,
    {
      query: NEW_TITLES_QUERY,
      variables: {
        country: 'ES',
        date,
        first: PAGE_SIZE,
        after: after ?? null,
        pageType,
        filter: { packages: ALL_JW_PACKAGES, objectTypes: ['MOVIE'] },
      },
    },
    { timeout: TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } }
  );

  const data = response.data?.data?.newTitles;
  if (!data) {
    throw new Error('JustWatch GraphQL: respuesta sin datos');
  }

  const entries: PageResult['entries'] = [];
  for (const edge of data.edges ?? []) {
    const offer = edge?.newOffer;
    const rawTmdbId = edge?.node?.content?.externalIds?.tmdbId;
    // Cinturón y tirantes además de objectTypes MOVIE: las series llegan
    // con tmdbId "12345:2" (id:temporada) → descartar.
    if (!offer || rawTmdbId == null || String(rawTmdbId).includes(':')) continue;
    const tmdbId = Number(rawTmdbId);
    const providerId = offer.package?.packageId;
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || typeof providerId !== 'number') continue;
    entries.push({
      tmdbId,
      providerId,
      availableTo: offer.availableTo ?? null,
      availableFrom: offer.availableFromTime ?? null,
    });
  }

  return {
    entries,
    hasNextPage: !!data.pageInfo?.hasNextPage,
    endCursor: data.pageInfo?.endCursor ?? null,
  };
}

export const JustWatchService = {
  // La lista NEW está anclada al parámetro date (pocas entradas por fecha):
  // se consultan los últimos NEW_LOOKBACK_DAYS días EN PARALELO. Fechas
  // caídas se toleran (allSettled); si fallan todas, se lanza.
  async getNewOnPlatforms(): Promise<JustWatchEntry[]> {
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < NEW_LOOKBACK_DAYS; i++) {
      dates.push(isoDay(new Date(today.getTime() - i * 24 * 60 * 60 * 1000)));
    }

    // Cada fecha se pagina (hasta MAX_NEW_PAGES_PER_DAY) por si un día
    // supera el tamaño de página.
    const fetchDay = async (date: string) => {
      const entries: PageResult['entries'] = [];
      let after: string | undefined;
      for (let page = 0; page < MAX_NEW_PAGES_PER_DAY; page++) {
        const result = await queryPage('NEW', date, after);
        entries.push(...result.entries);
        if (!result.hasNextPage || !result.endCursor) break;
        after = result.endCursor;
      }
      return entries;
    };

    const results = await Promise.allSettled(dates.map(fetchDay));
    const pages = results.filter(
      (r): r is PromiseFulfilledResult<PageResult['entries']> => r.status === 'fulfilled'
    );
    if (pages.length === 0) {
      throw new Error('JustWatch: todas las consultas de novedades fallaron');
    }

    // Solo cuenta como novedad lo llegado dentro de la ventana (JW re-lista
    // a veces títulos con availableFromTime de hace meses).
    const cutoff = isoDay(new Date(today.getTime() - NEW_LOOKBACK_DAYS * 24 * 60 * 60 * 1000));

    // Dedupe por película+plataforma conservando la fecha más reciente.
    const byKey = new Map<string, JustWatchEntry>();
    for (const page of pages) {
      for (const e of page.value) {
        const date = e.availableFrom;
        if (!date || date.slice(0, 10) < cutoff) continue;
        const key = `${e.tmdbId}:${e.providerId}`;
        const prev = byKey.get(key);
        if (!prev || date > prev.date) {
          byKey.set(key, { tmdbId: e.tmdbId, providerId: e.providerId, date });
        }
      }
    }
    return [...byKey.values()];
  },

  // LEAVING_SOON es una lista completa hacia delante (~600 títulos para
  // nuestras plataformas): se pagina por cursor con un tope duro.
  async getLeavingSoon(): Promise<JustWatchEntry[]> {
    const now = new Date();
    const today = isoDay(now);
    // "Se va pronto" = dentro de la ventana; la lista de JW llega a un año vista.
    const horizon = isoDay(new Date(now.getTime() + LEAVING_WINDOW_DAYS * 24 * 60 * 60 * 1000));
    const byKey = new Map<string, JustWatchEntry>();
    let after: string | undefined;

    for (let page = 0; page < MAX_LEAVING_PAGES; page++) {
      const result = await queryPage('LEAVING_SOON', today, after);
      for (const e of result.entries) {
        const date = e.availableTo;
        if (!date || date > horizon) continue;
        const key = `${e.tmdbId}:${e.providerId}`;
        const prev = byKey.get(key);
        // Se conserva la fecha de salida más próxima.
        if (!prev || date < prev.date) {
          byKey.set(key, { tmdbId: e.tmdbId, providerId: e.providerId, date });
        }
      }
      if (!result.hasNextPage || !result.endCursor) break;
      after = result.endCursor;
    }
    return [...byKey.values()];
  },
};
