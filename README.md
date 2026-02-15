# 🎨 MR LETREROS v2.0 - Sistema Completo

## ✨ Sistema Integral de Gestión de Letreros

**Versión:** 2.0 Final  
**Fecha:** 13 de Febrero de 2026  
**Estado:** Producción Ready ✅

---

## 🎯 CARACTERÍSTICAS PRINCIPALES

### 📊 Módulos Incluidos:

1. **🟢 Sistema Gremio** - Cotizaciones con precios mayoristas
2. **🔵 Sistema Clientes** - Cotizaciones con precios públicos
3. **🔨 Gestión de Trabajos** - Trabajos aprobados con notificaciones
4. **👥 Gestión de Clientes** - CRUD completo con sistema de rating ⭐
5. **💰 Gestión de Precios** - Precios Gremio y Cliente
6. **💳 Gestión de Costos** - Costos de materiales y servicios
7. **📦 Gestión de Materiales** - Inventario de rollos
8. **🔧 Gestión de Terceros** - Servicios externos
9. **📊 Rendimientos** - Análisis financiero
10. **✏️ Visor de Vectores** - Calcular perímetros

### 🌟 NUEVAS CARACTERÍSTICAS v2.0:

#### Sistema de Rating de Clientes:
- ⭐ Calificación automática 1-5 estrellas
- Categorías: VIP, Premium, Bueno, Regular, Nuevo
- Basado en: Monto facturado, Cantidad de trabajos, Frecuencia
- Estadísticas visuales por cliente

#### Búsqueda Mejorada:
- 🔍 Botón de búsqueda dedicado
- Búsqueda multi-campo
- Búsqueda por categorías (VIP, Premium, etc.)
- Filtros por tipo y estado

#### Navegación Universal:
- 📱 Sidebar lateral en todos los módulos
- Logo y marca siempre visible
- Información de contacto accesible
- 100% Responsive

#### Correcciones Críticas:
- ✅ Costos calculados correctamente
- ✅ Rendimientos con datos reales
- ✅ Gestión de clientes funcional
- ✅ m² mostrados sin formato de moneda

---

## 🚀 INSTALACIÓN

### Requisitos:

- Node.js 14+
- npm o yarn
- Windows/Linux/Mac

### Paso 1: Descomprimir

```bash
unzip mr_letreros_completo.zip
cd mr_letreros_completo
```

### Paso 2: Instalar Dependencias

```bash
npm install express cors
```

### Paso 3: Crear Estructura de Datos

```bash
mkdir -p datos_mr_letreros/gremio
mkdir -p datos_mr_letreros/clientes
```

### Paso 4: Iniciar Servidor

```bash
node server.js
```

### Paso 5: Abrir en Navegador

```
http://localhost:3000
```

---

## 📁 ESTRUCTURA DEL PROYECTO

```
mr_letreros_completo/
├── server.js                    # Servidor Node.js
├── package.json                 # Dependencias
├── README.md                    # Este archivo
├── CHANGELOG.md                 # Historial de cambios
├── datos_mr_letreros/          # Datos JSON
│   ├── gremio/
│   │   ├── clientes.json
│   │   └── cotizaciones.json
│   ├── clientes/
│   │   ├── clientes.json
│   │   └── cotizaciones.json
│   ├── clientes.json           # Base de clientes
│   ├── trabajos.json           # Trabajos aprobados
│   ├── gremio_precios_db.json  # Precios
│   ├── gremio_costos_db.json   # Costos
│   └── ...
└── public/
    ├── index.html              # Página principal
    ├── gremio.html             # Sistema Gremio
    ├── clientes.html           # Sistema Clientes
    ├── trabajos.html           # Gestión de trabajos
    ├── clientes-gestion.html   # Gestión de clientes ⭐
    ├── precios.html            # Gestión de precios
    ├── costos.html             # Gestión de costos
    ├── materiales.html         # Gestión de materiales
    ├── terceros.html           # Gestión de terceros
    ├── rendimientos.html       # Rendimientos
    ├── css/
    │   ├── base.css            # Estilos base
    │   └── sidebar-universal.css  # Sidebar ⭐
    ├── js/
    │   ├── shared/             # Módulos compartidos
    │   │   ├── data-manager-network.js
    │   │   ├── data-manager-extension.js
    │   │   ├── sidebar-universal.js  ⭐
    │   │   └── ...
    │   ├── gremio/
    │   │   └── gremio-main.js
    │   ├── clientes/
    │   │   └── clientes-main.js
    │   ├── clientes-gestion/   ⭐
    │   │   └── clientes-gestion-main.js
    │   └── ...
    └── img/
        └── logo.png
```

---

## 🎨 MÓDULOS DETALLADOS

### 1. Sistema Gremio (gremio.html)

**Funcionalidades:**
- Cotizaciones con precios mayoristas
- Descuentos configurables
- Cálculo de costos y ganancias
- Gestión de terceros integrada
- Exportación a PDF
- Notificaciones de trabajos

**Flujo:**
1. Seleccionar cliente
2. Agregar productos (con dimensiones)
3. Agregar terceros (opcional)
4. Aplicar descuentos
5. Guardar cotización
6. Aprobar → Envía a Trabajos

### 2. Sistema Clientes (clientes.html)

**Similar a Gremio pero con:**
- Precios públicos (mayores)
- IVA incluido
- Sin descuentos por defecto

### 3. Gestión de Clientes (clientes-gestion.html) ⭐ NUEVO

**Funcionalidades:**
- CRUD completo de clientes
- Sistema de rating automático (1-5 estrellas)
- Búsqueda mejorada con botón dedicado
- Estadísticas por cliente:
  - Total facturado
  - Cantidad de trabajos
  - Frecuencia de compra
- Categorías: VIP, Premium, Bueno, Regular, Nuevo
- Ordenamiento por: Rating, Facturación, Nombre, Fecha
- Filtros por: Tipo, Estado
- Dashboard con estadísticas globales

**Sistema de Rating:**
```
Puntos totales (máx 5):
├─ Monto facturado (máx 2 pts)
├─ Cantidad trabajos (máx 2 pts)
└─ Frecuencia compra (máx 1 pt)

Categorías:
├─ ⭐ VIP:      4.5 - 5.0
├─ ✨ Premium:  3.5 - 4.4
├─ 👍 Bueno:    2.5 - 3.4
├─ 👌 Regular:  1.5 - 2.4
└─ 🆕 Nuevo:    0.0 - 1.4
```

### 4. Gestión de Trabajos (trabajos.html)

**Funcionalidades:**
- Ver trabajos aprobados
- Sistema de notificaciones
- Filtros por estado
- Desglose de costos
- Botón condicional de borrado
- Integración con rendimientos

### 5. Rendimientos (rendimientos.html)

**Corregido v2.0:**
- Suma correcta de ingresos
- Solo cuenta cotizaciones aprobadas
- Usa `totalCliente` (con IVA)
- Gastos configurables
- Ganancia neta
- Margen porcentual

### 6. Gestión de Precios (precios.html)

**Funcionalidades:**
- Precios Gremio y Cliente
- Categorías de materiales
- Actualización masiva
- Importación/Exportación

### 7. Gestión de Costos (costos.html)

**Funcionalidades:**
- Costos de materiales
- Costos de mano de obra
- Costos de terceros
- Actualización individual

### 8. Gestión de Materiales (materiales.html)

**Funcionalidades:**
- Inventario de rollos
- Control de stock
- Alertas de bajo stock
- Historial de movimientos

### 9. Gestión de Terceros (terceros.html)

**Funcionalidades:**
- Lista de proveedores
- Servicios ofrecidos
- Costos y precios
- Contactos

### 10. Visor de Vectores (vector/index.html)

**Funcionalidades:**
- Subir archivos SVG
- Calcular perímetros
- Visualización

---

## 🔧 CONFIGURACIÓN

### Variables de Entorno:

```javascript
// En server.js
const PORT = 3000;
const BASE_PATH = 'C:\\MR_Letreros';
```

### Rutas de Datos:

```javascript
const DATA_DIR = path.join(BASE_PATH, 'datos_mr_letreros');
const PUBLIC_DIR = path.join(BASE_PATH, 'public');
```

### Personalización del Sidebar:

Editar `public/js/shared/sidebar-universal.js`:

```javascript
const SIDEBAR_CONFIG = {
  companyName: 'MR Letreros',     // Tu empresa
  tagline: 'Sistema de Gestión',  // Tu slogan
  logo: 'img/logo.png',           // Tu logo
  
  companyInfo: {
    phone: '📞 Tu teléfono',
    email: '✉️ Tu email',
    location: '📍 Tu ciudad'
  }
};
```

---

## 🧪 TESTING

### Test de Instalación:

```bash
# 1. Servidor inicia sin errores
node server.js
# Debe mostrar: "✅ Servidor corriendo en http://localhost:3000"

# 2. Abrir en navegador
# Debe cargar index.html sin errores

# 3. Navegar a cada módulo
# Todos deben tener sidebar y funcionar
```

### Test de Funcionalidades:

**Gestión de Clientes:**
```
1. Ir a clientes-gestion.html
2. Click "➕ Nuevo Cliente"
3. Llenar datos y guardar
4. Verificar que aparece en lista
5. Verificar estadísticas actualizadas
```

**Sistema de Rating:**
```
1. Agregar trabajos a un cliente
2. Recargar gestión de clientes
3. Verificar rating calculado
4. Verificar estrellas visibles
```

**Búsqueda:**
```
1. Escribir nombre en barra de búsqueda
2. Click "🔍 Buscar"
3. Verificar filtrado correcto
4. Probar búsqueda por categoría: "vip"
```

---

## 📊 DATOS DE EJEMPLO

El sistema incluye datos de ejemplo en:
- `datos_mr_letreros/ejemplo_precios.json`
- `datos_mr_letreros/ejemplo_costos.json`

Para usar datos propios, editar los archivos JSON manualmente o usar las interfaces de gestión.

---

## 🔒 SEGURIDAD

- No hay autenticación implementada (añadir si se requiere)
- Los datos se guardan en archivos JSON locales
- Backups manuales recomendados
- No hay cifrado de datos

---

## 🚀 DESPLIEGUE EN PRODUCCIÓN

### Opciones:

1. **Servidor Local:**
   - Usar en red local
   - Acceder desde otras PCs con IP del servidor

2. **VPS/Cloud:**
   - Subir a servidor Linux
   - Configurar Nginx/Apache reverse proxy
   - Usar dominio propio

3. **Docker:**
   ```dockerfile
   FROM node:14
   WORKDIR /app
   COPY . .
   RUN npm install
   EXPOSE 3000
   CMD ["node", "server.js"]
   ```

---

## 🐛 TROUBLESHOOTING

### Problema: Servidor no inicia

**Solución:**
```bash
# Verificar Puerto ocupado
netstat -ano | findstr :3000

# Cambiar puerto en server.js
const PORT = 3001;
```

### Problema: Gestión de clientes no funciona

**Solución:**
```bash
# Verificar carpeta correcta
ls public/js/clientes-gestion/
# Debe mostrar: clientes-gestion-main.js

# Si tiene espacio, renombrar:
mv "public/js/clientes gestion" "public/js/clientes-gestion"
```

### Problema: Costos en $0

**Solución:**
- Verificar que `precios.json` tiene campo `costo`
- O agregar datos en `costos.json`
- El sistema usa estimación automática (60% del precio)

### Problema: Rating no se calcula

**Solución:**
- Verificar que existen trabajos en `trabajos.json`
- Verificar que nombres de clientes coinciden
- Ver logs en consola (F12)

---

## 📞 SOPORTE

### Logs del Sistema:

```bash
# Ver logs del servidor
node server.js

# Ver logs del navegador
F12 → Console
```

### Comandos Útiles:

```bash
# Reiniciar servidor
Ctrl+C
node server.js

# Limpiar caché navegador
Ctrl+Shift+R

# Ver estructura
tree public/

# Backup de datos
cp -r datos_mr_letreros datos_mr_letreros_backup
```

---

## 📝 CHANGELOG

### v2.0 (2026-02-13) - CURRENT
- ✅ Sistema de rating de clientes (1-5 estrellas)
- ✅ Búsqueda mejorada con botón dedicado
- ✅ Sidebar universal en todos los módulos
- ✅ Corrección de costos en clientes
- ✅ Corrección de rendimientos
- ✅ Gestión de clientes completa
- ✅ Todas las funcionalidades integradas

### v1.0 (2024-02-04)
- Sistema base con Gremio y Clientes
- Gestión de trabajos
- Precios y costos básicos

---

## 📄 LICENCIA

Uso interno - MR Letreros  
Todos los derechos reservados

---

## 👨‍💻 DESARROLLO

**Sistema desarrollado para:** MR Letreros  
**Tecnologías:** Node.js, Express, Vanilla JavaScript, CSS3, HTML5  
**Base de datos:** Archivos JSON  

---

## ✅ PRÓXIMOS PASOS

1. Importar tu logo en `public/img/logo.png`
2. Configurar información de empresa en sidebar
3. Agregar precios y costos iniciales
4. Crear clientes de prueba
5. Hacer primera cotización
6. ¡Empezar a usar el sistema!

---

**¡Gracias por usar MR Letreros v2.0!** 🎨✨

