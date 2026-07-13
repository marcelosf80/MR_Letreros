/**
 * WHATSAPP BOT CON GEMINI AI - MR LETREROS
 * Sistema de calificación inteligente de leads con conversación natural
 * 
 * REQUISITOS:
 * - Node.js 18+
 * - npm install whatsapp-web.js qrcode-terminal @google/generative-ai
 * - API Key de Google Gemini (gratis en aistudio.google.com)
 * 
 * USO:
 * 1. Reemplazar GEMINI_API_KEY con tu key
 * 2. node whatsapp-bot-gemini.js
 * 3. Escanear QR con WhatsApp Business
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ══════════════════════════════════════════════════════════════════════

const CONFIG = {
  // ⚠️ REEMPLAZAR CON TU API KEY DE GEMINI
  geminiApiKey: 'AIzaSyCa0cYZYK3KE6tDsF0omv4Qo2fEyJvK3MI',
  
  // Números de vendedores para notificaciones
  vendedores: [
    '5491112345678',  // Vendedor 1
    '5491187654321'   // Vendedor 2
  ],
  
  // Directorios de datos
  dataDir: path.join(__dirname, 'data'),
  conversationsFile: path.join(__dirname, 'data', 'conversations.json'),
  leadsHotFile: path.join(__dirname, 'data', 'leads_hot.json'),
  leadsWarmFile: path.join(__dirname, 'data', 'leads_warm.json'),
  leadsColdFile: path.join(__dirname, 'data', 'leads_cold.json'),
  pricesFile: path.join(__dirname, '../../datos_mr_letreros/gremio_precios_db.json'),
  
  // Parámetros de conversación
  maxTurnos: 5,           // Máximo 5 intercambios antes de clasificar
  scoreMinCaliente: 60,   // Score mínimo para lead caliente
  inactivityTimeout: 15 * 60 * 1000 // 15 minutos
};

// ══════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN DE GEMINI
// ══════════════════════════════════════════════════════════════════════

let genAI;
let model;

try {
  genAI = new GoogleGenerativeAI(CONFIG.geminiApiKey);
  model = genAI.getGenerativeModel({ 
    model: 'gemini-pro',
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    }
  });
  console.log('✅ Gemini AI inicializado correctamente');
} catch (err) {
  console.error('❌ Error inicializando Gemini:', err.message);
  console.log('⚠️  El bot seguirá funcionando con modo básico (sin IA)');
}

// ══════════════════════════════════════════════════════════════════════
// UTILIDADES
// ══════════════════════════════════════════════════════════════════════

// Crear directorio de datos si no existe
if (!fs.existsSync(CONFIG.dataDir)) {
  fs.mkdirSync(CONFIG.dataDir, { recursive: true });
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

function calcularTier(score) {
  if (score >= 80) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

function formatearNumero(numero) {
  return numero.replace(/\D/g, '').replace(/^549/, '54');
}

function getPricesContext() {
  try {
    // Intentar cargar precios
    let pPath = CONFIG.pricesFile;
    // Fallback si no existe en la ruta principal (por si el script se movió)
    if (!fs.existsSync(pPath)) pPath = path.join(__dirname, 'data', 'precios.json');

    if (fs.existsSync(pPath)) {
      const raw = fs.readFileSync(pPath, 'utf-8');
      const data = JSON.parse(raw);
      
      // Normalizar estructura (Array o Objeto con cliente/gremio)
      let items = [];
      if (Array.isArray(data)) items = data;
      else if (data.cliente) items = data.cliente; // Preferir precios cliente
      else if (data.gremio) items = data.gremio;

      if (items.length > 0) {
        return items.slice(0, 50).map(i => `- ${i.material || i.producto || i.name}: $${i.precio || i.price}`).join('\n');
      }
    }
  } catch (e) { console.error('Error leyendo precios:', e.message); }
  return "No hay lista de precios disponible.";
}

// ══════════════════════════════════════════════════════════════════════
// ANÁLISIS CON GEMINI AI
// ══════════════════════════════════════════════════════════════════════

/**
 * Analiza el mensaje del cliente con Gemini AI
 * @param {string} mensajeCliente - Mensaje del cliente
 * @param {array} historial - Historial de la conversación
 * @returns {object} { score, insights, siguientePregunta, resumen }
 */
async function analizarConGemini(mensajeCliente, historial = []) {
  if (!model) {
    // Fallback si Gemini no está disponible
    return modoBasicoSinIA(mensajeCliente);
  }

  // Construir contexto del historial
  const contextoHistorial = historial.length > 0 
    ? historial.map(h => `${h.rol}: ${h.mensaje}`).join('\n')
    : 'Primera interacción del cliente';

  const preciosContext = getPricesContext();

  const prompt = `
Eres un asistente de ventas experto en calificar leads para MR Letreros, un negocio de gráfica y señalética.

═══ CONTEXTO DEL NEGOCIO ═══
- Productos: Letreros corporales, luminosos, cajas de luz, vinilos de gran formato, señalética empresarial
- Cliente ideal: Empresas (B2B) con presupuesto $20,000+ pesos y necesidad urgente
- Lead frío: Particulares sin presupuesto definido, consultas vagas tipo "cuánto sale"

═══ LISTA DE PRECIOS REFERENCIAL ═══
${preciosContext}

═══ HISTORIAL DE CONVERSACIÓN ═══
${contextoHistorial}

═══ ÚLTIMO MENSAJE DEL CLIENTE ═══
"${mensajeCliente}"

═══ TU TAREA ═══
Analiza el mensaje y devuelve SOLO un objeto JSON (sin markdown, sin explicaciones) con esta estructura EXACTA:

{
  "score": [número de 0 a 30],
  "insights": {
    "esEmpresa": [true o false],
    "urgencia": ["alta" | "media" | "baja" | "ninguna"],
    "presupuestoEstimado": ["alto" | "medio" | "bajo" | "indefinido"],
    "proyectoEspecifico": [true o false],
    "señalesPositivas": ["lista", "de", "keywords", "detectadas"],
    "señalesNegativas": ["lista", "de", "red flags"]
  },
  "siguientePregunta": "Pregunta conversacional natural y contextual para el cliente",
  "resumen": "Breve análisis de este mensaje"
}

CRITERIOS DE SCORING (0-30):
• Urgencia (0-10 pts):
  - "urgente", "ya", "esta semana", "necesito para X fecha" = 8-10 pts
  - "en algunas semanas", "pronto" = 4-6 pts
  - "cuando sea", "estoy viendo" = 0-2 pts

• Presupuesto (0-10 pts):
  - Menciona monto específico $20k+ = 8-10 pts
  - "presupuesto aprobado", "no es problema el precio" = 7-9 pts
  - "económico", "barato", "lo más barato" = 0-3 pts
  - No menciona = 4 pts

• Seriedad del Proyecto (0-10 pts):
  - Detalles específicos (medidas, cantidad, material) = 8-10 pts
  - Proyecto concreto pero sin detalles = 4-6 pts
  - Vago tipo "algo para mi negocio" = 2-4 pts
  - "solo pregunto", "estoy viendo" = 0-1 pts

IMPORTANTE: La siguiente pregunta debe:
1. Ser natural y conversacional (NO usar bullet points ni números)
2. Extraer información que falta (urgencia, presupuesto, o especificaciones)
3. Avanzar hacia una calificación más precisa
4. Ser empática y profesional
5. SI PIDEN PRECIO: Usa la lista de precios. Si el producto está, da el precio en 'siguientePregunta'. Si no, di que necesitas detalles.

Responde SOLO con el JSON, sin \`\`\`json ni explicaciones adicionales.
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Extraer JSON (manejar casos donde Gemini agrega markdown)
    let jsonText = responseText.trim();
    
    // Remover backticks si están presentes
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Buscar objeto JSON
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('⚠️  Gemini no devolvió JSON válido:', responseText);
      return modoBasicoSinIA(mensajeCliente);
    }
    
    const analisis = JSON.parse(jsonMatch[0]);
    
    // Validar estructura
    if (!analisis.score || !analisis.siguientePregunta) {
      console.error('⚠️  JSON de Gemini incompleto');
      return modoBasicoSinIA(mensajeCliente);
    }
    
    console.log(`\n🧠 Gemini analizó: ${analisis.score} pts | ${analisis.insights?.urgencia || 'N/A'} urgencia`);
    console.log(`   Siguiente: "${analisis.siguientePregunta.substring(0, 60)}..."`);
    
    return analisis;
    
  } catch (err) {
    console.error('❌ Error en Gemini:', err.message);
    return modoBasicoSinIA(mensajeCliente);
  }
}

/**
 * Fallback: modo básico sin IA (si Gemini falla)
 */
function modoBasicoSinIA(mensaje) {
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
    resumen: 'Análisis básico (Gemini no disponible)'
  };
}

// ══════════════════════════════════════════════════════════════════════
// CLIENTE WHATSAPP
// ══════════════════════════════════════════════════════════════════════

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './.wwebjs_auth'
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

// ══════════════════════════════════════════════════════════════════════
// EVENTOS DEL CLIENTE
// ══════════════════════════════════════════════════════════════════════

client.on('qr', (qr) => {
  console.log('\n🔐 ESCANEA ESTE QR CON WHATSAPP BUSINESS:\n');
  qrcode.generate(qr, { small: true });
  console.log('\n📱 Abre WhatsApp Business → Dispositivos vinculados → Vincular dispositivo\n');
});

client.on('ready', () => {
  console.log('\n✅ Bot de WhatsApp con Gemini AI conectado!');
  console.log('🧠 Modo: Conversación natural con IA');
  console.log('📞 Esperando mensajes...\n');
});

client.on('authenticated', () => {
  console.log('✅ Autenticación exitosa');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Error de autenticación:', msg);
});

client.on('disconnected', (reason) => {
  console.log('⚠️ Bot desconectado:', reason);
});

// ══════════════════════════════════════════════════════════════════════
// LÓGICA PRINCIPAL DEL BOT
// ══════════════════════════════════════════════════════════════════════

client.on('message', async (message) => {
  // Ignorar grupos y mensajes propios
  if (message.from.includes('@g.us') || message.fromMe) return;

  const numero = formatearNumero(message.from);
  const texto = message.body.trim();
  const contacto = await message.getContact();
  const nombreContacto = contacto.pushname || contacto.name || numero;

  console.log(`\n📩 ${nombreContacto}: ${texto}`);

  // Cargar conversaciones activas
  let conversaciones = loadJSON(CONFIG.conversationsFile);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CASO 1: NUEVA CONVERSACIÓN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (!conversaciones[numero]) {
    conversaciones[numero] = {
      nombre: nombreContacto,
      historial: [],
      scoreAcumulado: 0,
      turnosPregunta: 0,
      insights: {},
      iniciado: new Date().toISOString(),
      ultimoMensaje: new Date().toISOString()
    };

    await message.reply(
      `👋 ¡Hola *${nombreContacto}*! Soy el asistente de *MR Letreros*.\n\n` +
      `Contame qué necesitas y te ayudo a encontrar la mejor solución para vos. 😊`
    );

    saveJSON(CONFIG.conversationsFile, conversaciones);
    return;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CASO 2: CONVERSACIÓN ACTIVA
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const conv = conversaciones[numero];
  conv.ultimoMensaje = new Date().toISOString();

  // Verificar timeout
  const tiempoInactivo = Date.now() - new Date(conv.ultimoMensaje).getTime();
  if (tiempoInactivo > CONFIG.inactivityTimeout) {
    delete conversaciones[numero];
    saveJSON(CONFIG.conversationsFile, conversaciones);
    
    await message.reply(
      '⏱️ La conversación anterior expiró por inactividad.\n\n' +
      'Si aún necesitas ayuda, escribime de nuevo y arrancamos. 👍'
    );
    return;
  }

  // Agregar mensaje al historial
  conv.historial.push({ rol: 'cliente', mensaje: texto });

  // 🧠 ANALIZAR CON GEMINI
  const analisis = await analizarConGemini(texto, conv.historial);

  // Acumular score e insights
  conv.scoreAcumulado += analisis.score;
  conv.turnosPregunta++;
  conv.insights = { ...conv.insights, ...analisis.insights };

  console.log(`   Score acumulado: ${conv.scoreAcumulado} pts (turno ${conv.turnosPregunta}/${CONFIG.maxTurnos})`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DECISIÓN: ¿Seguir preguntando o clasificar?
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const debeClasificar = 
    conv.turnosPregunta >= CONFIG.maxTurnos || 
    conv.scoreAcumulado >= CONFIG.scoreMinCaliente ||
    (conv.scoreAcumulado < 15 && conv.turnosPregunta >= 3); // Lead frío obvio

  if (debeClasificar) {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CLASIFICAR Y GUARDAR LEAD
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const tier = calcularTier(conv.scoreAcumulado);

    const leadData = {
      id: `lead_${Date.now()}`,
      nombre: nombreContacto,
      numero: numero,
      scoreTotal: conv.scoreAcumulado,
      tier: tier,
      historial: conv.historial,
      insights: conv.insights,
      fecha: new Date().toISOString(),
      analizadoConIA: !!model
    };

    let leadsFile = tier === 'hot' ? CONFIG.leadsHotFile :
                    tier === 'warm' ? CONFIG.leadsWarmFile :
                    CONFIG.leadsColdFile;

    const leads = loadJSON(leadsFile);
    leads[leadData.id] = leadData;
    saveJSON(leadsFile, leads);

    // Eliminar conversación activa
    delete conversaciones[numero];
    saveJSON(CONFIG.conversationsFile, conversaciones);

    console.log(`\n🎯 Lead clasificado: ${tier.toUpperCase()} (${conv.scoreAcumulado} pts)`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ACCIONES SEGÚN TIER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    if (tier === 'hot') {
      // 🔥 LEAD CALIENTE
      await message.reply(
        `🔥 *¡Perfecto ${nombreContacto}!*\n\n` +
        `Tu consulta es prioritaria. *Nuestro vendedor te contacta en menos de 15 minutos* para darte toda la información que necesitas.\n\n` +
        `Mientras tanto, si tenés alguna pregunta urgente, escribila y te respondemos ya. 👇`
      );

      // Notificar vendedores
      for (const vendedorNumero of CONFIG.vendedores) {
        try {
          const chatVendedor = await client.getChatById(`${vendedorNumero}@c.us`);
          await chatVendedor.sendMessage(
            `🔥 *LEAD CALIENTE - CONTACTAR YA*\n\n` +
            `👤 *Cliente:* ${nombreContacto}\n` +
            `📞 *Teléfono:* ${numero}\n` +
            `📊 *Score:* ${conv.scoreAcumulado} puntos\n` +
            `⚡ *Urgencia:* ${conv.insights.urgencia || 'N/A'}\n` +
            `💰 *Presupuesto:* ${conv.insights.presupuestoEstimado || 'N/A'}\n` +
            `🏢 *Es empresa:* ${conv.insights.esEmpresa ? 'Sí' : 'No'}\n\n` +
            `💬 *Link:* https://wa.me/${numero}\n\n` +
            `⏰ *Contactar:* AHORA (< 15 min)`
          );
        } catch (err) {
          console.error(`❌ Error notificando vendedor:`, err.message);
        }
      }

    } else if (tier === 'warm') {
      // 🟡 LEAD TIBIO
      await message.reply(
        `✅ *Gracias ${nombreContacto}!*\n\n` +
        `Te vamos a enviar información completa por email con nuestro catálogo y casos de éxito similares.\n\n` +
        `Además, uno de nuestros vendedores te contacta en las próximas *48 horas* para resolver cualquier duda.\n\n` +
        `📧 Si no recibís el email, revisá spam o escribinos de nuevo.`
      );

      // Notificar vendedor (prioridad media)
      for (const vendedorNumero of CONFIG.vendedores) {
        try {
          const chatVendedor = await client.getChatById(`${vendedorNumero}@c.us`);
          await chatVendedor.sendMessage(
            `🟡 *Lead Tibio - Seguimiento 48hs*\n\n` +
            `👤 ${nombreContacto}\n` +
            `📞 ${numero}\n` +
            `📊 Score: ${conv.scoreAcumulado} pts\n` +
            `⏰ Contactar: En 48 horas\n\n` +
            `https://wa.me/${numero}`
          );
        } catch (err) {
          console.error(`❌ Error notificando vendedor:`, err.message);
        }
      }

    } else {
      // ❄️ LEAD FRÍO
      await message.reply(
        `👋 *Gracias por tu consulta ${nombreContacto}!*\n\n` +
        `Te cuento un poco sobre lo que hacemos:\n\n` +
        `📋 *Nuestros servicios:*\n` +
        `• Letreros corporales y luminosos\n` +
        `• Cajas de luz (backlight)\n` +
        `• Vinilos de gran formato\n` +
        `• Señalética empresarial\n` +
        `• Stands y merchandising\n\n` +
        `💰 *Precios de referencia:*\n` +
        `Los proyectos arrancan desde $15.000 dependiendo del tamaño y material.\n\n` +
        `📧 *Para presupuesto exacto, envianos:*\n` +
        `• Medidas (ancho x alto)\n` +
        `• Cantidad de unidades\n` +
        `• Tipo de material o producto\n\n` +
        `¡Y te cotizamos al toque! 🚀`
      );
    }

  } else {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CONTINUAR CONVERSACIÓN
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await message.reply(analisis.siguientePregunta);
    
    conv.historial.push({ 
      rol: 'bot', 
      mensaje: analisis.siguientePregunta 
    });
    
    saveJSON(CONFIG.conversationsFile, conversaciones);
  }
});

// ══════════════════════════════════════════════════════════════════════
// INICIAR BOT
// ══════════════════════════════════════════════════════════════════════

console.log('🚀 Iniciando bot de WhatsApp con Gemini AI...\n');
client.initialize();

// Manejo de señales
process.on('SIGINT', async () => {
  console.log('\n\n⏹️  Cerrando bot...');
  await client.destroy();
  process.exit(0);
});
