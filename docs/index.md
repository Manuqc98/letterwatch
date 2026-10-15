# Project Documentation Index - LetterWatch 🍿

Este catálogo indexa la documentación viva de contexto de **LetterWatch** para agentes de IA y desarrolladores. Consulta los archivos correspondientes según el alcance de tu tarea:

| Documento | Descripción / Alcance | Cuándo consultarlo |
| :--- | :--- | :--- |
| [architecture.md](./architecture.md) | Propósito del proyecto, stack técnico (Expo SDK 54, React Native, React 19, Paper M3), mapa de directorios y entry points. | Al iniciar una sesión de trabajo o planificar modificaciones estructurales en la app. |
| [flows.md](./flows.md) | Flujos paso a paso: Onboarding guard, escaneo incremental de Letterboxd/TMDB/JustWatch, filtrado dinámico en memoria y deep linking. | Al implementar, refactorizar o depurar pantallas, lógica de negocio o servicios de datos. |
| [limitations-and-gotchas.md](./limitations-and-gotchas.md) | Restricciones de scraping (280 películas máx), región fija ES, CORS web, API GraphQL de JustWatch, desfase de fechas y salvaguarda `cacheEpoch`. | **Siempre** antes de tocar lógica de sincronización, storage, componentes de cuadrícula o asumir comportamientos. |
| [decisions.md](./decisions.md) | Registro de Decisiones de Arquitectura (ADRs): scraping en cliente, TMDB + JustWatch, render progresivo, filtrado reactivo y Material 3. | Al proponer nuevas dependencias, rediseños de navegación o cambios en la estrategia de persistencia y APIs. |
