/**
 * WHATSAPP BOT CON GROQ AI (LLAMA 4 SCOUT) - MR LETREROS
 * Sistema de calificación inteligente de leads con conversación natural
 * 
 * REQUISITOS:
 * - Node.js 18+
 * - npm install whatsapp-web.js qrcode-terminal openai
 * - API Key de Groq (gratis en console.groq.com)
 * 
 * USO:
 * 1. Configurar GROQ_API_KEY
 * 2. node whatsapp-bot-gemini.js
 * 3. Escanear QR con WhatsApp Business
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const OpenAI = require('openai');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const axios = require('axios');
const notifier = require('node-notifier'); // Nueva dependencia para notificaciones de Windows
const TelefonoArgentino = require('telefono-argentino'); // Librería para identificar localidades

// Cargar base de datos de localidades (ENACOM)
let localizacionesDB = null;
try {
  const rawData = require('telefono-argentino/data/response.json');
  if (rawData && rawData.values) {
    localizacionesDB = {};
    rawData.values.slice(1).forEach(row => {
      localizacionesDB[row[0]] = {
        jurisdiccion: row[1],
        localidades: row[2], // Lista completa de ciudades
        cabecera: row[3]     // Ciudad principal
      };
    });
    console.log(`✅ Base de datos de ciudades cargada (${Object.keys(localizacionesDB).length} registros).`);
  }
} catch (e) {
  console.error('⚠️ Error cargando base de datos de ciudades:', e.message);
}

// ══════════════════════════════════════════════════════════════════════
// IDENTIFICACIÓN DE REGIONES (ARGENTINA)
// ══════════════════════════════════════════════════════════════════════
function identificarRegion(numeroStr) {
  try {
    let numRaw = numeroStr.split('@')[0].replace(/\D/g, '');
    if (numRaw.startsWith('0054')) numRaw = numRaw.substring(2);

    if (!numRaw.startsWith('54')) {
      if (numRaw.startsWith('0')) numRaw = numRaw.substring(1);
      if (numRaw.length < 10) return 'Internacional';
      numRaw = '54' + numRaw;
    }

    const tel = new TelefonoArgentino(numRaw);
    const data = tel.getData();
    const areaCode = data ? data.area_code : null;

    const formatInfo = (info) => {
      if (!info) return null;
      // Si es una cabecera importante o única
      if (info.cabecera && info.cabecera !== '---') {
        return `${info.cabecera} (${info.jurisdiccion})`;
      }
      // Si no tiene cabecera clara, devolver jurisdicción
      return info.jurisdiccion;
    };

    if (areaCode && localizacionesDB) {
      const res = formatInfo(localizacionesDB[areaCode]);
      if (res) return res;
    }

    // Plan B: Búsqueda manual por prefijo si la librería no lo detectó
    if (numRaw.startsWith('54') && localizacionesDB) {
      // Probar códigos de 4, 3 y 2 dígitos (de más específico a más general)
      for (let len = 4; len >= 2; len--) {
        const manualArea = numRaw.startsWith('549') ? numRaw.substring(3, 3 + len) : numRaw.substring(2, 2 + len);
        const res = formatInfo(localizacionesDB[manualArea]);
        if (res) return res;
      }
    }

    return numRaw.startsWith('54') ? 'Argentina' : 'Internacional';
  } catch (e) {
    return 'Internacional';
  }
}

// ══════════════════════════════════════════════════════════════════════
// MANEJO DE ERRORES GLOBAL
// ══════════════════════════════════════════════════════════════════════
process.on('uncaughtException', (err) => {
  console.error('🔥 [ERROR CRÍTICO] Excepción no capturada:', err);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('🔥 [ERROR CRÍTICO] Promesa rechazada:', reason);
  if (reason.toString().includes('Execution context was destroyed')) {
    console.log('♻️ Reiniciando cliente por error de contexto...');
    try { await client.destroy(); } catch (e) { }
    setTimeout(startClient, 5000);
  }
});

// ══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ══════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Tu API Key de Groq
  groqApiKey: process.env.GROQ_API_KEY || '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',

  // ⚠️ REEMPLAZA ESTOS NÚMEROS con los de tus vendedores (formato: 549...)
  vendedores: [
    '5491112345678',  // Vendedor 1
    '5491187654321'   // Vendedor 2
  ],

  // Directorios de datos (Alineado con server.js)
  dataDir: path.join(__dirname, 'datos_mr_letreros', 'bot_whatsapp'),
  conversationsFile: path.join(__dirname, 'datos_mr_letreros', 'bot_whatsapp', 'conversations.json'),
  leadsHotFile: path.join(__dirname, 'datos_mr_letreros', 'bot_whatsapp', 'leads_hot.json'),
  leadsWarmFile: path.join(__dirname, 'datos_mr_letreros', 'bot_whatsapp', 'leads_warm.json'),
  leadsColdFile: path.join(__dirname, 'datos_mr_letreros', 'bot_whatsapp', 'leads_cold.json'),
  // ✅ Archivo de precios reales del negocio
  preciosFile: path.join(__dirname, 'datos_mr_letreros', 'gremio_precios_db.json'),
  tercerosFile: path.join(__dirname, 'datos_mr_letreros', 'gremio_terceros.json'),
  finalesFile: path.join(__dirname, 'datos_mr_letreros', 'gremio_precios_finales.json'),
  promptsFile: path.join(__dirname, 'datos_mr_letreros', 'bot_whatsapp', 'system_prompt.txt'),
  imagesDir: path.join(__dirname, 'datos_mr_letreros', 'bot_whatsapp', 'imagenes'),
  configFile: path.join(__dirname, 'datos_mr_letreros', 'bot_whatsapp', 'bot_config.json'),
  learningsFile: path.join(__dirname, 'datos_mr_letreros', 'bot_whatsapp', 'aprendizajes.json'),
  maxLearnings: 50, // Máximo de reglas aprendidas (FIFO)

  // Parámetros de conversación
  maxTurnos: 4,           // Máximo 4 intercambios antes de derivar a vendedor
  scoreMinCaliente: 60,   // Score mínimo para lead caliente
  inactivityTimeout: 15 * 60 * 1000, // 15 minutos
  operatorTimeout: 10 * 60 * 1000, // 10 minutos para que el operador responda
  botEnabled: true,       // Estado del bot
  pricingMode: 'cliente',  // Modo de precios (cliente/gremio)
  aiProvider: 'groq',      // PROVEEDOR PRIMARIO: Groq Cloud
  ollamaModel: 'gemma4:e4b',
  ollamaVisionModel: 'gemma4:e4b',

  // Horario comercial por defecto
  businessHours: {
    enabled: false,
    timezone: 'America/Argentina/Buenos_Aires',
    holidays: [],
    schedule: {
      "0": { start: "09:00", end: "18:00" },
      "1": { start: "09:00", end: "18:00" },
      "2": { start: "09:00", end: "18:00" },
      "3": { start: "09:00", end: "18:00" },
      "4": { start: "09:00", end: "18:00" },
      "5": { start: "09:00", end: "18:00" },
      "6": { start: "09:00", end: "18:00" }
    }
  }
};

// Cargar configuración persistente si existe
let currentBotStatus = { message: 'Iniciando sistema...', color: '#9E9E9E' };
// CARGA GLOBAL DE CONVERSACIONES PARA EVITAR CONCURRENCIA
let conversacionesActivas = loadJSON(CONFIG.conversationsFile);
// Bloqueo para evitar procesamiento duplicado de mensajes simultáneos
const procesandoNumeros = new Set();
try {
  if (fs.existsSync(CONFIG.configFile)) {
    const saved = JSON.parse(fs.readFileSync(CONFIG.configFile, 'utf-8'));
    if (saved.botEnabled !== undefined) CONFIG.botEnabled = saved.botEnabled;
    if (saved.pricingMode) CONFIG.pricingMode = saved.pricingMode;
    if (saved.vendedores) CONFIG.vendedores = saved.vendedores;
    if (saved.operatorTimeout !== undefined) CONFIG.operatorTimeout = saved.operatorTimeout;
    if (saved.aiProvider) CONFIG.aiProvider = saved.aiProvider;
    if (saved.ollamaModel) CONFIG.ollamaModel = saved.ollamaModel;
    if (saved.ollamaVisionModel) CONFIG.ollamaVisionModel = saved.ollamaVisionModel;
    if (saved.activePromptFile) {
      CONFIG.promptsFile = path.join(CONFIG.dataDir, saved.activePromptFile);
    }
    if (saved.businessHours) {
      CONFIG.businessHours = saved.businessHours;
    }
  }
} catch (e) { console.error('⚠️ Error cargando configuración guardada:', e.message); }

// ══════════════════════════════════════════════════════════════════════
// 🧠 CEREBRO DEL BOT (INSTRUCCIONES PARA LLAMA 4 SCOUT)
// ══════════════════════════════════════════════════════════════════════
// Aquí defines cómo quieres que se comporte la IA.
// Este es el TEMPLATE POR DEFECTO si no existe el archivo.
const DEFAULT_PROMPT_TEMPLATE = `
Eres un Asesor Comercial Senior de MR Letreros, una empresa líder en gráfica y señalética. Tu trato es profesional, respetuoso y sobrio. Hablas con la seguridad de un experto técnico que valora el tiempo del cliente.

═══ TU MISIÓN ═══
- Calificar al lead entendiendo sus requerimientos técnicos y comerciales de forma eficiente.
- ⚠️ PRIORIDAD: Si el cliente envía una imagen, analízala con criterio profesional. Comenta aspectos técnicos relevantes (materiales, ubicación, proporciones). No preguntes obviedades que ya se ven en la foto.
- 🏢 CLIENTES GREMIO: Si el cliente tiene la etiqueta "Gremio", tratálo como un colega (imprentero/diseñador). Usa los "Precio Gremio" y mencionale que puede autogestionar sus pedidos con carga de archivos en el Portal Gremio si lo desea.

═══ TU PERSONALIDAD (PROFESIONAL Y SOBRIA) ═══
- Evita el uso de muletillas informales como "Genial", "Buenísimo", "Dale", "Impecable" o "Buenas".
- No trates al cliente con excesiva confianza; mantén un tono de respeto empresarial.
- Usa frases directas y profesionales: "Entendido", "Recibido", "Le comento los detalles técnicos...", "He analizado la imagen adjunta...".
- Si recibes una imagen, responde con análisis: "He recibido la imagen. Se observa que el espacio disponible es [X], lo cual es apto para [Y]".
- NUNCA uses diminutivos ni trates al cliente de forma paternalista.

═══ REGLAS DE NEGOCIO ═══
- Datos de contacto oficiales de la empresa (⚠️ IMPORTANTE: Solo proporcionar la dirección física o ubicación exacta si el cliente la solicita explícitamente):
  * Dirección: J. P. López 3162, Santa Fe (3000)
  * Teléfono/WhatsApp: +54 9 342 613-6868 (o 342 613-6868)
  * Email: info@mrletreros.com
- Productos: Letreros corpóreos (polyfan, acrílico, chapa), luminosos (LED, neón), vinilos, señalética.
- REGLA DE ORO: Retiro por local en J. P. López 3162, Santa Fe. Realizamos envíos e instalación en Santa Fe y alrededores. NO hacemos envíos nacionales de cartelería grande sin instalación propia.
- PRECIOS: Siempre mencioná que son + IVA si requiere factura A.
- TIPO DE CLIENTE ACTUAL: {{TIPO_CLIENTE}}

═══ LO YA SABEMOS (INSIGHTS) ═══
{{INSIGHTS}}

═══ ESTADO DE LA CONSULTA ═══
{{TEMAS_STATUS}}

═══ IMÁGENES DE EJEMPLO DISPONIBLES ═══
{{IMAGENES}}

═══ LISTA DE PRECIOS ═══
{{CATALOGO}}

═══ APRENDIZAJES DE VENDEDORES (USAR SIEMPRE) ═══
{{APRENDIZAJES}}

═══ REGLAS DE RESPUESTA ═══
1. **ANÁLISIS VISUAL**: Si en el mensaje actual viene una [Descripción visual], usala como si la estuvieras viendo vos. Respondé sobre lo que ves.
2. **COTIZACIÓN**: Si tenés medidas y producto, da el precio aproximado "llave en mano".
3. **PASO A PASO**: Pedí lo que falta de a poco. No mandes un cuestionario.
4. **MODO GREMIO**: Si el tipo de cliente es GREMIO, sé más técnico (hablá de materiales específicos, vectores, terminaciones).
5. **EVITAR REPETICIONES**: NUNCA repitas textualmente los mensajes previos del historial (ya sean del Cliente, del Bot o del Operador). No copies textualmente las frases o reglas descritas en la sección de "APRENDIZAJES"; úsalas solo como guía conceptual de negocio para redactar tu propia respuesta de forma natural, original y coherente con el último mensaje.

Responde SOLO JSON:
{
  "score": [0-30],
  "insights": { 
    "urgencia": "alta/media/baja", 
    "producto": "...", 
    "medidas": "...", 
    "ubicacion": "interior/exterior",
    "tipoCliente": "gremio/final" 
  },
  "siguientePregunta": "Tu respuesta aquí (natural y humana)",
  "presupuestoAceptado": true/false,
  "imagen": "nombre_archivo.jpg"
}

═══ HISTORIAL ═══
{{HISTORIAL}}

═══ MENSAJE ACTUAL ═══
"{{MENSAJE}}"
`;
// Variable para almacenar el prompt actual en memoria
let currentSystemPrompt = DEFAULT_PROMPT_TEMPLATE;

// Función para cargar el prompt desde el archivo
function loadSystemPrompt() {
  try {
    // Asegurar que el directorio existe
    const dir = path.dirname(CONFIG.promptsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(CONFIG.promptsFile)) {
      currentSystemPrompt = fs.readFileSync(CONFIG.promptsFile, 'utf-8');
      console.log(`📄 Prompt del sistema cargado desde: ${CONFIG.promptsFile}`);
    } else {
      // Si no existe, creamos el archivo con el default
      fs.writeFileSync(CONFIG.promptsFile, DEFAULT_PROMPT_TEMPLATE, 'utf-8');
      currentSystemPrompt = DEFAULT_PROMPT_TEMPLATE;
      console.log(`📄 Archivo de prompt creado con plantilla por defecto en: ${CONFIG.promptsFile}`);
    }
  } catch (err) {
    console.error('❌ Error cargando prompt:', err.message);
    currentSystemPrompt = DEFAULT_PROMPT_TEMPLATE;
  }
}

// Configurar vigilancia de archivo para recarga automática (Hot Reload)
try {
  const promptDir = path.dirname(CONFIG.promptsFile);
  if (fs.existsSync(promptDir)) {
    fs.watch(promptDir, (eventType, filename) => {
      if (filename && filename === path.basename(CONFIG.promptsFile)) {
        console.log(`📝 Detectado cambio externo en ${filename}. Recargando...`);
        loadSystemPrompt();
      }
    });
  }
} catch (e) {
  console.warn('⚠️ No se pudo iniciar el watcher de archivos de prompt:', e.message);
}

// ══════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN DE GROQ
// ══════════════════════════════════════════════════════════════════════

let aiClient;
let aiModelAvailable = true;

function inicializarIA() {
  const useOllama = CONFIG.aiProvider === 'ollama';

  if (useOllama) {
    aiClient = new OpenAI({
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'ollama',
    });
    console.log(`🤖 Ollama (Local) inicializado para el Bot: ${CONFIG.ollamaModel || 'llama3.1'}`);
  } else {
    aiClient = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: CONFIG.groqApiKey,
      timeout: 15000,
      maxRetries: 2
    });
    console.log(`🌐 Groq Cloud inicializado para el Bot: Llama 4 Scout`);
  }

  // Test de conectividad
  (async () => {
    try {
      const modelName = useOllama ? (CONFIG.ollamaModel || 'llama3.1') : 'meta-llama/llama-4-scout-17b-16e-instruct';
      await aiClient.chat.completions.create({
        model: modelName,
        messages: [{ role: 'user', content: 'Responder solo ok' }],
        max_tokens: 5
      });
      console.log(`✅ IA (${CONFIG.aiProvider || 'groq'}) conectada y funcionando correctamente.`);
    } catch (testErr) {
      console.error(`❌ IA (${CONFIG.aiProvider || 'groq'}) NO RESPONDE:`, testErr.message);
      aiModelAvailable = false;
    }
  })();
}

inicializarIA();

// ══════════════════════════════════════════════════════════════════════
// HORARIOS DE ATENCIÓN Y FERIADOS
// ══════════════════════════════════════════════════════════════════════

let fetchedHolidays = [];

/**
 * Sincroniza los feriados oficiales de Argentina desde una API externa.
 */
async function syncHolidays() {
  try {
    const timezone = CONFIG.businessHours?.timezone || 'America/Argentina/Buenos_Aires';
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    const year = now.getFullYear();

    log(`🔄 Sincronizando feriados de Argentina (${year}) desde API...`);

    // API: https://date.nager.at/api/v3/PublicHolidays/{year}/AR
    const response = await axios.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/AR`);

    if (Array.isArray(response.data)) {
      fetchedHolidays = response.data.map(h => h.date);
      log(`✅ Sincronizados ${fetchedHolidays.length} feriados oficiales.`);
      io.emit('holiday-data', { manual: CONFIG.businessHours?.holidays || [], fetched: fetchedHolidays });
    }
  } catch (err) {
    log(`⚠️ Error sincronizando feriados: ${err.message}. Se usará solo la lista manual.`);
  }
}

/**
 * Verifica si la hora actual está dentro del horario comercial configurado.
 * @returns {boolean}
 */
function isWithinBusinessHours() {
  if (!CONFIG.businessHours || !CONFIG.businessHours.enabled) return false;

  try {
    const timezone = CONFIG.businessHours.timezone || 'America/Argentina/Buenos_Aires';
    // Obtener fecha y hora en la zona horaria destino
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));

    // 📅 Verificar si hoy es feriado (Manual o desde API)
    const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const manualHolidays = CONFIG.businessHours.holidays || [];

    if (manualHolidays.includes(dateStr) || fetchedHolidays.includes(dateStr)) {
      log(`📅 Hoy (${dateStr}) es feriado. El bot permanecerá ACTIVO.`);
      return false;
    }

    const dayOfWeek = now.getDay(); // 0 (Domingo) a 6 (Sábado)
    const schedule = CONFIG.businessHours.schedule[dayOfWeek.toString()];

    if (!schedule || !schedule.start || !schedule.end) {
      return false; // Cerrado si no hay horario definido para ese día
    }

    const [startHour, startMin] = schedule.start.split(':').map(Number);
    const [endHour, endMin] = schedule.end.split(':').map(Number);

    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    const startTimeMinutes = startHour * 60 + startMin;
    const endTimeMinutes = endHour * 60 + endMin;

    return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
  } catch (err) {
    console.error('❌ Error verificando horario comercial:', err.message);
    return true; // En caso de error, preferimos atender
  }
}

// ══════════════════════════════════════════════════════════════════════
// UTILIDADES
// ══════════════════════════════════════════════════════════════════════

// Crear directorio de datos si no existe
if (!fs.existsSync(CONFIG.dataDir)) {
  fs.mkdirSync(CONFIG.dataDir, { recursive: true });
}
// Crear directorio de imágenes si no existe
if (!fs.existsSync(CONFIG.imagesDir)) {
  fs.mkdirSync(CONFIG.imagesDir, { recursive: true });
}

// Inicializar archivos JSON
[CONFIG.conversationsFile, CONFIG.leadsHotFile, CONFIG.leadsWarmFile, CONFIG.leadsColdFile].forEach(file => {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({}, null, 2));
  }
});

function loadJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch (err) {
    return {};
  }
}

function saveJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// ══════════════════════════════════════════════════════════════════════
// CARGAR PRECIOS DESDE ARCHIVO REAL
// Lee gremio_precios_db.json y formatea el catálogo para el prompt de IA.
// Se recarga en cada mensaje para reflejar cambios sin reiniciar el bot.
// ══════════════════════════════════════════════════════════════════════
function cargarCatalogoParaIA() {
  try {
    if (!fs.existsSync(CONFIG.preciosFile)) {
      return '(Lista de precios no disponible — archivo no encontrado)';
    }

    let catalogo = '';

    // 1. Cargar Precios Finales (Prioridad)
    if (fs.existsSync(CONFIG.finalesFile)) {
      try {
        const finales = JSON.parse(fs.readFileSync(CONFIG.finalesFile, 'utf-8'));
        if (Array.isArray(finales) && finales.length > 0) {
          catalogo += `\n🏆 PRODUCTOS TERMINADOS (PRECIO FINAL - NO SUMAR COMPONENTES):\n`;
          finales.forEach(p => {
            const precio = new Intl.NumberFormat('es-AR').format(p.precio);
            const unidad = p.unidad || 'unidad';
            const desc = p.descripcion ? ` (${p.descripcion})` : '';
            catalogo += `   • ${p.nombre}${desc}: $${precio} por ${unidad}\n`;
          });
          catalogo += `   (NOTA: Para estos productos, el precio ya incluye todo. Solo multiplicar por cantidad/m²).\n`;
        }
      } catch (e) { console.error('Error leyendo precios finales', e); }
    }

    const precios = JSON.parse(fs.readFileSync(CONFIG.preciosFile, 'utf-8'));
    if (!Array.isArray(precios) || precios.length === 0) {
      return '(Lista de precios vacía — cargala desde el panel de control)';
    }

    // Agrupar por categoría
    const porCategoria = {};
    precios.forEach(item => {
      const cat = item.categoria || 'Materiales / Impresión';
      if (!porCategoria[cat]) porCategoria[cat] = [];
      porCategoria[cat].push(item);
    });

    // Formatear como texto para el prompt
    for (const [categoria, items] of Object.entries(porCategoria)) {
      catalogo += `\n📦 ${categoria.toUpperCase()}:\n`;
      items.forEach(item => {
        const precioGremio = new Intl.NumberFormat('es-AR').format(item.precioGremio || 0);
        const precioCliente = new Intl.NumberFormat('es-AR').format(item.precioCliente);
        const unit = (item.unidad || item.unit || '').toLowerCase();
        const esMetro = unit.includes('m2') || unit.includes('m²') || (item.area && item.area >= 1);
        const unidadLabel = esMetro ? 'm²' : 'unidad';
        catalogo += `   • ${item.producto}: $${precioGremio} (Gremio) / $${precioCliente} (Cliente Final) por ${unidadLabel}\n`;
      });
    }

    // Agregar servicios de terceros si existen
    if (fs.existsSync(CONFIG.tercerosFile)) {
      const terceros = JSON.parse(fs.readFileSync(CONFIG.tercerosFile, 'utf-8'));
      if (Array.isArray(terceros) && terceros.length > 0) {
        catalogo += `\n🔧 SERVICIOS DE TERCEROS (MANO DE OBRA / ESTRUCTURAS):\n`;
        terceros.forEach(t => {
          t.servicios?.forEach(s => {
            // Usamos s.precio (Precio de Venta al Público), NO s.costo
            const precioVenta = new Intl.NumberFormat('es-AR').format(s.precio || 0);
            const unit = (s.unidad || 'unidad').toLowerCase();
            const labelUnit = (unit.includes('m2') || unit.includes('m²')) ? 'm²' : s.unidad;
            catalogo += `   • ${s.nombre} (${t.nombre}): $${precioVenta} (Precio Venta) por ${labelUnit}\n`;
          });
        });
      }
    }

    return catalogo;
  } catch (err) {
    console.error('❌ Error cargando precios:', err.message);
    return '(Error al cargar precios)';
  }
}

/**
 * Carga los aprendizajes extraídos de conversaciones de operadores.
 * @returns {string} Texto formateado con las reglas aprendidas.
 */
function cargarAprendizajesParaIA() {
  try {
    if (!fs.existsSync(CONFIG.learningsFile)) return '(Sin aprendizajes todavía. El bot aprenderá de los operadores.)';
    const aprendizajes = JSON.parse(fs.readFileSync(CONFIG.learningsFile, 'utf-8'));
    if (!Array.isArray(aprendizajes) || aprendizajes.length === 0) return '(Sin aprendizajes todavía.)';

    return aprendizajes.map((a, i) => {
      return `${i + 1}. ${a.regla}${a.contexto ? ` (Contexto: ${a.contexto})` : ''}`;
    }).join('\n');
  } catch (e) {
    return '(Error cargando aprendizajes)';
  }
}

/**
 * Analiza una conversación donde intervino un operador y extrae reglas/patrones.
 * @param {array} historial - Historial completo con mensajes de cliente, bot y operador.
 * @param {string} nombreCliente - Nombre del cliente.
 */
async function extraerAprendizajes(historial, nombreCliente) {
  try {
    // Solo extraer si hubo mensajes del operador
    const mensajesOperador = historial.filter(h => h.rol === 'operador');
    if (mensajesOperador.length < 2) {
      log('ℹ️ Menos de 2 mensajes del operador, no se extraen aprendizajes.');
      return;
    }

    // Construir la conversación para análisis
    const conversacionTexto = historial.map(h => {
      const emoji = h.rol === 'cliente' ? '👤 Cliente' : h.rol === 'operador' ? '👨‍💼 Operador humano' : '🤖 Bot';
      return `${emoji}: ${h.mensaje}`;
    }).join('\n');

    const promptExtraccion = `Analiza esta conversación REAL entre un operador experto de MR Letreros (negocio de gráfica y señalética) y un cliente.
El operador es un vendedor humano experimentado. Tu tarea es extraer REGLAS y PATRONES útiles de cómo atendió.

CONVERSACIÓN:
${conversacionTexto}

EXTRAE las reglas de venta y atención que usó el operador. Enfocate en:
1. ¿Qué preguntas hizo para entender al cliente?
2. ¿Cómo manejó objeciones o dudas?
3. ¿Qué información técnica ofreció?
4. ¿Cómo cerró la venta o derivó?
5. ¿Qué productos recomendó y por qué?
6. ¿Rechazó algún pedido? ¿Por qué? (ej: "no vendemos ese tipo de letreros")

Responde SOLO con un JSON array de objetos:
[
  { "regla": "Descripción clara de la regla", "contexto": "Situación donde aplica", "confianza": "alta|media|baja" }
]

Máximo 5 reglas. Solo reglas CONCRETAS y ACCIONABLES que el bot pueda usar. No incluyas reglas genéricas como "ser amable".`;

    const useOllama = CONFIG.aiProvider === 'ollama';
    const modelToUse = useOllama ? (CONFIG.ollamaModel || 'llama3.2:latest') : 'meta-llama/llama-4-scout-17b-16e-instruct';

    const completion = await aiClient.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: 'system', content: 'Eres un analista de ventas. Responde SOLO con JSON válido, sin texto adicional ni backticks.' },
        { role: 'user', content: promptExtraccion }
      ],
      max_tokens: 800,
      temperature: 0.3,
      response_format: useOllama ? undefined : { type: 'json_object' }
    });

    const responseText = completion.choices[0].message.content.trim()
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parsear respuesta - puede ser array directo o objeto con array
    let nuevasReglas;
    const parsed = JSON.parse(responseText);
    if (Array.isArray(parsed)) {
      nuevasReglas = parsed;
    } else if (parsed.reglas && Array.isArray(parsed.reglas)) {
      nuevasReglas = parsed.reglas;
    } else {
      // Intentar extraer array del JSON
      const arrMatch = responseText.match(/\[[\s\S]*\]/);
      nuevasReglas = arrMatch ? JSON.parse(arrMatch[0]) : [];
    }

    if (!nuevasReglas || nuevasReglas.length === 0) {
      log('ℹ️ No se extrajeron reglas de esta conversación.');
      return;
    }

    // Agregar metadata
    nuevasReglas.forEach(r => {
      r.fecha = new Date().toISOString().split('T')[0];
      r.cliente = nombreCliente;
    });

    // Cargar aprendizajes existentes y agregar los nuevos
    let aprendizajes = [];
    try {
      if (fs.existsSync(CONFIG.learningsFile)) {
        aprendizajes = JSON.parse(fs.readFileSync(CONFIG.learningsFile, 'utf-8'));
      }
    } catch (e) { aprendizajes = []; }

    // Filtrar reglas duplicadas (comparar texto similar)
    const reglasExistentes = aprendizajes.map(a => a.regla.toLowerCase());
    const reglasNuevasUnicas = nuevasReglas.filter(r => {
      const reglaLower = r.regla.toLowerCase();
      return !reglasExistentes.some(existente => {
        // Si más del 70% de las palabras coinciden, es duplicada
        const palabrasNueva = reglaLower.split(/\s+/);
        const coincidencias = palabrasNueva.filter(p => existente.includes(p)).length;
        return coincidencias / palabrasNueva.length > 0.7;
      });
    });

    if (reglasNuevasUnicas.length === 0) {
      log('ℹ️ Las reglas extraídas ya existían. No se agregaron duplicados.');
      return;
    }

    aprendizajes.push(...reglasNuevasUnicas);

    // Mantener máximo (FIFO - descartar las más viejas)
    if (aprendizajes.length > CONFIG.maxLearnings) {
      aprendizajes = aprendizajes.slice(aprendizajes.length - CONFIG.maxLearnings);
    }

    fs.writeFileSync(CONFIG.learningsFile, JSON.stringify(aprendizajes, null, 2));
    log(`🧠 ¡Aprendizaje exitoso! Se extrajeron ${reglasNuevasUnicas.length} nuevas reglas de la conversación con ${nombreCliente}.`);
    reglasNuevasUnicas.forEach(r => log(`   📌 ${r.regla}`));
    io.emit('log', `📚 Total de aprendizajes: ${aprendizajes.length}/${CONFIG.maxLearnings}`);

  } catch (err) {
    log(`⚠️ Error extrayendo aprendizajes: ${err.message}`);
  }
}

function cargarImagenesParaIA() {
  try {
    if (!fs.existsSync(CONFIG.imagesDir)) return '(No hay imágenes disponibles)';
    const files = fs.readdirSync(CONFIG.imagesDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    return files.length > 0 ? files.join(', ') : '(No hay imágenes disponibles)';
  } catch (e) { return '(Error leyendo imágenes)'; }
}

async function analizarImagenConLlama(b64Image) {
  const useOllama = CONFIG.aiProvider === 'ollama';
  try {
    const clientVision = new OpenAI({
      baseURL: useOllama ? 'http://localhost:11434/v1' : 'https://api.groq.com/openai/v1',
      apiKey: useOllama ? 'ollama' : CONFIG.groqApiKey,
    });

    // Llama 4 Scout soporta visión nativamente en Groq
    const visionModel = useOllama ? (CONFIG.ollamaVisionModel || 'llava:latest') : 'meta-llama/llama-4-scout-17b-16e-instruct';

    const prompt = `Analizá esta imagen enviada por un cliente a un negocio de gráfica y letreros (MR Letreros). 
    
    TAREAS ESPECÍFICAS:
    1. Describí qué ves: ¿Es un logo, una fachada de local, un letrero existente, un diseño de referencia?
    2. ⚠️ MUY IMPORTANTE: Buscá marcas, dibujos o círculos hechos por el usuario sobre la imagen (ej: marcas en verde, rojo, flechas). Si las hay, explicá qué está señalando el cliente.
    3. Identificá medidas anotadas a mano o en el entorno.
    4. Mencioná materiales visibles (chapa, acrílico, lona, madera, etc.) y colores.
    
    Sé conciso, profesional y directo. Tu descripción será leída por otra IA que no puede ver la imagen.`;

    const response = await clientVision.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64Image}` } }
          ],
        },
      ],
      max_tokens: 400,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('❌ Error analizando imagen con Llama:', error.message);
    // Intentar con modelo alternativo de visión si falla
    if (!useOllama) {
      try {
        log('🔄 Reintentando análisis de imagen con modelo alternativo...');
        const fallbackVision = new OpenAI({
          baseURL: 'https://api.groq.com/openai/v1',
          apiKey: CONFIG.groqApiKey,
        });
        const fbResponse = await fallbackVision.chat.completions.create({
          model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Describí brevemente qué ves en esta imagen. Sé conciso." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64Image}` } }
            ],
          }],
          max_tokens: 300,
        });
        return fbResponse.choices[0].message.content;
      } catch (fbErr) {
        console.error('❌ Fallback de visión también falló:', fbErr.message);
      }
    }
    return '(Error analizando contenido visual)';
  }
}

function calcularTier(score) {
  if (score >= 80) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

function formatearNumero(numero) {
  return numero.replace(/\D/g, '').replace(/^549/, '54');
}

/**
 * Crea un registro de cliente en clientes.json si no existe.
 * Se llama cuando un lead acepta un presupuesto.
 * @param {object} conversacion - El objeto de la conversación activa.
 * @param {string} numero - El número de teléfono del cliente.
 */
async function crearClienteDesdeLead(conversacion, numero) {
  const { nombre, insights } = conversacion;

  const clientPayload = {
    id: `client_${Date.now()}`,
    nombre: nombre,
    name: nombre, // Compatibilidad
    telefono: numero,
    email: '',
    contacto: '',
    direccion: '',
    // Usa el tipo de cliente que determinó la IA, con un fallback a 'cliente_final'
    tipo: insights.tipoCliente === 'gremio' ? 'gremio' : 'cliente_final',
    fechaRegistro: new Date().toISOString(),
    origen: 'bot_whatsapp_lead'
  };

  try {
    const clientesFile = path.join(__dirname, 'datos_mr_letreros', 'clientes.json');
    let clientes = [];
    try {
      clientes = JSON.parse(fs.readFileSync(clientesFile, 'utf-8'));
    } catch (e) {
      log('ℹ️ Archivo de clientes no encontrado o vacío, se creará uno nuevo.');
    }

    const clienteExistente = clientes.find(c => {
      const cTel = (c.telefono || '').replace(/\D/g, '');
      const nTel = numero.replace(/\D/g, '');
      return cTel.includes(nTel) || nTel.includes(cTel);
    });

    if (clienteExistente) {
      log(`ℹ️ Cliente ${nombre} (${numero}) ya existe (ID: ${clienteExistente.id}). Actualizando información.`);
      // Opcional: Actualizar tipo si la IA detectó algo distinto
      if (insights.tipoCliente === 'gremio' && clienteExistente.tipo !== 'gremio') {
        clienteExistente.tipo = 'gremio';
      }
      fs.writeFileSync(clientesFile, JSON.stringify(clientes, null, 2));
      return;
    }

    clientes.push(clientPayload);
    fs.writeFileSync(clientesFile, JSON.stringify(clientes, null, 2));
    log(`✅ Cliente "${nombre}" agendado exitosamente con tipo "${clientPayload.tipo}".`);
  } catch (error) {
    log(`❌ Error al agendar cliente nuevo: ${error.message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// SERVIDOR PANEL DE CONTROL (SOCKET.IO)
// ══════════════════════════════════════════════════════════════════════

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
  socket.emit('log', '🔌 Panel conectado al cerebro de Gemini');
  socket.emit('status', currentBotStatus);
  socket.emit('config-data', CONFIG);
  socket.emit('holiday-data', { manual: CONFIG.businessHours?.holidays || [], fetched: fetchedHolidays });

  // Permitir cambiar configuración desde la web
  socket.on('save-config', (newConfig) => {
    if (newConfig.botEnabled !== undefined) CONFIG.botEnabled = newConfig.botEnabled;
    if (newConfig.pricingMode) CONFIG.pricingMode = newConfig.pricingMode;
    if (newConfig.vendedores) CONFIG.vendedores = newConfig.vendedores;
    if (newConfig.operatorTimeout !== undefined) CONFIG.operatorTimeout = newConfig.operatorTimeout;
    if (newConfig.businessHours) CONFIG.businessHours = newConfig.businessHours;

    // Cambio de Prompt Activo
    if (newConfig.activePromptFile) {
      const newPath = path.join(CONFIG.dataDir, newConfig.activePromptFile);
      if (fs.existsSync(newPath)) {
        CONFIG.promptsFile = newPath;
        loadSystemPrompt(); // Recargar cerebro inmediatamente
      }
    }

    // Guardar en disco para persistencia
    try {
      const configToSave = {
        botEnabled: CONFIG.botEnabled,
        pricingMode: CONFIG.pricingMode,
        vendedores: CONFIG.vendedores,
        operatorTimeout: CONFIG.operatorTimeout,
        activePromptFile: path.basename(CONFIG.promptsFile),
        businessHours: CONFIG.businessHours
      };
      fs.writeFileSync(CONFIG.configFile, JSON.stringify(configToSave, null, 2));
    } catch (e) { console.error('Error guardando config:', e); }

    socket.emit('config-saved', { success: true, message: 'Configuración actualizada en memoria.' });
    io.emit('config-data', CONFIG); // Actualizar a todos
    log(`⚙️ Configuración actualizada: Bot ${CONFIG.botEnabled ? 'ON' : 'OFF'}, Prompt: ${path.basename(CONFIG.promptsFile)}`);
  });

  // Enviar lista de precios si se solicita
  socket.on('refresh-prices', () => {
    try {
      if (fs.existsSync(CONFIG.pricesFile)) {
        const data = JSON.parse(fs.readFileSync(CONFIG.pricesFile, 'utf-8'));
        let items = [];
        if (Array.isArray(data)) items = data;
        else if (data[CONFIG.pricingMode]) items = data[CONFIG.pricingMode];
        else if (data.cliente) items = data.cliente;
        socket.emit('price-list', items);
      }
    } catch (e) { }
  });

  // Gestión de Prompts desde el Panel
  socket.on('get-prompt', () => {
    socket.emit('prompt-data', currentSystemPrompt);
  });

  socket.on('save-prompt', (newPrompt) => {
    currentSystemPrompt = newPrompt;
    fs.writeFileSync(CONFIG.promptsFile, newPrompt, 'utf-8');
    socket.emit('prompt-saved', { success: true });
    log('📝 Prompt del sistema actualizado desde el panel.');
  });

  // Listar archivos de prompt disponibles
  socket.on('get-prompts-list', () => {
    fs.readdir(CONFIG.dataDir, (err, files) => {
      const txtFiles = err ? [] : files.filter(f => f.endsWith('.txt'));
      socket.emit('prompts-list', txtFiles);
    });
  });
});

// Cola de mensajes para evitar colapso de Puppeteer (Detached Frame)
const messageQueue = [];
let isProcessingQueue = false;

// Función para reiniciar el cliente sin matar el proceso
let isRestarting = false;
async function restartClient() {
  if (isRestarting) return;
  isRestarting = true;
  console.log('🔄 Iniciando reinicio seguro del cliente WhatsApp...');
  try {
    await client.destroy();
  } catch (e) {
    console.log('⚠️ Error destruyendo cliente (ignorable):', e.message);
  }
  setTimeout(() => {
    client.initialize().then(() => {
      console.log('✅ Cliente WhatsApp reinicializado con éxito.');
      isRestarting = false;
    }).catch(e => {
      console.error('❌ Error al reinicializar:', e);
      isRestarting = false;
    });
  }, 3000);
}

async function processMessageQueue() {
  if (isProcessingQueue || messageQueue.length === 0) return;
  isProcessingQueue = true;

  while (messageQueue.length > 0) {
    if (isRestarting) {
      console.log('⏳ Esperando a que el cliente se reinicie para enviar mensajes...');
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    const { chatId, message, resolve, reject, retries = 0 } = messageQueue[0];
    try {
      console.log(`🤖 [API] Enviando a chatId: ${chatId} (En cola: ${messageQueue.length})`);
      await client.sendMessage(chatId, message);
      console.log(`✅ [API] Mensaje enviado a ${chatId}: "${message.substring(0, 50)}..."`);
      messageQueue.shift(); // Remover de la cola si es exitoso
      resolve({ success: true });
    } catch (error) {
      console.error(`❌ Error enviando mensaje a ${chatId}:`, error.message);

      if (error.message.includes('detached Frame') || error.message.includes('Target closed') || error.message.includes('Session closed')) {
        console.log('⚠️ Frame de Puppeteer caído. Programando reinicio del bot...');
        restartClient();

        // Reintentar hasta 3 veces
        if (retries < 3) {
          console.log(`🔄 Reintentando mensaje a ${chatId} en 10s... (Intento ${retries + 1}/3)`);
          messageQueue[0].retries = retries + 1;
          await new Promise(r => setTimeout(r, 10000)); // Esperar a que reinicie
        } else {
          console.log(`❌ Se agotaron los reintentos para ${chatId}. Descartando mensaje.`);
          messageQueue.shift();
          reject(new Error('No se pudo enviar el mensaje después de reiniciar.'));
        }
      } else {
        // Otro error distinto, descartar
        messageQueue.shift();
        reject(error);
      }
    }

    // Pausa entre mensajes para no saturar
    await new Promise(r => setTimeout(r, 2000));
  }

  isProcessingQueue = false;
}

// ➤ ENDPOINT API: Enviar mensaje desde el sistema (Asistente IA)
app.post('/send-message', async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Faltan datos (phone, message)' });
  }

  try {
    // Normalización robusta para números de Argentina (ej: 0342 154050011 -> 5493424050011)
    let cleanNum = String(phone).replace(/\D/g, '');
    
    // Quitar prefijo de país 54/549 si ya lo tiene para normalizar el resto
    let has54 = false;
    if (cleanNum.startsWith('54')) {
      cleanNum = cleanNum.substring(2);
      has54 = true;
    }
    if (has54 && cleanNum.startsWith('9')) {
      cleanNum = cleanNum.substring(1);
    }

    // Quitar el 0 inicial del código de área
    if (cleanNum.startsWith('0')) {
      cleanNum = cleanNum.substring(1);
    }

    // Quitar el 15 (prefijo móvil de Argentina) si está presente
    if (cleanNum.length >= 11) {
      if (cleanNum.substring(2, 4) === '15') {
        cleanNum = cleanNum.substring(0, 2) + cleanNum.substring(4);
      } else if (cleanNum.substring(3, 5) === '15') {
        cleanNum = cleanNum.substring(0, 3) + cleanNum.substring(5);
      } else if (cleanNum.substring(4, 6) === '15') {
        cleanNum = cleanNum.substring(0, 4) + cleanNum.substring(6);
      }
    } else if (cleanNum.length === 11 && cleanNum.startsWith('15')) {
      cleanNum = cleanNum.substring(2);
    }

    // Asegurar formato internacional argentino: 549 + código de área + número
    let num;
    if (cleanNum.length === 10) {
      num = '549' + cleanNum;
    } else {
      num = '549' + cleanNum;
    }

    const chatId = `${num}@c.us`;

    // Añadir a la cola y esperar resolución
    const result = await new Promise((resolve, reject) => {
      messageQueue.push({ chatId, message, resolve, reject, retries: 0 });
      processMessageQueue();
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.listen(3001, () => {
  console.log('🔌 Panel de control disponible en http://localhost:3001');
});

// ══════════════════════════════════════════════════════════════════════
// ANÁLISIS CON GROQ AI
// ══════════════════════════════════════════════════════════════════════

/**
 * Analiza el mensaje del cliente con Groq AI (Llama 4 Scout)
 * @param {string} mensajeCliente - Mensaje del cliente
 * @param {array} historial - Historial de la conversación
 * @param {array} etiquetas - Etiquetas de WhatsApp Business del contacto
 * @param {string} contextExtra - Contexto adicional (ej: descripción de imagen enviada)
 * @param {object} currentInsights - Información ya recolectada (medidas, producto, etc.)
 * @returns {object} { score, insights, siguientePregunta, resumen }
 */
async function analizarConIA(mensajeCliente, historial = [], etiquetas = [], contextExtra = '', currentInsights = {}) {
  // Wrapper para logs que también envía al panel
  function log(msg) { console.log(msg); io.emit('log', msg); }

  if (!aiModelAvailable) {
    // Fallback si la IA no está disponible
    return modoBasicoSinIA(mensajeCliente, CONFIG.aiProvider || 'IA');
  }

  // Construir historial para el prompt
  const contextoHistorial = historial.length > 0
    ? historial.map(h => {
      let rolStr = '🤖 Bot';
      if (h.rol === 'cliente') rolStr = '👤 Cliente';
      else if (h.rol === 'operador') rolStr = '👨‍💼 Operador';
      return `${rolStr}: ${h.mensaje}`;
    }).join('\n')
    : '(primera vez que escribe)';

  // Construir string de etiquetas para el prompt
  const contextoEtiquetas = etiquetas.length > 0
    ? etiquetas.join(', ')
    : 'Ninguna';

  // Extraer qué temas ya se preguntaron basándose en insights y texto
  // Extraer qué temas ya se preguntaron basándose en historial
  const preguntasYaHechas = historial.map(h => h.mensaje.toLowerCase()).join(' ');
  const yaSabeUrgencia = currentInsights.urgencia || preguntasYaHechas.match(/cuándo|cuando|fecha|plazo|cuanto tarda/i);
  const yaSabePresupuesto = currentInsights.presupuestoEstimado || preguntasYaHechas.match(/presupuesto|monto|inversión/i);
  const yaSabeProducto = currentInsights.producto || preguntasYaHechas.match(/qué necesitás|qué necesitas/i);
  const yaSabeMedidas = currentInsights.medidas || preguntasYaHechas.match(/medida|tamaño|ancho|alto|dimensiones/i);
  const yaSabeUbicacion = currentInsights.ubicacion || preguntasYaHechas.match(/dónde|donde|local|ubicación|zona/i);
  const yaSabeDiseño = currentInsights.diseno || preguntasYaHechas.match(/pdf|corel|vectores|logo|diseño/i);

  // Construir estado de temas consultados
  const temasStatus = `
  - Urgencia/fecha: ${yaSabeUrgencia ? 'YA SE SABE ✓' : 'pendiente'}
  - Presupuesto: ${yaSabePresupuesto ? 'YA SE SABE ✓' : 'pendiente'}
  - Tipo de producto: ${yaSabeProducto ? 'YA SE SABE ✓' : 'pendiente'}
  - Medidas/tamaño: ${yaSabeMedidas ? 'YA SE SABE ✓' : 'pendiente'}
  - Ubicación/zona: ${yaSabeUbicacion ? 'YA SE SABE ✓' : 'pendiente'}
  - Diseño/Archivo: ${yaSabeDiseño ? 'YA SE SABE ✓' : 'pendiente'}
  `;

  // Agregar contexto extra (imágenes) al mensaje si existe
  const mensajeConContexto = contextExtra
    ? `${mensajeCliente}\n${contextExtra}`
    : mensajeCliente;

  // Reemplazar placeholders en el prompt cargado
  const insightsTexto = JSON.stringify(currentInsights, null, 2);

  const tipoClienteActual = etiquetas.some(e => e.toLowerCase().includes('gremio')) ? 'GREMIO' : 'CLIENTE FINAL';

  const prompt = currentSystemPrompt
    .replace('{{CATALOGO}}', cargarCatalogoParaIA())
    .replace('{{IMAGENES}}', cargarImagenesParaIA())
    .replace('{{APRENDIZAJES}}', cargarAprendizajesParaIA())
    .replace('{{INSIGHTS}}', insightsTexto)
    .replace('{{HISTORIAL}}', contextoHistorial)
    .replace('{{MENSAJE}}', mensajeConContexto)
    .replace('{{TEMAS_STATUS}}', temasStatus)
    .replace('{{ETIQUETAS}}', contextoEtiquetas)
    .replace('{{TIPO_CLIENTE}}', tipoClienteActual);

  try {
    const useOllama = CONFIG.aiProvider === 'ollama';
    const modelToUse = useOllama ? (CONFIG.ollamaModel || 'gemma4:e4b') : 'meta-llama/llama-4-scout-17b-16e-instruct';

    const completion = await Promise.race([
      aiClient.chat.completions.create({
        model: modelToUse,
        messages: [
          { role: 'system', content: 'Eres un asistente de ventas. Responde SIEMPRE con un objeto JSON válido, sin texto adicional ni backticks.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1024,
        temperature: 0.7,
        response_format: useOllama ? undefined : { type: 'json_object' }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), useOllama ? 120000 : 120000))
    ]);

    const responseText = completion.choices[0].message.content.trim();

    // Limpiar por si acaso viene con backticks
    const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log(`⚠️  Groq no devolvió JSON válido: ${responseText.substring(0, 100)}`);
      return modoBasicoSinIA(mensajeCliente, 'Groq');
    }

    const analisis = JSON.parse(jsonMatch[0]);

    // Log siempre para debug
    log(`📋 Groq raw: score=${analisis.score} | respuesta="${String(analisis.siguientePregunta || analisis.respuesta || analisis.response || analisis.mensaje || '').substring(0, 60)}"`);

    // Normalizar campos por si Groq usa nombres alternativos
    if (!analisis.siguientePregunta) {
      analisis.siguientePregunta =
        analisis.respuesta ||
        analisis.response ||
        analisis.mensaje ||
        analisis.nextQuestion ||
        analisis.reply ||
        null;
    }
    if (analisis.score == null) analisis.score = 5;

    if (!analisis.siguientePregunta) {
      log(`⚠️  Groq no generó respuesta. JSON completo: ${JSON.stringify(analisis).substring(0, 200)}`);
      return modoBasicoSinIA(mensajeCliente, 'Groq');
    }

    if (!analisis.insights) analisis.insights = {};

    log(`🧠 Groq OK: ${analisis.score} pts | ${analisis.insights?.urgencia || 'N/A'} urgencia`);
    return analisis;

  } catch (err) {
    log(`❌ Error en IA (${CONFIG.aiProvider}): ${err.message}`);

    // 🔥 RESPALDO: Intentar con Ollama Local si Groq falla
    if (CONFIG.aiProvider === 'groq' && CONFIG.ollamaModel) {
      log(`🔄 Intentando fallback a Ollama Local (${CONFIG.ollamaModel})...`);
      try {
        const fallbackClient = new OpenAI({ baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' });
        const fallbackCompletion = await fallbackClient.chat.completions.create({
          model: CONFIG.ollamaModel || 'gemma4:e4b',
          messages: [
            { role: 'system', content: 'Eres un asistente de ventas. Responde SIEMPRE con un objeto JSON válido, sin texto adicional ni backticks.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1024,
          temperature: 0.7
        });

        const responseText = fallbackCompletion.choices[0].message.content.trim();
        const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const fbResult = JSON.parse(jsonMatch[0]);
          log(`✅ Módulo de respaldo (Ollama) exitoso.`);
          return fbResult;
        }
      } catch (fbErr) {
        log(`❌ El módulo de respaldo (Ollama) también falló: ${fbErr.message}`);
      }
    }

    log(`⚠️ Usando modo básico sin IA`);
    return modoBasicoSinIA(mensajeCliente, CONFIG.aiProvider || 'IA');
  }
}

/**
 * Fallback: modo básico sin IA (si Groq falla)
 */
function modoBasicoSinIA(mensaje, iaProvider = 'La IA') {
  const mensajeLower = mensaje.toLowerCase();

  let score = 10; // Base

  // Detección simple de keywords
  if (mensajeLower.match(/urgente|ya|esta semana|mañana/)) score += 8;
  if (mensajeLower.match(/empresa|negocio|local|comercio/)) score += 7;
  if (mensajeLower.match(/presupuesto|\$\d+|pesos/)) score += 6;
  if (mensajeLower.match(/cuanto sale|precio|barato/)) score -= 5;
  if (mensajeLower.match(/solo pregunto|estoy viendo|mirando/)) score -= 8;

  return {
    score: Math.max(0, Math.min(30, score)),
    insights: {
      esEmpresa: mensajeLower.includes('empresa') || mensajeLower.includes('negocio'),
      urgencia: mensajeLower.includes('urgente') ? 'alta' : 'baja',
      presupuestoEstimado: 'indefinido',
      proyectoEspecifico: false
    },
    siguientePregunta: '¿Para cuándo lo necesitarías y qué presupuesto tenías pensado?',
    resumen: `Análisis básico (${iaProvider} no disponible)`
  };
}

// ══════════════════════════════════════════════════════════════════════
// CLIENTE WHATSAPP
// ══════════════════════════════════════════════════════════════════════

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './.wwebjs_auth_gemini'
  }),
  authTimeoutMs: 120000,
  puppeteer: {
    headless: 'new', // Modo moderno y más estable
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-extensions',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' // Simular navegador real
    ],
    protocolTimeout: 0,
    timeout: 120000
  }
});

// ══════════════════════════════════════════════════════════════════════
// EVENTOS DEL CLIENTE
// ══════════════════════════════════════════════════════════════════════

// Wrapper global para logs
function log(msg) { console.log(msg); io.emit('log', msg); }

client.on('qr', (qr) => {
  console.log('\n🔐 ESCANEA EL QR (Ver también en Panel Web):\n');
  qrcode.generate(qr, { small: true });

  // Enviar a la web
  currentBotStatus = { message: 'Escanea el QR', color: '#FFC107' };
  io.emit('qr', qr);
  io.emit('status', currentBotStatus);
});

client.on('ready', () => {
  log('✅ Bot de WhatsApp con Groq AI (Llama 4 Scout) conectado!');
  currentBotStatus = { message: '✅ Bot Conectado y Listo', color: '#4CAF50' };
  io.emit('ready');
  io.emit('status', currentBotStatus);

  // Procesar mensajes pendientes que fallaron cuando el bot estaba offline
  try {
    const pendingFile = path.join(__dirname, 'datos_mr_letreros', 'pending_messages.json');
    if (fs.existsSync(pendingFile)) {
      const pending = JSON.parse(fs.readFileSync(pendingFile, 'utf-8'));
      if (Array.isArray(pending) && pending.length > 0) {
        log(`🔄 Procesando ${pending.length} mensajes pendientes (offline queue)...`);
        pending.forEach(item => {
          if (item.phone && item.message) {
            let num = String(item.phone).replace(/\D/g, '');
            if (num.startsWith('0054')) num = num.substring(4);
            if (num.startsWith('0')) num = num.substring(1);
            if (num.startsWith('15')) num = num.substring(2);
            if (!num.startsWith('54')) num = '549' + num;
            else if (num.startsWith('54') && !num.startsWith('549')) num = '549' + num.substring(2);

            const chatId = `${num}@c.us`;
            // Añadir a la cola que creamos previamente
            messageQueue.push({
              chatId,
              message: item.message,
              resolve: () => { },
              reject: (err) => log(`❌ Falló envío pendiente: ${err.message}`),
              retries: 0
            });
          }
        });
        // Limpiar el archivo
        fs.writeFileSync(pendingFile, JSON.stringify([], null, 2));
        processMessageQueue();
      }
    }
  } catch (e) {
    log(`❌ Error procesando cola de mensajes pendientes: ${e.message}`);
  }
});

client.on('authenticated', () => {
  log('✅ Autenticación exitosa');
  currentBotStatus = { message: 'Autenticado...', color: '#2196F3' };
  io.emit('status', currentBotStatus);
});

client.on('auth_failure', (msg) => {
  console.error('❌ Error de autenticación:', msg);
  currentBotStatus = { message: 'Error de autenticación', color: '#F44336' };
  io.emit('status', currentBotStatus);
});

client.on('disconnected', (reason) => {
  log(`⚠️ Bot desconectado: ${reason}`);
  currentBotStatus = { message: 'Desconectado', color: '#F44336' };
  io.emit('status', currentBotStatus);
});

// ══════════════════════════════════════════════════════════════════════
// LÓGICA PRINCIPAL DEL BOT
// ══════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════
// ANTI-BUCLE: registro de mensajes enviados por el bot
// Cuando el bot envía en modo auto-test, el listener 'message_create'
// vuelve a capturar ese mensaje. Usamos este Set para ignorarlos.
// ══════════════════════════════════════════════════════════════════════
const mensajesEnviadosPorBot = new Set();

async function responder(message, texto) {
  // Registrar el inicio del texto para el filtro anti-bucle
  const clave = texto.substring(0, 80);
  mensajesEnviadosPorBot.add(clave);
  setTimeout(() => mensajesEnviadosPorBot.delete(clave), 10000); // Limpiar en 10s

  log(`🤖 Bot responde: "${texto.substring(0, 80)}${texto.length > 80 ? '...' : ''}"`);

  try {
    if (message.fromMe) {
      // Auto-test: enviar al propio número
      await client.sendMessage(message.from, texto);
    } else {
      await message.reply(texto);
    }
  } catch (err) {
    console.error('❌ Error al enviar respuesta:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════
// COMANDOS DE OPERADOR
// Los vendedores pueden usar estos comandos desde su WhatsApp personal.
//
//   !tomar NUMERO   → El operador toma control. El bot deja de responder
//                     a ese cliente y notifica al cliente que un asesor
//                     humano lo está atendiendo.
//
//   !liberar NUMERO → Devuelve el control al bot (el cliente vuelve a
//                     ser atendido por la IA).
//
//   !lista          → Muestra todas las conversaciones activas con su
//                     score, turno e indicador si están tomadas.
//
//   !cerrar NUMERO  → Clasifica y cierra la conversación manualmente.
//
//   !ping           → Diagnóstico: verifica que el bot está vivo.
// ══════════════════════════════════════════════════════════════════════

async function procesarComandoOperador(message) {
  const texto = message.body.trim();
  const esVendedor = CONFIG.vendedores.some(v => message.from.includes(v));

  if (!esVendedor && !message.fromMe) return false; // No es operador

  // ── !ping ──────────────────────────────────────────────────────────
  if (texto === '!ping') {
    log('🏓 Ping de operador. Respondiendo.');
    await message.reply('🤖 *Bot activo* (Gemini + WhatsApp OK)\n\nUsá !lista para ver conversaciones activas.');
    return true;
  }

  // ── !aprendizajes ──────────────────────────────────────────────────
  if (texto === '!aprendizajes') {
    try {
      let aprendizajes = [];
      if (fs.existsSync(CONFIG.learningsFile)) {
        aprendizajes = JSON.parse(fs.readFileSync(CONFIG.learningsFile, 'utf-8'));
      }
      if (aprendizajes.length === 0) {
        await message.reply('📚 El bot todavía no tiene aprendizajes. Atendé clientes con !tomar y al cerrar/liberar el bot aprenderá de tu estilo.');
        return true;
      }
      let resumen = `📚 *Aprendizajes del Bot* (${aprendizajes.length}/${CONFIG.maxLearnings})\n\n`;
      aprendizajes.forEach((a, i) => {
        resumen += `${i + 1}. ${a.regla}\n`;
        if (a.contexto) resumen += `   _${a.contexto}_\n`;
        resumen += `   📅 ${a.fecha} | Confianza: ${a.confianza || 'N/A'}\n\n`;
      });
      resumen += `_Para borrar: !borrar-aprendizajes_`;
      await message.reply(resumen);
    } catch (e) {
      await message.reply('❌ Error leyendo aprendizajes: ' + e.message);
    }
    return true;
  }

  // ── !borrar-aprendizajes ───────────────────────────────────────────
  if (texto === '!borrar-aprendizajes') {
    try {
      fs.writeFileSync(CONFIG.learningsFile, JSON.stringify([], null, 2));
      log('🗑️ Aprendizajes borrados por operador.');
      await message.reply('✅ Todos los aprendizajes han sido borrados. El bot empezará a aprender de cero.');
    } catch (e) {
      await message.reply('❌ Error borrando aprendizajes: ' + e.message);
    }
    return true;
  }

  // ── !lista ─────────────────────────────────────────────────────────
  if (texto === '!lista') {
    const convs = loadJSON(CONFIG.conversationsFile);
    const keys = Object.keys(convs);
    if (keys.length === 0) {
      await message.reply('📋 No hay conversaciones activas en este momento.');
      return true;
    }
    let resumen = '📋 *Conversaciones activas:*\n\n';
    keys.forEach((num, i) => {
      const c = convs[num];
      const estado = c.modoOperador ? '👤 OPERADOR' : '🤖 IA';
      resumen += `${i + 1}. *${c.nombre}*\n`;
      resumen += `   📞 ${num} | ${estado}\n`;
      resumen += `   📊 Score: ${c.scoreAcumulado} pts | Turno: ${c.turnosPregunta}\n\n`;
    });
    resumen += `_Para tomar control: !tomar NUMERO_\n_Para ver más: !cerrar NUMERO_`;
    await message.reply(resumen);
    return true;
  }

  // ── !tomar NUMERO ──────────────────────────────────────────────────
  const matchTomar = texto.match(/^!tomar\s+(\d+)/i);
  if (matchTomar) {
    const numTarget = matchTomar[1];
    const convs = loadJSON(CONFIG.conversationsFile);
    const conv = convs[numTarget];
    if (!conv) {
      await message.reply(`⚠️ No hay conversación activa con ${numTarget}.`);
      return true;
    }
    conv.modoOperador = true;
    conv.operadorDesde = new Date().toISOString();
    saveJSON(CONFIG.conversationsFile, convs);

    log(`👤 Operador tomó control de: ${conv.nombre} (${numTarget})`);
    io.emit('operador-tomo', { numero: numTarget, nombre: conv.nombre });

    // Notificar al cliente
    await client.sendMessage(`${numTarget}@c.us`,
      `👤 *Un asesor de MR Letreros va a atenderte ahora.*\n\n` +
      `En un momento te responde directamente. 😊`
    );

    await message.reply(
      `✅ Tomaste control de la conversación con *${conv.nombre}* (${numTarget}).\n\n` +
      `El bot ya no responderá a ese cliente.\n` +
      `Cuando termines, usá: *!liberar ${numTarget}*`
    );
    return true;
  }

  // ── !liberar NUMERO ────────────────────────────────────────────────
  const matchLiberar = texto.match(/^!liberar\s+(\d+)/i);
  if (matchLiberar) {
    const numTarget = matchLiberar[1];
    const convs = loadJSON(CONFIG.conversationsFile);
    const conv = convs[numTarget];
    if (!conv) {
      await message.reply(`⚠️ No hay conversación activa con ${numTarget}.`);
      return true;
    }

    // 🧠 Extraer aprendizajes ANTES de liberar
    if (conv.modoOperador && conv.historial.some(h => h.rol === 'operador')) {
      log(`🧠 Extrayendo aprendizajes de la conversación con ${conv.nombre}...`);
      extraerAprendizajes(conv.historial, conv.nombre).catch(e => log(`⚠️ ${e.message}`));
    }

    conv.modoOperador = false;
    delete conv.operadorDesde;
    saveJSON(CONFIG.conversationsFile, convs);

    log(`🤖 Bot retomó control de: ${conv.nombre} (${numTarget})`);

    await client.sendMessage(`${numTarget}@c.us`,
      `🤖 *Volvés a hablar con el asistente automático de MR Letreros.*\n\n` +
      `¿En qué más puedo ayudarte?`
    );

    await message.reply(`✅ El bot retomó la conversación con *${conv.nombre}*.`);
    return true;
  }

  // ── !cerrar NUMERO ─────────────────────────────────────────────────
  const matchCerrar = texto.match(/^!cerrar\s+(\d+)/i);
  if (matchCerrar) {
    const numTarget = matchCerrar[1];
    const convs = loadJSON(CONFIG.conversationsFile);
    const conv = convs[numTarget];
    if (!conv) {
      await message.reply(`⚠️ No hay conversación activa con ${numTarget}.`);
      return true;
    }

    const tier = calcularTier(conv.scoreAcumulado);
    const leadData = {
      id: `lead_${Date.now()}`,
      nombre: conv.nombre,
      numero: numTarget,
      scoreTotal: conv.scoreAcumulado,
      tier,
      historial: conv.historial,
      insights: conv.insights,
      fecha: new Date().toISOString(),
      cerradoPorOperador: true
    };

    const leadsFile = tier === 'hot' ? CONFIG.leadsHotFile :
      tier === 'warm' ? CONFIG.leadsWarmFile :
        CONFIG.leadsColdFile;
    const leads = loadJSON(leadsFile);
    leads[leadData.id] = leadData;
    saveJSON(leadsFile, leads);

    // 🧠 Extraer aprendizajes ANTES de cerrar
    if (conv.historial.some(h => h.rol === 'operador')) {
      log(`🧠 Extrayendo aprendizajes de la conversación cerrada con ${conv.nombre}...`);
      extraerAprendizajes(conv.historial, conv.nombre).catch(e => log(`⚠️ ${e.message}`));
    }

    delete convs[numTarget];
    saveJSON(CONFIG.conversationsFile, convs);

    log(`🎯 Operador cerró lead: ${tier.toUpperCase()} (${conv.scoreAcumulado} pts) - ${conv.nombre}`);
    await message.reply(`✅ Conversación con *${conv.nombre}* cerrada y guardada como lead *${tier.toUpperCase()}* (${conv.scoreAcumulado} pts).`);
    return true;
  }

  return false; // No era un comando de operador
}

// ══════════════════════════════════════════════════════════════════════
// LÓGICA PRINCIPAL DEL BOT
// ══════════════════════════════════════════════════════════════════════

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LÓGICA PRINCIPAL DEL BOT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function procesarMensaje(message) {
  if (CONFIG.botEnabled === false) return;
  if (message.from.includes('@g.us')) return;
  if (message.from === 'status@broadcast') return;

  const numero = formatearNumero(message.from);

  // ANTI-DUPLICADOS: Si ya estamos procesando este número, ignorar este evento
  if (procesandoNumeros.has(numero)) return;
  procesandoNumeros.add(numero);

  try {
    let texto = message.body ? message.body.trim() : "";
    let contextExtra = "";

    // LÓGICA DE NOTIFICACIÓN DE ESCRITORIO
    try {
      const contactoNotif = await message.getContact();
      const nombreNotif = contactoNotif.pushname || contactoNotif.name || numero;
      const regionNotif = identificarRegion(message.from);

      /* 
      notifier.notify({
          title: `WhatsApp: ${nombreNotif}`,
          message: `${regionNotif} 📍\n"${texto.substring(0, 50)}${texto.length > 50 ? '...' : ''}"`,
          sound: true, 
          wait: false  
      });
      */
    } catch (e) {
      // Ignorar si falla la notificación
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASO 0.1: VERIFICACIÓN DE HORARIO DE ATENCIÓN HUMANA
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (isWithinBusinessHours()) {
      log(`👤 Horario humano detectado (${numero}). El bot se mantiene en silencio.`);

      if (!conversacionesActivas[numero]) {
        let nombreSombra = numero;
        try {
          const contactoSombra = await message.getContact();
          nombreSombra = contactoSombra.pushname || contactoSombra.name || numero;
        } catch (e) { }

        conversacionesActivas[numero] = {
          nombre: nombreSombra,
          historial: [],
          scoreAcumulado: 0,
          turnosPregunta: 0,
          insights: {},
          modoOperador: true,
          iniciado: new Date().toISOString(),
          ultimoMensaje: new Date().toISOString(),
          shadowMode: true
        };
      }

      conversacionesActivas[numero].historial.push({ rol: 'cliente', mensaje: texto });
      conversacionesActivas[numero].ultimoMensaje = new Date().toISOString();
      saveJSON(CONFIG.conversationsFile, conversacionesActivas);
      procesandoNumeros.delete(numero);
      return;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASO 1.5: DETECCION DE IMAGENES / MULTIMEDIA
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (message.hasMedia && (message.type === 'image' || message.type === 'sticker')) {
      try {
        log(`📸 Detectada imagen de ${numero}. Descargando para analizar...`);
        const media = await message.downloadMedia();
        if (media && media.mimetype.includes('image')) {
          const descripcionImagen = await analizarImagenConLlama(media.data);
          log(`👁️ Llama Vision dice: ${descripcionImagen}`);
          contextExtra = `\n[SISTEMA: El cliente envió una imagen. Descripción visual: ${descripcionImagen}]`;
          texto = texto ? `${texto} [Imagen: ${descripcionImagen}]` : `(Envió una imagen) [Imagen: ${descripcionImagen}]`;
        }
      } catch (err) { log(`❌ Error procesando media: ${err.message}`); }
    }

    if (!texto && !contextExtra) {
      procesandoNumeros.delete(numero);
      return;
    }

    // Primero verificar si es comando de operador
    const fueComando = await procesarComandoOperador(message);
    if (fueComando) {
      procesandoNumeros.delete(numero);
      return;
    }

    const contacto = await message.getContact();
    const nombreContacto = contacto.pushname || contacto.name || numero;

    // Obtener etiquetas
    let etiquetasCliente = [];
    try {
      const chat = await message.getChat();
      if (typeof chat.getLabels === 'function') {
        const labelsObject = await chat.getLabels();
        if (labelsObject && labelsObject.length > 0) etiquetasCliente = labelsObject.map(l => l.name);
      }
    } catch (err) { }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASO 1.6: FILTRO DE GREMIOS (SILENCIAR IA)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (etiquetasCliente.some(e => e.toLowerCase().includes('gremio') || e.toLowerCase().includes('insumo'))) {
      log(`🚫 Silenciando IA para Gremio/Insumos: ${nombreContacto}. (Solo recibirá notificaciones de sistema)`);

      // Registrar en historial para que el operador vea qué escribió, pero sin responder
      if (!conversacionesActivas[numero]) {
        conversacionesActivas[numero] = {
          nombre: nombreContacto,
          historial: [],
          scoreAcumulado: 0,
          insights: {},
          modoOperador: true, // Forzar modo operador para que el bot no intente hablar luego
          ultimoMensaje: new Date().toISOString()
        };
      }
      conversacionesActivas[numero].historial.push({ rol: 'cliente', mensaje: texto });
      saveJSON(CONFIG.conversationsFile, conversacionesActivas);

      procesandoNumeros.delete(numero);
      return;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // LÓGICA DE CONVERSACIÓN (NUEVA O EXISTENTE)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let conv = conversacionesActivas[numero];
    let fueraDeHorario = !isWithinBusinessHours(); // Ya verificado arriba pero para claridad

    if (fueraDeHorario) {
      const pideDireccion = texto.toLowerCase().match(/dond|dónd|direcc|ubicac|qued|local|taller|calle|altura/);

      if (pideDireccion) {
        const respuestaDireccion = `📍 *Dirección de MR Letreros:* J. P. López 3162, Santa Fe (3000)\n\n⏰ Horario de atención: Lunes a Viernes de 07:30 a 16:00 hs.`;
        await responder(message, respuestaDireccion);
        if (!conv) {
          conversacionesActivas[numero] = {
            nombre: nombreContacto,
            historial: [],
            scoreAcumulado: 0,
            turnosPregunta: 0,
            insights: {},
            modoOperador: true,
            fueraDeHorarioNotificado: true,
            iniciado: new Date().toISOString(),
            ultimoMensaje: new Date().toISOString()
          };
          conv = conversacionesActivas[numero];
        } else {
          conv.modoOperador = true;
          conv.fueraDeHorarioNotificado = true;
          conv.ultimoMensaje = new Date().toISOString();
        }
        conv.historial.push({ rol: 'cliente', mensaje: texto });
        conv.historial.push({ rol: 'bot', mensaje: respuestaDireccion });
        saveJSON(CONFIG.conversationsFile, conversacionesActivas);
      } else if (!conv || !conv.fueraDeHorarioNotificado) {
        const saludoFuera = `👋 ¡Hola *${nombreContacto}*! Gracias por comunicarte con *MR Letreros*.\n\n` +
          `⏰ Te informamos que en este momento estamos fuera de nuestro horario de atención comercial.\n\n` +
          `Un asesor de nuestro equipo revisará tu consulta y te responderá a la brevedad en el próximo día hábil. 😊\n\n` +
          `Por favor, dejanos tu consulta detallada y te responderemos lo antes posible. ¡Gracias! 🙌`;

        if (!conv) {
          conversacionesActivas[numero] = {
            nombre: nombreContacto,
            historial: [],
            scoreAcumulado: 0,
            turnosPregunta: 0,
            insights: {},
            modoOperador: true,
            fueraDeHorarioNotificado: true,
            iniciado: new Date().toISOString(),
            ultimoMensaje: new Date().toISOString()
          };
          conv = conversacionesActivas[numero];
        } else {
          conv.modoOperador = true;
          conv.fueraDeHorarioNotificado = true;
          conv.ultimoMensaje = new Date().toISOString();
        }

        await responder(message, saludoFuera);
        conv.historial.push({ rol: 'cliente', mensaje: texto });
        conv.historial.push({ rol: 'bot', mensaje: saludoFuera });
        saveJSON(CONFIG.conversationsFile, conversacionesActivas);
      } else {
        // Ya fue notificado de fuera de horario. Guardar en el historial en silencio.
        conv.historial.push({ rol: 'cliente', mensaje: texto });
        conv.ultimoMensaje = new Date().toISOString();
        saveJSON(CONFIG.conversationsFile, conversacionesActivas);
      }
      procesandoNumeros.delete(numero);
      return;
    }

    if (!conv) {
      // ES UNA CONVERSACIÓN NUEVA
      log(`✨ Nueva conversación de ${nombreContacto} (${numero})`);
      conversacionesActivas[numero] = {
        nombre: nombreContacto,
        historial: [],
        scoreAcumulado: 0,
        turnosPregunta: 0,
        insights: {},
        modoOperador: false,
        iniciado: new Date().toISOString(),
        ultimoMensaje: new Date().toISOString()
      };
      conv = conversacionesActivas[numero];

      // Enviar saludo inicial ANTES de procesar con IA
      let motivoFuera = fueraDeHorario ? "fuera del horario de atención" : "feriado/fin de semana";
      let saludo = `👋 ¡Hola *${nombreContacto}*! Soy el asistente de *MR Letreros*.\n\n` +
        (fueraDeHorario ? `⏰ Te comento que en este momento no hay asesores humanos (${motivoFuera}), pero puedo ir ayudándote yo. 😊\n\n` : "") +
        `Contanos qué necesitás y te ayudamos.`;

      await responder(message, saludo);
      conv.historial.push({ rol: 'bot', mensaje: saludo });
    } else {
      // CONVERSACIÓN EXISTENTE
      if (conv.modoOperador) {
        // ... (lógica de operador omitida por brevedad en el chunk, pero mantenida en memoria)
        procesandoNumeros.delete(numero);
        return;
      }

      const tiempoInactivo = Date.now() - new Date(conv.ultimoMensaje).getTime();
      if (tiempoInactivo > 2 * 60 * 60 * 1000) {
        const saludoVuelta = `¡Hola de nuevo *${nombreContacto}*! 👋 Aquí sigo atento a lo que hablábamos.`;
        await responder(message, saludoVuelta);
        conv.historial.push({ rol: 'bot', mensaje: saludoVuelta });
      }
    }

    // ACTUALIZAR HISTORIAL CON EL MENSAJE ACTUAL DEL CLIENTE
    conv.historial.push({ rol: 'cliente', mensaje: texto });
    conv.ultimoMensaje = new Date().toISOString();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // LÍMITE DE PREGUNTAS: Si ya alcanzó el máximo, derivar a vendedor
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (conv.turnosPregunta >= CONFIG.maxTurnos) {
      log(`🔄 Límite de ${CONFIG.maxTurnos} preguntas alcanzado para ${nombreContacto}. Derivando a vendedor.`);

      let msgDerivacion;
      if (fueraDeHorario) {
        msgDerivacion = `Gracias por toda la info, *${nombreContacto}*. 🙌\n\n` +
          `⏰ Como estamos ${fueraDeHorario ? "fuera del horario de atención" : "en feriado"}, no hay asesores disponibles en este momento.\n\n` +
          `El próximo día hábil un asesor va a revisar tu consulta y te va a contactar para darte un presupuesto detallado.\n\n` +
          `¡Que tengas un excelente día! 😊`;
      } else {
        msgDerivacion = `Gracias por toda la info, *${nombreContacto}*. 🙌\n\n` +
          `Voy a derivarte con un asesor de MR Letreros para que te dé un presupuesto detallado y coordinen los detalles. En breve te contactan. 😊`;
      }

      await responder(message, msgDerivacion);
      conv.historial.push({ rol: 'bot', mensaje: msgDerivacion });
      conv.modoOperador = true;
      conv.operadorDesde = new Date().toISOString();
      saveJSON(CONFIG.conversationsFile, conversacionesActivas);

      // Notificar a vendedores
      for (const vendedorNumero of CONFIG.vendedores) {
        try {
          const chatVendedor = await client.getChatById(`${vendedorNumero}@c.us`);
          await chatVendedor.sendMessage(
            `📋 *CONSULTA DERIVADA (${CONFIG.maxTurnos} preguntas completadas)*\n\n` +
            `👤 *Cliente:* ${nombreContacto}\n` +
            `📞 *Número:* ${numero}\n` +
            `📊 *Score:* ${conv.scoreAcumulado} pts\n` +
            `⚡ *Urgencia:* ${conv.insights.urgencia || 'N/A'}\n\n` +
            `💬 https://wa.me/${numero}\n\n` +
            `👉 Para tomar: *!tomar ${numero}*`
          );
        } catch (err) {
          console.error(`❌ Error notificando vendedor:`, err.message);
        }
      }
      procesandoNumeros.delete(numero);
      return;
    }


    // 🧠 ANALIZAR CON GROQ — la IA genera la respuesta (con contexto de imagen si existe)
    log(`🧠 Consultando Llama 4 Scout para: "${texto.substring(0, 60)}"`);
    const analisis = await analizarConIA(texto, conv.historial, etiquetasCliente, contextExtra, conv.insights);

    // Acumular score e insights (en background, no corta la conversación)
    conv.scoreAcumulado += analisis.score;
    conv.turnosPregunta++;
    conv.insights = { ...conv.insights, ...analisis.insights };
    log(`📊 Score acumulado: ${conv.scoreAcumulado} pts | Turno #${conv.turnosPregunta} de ${CONFIG.maxTurnos}`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DETECTAR SI EL CLIENTE ACEPTÓ EL PRESUPUESTO
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const presupuestoAceptado =
      analisis.presupuestoAceptado === true ||
      analisis.siguientePregunta?.includes('PRESUPUESTO_ACEPTADO');

    // Limpiar el tag interno antes de enviar al cliente
    const respuestaFinal = (analisis.siguientePregunta || '')
      .replace('PRESUPUESTO_ACEPTADO', '').trim();

    // Enviar respuesta (con imagen si corresponde)
    if (analisis.imagen) {
      const imagePath = path.join(CONFIG.imagesDir, analisis.imagen);
      if (fs.existsSync(imagePath)) {
        try {
          const media = MessageMedia.fromFilePath(imagePath);
          // Enviar imagen con el texto como descripción
          await client.sendMessage(message.from, media, { caption: respuestaFinal });
          log(`📸 Imagen enviada: ${analisis.imagen}`);
        } catch (e) {
          log(`❌ Error enviando imagen: ${e.message}`);
          await responder(message, respuestaFinal);
        }
      } else {
        await responder(message, respuestaFinal);
      }
    } else {
      await responder(message, respuestaFinal);
    }

    conv.historial.push({ rol: 'bot', mensaje: respuestaFinal });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SI ACEPTÓ → notificar vendedor y poner en modo operador
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (presupuestoAceptado && !conv.notificadoAceptado) {
      conv.notificadoAceptado = true;
      conv.modoOperador = true; // El bot se silencia, toma el vendedor
      conv.operadorDesde = new Date().toISOString();
      saveJSON(CONFIG.conversationsFile, conversacionesActivas);

      // Agendar al cliente en la base de datos principal
      await crearClienteDesdeLead(conv, numero);

      log(`✅ PRESUPUESTO ACEPTADO por ${nombreContacto} — notificando vendedores`);
      io.emit('presupuesto-aceptado', { numero, nombre: nombreContacto, score: conv.scoreAcumulado });

      // Notificar a todos los vendedores
      for (const vendedorNumero of CONFIG.vendedores) {
        try {
          const chatVendedor = await client.getChatById(`${vendedorNumero}@c.us`);
          await chatVendedor.sendMessage(
            `✅ *PRESUPUESTO ACEPTADO — Tomar ahora*

` +
            `👤 *Cliente:* ${nombreContacto}
` +
            `📞 *Número:* ${numero}
` +
            `📊 *Score:* ${conv.scoreAcumulado} pts
` +
            `⚡ *Urgencia:* ${conv.insights.urgencia || 'N/A'}
` +
            `💰 *Presupuesto:* ${conv.insights.presupuestoEstimado || 'N/A'}
` +
            `🏢 *Empresa:* ${conv.insights.esEmpresa ? 'Sí' : 'No'}

` +
            `💬 https://wa.me/${numero}

` +
            `⚠️ *El bot ya está en silencio. El cliente espera tu contacto.*
` +
            `👉 Tomá el chat: *!tomar ${numero}*
` +
            `👉 Si querés que el bot siga: *!liberar ${numero}*`
          );
        } catch (err) {
          console.error(`❌ Error notificando vendedor:`, err.message);
        }
      }
      return; // No seguir con la lógica de score/tier
    }

    saveJSON(CONFIG.conversationsFile, conversacionesActivas);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // NOTIFICACIÓN AUTOMÁTICA A VENDEDORES (sin cerrar la conv)
    // Si el score es alto, notifica para que el vendedor decida cuándo tomar.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const tier = calcularTier(conv.scoreAcumulado);

    // Notificar solo la primera vez que sube de tier
    if (tier === 'hot' && !conv.notificadoHot) {
      conv.notificadoHot = true;
      saveJSON(CONFIG.conversationsFile, conversacionesActivas);
      log(`🔥 Lead CALIENTE detectado: ${nombreContacto} (${conv.scoreAcumulado} pts) — notificando vendedores`);

      for (const vendedorNumero of CONFIG.vendedores) {
        try {
          const chatVendedor = await client.getChatById(`${vendedorNumero}@c.us`);
          await chatVendedor.sendMessage(
            `🔥 *LEAD CALIENTE — Intervenir ahora*\n\n` +
            `👤 *Cliente:* ${nombreContacto}\n` +
            `📞 *Número:* ${numero}\n` +
            `📊 *Score:* ${conv.scoreAcumulado} pts\n` +
            `⚡ *Urgencia:* ${conv.insights.urgencia || 'N/A'}\n` +
            `💰 *Presupuesto:* ${conv.insights.presupuestoEstimado || 'N/A'}\n` +
            `🏢 *Es empresa:* ${conv.insights.esEmpresa ? 'Sí' : 'No'}\n\n` +
            `💬 https://wa.me/${numero}\n\n` +
            `👉 Para tomar el chat: *!tomar ${numero}*`
          );
        } catch (err) {
          console.error(`❌ Error notificando vendedor:`, err.message);
        }
      }
    } else if (tier === 'warm' && !conv.notificadoWarm) {
      conv.notificadoWarm = true;
      saveJSON(CONFIG.conversationsFile, conversacionesActivas);
      log(`🟡 Lead TIBIO detectado: ${nombreContacto} (${conv.scoreAcumulado} pts) — notificando vendedores`);

      for (const vendedorNumero of CONFIG.vendedores) {
        try {
          const chatVendedor = await client.getChatById(`${vendedorNumero}@c.us`);
          await chatVendedor.sendMessage(
            `🟡 *Lead Tibio — Seguimiento sugerido*\n\n` +
            `👤 ${nombreContacto} | 📞 ${numero}\n` +
            `📊 Score: ${conv.scoreAcumulado} pts\n\n` +
            `💬 https://wa.me/${numero}\n` +
            `👉 Para tomar el chat: *!tomar ${numero}*`
          );
        } catch (err) {
          console.error(`❌ Error notificando vendedor:`, err.message);
        }
      }
    }
    saveJSON(CONFIG.conversationsFile, conversacionesActivas);
  } catch (err) {
    log(`❌ Error procesando mensaje de ${numero}: ${err.message}`);
  } finally {
    procesandoNumeros.delete(numero);
  }
}

/**
 * LIMPIEZA Y APRENDIZAJE AUTOMÁTICO
 * Revisa conversaciones inactivas que tuvieron intervención humana 
 * y extrae aprendizajes sin necesidad de comandos manuales.
 */
async function limpiezaAutomaticaYAprendizaje() {
  log('🧹 Ejecutando limpieza y aprendizaje automático...');
  const ahora = Date.now();
  const tiempoInactividadParaAprender = 45 * 60 * 1000; // 45 minutos de silencio
  let huboCambios = false;

  for (const numero in conversacionesActivas) {
    const conv = conversacionesActivas[numero];
    const tiempoInactivo = ahora - new Date(conv.ultimoMensaje).getTime();

    // Si hubo intervención humana y lleva mucho tiempo en silencio
    if (conv.historial.some(h => h.rol === 'operador') && tiempoInactivo > tiempoInactividadParaAprender) {
      log(`🧠 Aprendizaje automático: Procesando conversación inactiva de ${conv.nombre}...`);

      try {
        // 1. Extraer aprendizajes de lo que escribió el humano
        await extraerAprendizajes(conv.historial, conv.nombre);

        // 2. Guardar como lead (si tiene score)
        const tier = calcularTier(conv.scoreAcumulado);
        const leadData = {
          id: `lead_auto_${Date.now()}`,
          nombre: conv.nombre,
          numero: numero,
          scoreTotal: conv.scoreAcumulado,
          tier,
          historial: conv.historial,
          fecha: new Date().toISOString(),
          autoCerrado: true
        };
        const leadsFile = tier === 'hot' ? CONFIG.leadsHotFile : (tier === 'warm' ? CONFIG.leadsWarmFile : CONFIG.leadsColdFile);
        const leads = loadJSON(leadsFile);
        leads[leadData.id] = leadData;
        saveJSON(leadsFile, leads);

        // 3. Eliminar de activas para limpiar memoria
        delete conversacionesActivas[numero];
        huboCambios = true;
        log(`✅ Conversación de ${conv.nombre} procesada y archivada automáticamente.`);
      } catch (err) {
        log(`⚠️ Error en aprendizaje automático para ${numero}: ${err.message}`);
      }
    }
    // Limpieza de conversaciones viejas sin operador (más de 24hs)
    else if (tiempoInactivo > 24 * 60 * 60 * 1000) {
      delete conversacionesActivas[numero];
      huboCambios = true;
    }
  }

  if (huboCambios) {
    saveJSON(CONFIG.conversationsFile, conversacionesActivas);
  }
}

// Ejecutar limpieza cada 30 minutos
setInterval(limpiezaAutomaticaYAprendizaje, 30 * 60 * 1000);

// Escuchar mensajes entrantes (de otros)
client.on('message', procesarMensaje);

// Escuchar mensajes creados (Enviados por el bot o por el humano desde el celular)
client.on('message_create', (message) => {
  if (!message.fromMe) return;

  // 1. Si el OPERADOR responde a un cliente, capturamos su mensaje y reiniciamos timer
  if (message.to !== message.from) {
    const numDestino = formatearNumero(message.to);

    // Si NO existe la conversación pero es horario comercial, la creamos (Modo Sombra)
    const enHorarioComercial = isWithinBusinessHours();

    if (conversacionesActivas[numDestino]?.modoOperador || enHorarioComercial) {
      if (!conversacionesActivas[numDestino]) {
        // Crear conv de emergencia para detectar aprendizaje
        conversacionesActivas[numDestino] = {
          nombre: numDestino, // Fallback si no lo conocemos
          historial: [],
          scoreAcumulado: 0,
          turnosPregunta: 0,
          insights: {},
          modoOperador: true,
          iniciado: new Date().toISOString(),
          ultimoMensaje: new Date().toISOString(),
          shadowMode: enHorarioComercial
        };
      }

      // 🧠 Guardar mensaje del operador en el historial para aprendizaje
      const textoOp = message.body ? message.body.trim() : '';
      if (textoOp && !textoOp.startsWith('!')) {
        conversacionesActivas[numDestino].historial.push({
          rol: 'operador',
          mensaje: textoOp
        });
        log(`👨‍💼 ${enHorarioComercial ? 'Sombra' : 'Operador'} → ${conversacionesActivas[numDestino].nombre}: "${textoOp.substring(0, 60)}${textoOp.length > 60 ? '...' : ''}"`);
      }
      conversacionesActivas[numDestino].operadorDesde = new Date().toISOString();
      conversacionesActivas[numDestino].ultimoMensaje = new Date().toISOString();
      saveJSON(CONFIG.conversationsFile, conversacionesActivas);
    }
    return;
  }

  // 2. Auto-Test (Mensaje a uno mismo)

  const texto = message.body.trim();

  // ✅ Anti-bucle mejorado: ignorar respuestas que el propio bot acaba de enviar
  const clave = texto.substring(0, 80);
  if (mensajesEnviadosPorBot.has(clave)) return;

  log(`📝 Auto-Test detectado: "${texto}"`);
  procesarMensaje(message);
});

// ══════════════════════════════════════════════════════════════════════
// INICIAR BOT
// ══════════════════════════════════════════════════════════════════════

console.log('🚀 Iniciando bot de WhatsApp con Groq AI (Llama 4 Scout)...\n');
loadSystemPrompt(); // Cargar prompt al inicio
syncHolidays();     // Sincronizar feriados desde API
setInterval(syncHolidays, 24 * 60 * 60 * 1000); // Re-sincronizar cada 24hs

// Función de inicio robusta con reintento y limpieza de sesión
let isInitializing = false;
async function startClient() {
  if (isInitializing) return;
  isInitializing = true;

  try {
    await client.initialize();
    isInitializing = false;
  } catch (err) {
    isInitializing = false;
    console.error('❌ Error fatal al inicializar cliente:', err.message);

    // Limpieza profunda antes del reintento para evitar bloqueo de sesión
    try {
      console.log('🧹 Limpiando procesos de navegador previos...');
      await client.destroy();
    } catch (e) {
      // Si falla el destroy, es probable que ni siquiera haya abierto el browser
    }

    console.log('🔄 Reintentando en 10 segundos...');
    setTimeout(startClient, 10000);
  }
}
startClient();

async function restartClient() {
  if (isInitializing) return;
  console.log('\n🔄 Iniciando reinicio de emergencia del cliente por caída de Frame...');
  try {
    await client.destroy();
  } catch (e) {
    console.log('⚠️ Aviso al destruir cliente:', e.message);
  }
  console.log('⏳ Esperando 5 segundos antes de volver a conectar...');
  setTimeout(startClient, 5000);
}

// Manejo de señales
process.on('SIGINT', async () => {
  console.log('\n\n⏹️  Cerrando bot...');
  await client.destroy();
  process.exit(0);
});