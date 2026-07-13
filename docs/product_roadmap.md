# Hoja de Ruta del Proyecto - Optimización LED Wizard

## Fase 1: Corrección de Coordenadas y Posicionamiento
- [x] Fix `crearLed` y `crearAura` aplicando la matriz de transformación inversa del viewport transform (`canvas.viewportTransform`) para posicionamiento con zoom/pan.
- [x] Fix en la comparación de BBox en `_calculateOnBackend` convirtiendo las coordenadas de validación para evitar rechazos de LEDs falsos positivos.
- [x] Fix `calcularNeon` clonando y reposicionando con `qrDecompose` sobre el canvas absoluto.

## Fase 2: Integración y Optimización de Gemini AI
- [x] Asegurar que `analizarConIA` use la clave API cargada dinámicamente desde `/api/config/gemini-key`.
- [x] Refactorizar el prompt de análisis visual para usar JSON estructurado nativo con Gemini 2.0 Flash.

## Fase 3: Validación Visual y Despliegue
- [x] Validar importación de SVG plano, poblamiento con zoom/pan activo y renderizado de capas.
- [x] Verificar el z-index de los componentes (letras en el fondo, seguidas de neon, cables, módulos y fuentes).
