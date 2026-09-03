import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { StorageService, CachedMovie, STALE_AFTER_DAYS } from '../services/storage';
import { LetterboxdService, LetterboxdError } from '../services/letterboxd';
import { TMDBService } from '../services/tmdb';
import { JustWatchService, JustWatchEntry } from '../services/justwatch';
import { PlatformKey, DEFAULT_PLATFORMS, matchPlatforms } from '../constants/platforms';

export type VisibleMovie = CachedMovie & { matched: PlatformKey[] };
export type NewsMovie = VisibleMovie & { availableFrom: string; newOn: PlatformKey[] };
export type LeavingMovie = VisibleMovie & { availableTo: string; singlePlatform: boolean };

export type DialogState = {
  icon: string;
  title: string;
  message: string;
  actions?: { label: string; onPress?: () => void }[];
} | null;

// Peticiones simultáneas a TMDB durante un escaneo (admite ~50/s; con 20
// concurrentes y 1-2 req/película seguimos por debajo, y el retry de 429
// del servicio cubre los picos).
const BATCH_SIZE = 20;

// Formatea "YYYY-MM-DD..." como "DD/MM" sin pasar por Date: las fechas
// date-only de JW parseadas como UTC cambiarían de día según el huso.
export function fmtDay(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}`;
}

function isoDayFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function ratingKey(movie: CachedMovie): number {
  return movie.voteAverage != null ? Math.round(movie.voteAverage * 10) : -1;
}

// Orden de Ready: nota (a 1 decimal, como se muestra) desc → año reciente → alfabético.
function compareByRating(a: CachedMovie, b: CachedMovie): number {
  const ratingA = ratingKey(a);
  const ratingB = ratingKey(b);
  if (ratingA !== ratingB) return ratingB - ratingA;
  const yearA = a.year ? parseInt(a.year, 10) : 0;
  const yearB = b.year ? parseInt(b.year, 10) : 0;
  if (yearA !== yearB) return yearB - yearA;
  return a.title.localeCompare(b.title, 'es');
}

interface WatchlistContextValue {
  configured: boolean | null;
  userPlatforms: Record<PlatformKey, boolean>;
  allMovies: CachedMovie[];
  readyMovies: VisibleMovie[];
  newsMovies: NewsMovie[];
  leavingMovies: LeavingMovie[];
  lastUpdated: number | null;
  truncated: boolean;
  isStale: boolean;
  isLoading: boolean;
  progress: number | null;
  progressMsg: string;
  jwAvailable: boolean; // hay datos JW (frescos o cacheados)
  jwStale: boolean; // el último refresh no pudo actualizar JW
  jwFetchFailed: boolean; // la última consulta a JW falló (haya caché o no)
  refresh: () => Promise<void>;
  showDialog: (dialog: NonNullable<DialogState>) => void;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function useWatchlist(): WatchlistContextValue {
  const value = useContext(WatchlistContext);
  if (!value) throw new Error('useWatchlist debe usarse dentro de WatchlistProvider');
  return value;
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [userPlatforms, setUserPlatforms] = useState<Record<PlatformKey, boolean>>(DEFAULT_PLATFORMS);
  const [allMovies, setAllMovies] = useState<CachedMovie[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progress, setProgress] = useState<number | null>(null); // null = indeterminado
  const [jwNews, setJwNews] = useState<JustWatchEntry[] | null>(null);
  const [jwLeaving, setJwLeaving] = useState<JustWatchEntry[] | null>(null);
  const [jwFetchFailed, setJwFetchFailed] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  // El Dialog sigue montado ~220ms durante su animación de cierre: se
  // renderiza el último contenido no nulo para que no parpadee al fallback.
  const lastDialogRef = useRef<NonNullable<DialogState> | null>(null);
  if (dialog) lastDialogRef.current = dialog;
  const dialogContent = dialog ?? lastDialogRef.current;
  // Ref (no estado): el callback del focus lo lee sin sufrir stale closures.
  const isRefreshingRef = useRef(false);

  // Este provider vive en el layout de (tabs): el focus se liga al route
  // "(tabs)" del Stack raíz, así que cambiar de tab NO recarga, pero volver
  // de Ajustes o del onboarding SÍ (misma semántica que la v1).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const username = await StorageService.getUsername();
          const platforms = await StorageService.getPlatforms();
          const cache = await StorageService.getCache();
          if (!active) return;

          if (!username || !platforms) {
            setConfigured(false);
            return;
          }
          setConfigured(true);
          setUserPlatforms(platforms);

          // Con un escaneo en marcha no se pisa la lista con la caché vieja:
          // el propio escaneo actualizará el estado al terminar.
          if (isRefreshingRef.current) return;

          // Una caché de otro usuario (cambio de cuenta) no vale.
          if (cache && cache.username === username) {
            setAllMovies(cache.movies);
            setLastUpdated(cache.timestamp);
            setTruncated(cache.truncated);
            setJwNews(cache.news ?? null);
            setJwLeaving(cache.leaving ?? null);
          } else {
            setAllMovies([]);
            setLastUpdated(null);
            setTruncated(false);
            setJwNews(null);
            setJwLeaving(null);
          }
        } catch (e) {
          console.error('Error cargando datos guardados:', e);
          // Un fallo transitorio de lectura no expulsa al onboarding a un
          // usuario ya configurado: solo se resuelve a false el primer load.
          if (active) setConfigured((prev) => prev ?? false);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const refresh = async () => {
    if (isRefreshingRef.current) return;
    if (!TMDBService.isConfigured()) {
      setDialog({
        icon: 'key-alert-outline',
        title: 'Falta la API key',
        message: 'Configura EXPO_PUBLIC_TMDB_API_KEY en el fichero .env (ver README) y reinicia la app.',
      });
      return;
    }

    setIsLoading(true);
    isRefreshingRef.current = true;
    setProgress(null);
    try {
      const username = await StorageService.getUsername();
      if (!username) return;
      const epochAtStart = StorageService.getCacheEpoch();

      // JustWatch corre en paralelo al escaneo TMDB (hosts distintos).
      // El handler va adjunto DESDE LA CREACIÓN (null = fuente caída): así
      // no hay unhandled rejections si el escaneo aborta antes del await,
      // y un fallo en una fuente no tira el resultado de la otra.
      const jwNewsPromise = JustWatchService.getNewOnPlatforms().catch((e) => {
        console.error('JustWatch novedades no disponible:', e);
        return null;
      });
      const jwLeavingPromise = JustWatchService.getLeavingSoon().catch((e) => {
        console.error('JustWatch salidas no disponible:', e);
        return null;
      });

      setProgressMsg('Obteniendo tu Watchlist de Letterboxd...');
      const { movies: watchlist, truncated: wasTruncated } = await LetterboxdService.fetchWatchlist(username);

      if (watchlist.length === 0) {
        setDialog({
          icon: 'movie-off-outline',
          title: 'Watchlist vacía',
          message: 'Tu watchlist no tiene películas, o es privada.',
        });
        return;
      }

      const previousById = new Map(allMovies.map((m) => [m.id, m]));
      let failedCount = 0;

      // Render progresivo: el grid arranca sembrado con la caché de las
      // películas que siguen en la watchlist y se actualiza por lotes.
      const interim = new Map<string, CachedMovie>();
      for (const movie of watchlist) {
        const prev = previousById.get(movie.id);
        if (prev) interim.set(movie.id, prev);
      }
      setAllMovies([...interim.values()]);

      for (let i = 0; i < watchlist.length; i += BATCH_SIZE) {
        const batch = watchlist.slice(i, i + BATCH_SIZE);
        setProgressMsg(`Comprobando disponibilidad ${Math.min(i + BATCH_SIZE, watchlist.length)}/${watchlist.length}...`);
        const processed = await Promise.all(
          batch.map(async (movie): Promise<CachedMovie | null> => {
            const prev = previousById.get(movie.id);
            try {
              // El tmdbId de una película no cambia: se reutiliza el de
              // escaneos anteriores y solo se buscan las películas nuevas.
              const tmdbId =
                prev && prev.tmdbId !== null
                  ? prev.tmdbId
                  : await TMDBService.searchMovie(movie.title, movie.year);
              if (tmdbId === null) {
                return { ...movie, tmdbId: null, posterUrl: null, flatrateProviderIds: [], voteAverage: null };
              }
              // Providers + nota + póster en una sola petición.
              const status = await TMDBService.getMovieStatus(tmdbId);
              return {
                ...movie,
                tmdbId,
                posterUrl: status.posterUrl,
                flatrateProviderIds: status.flatrateProviderIds,
                voteAverage: status.voteAverage,
              };
            } catch {
              // Fallo de red/API: mejor conservar el dato anterior que
              // cachear un falso "no disponible".
              failedCount++;
              return prev ?? null;
            }
          })
        );
        for (const movie of processed) {
          if (movie) interim.set(movie.id, movie);
        }
        setAllMovies([...interim.values()]);
        setProgress(Math.min(i + BATCH_SIZE, watchlist.length) / watchlist.length);
      }
      const results = [...interim.values()];

      setProgressMsg('Consultando novedades de plataformas...');
      // Degradación por fuente: la que falla (null) conserva sus datos
      // anteriores; la que responde se actualiza.
      const newsResult = await jwNewsPromise;
      const leavingResult = await jwLeavingPromise;
      const newsFinal = newsResult ?? jwNews;
      const leavingFinal = leavingResult ?? jwLeaving;
      const jwFailed = newsResult === null || leavingResult === null;

      // Si durante el escaneo hubo un logout, "Borrar datos" o cambio de
      // usuario, estos resultados ya no son suyos: no se persisten.
      const currentUsername = await StorageService.getUsername();
      if (currentUsername !== username || StorageService.getCacheEpoch() !== epochAtStart) return;

      setAllMovies(results);
      setTruncated(wasTruncated);
      setLastUpdated(Date.now());
      setJwNews(newsFinal);
      setJwLeaving(leavingFinal);
      setJwFetchFailed(jwFailed);
      await StorageService.setCache(username, results, wasTruncated, newsFinal, leavingFinal);

      if (failedCount > 0) {
        setDialog({
          icon: 'cloud-alert',
          title: 'Escaneo incompleto',
          message: `No se pudo comprobar la disponibilidad de ${failedCount} película(s) (red o límite de la API). Se conservan sus datos anteriores; vuelve a actualizar más tarde.`,
        });
      }
    } catch (error) {
      if (error instanceof LetterboxdError && error.code === 'USER_NOT_FOUND') {
        setDialog({
          icon: 'account-question-outline',
          title: 'Usuario no encontrado',
          message: error.message,
          actions: [
            { label: 'Cerrar' },
            // navigate (no push): si Ajustes ya está abierto, no lo duplica.
            { label: 'Ir a Ajustes', onPress: () => router.navigate('/settings') },
          ],
        });
      } else if (error instanceof LetterboxdError) {
        setDialog({
          icon: 'wifi-off',
          title: 'Sin conexión con Letterboxd',
          message: `${error.message} Comprueba tu conexión e inténtalo de nuevo.`,
        });
      } else {
        console.error(error);
        setDialog({
          icon: 'alert-circle-outline',
          title: 'Error al actualizar',
          message: 'Hubo un error inesperado al actualizar los datos. Inténtalo de nuevo.',
        });
      }
    } finally {
      setProgressMsg('');
      setProgress(null);
      setIsLoading(false);
      isRefreshingRef.current = false;
    }
  };

  // El filtrado por plataformas se hace en los selectores, no al escanear:
  // cambiar los switches en Ajustes surte efecto sin re-escanear nada.
  const readyMovies = useMemo<VisibleMovie[]>(
    () =>
      allMovies
        .map((movie) => ({
          ...movie,
          matched: matchPlatforms(movie.flatrateProviderIds, userPlatforms),
        }))
        .filter((movie) => movie.matched.length > 0)
        .sort(compareByRating),
    [allMovies, userPlatforms]
  );

  const moviesByTmdbId = useMemo(
    () => new Map(allMovies.filter((m) => m.tmdbId !== null).map((m) => [m.tmdbId as number, m])),
    [allMovies]
  );

  const newsMovies = useMemo<NewsMovie[]>(() => {
    if (!jwNews) return [];
    // Re-aplicar la ventana con la fecha de HOY: los datos vienen de caché
    // y pueden tener días; lo que ya no es reciente deja de ser novedad.
    const cutoff = isoDayFromMs(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const grouped = new Map<number, { platforms: Set<PlatformKey>; providerIds: number[]; date: string }>();
    for (const entry of jwNews) {
      if (entry.date.slice(0, 10) < cutoff) continue;
      const movie = moviesByTmdbId.get(entry.tmdbId);
      if (!movie) continue;
      const keys = matchPlatforms([entry.providerId], userPlatforms);
      if (keys.length === 0) continue;
      const group = grouped.get(entry.tmdbId) ?? { platforms: new Set<PlatformKey>(), providerIds: [], date: entry.date };
      keys.forEach((k) => group.platforms.add(k));
      group.providerIds.push(entry.providerId);
      if (entry.date > group.date) group.date = entry.date;
      grouped.set(entry.tmdbId, group);
    }
    return [...grouped.entries()]
      .map(([tmdbId, group]) => {
        const movie = moviesByTmdbId.get(tmdbId)!;
        // Unión TMDB ∪ JW: TMDB va días por detrás de las novedades.
        const matched = matchPlatforms([...movie.flatrateProviderIds, ...group.providerIds], userPlatforms);
        return { ...movie, matched, newOn: [...group.platforms], availableFrom: group.date };
      })
      .sort((a, b) => b.availableFrom.localeCompare(a.availableFrom) || compareByRating(a, b));
  }, [jwNews, moviesByTmdbId, userPlatforms]);

  const leavingMovies = useMemo<LeavingMovie[]>(() => {
    if (!jwLeaving) return [];
    // Re-aplicar la ventana con la fecha de HOY: fuera lo ya salido (caché
    // con días) y lo que quede más allá del horizonte de "pronto".
    const today = isoDayFromMs(Date.now());
    const horizon = isoDayFromMs(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const grouped = new Map<number, { providerIds: number[]; date: string }>();
    for (const entry of jwLeaving) {
      const day = entry.date.slice(0, 10);
      if (day < today || day > horizon) continue;
      const movie = moviesByTmdbId.get(entry.tmdbId);
      if (!movie) continue;
      const keys = matchPlatforms([entry.providerId], userPlatforms);
      if (keys.length === 0) continue;
      const group = grouped.get(entry.tmdbId) ?? { providerIds: [], date: entry.date };
      group.providerIds.push(entry.providerId);
      if (entry.date < group.date) group.date = entry.date; // salida más próxima
      grouped.set(entry.tmdbId, group);
    }
    return [...grouped.entries()]
      .map(([tmdbId, group]) => {
        const movie = moviesByTmdbId.get(tmdbId)!;
        const matched = matchPlatforms([...movie.flatrateProviderIds, ...group.providerIds], userPlatforms);
        return { ...movie, matched, availableTo: group.date, singlePlatform: matched.length === 1 };
      })
      .sort((a, b) => a.availableTo.localeCompare(b.availableTo) || compareByRating(a, b));
  }, [jwLeaving, moviesByTmdbId, userPlatforms]);

  const isStale =
    lastUpdated !== null && (Date.now() - lastUpdated) / (1000 * 60 * 60 * 24) > STALE_AFTER_DAYS;
  const jwAvailable = jwNews !== null || jwLeaving !== null;

  const value: WatchlistContextValue = {
    configured,
    userPlatforms,
    allMovies,
    readyMovies,
    newsMovies,
    leavingMovies,
    lastUpdated,
    truncated,
    isStale,
    isLoading,
    progress,
    progressMsg,
    jwAvailable,
    jwStale: jwAvailable && jwFetchFailed,
    jwFetchFailed,
    refresh,
    showDialog: setDialog,
  };

  return (
    <WatchlistContext.Provider value={value}>
      {children}
      <Portal>
        <Dialog visible={!!dialog} onDismiss={() => setDialog(null)}>
          <Dialog.Icon icon={dialogContent?.icon ?? 'alert-circle-outline'} />
          <Dialog.Title style={{ textAlign: 'center' }}>{dialogContent?.title}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{dialogContent?.message}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            {(dialogContent?.actions ?? [{ label: 'Entendido' }]).map((action) => (
              <Button
                key={action.label}
                onPress={() => {
                  setDialog(null);
                  action.onPress?.();
                }}
              >
                {action.label}
              </Button>
            ))}
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </WatchlistContext.Provider>
  );
}
