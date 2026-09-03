# LetterWatch (Letterboxd Upgrade) 🍿

**LetterWatch** es una aplicación móvil que resuelve un problema muy común para los usuarios de **Letterboxd**: tener una Watchlist enorme y no saber en qué plataforma de streaming vienen incluidas cada película.

## 💡 El Problema

Los usuarios de Letterboxd añaden cientos de películas a su "Watchlist" (Lista de seguimiento). Sin embargo, cuando llega la noche y quieren ver algo, el filtrado que te ofrece letterboxd por plataforma no funciona correctamente y en ocasiones son de alquiler.

## 🎯 La Solución a Alto Nivel (Qué hace la App)

LetterWatch automatiza este proceso:

1. **Conexión con Letterboxd:** La app hace "scraping" de la Watchlist pública del usuario introducido (Letterboxd no tiene API pública abierta).
2. **Cruce de Datos (TMDB):** Por cada película de la Watchlist, se consulta la API de _The Movie Database (TMDB)_ (que incluye datos de JustWatch) para saber en qué plataformas está disponible en España (`ES`).
3. **Filtrado Inteligente:** Se guardan **todas** las plataformas "Flatrate" (incluidas gratis con la suscripción, sin alquilar) de cada película, y la app filtra al pintar la lista según las plataformas que el usuario ha marcado que posee. Por eso cambiar de plataformas en Ajustes surte efecto al instante, sin re-escanear.
4. **Almacenamiento Local (Caché):** Los resultados se guardan en la memoria del teléfono (`AsyncStorage`). El usuario no espera a que se procese toda la lista cada vez que abre la app; cuando los datos tienen más de 7 días, la app sugiere actualizar. Además, el escaneo es incremental: las películas ya identificadas en TMDB no se vuelven a buscar.

## 📱 Flujo del Usuario

- **Primera vez (Onboarding):** El usuario introduce su nombre de usuario de Letterboxd y activa los "switches" de las plataformas que paga (Ej: Netflix, Movistar Plus+, HBO Max...).
- **Pantalla Principal (Feed):** El usuario ve una cuadrícula con los pósters de las películas que sí puede ver hoy mismo, con los logos de la(s) plataforma(s) donde están. Tocar un póster abre la ficha de la película en la app de Letterboxd (o en la web si no está instalada).
- **Actualización:** Como el catálogo cambia, el usuario puede pulsar un botón para volver a escanear su lista y actualizar los datos.
- **Ajustes:** Si el usuario se da de baja de Netflix y se suscribe a Filmin, puede cambiarlo en los ajustes y el filtro se aplica al momento.

## 📺 Plataformas soportadas

Netflix, Amazon Prime Video, Disney+, HBO Max, SkyShowtime, Movistar Plus+, Apple TV, Filmin y YouTube (región España). Añadir más es trivial: basta con añadir una entrada con su ID de TMDB en `src/constants/platforms.ts`.

## 🛠️ Stack Tecnológico

- **Frontend:** React Native + Expo SDK 54 (Expo Router).
- **UI:** `react-native-paper` (Material 3) con tema light/dark generado desde un color semilla (`@material/material-color-utilities`, semilla naranja Letterboxd en `src/constants/theme.ts`).
- **Scraping:** `axios` (peticiones HTTP) + `cheerio` (parseo de HTML).
- **API Externa:** TMDB API (The Movie Database).
- **Almacenamiento:** `@react-native-async-storage/async-storage`.

## 🚀 Cómo ejecutar

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Consigue una API key gratuita de TMDB (https://www.themoviedb.org/settings/api) y crea un fichero `.env` en la raíz:
   ```
   EXPO_PUBLIC_TMDB_API_KEY=tu_api_key_aqui
   ```
3. Arranca el proyecto y ábrelo con Expo Go (o un emulador):
   ```bash
   npx expo start
   ```

> **Nota:** la app debe probarse en dispositivo o emulador. En el navegador (`expo start --web`) el scraping de Letterboxd falla por CORS.

## 📲 Instalar como app (Android, sin PC)

Con **EAS Build** (gratis) se compila en la nube un APK que se instala como una app normal:

1. Crea una cuenta gratis en https://expo.dev e inicia sesión:
   ```bash
   npx eas-cli login
   ```
2. Registra la API key de TMDB como variable de entorno de EAS (el `.env` está en `.gitignore` y **no** se sube al build). Solo hace falta una vez:
   ```bash
   npx eas-cli env:create --scope project --name EXPO_PUBLIC_TMDB_API_KEY --environment preview --environment production
   ```
   (pega el valor de tu `.env` cuando lo pida)
3. Lanza el build (la primera vez pregunta si crear el proyecto y genera el keystore: acepta los valores por defecto):
   ```bash
   npx eas-cli build --platform android --profile preview
   ```
4. Cuando termine (~10-20 min en la cola gratuita), abre el enlace del build desde el móvil, descarga el APK e instálalo (Android pedirá permitir "instalar apps desconocidas").

Cada cambio futuro en el código requiere repetir el paso 3 e instalar el APK nuevo.

## ⚠️ Limitaciones conocidas

- El scraping depende del HTML de Letterboxd: si cambian su markup, hay que actualizar los selectores en `src/services/letterboxd.ts`.
- Se analizan como máximo 10 páginas de la watchlist (280 películas). Si tu lista es mayor, la app te avisa de que está truncada.
- La región de streaming está fijada a España (`ES`) en `src/services/tmdb.ts`.
- La API key de TMDB va empaquetada en el cliente (prefijo `EXPO_PUBLIC_`): no subas tu `.env` a ningún repositorio (ya está en `.gitignore`).
