# Especificación de Diseño Visual - MR Letreros

## 1. Identidad Visual y Paleta de Colores
El diseño debe transmitir profesionalismo, precisión y modernidad.
- **Color Primario (Gremio/General)**: Azul moderno (#0d6efd o HSL con alta saturación).
- **Color Secundario (Clientes)**: Verde/Cyan vibrante.
- **Fondo**: Modos oscuros elegantes combinados con componentes de tipo glassmorphism o tarjetas con bordes suaves.
- **Tipografía**: Fuentes sin serifa limpias (Inter, Roboto, u Outfit) integradas desde Google Fonts.

## 2. Componentes Clave
- **Sidebar Universal**: Panel lateral izquierdo persistente y colapsable que unifica el acceso a todos los módulos (`public/js/shared/sidebar-universal.js`).
- **Tablas Dinámicas**: Para listados de clientes, cotizaciones y trabajos, con soporte de filtrado rápido y búsqueda en tiempo real.
- **Tarjetas de Estadísticas (KPIs)**: Indicadores visuales de facturación, trabajos pendientes y rating en la cabecera de los módulos.
- **Barra de Búsqueda**: Diseño prominente con botones de acción rápida.
- **Carga Asíncrona**: Spinners y transiciones suaves durante el renderizado de datos.
