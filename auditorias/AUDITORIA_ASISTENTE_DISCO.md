# AUDITORÍA COMPLETA — ASISTENTE IA MR LETREROS
## Por qué no guarda datos y cómo darle acceso directo al disco como el bot de WhatsApp

---

## 1. EL DIAGNÓSTICO REAL — POR QUÉ NO PUEDE GUARDAR

### Hay 3 procesos corriendo en tu sistema

```
PROCESO 1: server.js            → Puerto 3000 → Node.js → TIENE fs → SÍ escribe disco
PROCESO 2: whatsapp-bot-gemini  → Puerto 3001 → Node.js → TIENE fs → SÍ escribe disco
PROCESO 3: asistente.html       → Chrome/Firefox → Browser → NO TIENE fs → NO puede tocar disco
```

El bot de WhatsApp vive en Node.js. Hace exactamente esto:

```javascript
// whatsapp-bot-gemini.js — línea 311
function saveJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  // ↑ Acceso directo al disco. Sin intermediarios.
}
```

El asistente web vive en el navegador. El navegador es una caja de arena de seguridad:
no puede usar `require()`, no puede usar `fs`, no puede tocar ningún archivo del sistema.

### El flujo roto actual

```
Operador escribe "guardá la cotización" en el chat
    ↓
asistente.html (browser) → llama a /api/ai/chat
    ↓
server.js llama a Groq — SIN tools, SIN response_format — solo texto libre
    ↓
Groq responde "✅ Guardé la cotización" — SOLO TEXTO, no ejecutó nada
    ↓
asistente.html muestra la respuesta bonita
    ↓
El archivo JSON NO se tocó. La cotización no existe.
```

La IA miente de buena fe: le dijeron que puede guardar pero nunca le dieron cómo hacerlo.

---

## 2. POR QUÉ server.js ES LA SOLUCIÓN

`server.js` ya tiene todo lo necesario:

```javascript
// YA EXISTE en server.js:
const fs = require('fs').promises;           // acceso al disco
const DATA_DIR = 'C:\\MR_Letreros\\datos_mr_letreros';

async function readJSON(filepath) { ... }    // lee cualquier JSON
async function writeJSON(filepath, data) {  // escribe cualquier JSON
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
}

const FILES = {
  gremio_clientes: DATA_DIR + '/clientes.json',
  gremio_data:     DATA_DIR + '/gremio/cotizaciones.json',
  clientes_data:   DATA_DIR + '/clientes/cotizaciones.json',
  trabajos:        DATA_DIR + '/trabajos.json',
  precios_finales: DATA_DIR + '/gremio_precios_finales.json',
  // ... todos los archivos mapeados
};
```

Y ya tiene instalado el paquete `openai` v6 que el bot usa para hablar con Groq.

**La solución:** el endpoint `/api/ai/chat` en server.js tiene que hacer todo el trabajo.
No delegar nada al browser. El browser solo envía el mensaje y muestra la respuesta.

---

## 3. CÓMO LO HACE EL BOT DE WHATSAPP (el modelo a copiar)

El bot usa Groq con `response_format: { type: 'json_object' }`. Groq devuelve
un JSON estructurado en lugar de texto libre. El bot lee ese JSON y actúa:

```javascript
// whatsapp-bot-gemini.js — patrón exacto
const completion = await groqClient.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [
    { role: 'system', content: 'Respondé SIEMPRE con JSON válido. Sin backticks.' },
    { role: 'user', content: prompt }
  ],
  max_tokens: 1024,
  temperature: 0.7,
  response_format: { type: 'json_object' }  // ← LA CLAVE
});

const analisis = JSON.parse(completion.choices[0].message.content);
// analisis.siguientePregunta  → texto para responder al cliente
// analisis.score              → puntaje del lead
// analisis.presupuestoAceptado → flag para guardar en disco

// Si hay acción → escribe directo al disco
if (analisis.presupuestoAceptado) {
  fs.writeFileSync(clientesFile, JSON.stringify(clientes, null, 2));
}
```

El asistente web tiene que hacer exactamente lo mismo, pero en server.js.

---

## 4. LA SOLUCIÓN: NUEVO FLUJO COMPLETO

```
Operador escribe "guardá la cotización de Juan, cartel de lona 300x100cm"
    ↓
asistente.html (browser) → fetch POST /api/ai/chat → {message: "..."}
    ↓
server.js recibe el mensaje
    ↓
server.js carga los datos del disco (precios, clientes, trabajos)
    ↓
server.js llama a Groq con response_format: json_object
System prompt: "Devolvé JSON con {accion, datos, respuesta_texto}"
    ↓
Groq devuelve:
{
  "accion": "guardar_cotizacion",
  "datos": {
    "nombre_cliente": "Juan",
    "descripcion": "Cartel Lona Front 3x1m",
    "ancho_cm": 300, "alto_cm": 100,
    "total": 285000,
    "tipo_cliente": "cliente"
  },
  "respuesta_texto": "Calculé la cotización para Juan. ¿La guardo?"
}
    ↓
server.js ejecuta la acción (readJSON → push → writeJSON) directo al disco
    ↓
server.js devuelve al browser: {content: "✅ Cotización guardada — ID: 1740...", accion_ejecutada: true}
    ↓
asistente.html muestra el mensaje. No hace nada más.
```

---

## 5. CAMPOS EXACTOS POR ENTIDAD (auditados contra los JSONs reales)

### Cliente Común → `clientes.json`

```json
{
  "nombre": "Juan Pérez",
  "telefono": "1155556666",
  "email": "juan@mail.com",
  "direccion": "Av. San Martín 100",
  "createdAt": "2026-02-26T00:00:00.000Z"
}
```
⚠️ Campo es `"nombre"` NO `"name"`. Sin `"id"` (el sistema no lo usa para clientes comunes).

### Cliente Gremio → `clientes.json` (mismo archivo, prefijo de id diferente)

```json
{
  "id": "gremio_cli_1740000000000",
  "name": "Imprenta López",
  "telefono": "1166667777",
  "email": "lopez@imprenta.com",
  "direccion": "Av. Colón 500",
  "fechaRegistro": "2026-02-26T00:00:00.000Z"
}
```
⚠️ Campo es `"name"` NO `"nombre"`. Requiere `"id"` con prefijo `"gremio_cli_"`.

### Cotización Cliente → `clientes/cotizaciones.json`

```json
{
  "id": "1740000000000",
  "clientId": "cliente_cli_1740000000001",
  "cliente": {
    "nombre": "Juan Pérez",
    "telefono": "1155556666",
    "email": "",
    "direccion": ""
  },
  "fechaEntrega": "",
  "productos": [],
  "terceros": [],
  "multiCategories": {
    "categories": [{
      "id": "cat_1740000000000",
      "name": "Cartel Lona Front",
      "costPerM2": 0,
      "pricePerM2": 95000,
      "totalCost": 0,
      "totalPrice": 285000,
      "margin": 285000,
      "m2": 3
    }],
    "sharedDimensions": { "width": 3, "height": 1, "totalM2": 3 },
    "inkPriceEnabled": false,
    "inkPricePerM2": 0
  },
  "costoTotal": 0,
  "subtotal": 285000,
  "iva": 0,
  "totalCliente": 285000,
  "ganancia": 285000,
  "anticipo": 0,
  "saldo": 285000,
  "fecha": "2026-02-26T00:00:00.000Z",
  "estado": "pendiente",
  "approved": false
}
```

### Cotización Gremio → `gremio/cotizaciones.json` (misma estructura, sin IVA por defecto)

Exactamente igual pero `"iva": 0` siempre (gremio no paga IVA en la cotización).

### Trabajo → `trabajos.json` dentro de `works[]`

```json
{
  "id": "work_1740000000000",
  "quoteId": "1740000000000",
  "clientName": "Juan Pérez",
  "clientPhone": "1155556666",
  "clientEmail": "",
  "clientAddress": "",
  "total": 285000,
  "totalCost": 0,
  "profit": 285000,
  "paidAmount": 171000,
  "balance": 114000,
  "status": "pending",
  "paymentStatus": "partial",
  "priority": "normal",
  "createdAt": "2026-02-26T00:00:00.000Z",
  "deliveryDate": "2026-03-05",
  "timeline": [{
    "type": "created",
    "description": "Creado por Asistente IA",
    "timestamp": "2026-02-26T00:00:00.000Z"
  }],
  "notes": [],
  "deliveryStatus": "pending"
}
```

⚠️ Para agregar un trabajo: GET el archivo completo → push al array `works` → POST el objeto completo.
`POST /api/trabajos` reemplaza TODO el archivo, no agrega.

---

## 6. PROMPT COMPLETO PARA IMPLEMENTAR LA SOLUCIÓN

Copiá este prompt y pegáselo a cualquier IA (Claude, GPT-4, Gemini) junto con
el código actual de `server.js` y `asistente.html`:

---

```
CONTEXTO DEL SISTEMA:
Sistema "MR Letreros" — gestión de una imprenta/gráfica en Argentina.
Stack: Node.js + Express (server.js, puerto 3000), HTML/JS vanilla en browser (asistente.html),
archivos JSON como base de datos, Groq/LLaMA como IA.

PROBLEMA CENTRAL:
El asistente web (asistente.html corre en el browser) NO puede guardar datos porque el browser
no tiene acceso al sistema de archivos. Toda la lógica de guardado tiene que vivir en server.js,
que sí corre en Node.js y tiene acceso total al disco.

OBJETIVO:
Rediseñar el endpoint POST /api/ai/chat en server.js para que sea un agente completo:
1. Recibe el mensaje del operador desde el browser
2. Carga contexto completo desde disco (precios, clientes, trabajos, cotizaciones)
3. Llama a Groq con response_format: {type: 'json_object'} para obtener acción estructurada
4. Ejecuta la acción directamente usando readJSON/writeJSON (ya existen en server.js)
5. Devuelve al browser solo el texto de confirmación para mostrar en el chat

El browser (asistente.html) se simplifica: solo envía el mensaje y muestra la respuesta.
NO tiene lógica de herramientas, NO intenta guardar nada, NO detecta intents.

═══════════════════════════════════════════════════════════
CAMBIO 1 — server.js: Reemplazar /api/ai/chat completo
═══════════════════════════════════════════════════════════

El nuevo endpoint debe hacer esto en orden:

PASO A: Leer API Key de Groq
(el código actual ya lo hace, mantenerlo igual)

PASO B: Cargar todos los datos del disco
```javascript
const [
  trabajosRaw, clientesComunes, clientesGremio,
  cotsClientes, cotsGremio,
  preciosFinales, terceros
] = await Promise.all([
  readJSON(FILES.trabajos),
  readJSON(FILES.clientes),
  readJSON(FILES.gremio_clientes),
  readJSON(FILES.clientes_data),
  readJSON(FILES.gremio_data),
  readJSON(FILES.precios_finales),
  readJSON(FILES.terceros)
]);

const trabajos = trabajosRaw.works || [];
const cotsClientesPend = cotsClientes.filter(c => !c.approved);
const cotsGremioPend   = cotsGremio.filter(c => !c.approved);
const morosos = trabajos.filter(t => (t.balance || 0) > 0);
const hoy = new Date().toLocaleDateString('es-AR');
const fmt = n => '$' + new Intl.NumberFormat('es-AR', {maximumFractionDigits:0}).format(n||0);
```

PASO C: Construir el system prompt con contexto completo + instrucciones de acción

El system prompt tiene DOS partes:

PARTE 1 — CONTEXTO DEL NEGOCIO (se incluye siempre):
```
Sos el Asistente IA del panel de operación de MR Letreros (gráfica, Santa Fe, Argentina).
Hoy: ${hoy}. Respondé en español, tono profesional.

PRECIOS FIJOS (sin IVA):
${preciosFinales.map(p => `- ${p.nombre}: ${fmt(p.precio)} por ${p.unidad}`).join('\n')}

TRABAJOS ACTIVOS (${trabajos.filter(t=>t.status!=='completed').length}):
${JSON.stringify(trabajos.filter(t=>t.status!=='completed').slice(0,15).map(t=>({
  id: t.id, cliente: t.clientName, total: t.total,
  saldo: t.balance, estado: t.status, entrega: t.deliveryDate
})), null, 2)}

CLIENTES CON SALDO PENDIENTE:
${JSON.stringify(morosos.slice(0,10).map(t=>({
  cliente: t.clientName, tel: t.clientPhone, saldo: t.balance
})), null, 2)}

COTIZACIONES SIN APROBAR:
Clientes: ${cotsClientesPend.length} | Gremio: ${cotsGremioPend.length}
${JSON.stringify([...cotsClientesPend,...cotsGremioPend].slice(0,8).map(c=>({
  id: c.id, cliente: c.cliente?.nombre, total: c.totalCliente
})), null, 2)}

REGLAS:
- Precios SIN IVA. Si piden factura: +21%.
- Anticipo siempre 60% para iniciar.
- Clientes gremio = mayoristas/imprenteros (sin IVA en cotización).
- Cálculo m²: precio × (ancho_cm/100) × (alto_cm/100) × cantidad.
```

PARTE 2 — INSTRUCCIONES DE RESPUESTA (siempre al final del system prompt):
```
═══ FORMATO DE RESPUESTA OBLIGATORIO ═══
Respondé ÚNICAMENTE con un JSON válido. Sin texto extra. Sin backticks.

{
  "respuesta_texto": "Texto en español para mostrar al operador en el chat. Puede usar markdown.",
  "accion": "ninguna | guardar_cliente_comun | guardar_cliente_gremio | guardar_cotizacion_cliente | guardar_cotizacion_gremio | crear_trabajo | actualizar_trabajo | registrar_pago",
  "datos": { ... campos según la acción, o null si accion=ninguna }
}

═══ CAMPOS EXACTOS POR ACCIÓN ═══

accion: "guardar_cliente_comun"
datos: { "nombre": string, "telefono": string, "email": string, "direccion": string }

accion: "guardar_cliente_gremio"
datos: { "nombre": string, "telefono": string, "email": string, "direccion": string }

accion: "guardar_cotizacion_cliente" o "guardar_cotizacion_gremio"
datos: {
  "nombre_cliente": string,
  "telefono_cliente": string,
  "descripcion": string,
  "ancho_cm": number,
  "alto_cm": number,
  "cantidad": number,
  "precio_unitario": number,
  "total_sin_iva": number,
  "con_iva": boolean
}

accion: "crear_trabajo"
datos: {
  "nombre_cliente": string,
  "telefono": string,
  "descripcion": string,
  "total": number,
  "anticipo_cobrado": number,
  "fecha_entrega": "YYYY-MM-DD o null",
  "prioridad": "normal | urgent",
  "tipo_cliente": "cliente | gremio",
  "cotizacion_id": "id de la cotización si viene de una, o null"
}

accion: "actualizar_trabajo"
datos: {
  "trabajo_id": "id exacto o null (usar nombre si no hay id)",
  "nombre_cliente": string,
  "nuevo_estado": "pending | in_progress | completed | null",
  "nota": string
}

accion: "registrar_pago"
datos: {
  "trabajo_id": "id exacto o null",
  "nombre_cliente": string,
  "monto": number
}

accion: "ninguna"
datos: null
(usar para consultas, preguntas, cálculos sin guardar, saludos)

═══ REGLAS DE NEGOCIO PARA COTIZAR ═══
1. Buscar PRIMERO en precios fijos de arriba.
2. Si hay match y unidad="m2": total = precio × (ancho/100) × (alto/100) × cantidad
3. Si hay match y unidad="unidad": total = precio × cantidad
4. Si no hay match: calcular con precio manual o indicar que necesita cotización manual.
5. SIEMPRE mostrar: total sin IVA + aclaración IVA + anticipo 60%.

═══ CUÁNDO GUARDAR ═══
- Si el operador dice "guardá", "registrá", "anotá", "creá", "nueva cotización" → guardar
- Si el operador dice "sí" o "confirmá" después de que mostraste un presupuesto → guardar
- Si el operador dice "la cotización fue aprobada" o "hacé el trabajo" → crear_trabajo
- Si el operador dice "marcá como en proceso/terminado/completado" → actualizar_trabajo
- Si el operador dice "pagó $X" o "cobré $X" → registrar_pago
- Si es una consulta, pregunta o cálculo sin confirmación → ninguna
```

PASO D: Llamar a Groq con JSON mode
```javascript
const OpenAI = require('openai');
const groq = new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: groqApiKey });

const completion = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [
    { role: 'system', content: systemPrompt },
    ...messages  // historial del chat del operador
  ],
  max_tokens: 1500,
  temperature: 0.3,
  response_format: { type: 'json_object' }  // ← CLAVE: JSON mode
});

const raw = completion.choices[0].message.content.trim();
// Limpiar por si acaso (igual que el bot)
const clean = raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
const resultado = JSON.parse(clean);
const { respuesta_texto, accion, datos } = resultado;
```

PASO E: Ejecutar la acción en el disco
```javascript
let mensajeFinal = respuesta_texto;
let accionEjecutada = null;

try {
  if (accion && accion !== 'ninguna' && datos) {
    accionEjecutada = await ejecutarAccion(accion, datos, trabajosRaw, cotsClientes, cotsGremio);
    // ejecutarAccion devuelve {ok, id, mensaje}
    if (accionEjecutada.ok) {
      mensajeFinal = respuesta_texto + '\n\n✅ ' + accionEjecutada.mensaje;
    } else {
      mensajeFinal = respuesta_texto + '\n\n❌ Error: ' + accionEjecutada.error;
    }
  }
} catch(e) {
  logger.error('Error ejecutando acción del asistente:', e.message);
  mensajeFinal = respuesta_texto + '\n\n❌ Error ejecutando la acción: ' + e.message;
}

res.json({ content: mensajeFinal, accion_ejecutada: accionEjecutada });
```

PASO F: Función ejecutarAccion (agregar en server.js fuera del endpoint)
```javascript
async function ejecutarAccion(accion, datos, trabajosRaw, cotsClientes, cotsGremio) {
  const ts = Date.now();
  const iso = new Date().toISOString();

  switch(accion) {

    case 'guardar_cliente_comun': {
      const clientes = await readJSON(FILES.clientes);
      // Verificar duplicado por teléfono
      const existe = clientes.find(c => c.telefono === datos.telefono && datos.telefono);
      if (existe) return { ok: false, error: `Ya existe cliente con tel ${datos.telefono}` };
      const nuevo = {
        nombre: datos.nombre,
        telefono: datos.telefono || '',
        email: datos.email || '',
        direccion: datos.direccion || '',
        createdAt: iso
      };
      clientes.push(nuevo);
      await writeJSON(FILES.clientes, clientes);
      logger.info('✅ Asistente guardó cliente común:', datos.nombre);
      return { ok: true, mensaje: `Cliente "${datos.nombre}" guardado como Cliente Común.` };
    }

    case 'guardar_cliente_gremio': {
      const clientes = await readJSON(FILES.gremio_clientes);
      const existe = clientes.find(c => c.telefono === datos.telefono && datos.telefono);
      if (existe) return { ok: false, error: `Ya existe cliente gremio con tel ${datos.telefono}` };
      const nuevo = {
        id: 'gremio_cli_' + ts,
        name: datos.nombre,
        telefono: datos.telefono || '',
        email: datos.email || '',
        direccion: datos.direccion || '',
        fechaRegistro: iso
      };
      clientes.push(nuevo);
      await writeJSON(FILES.gremio_clientes, nuevo); // el endpoint actual hace push
      // NOTA: FILES.gremio_clientes y FILES.clientes apuntan al MISMO archivo (clientes.json)
      // pero con estructura diferente. Guardar directo:
      await writeJSON(FILES.clientes, [...await readJSON(FILES.clientes), nuevo]);
      logger.info('✅ Asistente guardó cliente gremio:', datos.nombre);
      return { ok: true, id: nuevo.id, mensaje: `Cliente "${datos.nombre}" guardado como Gremio.` };
    }

    case 'guardar_cotizacion_cliente':
    case 'guardar_cotizacion_gremio': {
      const esGremio = accion === 'guardar_cotizacion_gremio';
      const archivo = esGremio ? FILES.gremio_data : FILES.clientes_data;
      const m2 = (datos.ancho_cm && datos.alto_cm)
        ? (datos.ancho_cm / 100) * (datos.alto_cm / 100) * (datos.cantidad || 1)
        : 1;
      const totalSinIva = datos.total_sin_iva || datos.precio_unitario || 0;
      const totalFinal = datos.con_iva ? totalSinIva * 1.21 : totalSinIva;

      const cotizacion = {
        id: String(ts),
        clientId: (esGremio ? 'gremio_cli_' : 'cliente_cli_') + (ts + 1),
        cliente: {
          nombre: datos.nombre_cliente,
          telefono: datos.telefono_cliente || '',
          email: '', direccion: ''
        },
        fechaEntrega: '',
        productos: [],
        terceros: [],
        multiCategories: {
          categories: [{
            id: 'cat_' + ts,
            name: datos.descripcion,
            costPerM2: 0,
            pricePerM2: m2 > 0 ? totalSinIva / m2 : totalSinIva,
            totalCost: 0,
            totalPrice: totalSinIva,
            margin: totalSinIva,
            m2: m2
          }],
          sharedDimensions: {
            width:  (datos.ancho_cm || 100) / 100,
            height: (datos.alto_cm  || 100) / 100,
            totalM2: m2
          },
          inkPriceEnabled: false,
          inkPricePerM2: 0
        },
        costoTotal: 0,
        subtotal: totalSinIva,
        iva: datos.con_iva ? totalSinIva * 0.21 : 0,
        totalCliente: totalFinal,
        ganancia: totalFinal,
        anticipo: totalFinal * 0.6,
        saldo: totalFinal,
        fecha: iso,
        estado: 'pendiente',
        approved: false,
        descripcion: datos.descripcion
      };

      const lista = await readJSON(archivo);
      lista.push(cotizacion);
      await writeJSON(archivo, lista);
      logger.info(`✅ Asistente guardó cotización (${esGremio ? 'gremio' : 'cliente'}):`, datos.nombre_cliente);

      const fmt = n => '$' + new Intl.NumberFormat('es-AR', {maximumFractionDigits:0}).format(n||0);
      return {
        ok: true,
        id: cotizacion.id,
        mensaje: `Cotización ID ${cotizacion.id} guardada para ${datos.nombre_cliente}.\n` +
                 `Total: ${fmt(totalFinal)} | Anticipo 60%: ${fmt(totalFinal * 0.6)}`
      };
    }

    case 'crear_trabajo': {
      const total = datos.total || 0;
      const anticipo = datos.anticipo_cobrado || 0;
      const nuevoTrabajo = {
        id: 'work_' + ts,
        quoteId: datos.cotizacion_id || null,
        clientName: datos.nombre_cliente,
        clientPhone: datos.telefono || '',
        clientEmail: '',
        clientAddress: '',
        total, totalCost: 0, profit: total,
        paidAmount: anticipo,
        balance: total - anticipo,
        status: 'pending',
        paymentStatus: anticipo >= total ? 'paid' : anticipo > 0 ? 'partial' : 'unpaid',
        priority: datos.prioridad || 'normal',
        createdAt: iso,
        deliveryDate: datos.fecha_entrega || null,
        timeline: [{ type: 'created', description: 'Creado por Asistente IA', timestamp: iso }],
        notes: [],
        deliveryStatus: 'pending',
        descripcion: datos.descripcion || ''
      };

      // Si viene de cotización, marcarla como aprobada
      if (datos.cotizacion_id) {
        const esGremio = datos.tipo_cliente === 'gremio';
        const archivo = esGremio ? FILES.gremio_data : FILES.clientes_data;
        const lista = await readJSON(archivo);
        const idx = lista.findIndex(c => c.id === datos.cotizacion_id);
        if (idx !== -1) {
          lista[idx].approved = true;
          lista[idx].estado = 'aprobada';
          lista[idx].fechaAprobacion = iso;
          await writeJSON(archivo, lista);
        }
      }

      // Agregar a trabajos
      const tw = await readJSON(FILES.trabajos);
      if (!tw.works) tw.works = [];
      tw.works.push(nuevoTrabajo);
      await writeJSON(FILES.trabajos, tw);

      logger.info('✅ Asistente creó trabajo:', nuevoTrabajo.id, 'para', datos.nombre_cliente);
      const fmt = n => '$' + new Intl.NumberFormat('es-AR', {maximumFractionDigits:0}).format(n||0);
      return {
        ok: true,
        id: nuevoTrabajo.id,
        mensaje: `Trabajo ${nuevoTrabajo.id} creado para ${datos.nombre_cliente}.\n` +
                 `Total: ${fmt(total)} | Anticipo: ${fmt(anticipo)} | Saldo: ${fmt(total - anticipo)}\n` +
                 `Visible en trabajos.html y el dashboard.`
      };
    }

    case 'actualizar_trabajo': {
      const tw = await readJSON(FILES.trabajos);
      let trabajo = datos.trabajo_id
        ? tw.works.find(w => w.id === datos.trabajo_id)
        : tw.works.find(w =>
            w.clientName.toLowerCase().includes(datos.nombre_cliente.toLowerCase()) &&
            w.status !== 'completed'
          ) || tw.works.find(w =>
            w.clientName.toLowerCase().includes(datos.nombre_cliente.toLowerCase())
          );

      if (!trabajo) return { ok: false, error: `No se encontró trabajo de "${datos.nombre_cliente}"` };

      if (datos.nuevo_estado) {
        trabajo.status = datos.nuevo_estado;
        trabajo.timeline = [...(trabajo.timeline||[]), {
          type: 'status_changed',
          description: `Estado → ${datos.nuevo_estado}${datos.nota ? ': ' + datos.nota : ''} (Asistente IA)`,
          timestamp: iso
        }];
        if (datos.nuevo_estado === 'completed') {
          trabajo.deliveryStatus = 'delivered';
          trabajo.actualDeliveryDate = iso;
        }
      }

      await writeJSON(FILES.trabajos, tw);
      logger.info('✅ Asistente actualizó trabajo:', trabajo.id);
      return {
        ok: true,
        id: trabajo.id,
        mensaje: `Trabajo de ${trabajo.clientName} actualizado → ${datos.nuevo_estado || 'sin cambio de estado'}`
      };
    }

    case 'registrar_pago': {
      const tw = await readJSON(FILES.trabajos);
      let trabajo = datos.trabajo_id
        ? tw.works.find(w => w.id === datos.trabajo_id)
        : tw.works.find(w =>
            w.clientName.toLowerCase().includes(datos.nombre_cliente.toLowerCase()) &&
            w.status !== 'completed'
          );

      if (!trabajo) return { ok: false, error: `No se encontró trabajo de "${datos.nombre_cliente}"` };

      const nuevoPagado = (trabajo.paidAmount || 0) + datos.monto;
      const nuevoSaldo  = Math.max(0, trabajo.total - nuevoPagado);
      trabajo.paidAmount    = nuevoPagado;
      trabajo.balance       = nuevoSaldo;
      trabajo.paymentStatus = nuevoSaldo <= 0 ? 'paid' : nuevoPagado > 0 ? 'partial' : 'unpaid';
      trabajo.timeline = [...(trabajo.timeline||[]), {
        type: 'payment',
        description: `Pago recibido: $${datos.monto.toLocaleString('es-AR')} | Saldo: $${nuevoSaldo.toLocaleString('es-AR')}`,
        timestamp: iso
      }];

      await writeJSON(FILES.trabajos, tw);
      logger.info('✅ Asistente registró pago:', datos.monto, 'para', trabajo.clientName);
      const fmt = n => '$' + new Intl.NumberFormat('es-AR', {maximumFractionDigits:0}).format(n||0);
      return {
        ok: true,
        id: trabajo.id,
        mensaje: `Pago de ${fmt(datos.monto)} registrado para ${trabajo.clientName}.\nSaldo restante: ${fmt(nuevoSaldo)}`
      };
    }

    default:
      return { ok: false, error: `Acción desconocida: ${accion}` };
  }
}
```

═══════════════════════════════════════════════════════════
CAMBIO 2 — asistente.html: Simplificar completamente el JS
═══════════════════════════════════════════════════════════

El browser ya no necesita:
- Ninguna función ejecutarAccion()
- Ninguna función detectAndRunTool()
- Ningún switch/case de herramientas
- Ninguna lógica de precios ni cálculos
- Los objetos tools[] y toda su estructura

Lo único que queda en el browser:

```javascript
// ESTADO
let conversationHistory = [];
let isThinking = false;

// AUTH
function getAuthToken() {
  return localStorage.getItem('mr_token') || '';
}

// CARGAR DATOS PARA EL PANEL LATERAL (solo lectura, para estadísticas)
async function loadContextPanel() {
  try {
    const [trabRes, cliRes] = await Promise.all([
      fetch('/api/trabajos', { headers: { Authorization: 'Bearer ' + getAuthToken() } }),
      fetch('/api/clientes',  { headers: { Authorization: 'Bearer ' + getAuthToken() } })
    ]);
    const { works = [] } = await trabRes.json();
    const clientes = await cliRes.json();
    document.getElementById('ctxTrabajos').textContent = works.filter(w => w.status !== 'completed').length;
    document.getElementById('ctxClientes').textContent = clientes.length;
    document.getElementById('ctxMorosos').textContent  = works.filter(w => (w.balance||0) > 0).length;
  } catch(e) { console.warn('Panel lateral:', e.message); }
}

// ENVIAR MENSAJE — toda la lógica real está en server.js
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = (input.value || '').trim();
  if (!text || isThinking) return;

  input.value = '';
  input.style.height = 'auto';
  isThinking = true;
  document.getElementById('sendBtn').disabled = true;

  addMessage('user', text);
  showThinking();

  try {
    const resp = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getAuthToken()
      },
      body: JSON.stringify({
        messages: [...conversationHistory, { role: 'user', content: text }]
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `Error ${resp.status}`);
    }

    const data = await resp.json();
    const reply = data.content || 'Sin respuesta.';

    removeThinking();
    addMessage('bot', reply);

    // Actualizar historial
    conversationHistory.push({ role: 'user', content: text });
    conversationHistory.push({ role: 'assistant', content: reply });
    if (conversationHistory.length > 40) conversationHistory = conversationHistory.slice(-40);

    // Si hubo una acción ejecutada, recargar el panel lateral
    if (data.accion_ejecutada?.ok) {
      loadContextPanel();
    }

    setStatus(true);
  } catch(e) {
    removeThinking();
    addMessage('bot', '❌ **Error:** ' + e.message);
    setStatus(false);
  }

  isThinking = false;
  document.getElementById('sendBtn').disabled = false;
  document.getElementById('chatInput').focus();
}

document.addEventListener('DOMContentLoaded', loadContextPanel);
```

Mantener intacto todo el HTML/CSS visual. Solo cambiar el bloque de JavaScript.

═══════════════════════════════════════════════════════════
NOTA IMPORTANTE: FILES.gremio_clientes y FILES.clientes
═══════════════════════════════════════════════════════════

En server.js ambos apuntan al MISMO archivo:
  FILES.gremio_clientes = DATA_DIR + '/clientes.json'
  FILES.clientes        = DATA_DIR + '/clientes.json'

Este archivo mezcla clientes comunes (campo "nombre") y gremio (campo "name").
Al guardar gremio, leer el array completo y hacer push con el nuevo objeto gremio.
Al guardar cliente común, leer el array completo y hacer push con el nuevo objeto común.
Ambos conviven en el mismo JSON sin problema.

═══════════════════════════════════════════════════════════
VERIFICACIÓN POST-DEPLOY
═══════════════════════════════════════════════════════════

Probá estas instrucciones en el chat en orden:

1. "Guardame cliente Juan Pérez, tel 1155556666"
   → Verificar: abrir clientes.json y ver que Juan aparece con campo "nombre"

2. "Guardame cliente gremio Imprenta López, tel 1166667777"
   → Verificar: clientes.json tiene un objeto con campo "name" e id "gremio_cli_XXX"

3. "Cotizame un cartel de lona 300x100cm para Juan Pérez"
   → Debe calcular: 3m² × $95.000 = $285.000

4. "Sí, guardala"
   → Verificar: clientes/cotizaciones.json tiene la cotización nueva

5. "El trabajo de Juan fue aprobado, anticipo $171.000, entrega el 5 de marzo"
   → Verificar: trabajos.json tiene work_XXX con status "pending" y paidAmount 171000

6. "Marcá el trabajo de Juan como en producción"
   → Verificar: trabajos.json tiene status "in_progress"

7. "Juan pagó el saldo de $114.000"
   → Verificar: paidAmount=285000, balance=0, paymentStatus="paid"
```

---

## 7. RESUMEN EJECUTIVO

| | WhatsApp Bot | Asistente Web ANTES | Asistente Web DESPUÉS |
|---|---|---|---|
| Corre en | Node.js | Browser | Node.js (server.js) |
| Tiene `fs` | ✅ Sí | ❌ No | ✅ Sí (server.js) |
| Groq mode | JSON mode | Texto libre | JSON mode |
| Guarda datos | ✅ Directamente | ❌ Nunca | ✅ Directamente |
| Browser hace | (no aplica) | Toda la lógica | Solo muestra chat |
| Lógica en | bot + Node.js | browser (imposible) | server.js (correcto) |

**El cambio de paradigma:** toda la inteligencia se mueve del browser al servidor.
El browser se convierte en un terminal tonto que muestra mensajes.
El servidor se convierte en el agente que entiende, decide y actúa sobre el disco.
