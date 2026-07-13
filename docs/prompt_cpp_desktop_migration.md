# PROMPT TÉCNICO - Migración a Escritorio C++ (Qt 6) - MR Letreros

## Contexto del Proyecto
Este prompt describe los requisitos técnicos para construir la aplicación de escritorio nativa en C++ para **MR Letreros**. La aplicación migra el cotizador de vectores de su versión web (Fabric.js, Node.js) a un entorno nativo de alto rendimiento en Windows usando el framework **Qt 6**.

---

## Directrices de Arquitectura

### 1. Sistema de Construcción y Compilación
- **CMake**: Versión mínima `3.16`, configurado para compilar en C++17 o superior.
- **Framework UI**: Qt 6 (requiere componentes: Widgets, Gui, Core, OpenGLWidgets).
- **Librerías de Terceros**:
  - `ClipperLib` (C++): Versión nativa para compensación (offsetting) y unificación de curvas.

### 2. Conversión de Coordenadas de Diseño
En la versión web, Fabric.js maneja un canvas con coordenadas locales y mundiales modificadas por zoom y paneo. En Qt:
- **QGraphicsScene**: Representa el espacio lógico del plano en milímetros (mm).
- **QGraphicsView**: Administra el zoom (`scale()`) y paneo (`translate()`).
- **Punto de Inicio CNC (0,0)**: Posicionado en la esquina inferior izquierda (Y-up), a diferencia del origen de QGraphicsScene que por defecto usa Y-down. Debe hacerse la inversión de Y:
  $$Y_{\text{cnc}} = Alto_{\text{plancha}} - Y_{\text{pantalla}}$$

### 3. Fórmulas de Cotización Corpórea
La lógica en C++ debe implementar el cálculo exacto de costos y precios sugeridos:
- **Costo de Producción**:
  $$\text{Costo Total} = (\text{Área de Plancha} \times \text{Costo } m^2) + (\text{Cm Lineales de Corte} \times \text{Costo Corte/cm}) + \text{Mano de Obra}$$
- **Precio Venta Sugerido**:
  $$\text{Precio Sugerido} = (\text{Área de Plancha} \times \text{Costo } m^2 \times \text{Markup}) + (\text{Cm Lineales} \times \text{Precio Corte/cm}) + \text{Mano de Obra Venta}$$

### 4. Cálculo Proporcional Dinámico (Polifan)
El precio de corte lineal (`Precio Corte/cm`) para el material Polifan se calcula proporcionalmente en tiempo real basado en el costo de la placa seleccionada:
- **Referencia Base**: Polifan 30mm (Costo Placa: $2090, Precio Corte Lineal: $345).
- **Fórmula**:
  $$\text{Precio Corte/cm} = \text{Costo Placa Actual} \times \left(\frac{345}{2090}\right)$$

---

## Checklist de Implementación para Agentes

- [ ] Configurar el archivo `CMakeLists.txt` vinculando Qt 6 Core, Widgets, Gui y OpenGL.
- [ ] Implementar la clase `Calculator` con soporte de deserialización JSON para leer los costos predeterminados.
- [ ] Implementar un visor 2D nativo utilizando `QGraphicsView` y `QGraphicsScene` que permita cargar y dibujar rutas a partir de archivos vectoriales.
- [ ] Añadir soporte para el cálculo del perímetro de curvas compuestas (Bézier y rectas) en mm.
