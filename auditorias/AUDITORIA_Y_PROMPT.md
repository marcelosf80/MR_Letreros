# AUDITORÍA COMPLETA — ASISTENTE IA MR LETREROS v2.0
### + Prompt para corrección por otra IA

---

## PARTE 1 — LOS 6 BUGS QUE ESTABAN ROTOS

### Bug #1 — guardar_cliente ignoraba el tipo de cliente
El campo del servidor es `name` no `nombre`. Y todos iban siempre a `/api/clientes`.

**Fix:**
```javascript
const prefix = tipo === 'gremio' ? 'gremio_cli_' : 'cliente_cli_';
const endpoint = tipo === 'gremio' ? '/gremio/clientes' : '/clientes';
await apiPost(endpoint, { id: prefix + Date.now(), name: args.nombre, ... });
```

### Bug #2 — guardar_cotizacion nunca guardaba nada
Hacía `POST { type:'save_cotizacion', data:... }` — ese formato no existe en ningún endpoint.

**Fix:** POST directo el objeto cotización al endpoint correcto:
```javascript
const endpoint = tipo === 'gremio' ? '/gremio/data' : '/clientes/data';
await apiPost(endpoint, objetoCotizacionCompleto);
```

### Bug #3 — aprobar_cotizacion no existía
No había flujo para convertir cotización aprobada en trabajo de producción.

**Fix:** Nueva herramienta `aprobar_cotizacion` que: 1) marca la cot como aprobada, 2) crea el trabajo con todos los campos reales del dashboard.

### Bug #4 — Regex de API key Groq no matcheaba
Solo buscaba `process.env.X || 'gsk_...'` pero la key puede estar hardcodeada directo.

**Fix en server.js:**
```javascript
const m1 = botFile.match(/groqApiKey\s*:\s*(?:process\.env\.\w+\s*\|\|\s*)?['"]([^'"]{20,})['"]/);
const m2 = botFile.match(/(gsk_[a-zA-Z0-9_]{20,})/);
groqApiKey = (m1 && m1[1]) || (m2 && m2[1]);
```

### Bug #5 — Contexto de la IA no incluía cotizaciones pendientes
La IA no sabía qué cotizaciones había sin aprobar, ni cuántos clientes de cada tipo.

**Fix:** El systemPrompt ahora carga cotizaciones_clientes + cotizaciones_gremio + clientes separados por tipo.

### Bug #6 — loadSystemData no cargaba clientes de gremio
Solo cargaba `/api/clientes` pero no `/api/gremio/clientes`, entonces al buscar un cliente de gremio no lo encontraba.

**Fix:** `loadSystemData()` ahora carga `clientes_gremio` por separado.

---

## PARTE 2 — MAPA DE CAPACIDADES v2.0

| Instrucción | Herramienta | Qué hace |
|---|---|---|
| "Guardame cliente Juan, es de gremio" | `guardar_cliente` tipo=gremio | POST `/api/gremio/clientes` con ID `gremio_cli_XXX` |
| "Guardame cliente María, tel 1166..." | `guardar_cliente` tipo=cliente | POST `/api/clientes` con ID `cliente_cli_XXX` |
| "Cotizame un cartel de lona 300×100cm" | `cotizar_trabajo` | Busca precio fijo → $285.000 + anticipo |
| "Guardalo como cotización para Juan" | `guardar_cotizacion` | POST `/api/gremio/data` o `/api/clientes/data` |
| "La cotización de Juan fue aprobada" | `aprobar_cotizacion` | Aprueba cot + crea trabajo en producción |
| "Creá un trabajo para María, $150.000" | `crear_trabajo` | Trabajo directo en lista de producción |
| "Marcá trabajo de Juan como en proceso" | `actualizar_trabajo` | PUT `/api/trabajos/:id` status=in_progress |
| "Juan pagó $85.000" | `actualizar_trabajo` monto_pago | Actualiza paidAmount, balance, paymentStatus |
| "¿Qué trabajos hay pendientes?" | `consultar_trabajos` | Lista con estados, totales, fechas |
| "¿Hay cotizaciones sin aprobar?" | `consultar_cotizaciones` | Lista pendientes de ambos tipos |
| "¿Quién me debe plata?" | `consultar_morosos` | Lista con saldos y teléfonos |
| "Dame un resumen del negocio" | `resumen_negocio` | Facturación, activos, morosos, entregas |

---

## PARTE 3 — ARCHIVOS ENTREGADOS

| Archivo | Destino en el proyecto |
|---|---|
| `asistente.html` | `public/asistente.html` |
| `server.js` | `server.js` (raíz del proyecto) |

---

## PARTE 4 — PROMPT PARA OTRA IA CORRECTORA

```
ROL: Eres un desarrollador senior full-stack especializado en sistemas de gestión para PyMEs.

SISTEMA: MR Letreros — gestión de gráfica y señalética en Argentina.
Stack: Node.js + Express, HTML/JS vanilla, archivos JSON como base de datos.

TAREA: Revisar y mejorar el archivo asistente.html (chat IA para el operador).
El chat llama a /api/ai/chat y también ejecuta llamadas directas a la API REST.

═══ ESTRUCTURA DE DATOS EXACTA (no inventar) ═══

CLIENTES:
  Gremio:  POST /api/gremio/clientes → id: "gremio_cli_" + Date.now(), campo: "name"
  Común:   POST /api/clientes        → id: "cliente_cli_" + Date.now(), campo: "name"
  Detección: "gremio"/"mayorista"/"colega" → gremio. Sin aclaración → cliente.
  Estructura: { id, name, telefono, email, direccion, fechaRegistro }

COTIZACIONES:
  Gremio:   POST /api/gremio/data
  Clientes: POST /api/clientes/data
  Objeto mínimo:
  {
    id: String(Date.now()),
    clientId: string,
    cliente: { nombre, telefono, email, direccion },
    multiCategories: {
      categories: [{ id, name, pricePerM2, totalPrice, costPerM2:0, totalCost:0, margin, m2 }],
      sharedDimensions: { width, height, totalM2 },
      inkPriceEnabled: false, inkPricePerM2: 0
    },
    subtotal: number, iva: number, totalCliente: number,
    ganancia: number, anticipo: totalCliente*0.6, saldo: totalCliente,
    fecha: ISO, estado: "pendiente", approved: false,
    descripcion: string, tipoCliente: "gremio"|"cliente"
  }

TRABAJOS:
  GET /api/trabajos → { works: [], notifications: [] }
  Agregar: GET → push → POST (o POST /api/trabajos/add para agregar uno solo)
  PUT /api/trabajos/:id → merge de campos
  Objeto:
  {
    id: "work_" + Date.now(), quoteId: string|null,
    clientName, clientPhone, clientEmail, clientAddress,
    total, totalCost:0, profit, paidAmount, balance,
    status: "pending"|"in_progress"|"completed",
    paymentStatus: "unpaid"|"partial"|"paid",
    priority: "normal"|"urgent", tipoCliente: "gremio"|"cliente",
    createdAt: ISO, deliveryDate: ISO|null,
    timeline: [{type, description, timestamp}],
    notes: [], deliveryStatus: "pending"|"delivered", descripcion: string
  }

PRECIOS — Jerarquía obligatoria:
  1. GET /api/precios-finales → precios fijos por producto terminado (usar SIEMPRE primero)
     { nombre, precio, unidad:"m2"|"unidad" }
     Si hay match → usar directo. NO sumar componentes.
  2. Solo si no hay precio fijo: GET /api/precios (materiales) + /api/terceros (servicios)
  Cálculo: precio × (ancho_cm/100) × (alto_cm/100) × cantidad
  SIEMPRE aclarar: sin IVA + "IVA 21% si pide factura" + anticipo 60%

AUTH: localStorage.getItem('mr_token') → header: Authorization: Bearer {token}
API BASE: /api (relativo, sin hostname)

═══ ERRORES A NO REPETIR ═══

❌ await apiPost('/clientes/data', { type:'save_cotizacion', data:... })
✅ await apiPost('/clientes/data', objetoCotizacion)

❌ { nombre: args.nombre } al crear cliente
✅ { name: args.nombre }

❌ guardar siempre en /api/clientes
✅ if(tipo==='gremio') POST /gremio/clientes else POST /clientes

❌ await apiPost('/trabajos', nuevoTrabajo) — REEMPLAZA todo el archivo
✅ const d = await apiGet('/trabajos'); d.works.push(nuevo); await apiPost('/trabajos', d)
   O: await apiPost('/trabajos/add', nuevoTrabajo)

═══ FLUJOS COMPLETOS REQUERIDOS ═══

FLUJO 1 — Guardar cliente:
  "Guardame a Juan Pérez, tel 1155556666, es de gremio"
  → POST /api/gremio/clientes: { id:'gremio_cli_1234', name:'Juan Pérez', telefono:'1155556666' }
  → "✅ Juan Pérez guardado como cliente Gremio"

FLUJO 2 — Cotización completa:
  "Cotizame un cartel de lona 300x100cm para Juan"
  → GET /api/precios-finales → "Cartel Completo" $95.000/m²
  → 3m × 1m = 3m² → $285.000
  → "Cartel Completo — 3×1m — $285.000 sin IVA — Anticipo $171.000 ¿Lo guardo?"
  "Sí" → POST /api/gremio/data con cotización completa
  → "✅ Cotización guardada ID: XXXXXXXXXX"

FLUJO 3 — Aprobar cotización → producción:
  "La cotización de Juan fue aprobada"
  → Buscar cotización pendiente de Juan (cots_clientes + cots_gremio)
  → Actualizar estado approved:true → POST array actualizado al endpoint
  → Crear trabajo → POST /api/trabajos/add con objeto completo
  → "✅ Trabajo creado en producción. Visible en trabajos.html y dashboard."

FLUJO 4 — Registrar pago:
  "Juan pagó $171.000"
  → Buscar trabajo de Juan → PUT /api/trabajos/:id
  → { paidAmount: 171000, balance: 114000, paymentStatus:'partial' }
  → "✅ Pago registrado. Saldo: $114.000"

FLUJO 5 — Actualizar estado:
  "El trabajo de Juan está terminado"
  → PUT /api/trabajos/:id: { status:'completed', deliveryStatus:'delivered', actualDeliveryDate:ISO }
  → "✅ Trabajo de Juan → Completado"

═══ FORMATO DE RESPUESTAS ═══
  - Tablas markdown: | col | col | para listas
  - ✅ confirmaciones, ❌ errores, ⚠️ advertencias
  - Precios: "$285.000" con puntos como separador de miles
  - Español neutro y profesional
  - No inventar datos — usar siempre la API

═══ CONSTRAINTS ═══
  - Corre en browser → sin require(), sin fs
  - fetch('/api/...') relativo, no absoluto
  - El servidor expone POST /api/ai/chat que acepta { messages:[], systemExtra:"" }
```

---

## PARTE 5 — VERIFICACIÓN POST-DEPLOY

Ejecutá estas instrucciones en el chat en orden para verificar:

1. `"Dame un resumen del negocio"` → debe mostrar datos reales (trabajos, clientes, morosos)
2. `"Guardame cliente Test IA, tel 0000000000"` → debe responder ✅ con ID `cliente_cli_XXX`
3. `"Mostrá los trabajos"` → debe listar trabajos existentes con estado
4. `"Cotizame un cartel de lona 200x80cm"` → debe calcular $152.000 (95.000 × 1.6m²)
5. `"Hay clientes morosos?"` → debe mostrar saldos reales del sistema

Si alguno falla → abrir F12 > Consola y ver el error exacto.
