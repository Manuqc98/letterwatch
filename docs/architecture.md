# Arquitectura del Sistema - LetterWatch

## 1. Propósito del Proyecto
**LetterWatch** es una aplicación móvil (Android / iOS) desarrollada con React Native y Expo que soluciona el problema de disponibilidad de streaming para los usuarios de [Letterboxd](https://letterboxd.com). La app extrae la Watchlist pública de un usuario mediante web scraping, cruza cada título con la API de **The Movie Database (TMDB)** y la API GraphQL de **JustWatch**, y presenta de forma instantánea qué películas de su lista están incluidas ("Flatrate") en los servicios de suscripción que el usuario tiene activos en España (`ES`), además de avisar sobre novedades recientes y títulos que abandonarán los catálogos próximamente.

---

## 2. Stack Tecnológico y Dependencias Clave

* **Framework y Runtime:**
  * **React 19** (`react@^19.1.0`, `react-dom@^19.1.0`)
  * **React Native** (`react-native@^0.81.5`)
  * **Expo SDK 54** (`expo@^54.0.0`) con TypeScript (`typescript@~5.9.2`)
  * **Expo Router v6** (`expo-router@~6.0.24`, sistema de rutas basado en archivos)
* **Diseño e Interfaz (UI/UX):**
  * **React Native Paper v5** (`react-native-paper@^5.15.3`, componentes Material Design 3)
  * **Material Color Utilities** (`@material/material-color-utilities@^0.3.0`, generación de paletas tonales M3 a partir de un color semilla)
  * **Expo Image** (`expo-image@~3.0.11`, renderizado y caché eficiente de pósters y logos)
  * **Expo Vector Icons** (`@expo/vector-icons@^15.1.1`, glifos Material Community Icons)
  * **React Native Safe Area Context & Screens** (`react-native-safe-area-context`, `react-native-screens`)
* **Red, Datos y Scraping:**
  * **Axios** (`axios@^1.20.0`, cliente HTTP para llamadas a Letterboxd, TMDB y JustWatch)
  * **Cheerio** (`cheerio@1.0.0-rc.12`, parser HTML del lado cliente para extraer datos de Letterboxd)
* **Almacenamiento Local:**
  * **AsyncStorage** (`@react-native-async-storage/async-storage@2.2.0`, persistencia de credenciales de usuario, selección de plataformas y caché de películas)
* **Build y Distribución:**
  * **Expo Application Services (EAS Build)** (`eas.json`) para compilación de APKs/AABs en la nube.

---

## 3. Mapa y Responsabilidades de Directorios

```
letterwatch/
├── app/                        # Capa de Navegación y Pantallas (Expo Router)
│   ├── _layout.tsx             # Stack raíz: Temas (Paper + Nav), Snackbar global y rutas
│   ├── onboarding.tsx          # Pantalla de bienvenida, setup de usuario y plataformas
│   ├── settings.tsx            # Pantalla modal de ajustes (cuenta, autoguardado, reset)
│   └── (tabs)/                 # Grupo de pestañas principales (custodiadas por Auth Guard)
│       ├── _layout.tsx         # Layout de Tabs Material 3 + Guard de Onboarding + Header
│       ├── index.tsx           # Tab 1: "Ready to watch" (disponibles en plataformas)
│       ├── news.tsx            # Tab 2: "News" (incorporaciones en los últimos 14 días)
│       └── watchout.tsx        # Tab 3: "WatchOut" (salidas en los próximos 30 días)
├── src/
│   ├── components/             # Componentes visuales reutilizables
│   │   ├── EmptyState.tsx      # Estado vacío para listas sin resultados o errores suaves
│   │   ├── MovieGrid.tsx       # Cuadrícula responsive de 3 columnas para pósters
│   │   ├── MoviePosterCard.tsx # Tarjeta accesible de película con nota, logos y enlace
│   │   ├── NoticeCard.tsx      # Banner informativo tonal estilo Material 3
│   │   ├── PlatformList.tsx    # Lista agrupada con switches para activar plataformas
│   │   ├── ProgressCard.tsx    # Barra de progreso y mensajes durante escaneos
│   │   ├── ScanFab.tsx         # Floating Action Button flotante para refrescar catálogo
│   │   └── SnackbarProvider.tsx# Contexto y host global para avisos tipo toast
│   ├── constants/              # Constantes de configuración, catálogo y diseño
│   │   ├── genres.ts           # Diccionario oficial de géneros TMDB en español
│   │   ├── platforms.ts        # Definición de plataformas ES, IDs TMDB y packages JW
│   │   └── theme.ts            # Semilla naranja (#FF8000), paletas M3 light/dark y tokens
│   ├── context/
│   │   └── WatchlistContext.tsx# Estado global: escaneo, caché, ordenación y filtrado
│   └── services/               # Integraciones externas y almacenamiento
│       ├── justwatch.ts        # Cliente GraphQL no oficial de JustWatch (News & Leaving)
│       ├── letterboxd.ts       # Scraper HTML de Letterboxd con Axios + Cheerio
│       ├── storage.ts          # Abstracción sobre AsyncStorage con control de epoch
│       └── tmdb.ts             # Cliente REST TMDB con retry automático ante HTTP 429
├── scripts/
│   └── reset-project.js        # Script utilitario inicial de Expo
├── AGENTS.md                   # Reglas e instrucciones para agentes de IA
├── app.json                    # Manifiesto de configuración de la app de Expo
├── eas.json                    # Configuración de compilaciones EAS (preview, production)
└── package.json                # Dependencias y scripts de ejecución
```

---

## 4. Puntos de Entrada y Flujo Estructural

1. **Punto de Entrada Primario ([app/_layout.tsx](file:///home/manuqc98/reposPersonales/letterwatch/app/_layout.tsx)):**
   - Detecta el esquema de color del sistema (`useColorScheme`).
   - Envuelve la aplicación en `PaperProvider` (tema Material 3) y `ThemeProvider` (`@react-navigation/native`).
   - Monta el `SnackbarProvider` global.
   - Declara la pila (`Stack`) nativa donde `(tabs)` es la ruta principal, y `onboarding` y `settings` se apilan por encima sin barra de navegación inferior.

2. **Control de Acceso y Tabs ([app/(tabs)/_layout.tsx](file:///home/manuqc98/reposPersonales/letterwatch/app/(tabs)/_layout.tsx)):**
   - Instancia el `WatchlistProvider`, que comparte la lógica entre las tres pestañas.
   - Actúa como guardia de navegación: si no hay usuario o plataformas configuradas, redirige inmediatamente a `/onboarding`.
   - Renderiza la barra inferior de navegación `BottomNavigation.Bar` de React Native Paper conectada al router.

3. **Capa de Estado Centralizada ([src/context/WatchlistContext.tsx](file:///home/manuqc98/reposPersonales/letterwatch/src/context/WatchlistContext.tsx)):**
   - Gestiona el ciclo de vida del escaneo, la carga de datos desde `AsyncStorage`, y calcula de forma reactiva en memoria las colecciones `readyMovies`, `newsMovies` y `leavingMovies`.
