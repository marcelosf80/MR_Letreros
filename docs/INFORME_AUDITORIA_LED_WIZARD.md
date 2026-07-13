# 📔 INFORME DE AUDITORÍA Y OPTIMIZACIÓN — LED WIZARD

**Fecha:** Junio 2026  
**Estado:** Reporte de Auditoría Técnico  

---

## 🔍 1. COMPONENTES ANALIZADOS
1.  **Frontend (`public/js/led-wizard/led-wizard-main.js`)**: Lógica de interacción con Fabric.js, manejo del z-index, emulación de auras, llamadas al backend y análisis visual con Gemini API.
2.  **Backend (`backend/main.py`)**: API de FastAPI para cálculos vectoriales de grids y centerlines utilizando Shapely 2.0 y NumPy.

---

## 🐞 2. HALLAZGOS Y BUGS DETECTADOS

### 🔴 Bug A: Desplazamiento y Rechazo de Módulos LED bajo Zoom/Pan
*   **Problema**: Cuando el canvas de Fabric.js tiene zoom o desplazamiento (pan), los módulos LED y las auras se generan en posiciones incorrectas o se descartan casi en su totalidad.
*   **Causa Raíz**: 
    1.  `scalePxPerCm` se calcula dividiendo el ancho de `group.getBoundingRect()` por el tamaño real en cm. Sin embargo, `getBoundingRect()` incluye la transformación del viewport (zoom), haciendo que la escala crezca artificialmente.
    2.  Debido a esto, el backend recibe dimensiones en píxeles de viewport y devuelve las posiciones en píxeles de viewport.
    3.  Al intentar validar e insertar estos puntos mediante `getBoundingRect()` del padre (que está en coordenadas de viewport) y compararlos con las posiciones lógicas del canvas en la validación fina de `_calculateOnBackend`, se produce una discrepancia matemática que causa el descarte masivo (`rejected++`).
*   **Solución**: 
    - Convertir las coordenadas devueltas por el backend (que están en el espacio del viewport/escala física) a coordenadas lógicas del canvas aplicando la matriz inversa del viewport transform: `fabric.util.transformPoint({ x, y }, fabric.util.invertTransform(canvas.viewportTransform))`.

### 🔴 Bug B: Desfase del trazado de Neon Flex
*   **Problema**: Las líneas de Neon Flex aparecen dibujadas fuera del contorno visual de las letras.
*   **Causa Raíz**: El código actual intenta calcular la posición absoluta extrayendo el path y usando una transformación personalizada construida manualmente en base a `_getCenterTransformMatrix`. Sin embargo, esto no conserva los desplazamientos internos del path original (`minX`, `minY` y alineación del origen).
*   **Solución**: 
    - Realizar una clonación exacta del objeto mediante `fabricObj.clone()` y luego reasignar sus propiedades absolutas de transformación (`left`, `top`, `scaleX`, `scaleY`, `angle`, `skewX`, `skewY`) descomponiendo su matriz de transformación acumulada real (`calcTransformMatrix`) con `fabric.util.qrDecompose`.

### 🟡 Optimización C: Carga Dinámica de API Keys
*   **Problema**: La API key para Gemini Vision usa un valor fijo de fallback si `window.GEMINI_API_KEY` está vacío.
*   **Solución**: Forzar la obtención asíncrona desde el endpoint `/api/config/gemini-key` provisto por `server.js` y sanitizar la respuesta de Gemini Vision utilizando `responseMimeType: "application/json"` nativo.

---

## 🛠️ 3. PLAN DE TRABAJO ESTRUCTURADO (GOAL)
El roadmap y PRD del proyecto han sido actualizados para guiar de forma autónoma la ejecución:
1.  **Fase 1**: Corrección física de coordenadas de colocación en `crearLed` y clonación nativa corregida en `calcularNeon`.
2.  **Fase 2**: Integración segura de credenciales y depuración de la respuesta de Gemini Vision.
3.  **Fase 3**: Pruebas de renderizado y ordenamiento jerárquico de capas.
