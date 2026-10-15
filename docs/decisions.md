# Registro de Decisiones de Arquitectura (ADR) - LetterWatch

Este documento registra las decisiones técnicas clave tomadas durante el desarrollo de **LetterWatch**, su contexto, justificación y alternativas descartadas.

---

### ADR-001: Scraping en Cliente con Axios y Cheerio en lugar de Backend Intermediario
* **Estado:** Aceptado
* **Contexto:** Letterboxd no dispone de una API pública abierta para usuarios de nivel estándar ni permite autenticación OAuth directa para extraer watchlists de terceros. Se requería una forma de obtener las películas de la lista del usuario.
* **Decisión:** Implementar el scraping directamente en el cliente nativo mediante [axios](https://axios-http.com/) y [cheerio](https://cheerio.js.org/).
* **Alternativas descartadas:**
  * *Crear un servidor backend (Node.js / Python / Go / Supabase)*: Añadiría costes de servidor, mantenimiento de infraestructura, gestión de tráfico y posibles bloqueos masivos por IP compartida en Letterboxd. Al hacerlo en cliente, cada usuario realiza peticiones con su propia conexión de datos/Wi-Fi.
* **Consecuencias:** No funciona en entorno web (`expo start --web`) por restricciones CORS del navegador, pero funciona perfectamente en compilaciones móviles Android e iOS.

---

### ADR-002: TMDB como Fuente Primaria de Disponibilidad y Metadatos
* **Estado:** Aceptado
* **Contexto:** Se requiere conocer qué plataformas de streaming tienen incluida cada película en España (`ES`), además de obtener el póster oficial, año, géneros y nota del público.
* **Decisión:** Emplear la API pública de **The Movie Database (TMDB)** (`/movie/{id}?append_to_response=watch/providers`).
* **Justificación:** TMDB integra directamente los datos sindicados de JustWatch para streaming internacional, ofrece una API REST documentada, notas de usuarios, pósters en diversas resoluciones y soporte para agrupar llamadas con `append_to_response`.
* **Consecuencias:** Requiere una clave de API pública gratuita de TMDB configurada en las variables de entorno (`EXPO_PUBLIC_TMDB_API_KEY`).

---

### ADR-003: Uso de la API GraphQL no oficial de JustWatch para Novedades y Salidas
* **Estado:** Aceptado
* **Contexto:** La API pública de TMDB solo indica disponibilidad actual (sí/no), pero **no** expone las fechas en las que una película llega a una plataforma o la fecha exacta en la que dejará de estar disponible.
* **Decisión:** Consultar en paralelo el endpoint GraphQL de JustWatch (`https://apis.justwatch.com/graphql`) para alimentar las pantallas "News" (últimos 14 días) y "WatchOut" (próximos 30 días).
* **Justificación:** Permite ofrecer funcionalidades de alto valor añadido (alertas de "se va pronto" y novedades recientes) sin obligar al usuario a pagar suscripciones premium ni levantar servidores propios.
* **Consecuencias:** La integración debe ser ultra-defensiva: timeout corto (8s) y arquitectura tolerante a fallos para que cualquier cambio o caída en JustWatch nunca comprometa la pestaña principal `Ready to watch`.

---

### ADR-004: Caché Local en AsyncStorage con Render Progresivo
* **Estado:** Aceptado
* **Contexto:** Escanear hasta 280 películas contra Letterboxd y TMDB toma tiempo. Si el usuario tuviera que esperar un escaneo completo cada vez que abre la app, la experiencia sería inusable.
* **Decisión:**
  1. Almacenar el resultado en `@react-native-async-storage/async-storage`.
  2. Implementar **búsqueda incremental**: el `tmdbId` de una película se reutiliza y no se vuelve a buscar en TMDB en escaneos futuros.
  3. **Renderizado progresivo**: la interfaz se llena inmediatamente con las películas que ya estaban en caché y se va actualizando en lotes de 20 (`BATCH_SIZE`) a medida que se completan las consultas.
* **Alternativas descartadas:**
  * *SQLite local (`expo-sqlite`)*: Descartado temporalmente por simplicidad de implementación y suficiente rendimiento con el volumen actual de datos (< 300 elementos).

---

### ADR-005: Desacoplamiento de la Selección de Plataformas del Proceso de Escaneo
* **Estado:** Aceptado
* **Contexto:** En aplicaciones similares, cambiar las plataformas contratadas obliga a re-escanear o re-consultar la API.
* **Decisión:** En la caché local se persisten **todos** los proveedores flatrate que tiene la película en España. El filtrado contra las plataformas activadas por el usuario se evalúa dinámicamente en memoria mediante selectores `useMemo` (`matchPlatforms`).
* **Justificación:** Cuando el usuario cambia sus plataformas en Ajustes (o selecciona géneros en el feed), el catálogo se actualiza a 60 FPS de forma instantánea sin peticiones de red ni latencias.

---

### ADR-006: Expo Router con Guardia de Autenticación en Layout
* **Estado:** Aceptado
* **Contexto:** La app requiere onboarding inicial (introducir usuario y plataformas) y no debe permitir el acceso a las pantallas principales si faltan estos datos.
* **Decisión:**
  * Colocar el guard en `app/(tabs)/_layout.tsx` mediante comprobación de `configured` y `<Redirect href="/onboarding" />`.
  * Mantener `onboarding` y `settings` en el `Stack` raíz, fuera de `(tabs)`.
* **Justificación:** Permite que las pantallas de ajustes y bienvenida se apilen por encima de la barra de navegación inferior (`BottomNavigation`), aprovechando el comportamiento nativo del botón atrás de Android y gestos de iOS.

---

### ADR-007: Material Design 3 con Semilla Tonal Naranja Letterboxd
* **Estado:** Aceptado
* **Contexto:** Se buscaba una identidad visual limpia, moderna y con soporte consistente para modo claro y oscuro.
* **Decisión:**
  * Emplear `react-native-paper` con especificación Material Design 3.
  * Usar `@material/material-color-utilities` para generar automáticamente la paleta tonal light/dark completa partiendo del color corporativo naranja de Letterboxd (`#FF8000`).
* **Justificación:** Coherencia cromática con la marca de Letterboxd, adaptación automática al tema del sistema operativo y cumplimiento estricto de contrastes de accesibilidad WCAG.
