# 📝 CHANGELOG - MR Letreros

## [2.0.0] - 2026-02-13 🌟 VERSIÓN ACTUAL

### ✨ Nuevas Características

#### Sistema de Rating de Clientes
- Calificación automática 1-5 estrellas
- Categorías: VIP (⭐), Premium (✨), Bueno (👍), Regular (👌), Nuevo (🆕)
- Algoritmo basado en: Monto total, Cantidad de trabajos, Frecuencia
- Visualización con estrellas en cada cliente
- Estadísticas por cliente: Total facturado, Trabajos, Frecuencia

#### Búsqueda Mejorada
- Botón "🔍 Buscar" dedicado
- Búsqueda multi-campo: Nombre, Teléfono, Email, CUIT, Dirección
- Búsqueda por categorías: "vip", "premium", "bueno", "gremio", "cliente"
- Enter para buscar
- Filtros por tipo y estado
- Botón "Limpiar" filtros

#### Navegación Universal
- Sidebar lateral en TODOS los módulos
- Logo y marca siempre visible
- Información de contacto de la empresa
- Estado colapsable (280px ↔ 70px)
- 100% Responsive con botón hamburguesa en móvil
- Navegación entre módulos en 1 click

#### Dashboard Mejorado
- Estadística "⭐ Clientes VIP" (4.5+ estrellas)
- Estadística "✅ Activos"
- Botones de ordenamiento: Rating, Facturación, A-Z, Fecha

### 🔧 Correcciones Críticas

#### Gestión de Clientes
- ✅ Carpeta renombrada correctamente (de "clientes gestion" a "clientes-gestion")
- ✅ Botones funcionan correctamente
- ✅ Modal abre y cierra
- ✅ CRUD completo operativo
- ✅ Inicialización automática

#### Costos en Clientes
- ✅ Búsqueda en múltiples fuentes (costos.json, precios.json)
- ✅ Campo `costo`, `costoGremio` como fallbacks
- ✅ Estimación automática (60% del precio)
- ✅ Logs detallados para debugging
- ✅ Costos YA NO aparecen en $0,00

#### Rendimientos
- ✅ Suma correcta de ingresos
- ✅ Solo cuenta cotizaciones aprobadas
- ✅ Usa `totalCliente` (con IVA incluido)
- ✅ Cálculo de ganancia correcto

#### Detalles de Productos
- ✅ m² mostrados sin formato de moneda
- ✅ Dimensiones: 1.00m (no $1,00m)
- ✅ Precio/m² con formato correcto

### 📦 Archivos Actualizados

**HTML:**
- index.html (menú desplegable)
- clientes-gestion.html (rating y búsqueda)
- gremio.html (sidebar)
- clientes.html (sidebar)
- trabajos.html (sidebar)
- precios.html (sidebar)
- costos.html (sidebar)
- materiales.html (sidebar)
- terceros.html (sidebar)
- rendimientos.html (sidebar)

**JavaScript:**
- clientes-gestion-main.js (sistema completo de rating)
- clientes-main.js (costos corregidos)
- gremio-main.js (detalles corregidos)
- rendimientos-main.js (cálculo corregido)
- sidebar-universal.js (nuevo)
- data-manager-extension.js (API clientes)

**CSS:**
- sidebar-universal.css (nuevo)
- base.css (actualizado)

**Backend:**
- server.js (endpoints de clientes)

---

## [1.5.0] - 2026-02-12

### 🔧 Correcciones
- Botón borrar condicional en trabajos
- Desglose de costos en trabajos
- Ver detalle en clientes y gremio

---

## [1.4.0] - 2026-02-11

### ✨ Nuevas Características
- Sistema de notificaciones en trabajos
- Integración de terceros en cotizaciones
- Materiales con inventario

---

## [1.3.0] - 2026-02-10

### 🔧 Correcciones
- Formato de moneda global
- Cálculos de precios mejorados

---

## [1.2.0] - 2026-02-09

### ✨ Nuevas Características
- PDF con notificaciones
- Sistema de trabajos aprobados

---

## [1.1.0] - 2026-02-06

### ✨ Nuevas Características
- Sistema multi-categoría
- Gestión de precios y costos

---

## [1.0.0] - 2024-02-04

### 🎉 Lanzamiento Inicial
- Sistema Gremio
- Sistema Clientes
- Cotizaciones básicas
- Gestión de materiales
- Interfaz inicial

---

**Formato de versiones:** [Major.Minor.Patch]
- Major: Cambios incompatibles
- Minor: Nuevas características compatibles
- Patch: Correcciones de bugs
