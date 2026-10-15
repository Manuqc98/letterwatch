# Limitaciones Conocidas, Gotchas y Deuda Técnica - LetterWatch

Este documento reúne las restricciones de diseño, comportamientos no evidentes, dependencias frágiles y advertencias críticas que cualquier desarrollador o agente de IA debe conocer antes de realizar cambios en el código.

---

## 1. Cosas a las que no se llega (Limitaciones Funcionales)

1. **Scraping sin API Oficial de Letterboxd:**
   * Letterboxd no cuenta con una API pública abierta para desarrolladores individuales. La extracción se realiza mediante scraping HTML del DOM público (`https://letterboxd.com/{user}/watchlist/page/{n}/`).
   * **Tope de 280 películas:** Se analizan como máximo 10 páginas (28 páginas por película = 280 títulos). Si el usuario tiene una watchlist superior, la aplicación procesa únicamente las primeras 280 y muestra un aviso visual de lista truncada (`truncated: true`).
   * **Listas privadas:** No se puede acceder a watchlists privadas o cuentas protegidas.
2. **Región fijada a España (`ES`):**
   * Toda la lógica de proveedores de TMDB (`watch/providers` con región `ES`) y JustWatch está cableada al catálogo español. No hay selector de país ni soporte multi-región internacional en la versión actual.
3. **Incompatibilidad con Web (`expo start --web`):**
   * Las peticiones HTTP realizadas directamente desde el navegador web hacia `letterboxd.com` son bloqueadas por políticas de **CORS**. La aplicación está concebida exclusivamente para entornos nativos móviles (Android / iOS con Expo Go o compilación nativa EAS).
4. **Exclusivo para Películas:**
   * No existe soporte para series de televisión o documentales por episodios. Los filtros de JustWatch y TMDB descartan explícitamente formatos distintos de largometraje (`MOVIE`).

---

## 2. Gotchas y Supuestos Técnicos (Comportamientos no evidentes)

### A. API GraphQL no oficial de JustWatch
* La aplicación consulta el endpoint privado de JustWatch (`https://apis.justwatch.com/graphql`) sin autenticación.
* **Gotcha:** Este endpoint puede cambiar de esquema o aplicar protecciones sin previo aviso.
* **Mitigación en código:** Se aplica un timeout estricto de 8 segundos (`TIMEOUT_MS = 8000`) y degradación tolerante a fallos: si JustWatch falla, las pestañas `News` y `WatchOut` muestran datos cacheados o un estado vacío con advertencia, **sin impedir jamás que la pestaña principal `Ready to watch` funcione con normalidad**.
* **Gotcha de IDs de series:** JustWatch a veces clasifica contenido mixto o envía IDs con sintaxis `12345:2` (id:temporada). [src/services/justwatch.ts](file:///home/manuqc98/reposPersonales/letterwatch/src/services/justwatch.ts) descarta explícitamente cualquier identificador que contenga `:` o que no sea un entero positivo.

### B. Desfase de Zona Horaria en Fechas Date-Only
* Las fechas retornadas por JustWatch (`availableFromTime`, `availableTo`) vienen en formato ISO parcial o fecha pura `YYYY-MM-DD`.
* **Gotcha:** Parsear cadenas `YYYY-MM-DD` mediante `new Date(str)` en husos horarios occidentales interpreta la fecha como medianoche UTC, provocando que en husos locales negativos o positivos la fecha cambie de día (p. ej. mostrar 11 de septiembre en lugar de 12).
* **Solución:** Se implementó [fmtDay](file:///home/manuqc98/reposPersonales/letterwatch/src/context/WatchlistContext.tsx#L36-L39) que realiza manipulación directa de cadenas (`iso.slice(0, 10).split('-')`) evitando cualquier conversión por el motor de fecha de JavaScript.

### C. Condición de Carrera en Borrado de Datos (`cacheEpoch`)
* **Gotcha:** Un escaneo de watchlist puede tardar varios segundos. Si el usuario pulsa *"Borrar datos y cambiar usuario"* en Ajustes mientras un escaneo está en curso, la promesa de red podría resolver segundos más tarde y sobreescribir el almacenamiento con los datos del usuario recién borrado.
* **Solución:** [StorageService](file:///home/manuqc98/reposPersonales/letterwatch/src/services/storage.ts#L56-L61) implementa un contador en memoria `cacheEpoch`. Al iniciar el escaneo se guarda el epoch; si al terminar el escaneo el epoch ha variado (porque se llamó a `clearAll()`), los datos se descartan silenciosamente y no se guardan en `AsyncStorage`.

### D. Rate Limiting de TMDB (HTTP 429)
* TMDB permite aproximadamente 40-50 peticiones por segundo. Con lotes de 20 películas simultáneas se mantiene un margen seguro, pero pueden producirse picos.
* **Solución:** [src/services/tmdb.ts](file:///home/manuqc98/reposPersonales/letterwatch/src/services/tmdb.ts#L23-L35) intercepta errores `429`, lee el encabezado `retry-after` y espera el tiempo correspondiente antes de reintentar la llamada. Si la llamada reintentada fallara, la película conserva sus datos previos en lugar de marcarse como "no disponible".

### E. Exposición de Clave TMDB en Cliente
* La variable `EXPO_PUBLIC_TMDB_API_KEY` se inyecta en tiempo de compilación en el bundle de JavaScript público. Se debe asumir que cualquier usuario técnico puede extraer esta clave del paquete APK/AAB. Es una clave pública de solo lectura para TMDB, pero no deben almacenarse claves privadas o de pago con este mecanismo.

---

## 3. Deuda Técnica

1. **Script innecesario `scripts/reset-project.js`:**
   * Es un archivo residual del template original de Expo. No tiene uso en la aplicación y puede ser eliminado en futuras limpiezas sin afectar a la funcionalidad.
2. **Fragilidad de Selectores HTML en Letterboxd:**
   * El scraper depende de que Letterboxd mantenga la clase `li.griditem div.react-component[data-item-slug]` y los atributos `data-item-name`. Si Letterboxd rediseña su frontend o implementa un challenge anti-bot (Cloudflare Turnstile), el servicio dejará de extraer datos.
3. **Caché en JSON monobloque:**
   * Toda la lista de películas cacheadas se almacena serializada en una única entrada de `AsyncStorage` (`@letterwatch_cache`). Para 280 películas el tamaño es pequeño (< 100 KB), pero un modelo relacional (SQLite con `expo-sqlite`) sería más robusto si el volumen aumentara.

---

## 4. Advertencias Críticas para Agentes de IA

> [!IMPORTANT]
> **Expo SDK 54**: Este proyecto utiliza Expo SDK 54 con React 19. Consulta siempre la documentación oficial versionada en https://docs.expo.dev/versions/v54.0.0/. No utilices APIs obsoletas de versiones anteriores.

> [!WARNING]
> **No mover el filtrado de plataformas al escaneo:**
> La app guarda **todos** los proveedores flatrate de cada película en la caché local. El filtrado contra `userPlatforms` se realiza **estrictamente en memoria al renderizar** (mediante selectores en `WatchlistContext.tsx`). Esto permite que cuando el usuario activa o desactiva Netflix o HBO en Ajustes, el cambio sea instantáneo sin volver a consultar TMDB ni re-escanear.

> [!CAUTION]
> **No modificar el cálculo de ancho en `MovieGrid.tsx`:**
> Las tarjetas en `MovieGrid` usan un ancho explícito en píxeles (`cardWidth = Math.floor(...)`). **No** reemplaces esto por `flex: 1` en las columnas, ya que provocaría que la última fila (cuando tiene 1 o 2 películas) se ensanche horizontalmente deformando la relación de aspecto del póster.
