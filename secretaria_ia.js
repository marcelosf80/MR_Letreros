// c:\MR_Letreros\secretaria_ia.js
// Asistente y Secretaria IA para Seguimiento de Clientes y Ventas en WhatsApp
// MR Letreros

const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.join(__dirname, 'datos_mr_letreros');
const BOT_DATA_DIR = path.join(DATA_DIR, 'bot_whatsapp');

const CONVERSATIONS_FILE = path.join(BOT_DATA_DIR, 'conversations.json');
const LEADS_HOT_FILE = path.join(BOT_DATA_DIR, 'leads_hot.json');
const LEADS_WARM_FILE = path.join(BOT_DATA_DIR, 'leads_warm.json');
const SECRETARIA_FILE = path.join(DATA_DIR, 'secretaria_leads.json');

let GoogleGenerativeAI = null;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (e) { }

let OpenAI = null;
try {
  OpenAI = require('openai');
} catch (e) { }

// Escritura segura atómica
async function safeWrite(filePath, data) {
  const tmp = filePath + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmp, filePath);
}

// Lectura segura
async function readSafeJSON(filePath, fallback = {}) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

class SecretariaIAService {
  constructor(getGeminiKeyFn, getGroqKeyFn) {
    this.getGeminiKey = getGeminiKeyFn;
    this.getGroqKey = getGroqKeyFn;
    this.isAnalyzing = false;
  }

  // Obtener todas las conversaciones unificadas
  async obtenerTodasLasConversaciones() {
    const convs = await readSafeJSON(CONVERSATIONS_FILE, {});
    const hot = await readSafeJSON(LEADS_HOT_FILE, {});
    const warm = await readSafeJSON(LEADS_WARM_FILE, {});

    const mapa = new Map();

    // 1. Agregar conversaciones activas
    for (const [keyNum, data] of Object.entries(convs)) {
      if (!data || !Array.isArray(data.historial) || data.historial.length === 0) continue;
      const num = String(data.numero || keyNum);
      mapa.set(num, {
        numero: num,
        chatId: data.chatId || '',
        nombre: data.nombre || num,
        historial: data.historial,
        ultimoMensaje: data.ultimoMensaje || new Date().toISOString(),
        origen: 'conversations'
      });
    }

    // 2. Agregar leads hot y warm
    const leadsList = [...Object.values(hot), ...Object.values(warm)];
    for (const lead of leadsList) {
      if (!lead || !lead.numero || !Array.isArray(lead.historial) || lead.historial.length === 0) continue;
      const num = String(lead.numero);
      const existente = mapa.get(num);

      if (!existente || (lead.historial.length > existente.historial.length)) {
        mapa.set(num, {
          numero: num,
          nombre: lead.nombre || (existente ? existente.nombre : num),
          historial: lead.historial,
          ultimoMensaje: lead.fecha || (existente ? existente.ultimoMensaje : new Date().toISOString()),
          scoreTotal: lead.scoreTotal || 0,
          origen: lead.tier || 'lead'
        });
      }
    }

    return Array.from(mapa.values());
  }

  // Determinar estado previo básico según los turnos de mensaje
  analizarMetricasChat(historial) {
    if (!historial || historial.length === 0) {
      return { ultimoRol: 'ninguno', ultimoTexto: '', horasSinContacto: 0, esperandoNuestraRespuesta: false };
    }

    const ultimo = historial[historial.length - 1];
    const ultimoRol = ultimo.rol || 'cliente';
    const ultimoTexto = ultimo.mensaje || '';

    // Buscar si el operador envió cotización o presupuesto
    const envioPresupuesto = historial.some(m => {
      const msg = (m.mensaje || '').toLowerCase();
      return (m.rol === 'operador' || m.rol === 'bot') && 
             (msg.includes('presupuesto') || msg.includes('.pdf') || msg.includes('$') || msg.includes('costo'));
    });

    return {
      ultimoRol,
      ultimoTexto,
      envioPresupuesto
    };
  }

  // Detección heurística de tipo de trabajo por palabras clave
  detectarTipoTrabajoHeuristico(historial) {
    const texto = (historial || []).map(m => m.mensaje || '').join(' ').toLowerCase();
    if (texto.includes('lona') || texto.includes('banner') || texto.includes('frontlight') || texto.includes('backlight') || texto.includes('ojales')) return 'Lona';
    if (texto.includes('polifan') || texto.includes('corporeo') || texto.includes('corpóreo') || texto.includes('letras 3d') || texto.includes('huecas')) return 'Corpóreo Polifan';
    if (texto.includes('acrilico') || texto.includes('acrílico') || texto.includes('placa') || texto.includes('grabado')) return 'Acrílico / Placas';
    if (texto.includes('vinilo') || texto.includes('microperforado') || texto.includes('calco') || texto.includes('sticker') || texto.includes('esmerilado')) return 'Vinilo Impreso';
    if (texto.includes('led') || texto.includes('neon') || texto.includes('neón') || texto.includes('luminoso') || texto.includes('cartel')) return 'Cartel Luminoso / LED';
    if (texto.includes('vector') || texto.includes('diseño') || texto.includes('logo') || texto.includes('corel') || texto.includes('pdf')) return 'Diseño / Vectorización';
    if (texto.includes('estructura') || texto.includes('bastidor') || texto.includes('hierro') || texto.includes('soldar')) return 'Estructura / Bastidor';
    return 'Consulta General';
  }

  // Análisis inteligente con Gemini o Groq
  async analizarConversacionConIA(conv) {
    const geminiKey = this.getGeminiKey ? await this.getGeminiKey() : process.env.GEMINI_API_KEY;
    const groqKey = this.getGroqKey ? await this.getGroqKey() : process.env.GROQ_API_KEY;

    const chatTexto = conv.historial.map(m => {
      const emisor = m.rol === 'cliente' ? (conv.nombre || 'Cliente') : (m.rol === 'operador' ? 'Vendedor/MR' : 'Bot');
      return `${emisor}: ${m.mensaje}`;
    }).join('\n');

    const prompt = `Sos la Secretaria Ejecutiva y Asistente Comercial de "MR Letreros" (fabricante de letreros, cartelería, corpóreos en polifan, acrílicos, vinilos impresos, lonas y grabado láser).
Tu tarea es analizar el chat de WhatsApp con un cliente para que NINGÚN cliente quede sin atender y NINGUNA venta quede en el aire.

Datos del cliente:
- Nombre: ${conv.nombre || 'Sin nombre'}
- Número: ${conv.numero}

Conversación completa:
"""
${chatTexto}
"""

Instrucciones:
1. DETECTÁ EL TIPO DE TRABAJO exacto entre una de estas categorías:
   - "Lona"
   - "Corpóreo Polifan"
   - "Cartel Luminoso / LED"
   - "Acrílico / Placas"
   - "Vinilo Impreso"
   - "Rotulación / Vehículos"
   - "Grabado Láser"
   - "Estructura / Bastidor"
   - "Diseño / Vectorización"
   - "Consulta General"
2. Detectá las medidas si las mencionó (ej: "4 x 2.90 m", "3x2m", "100x50cm" o "A definir").
3. Identificá qué producto o trabajo consultó o pidió (medidas, material, especificaciones).
4. Determiná el estado real de la venta:
   - "sin_responder": El cliente hizo una consulta o pregunta y nosotros NO le respondimos aún.
   - "presupuesto_enviado": Se le pasó precio/presupuesto pero el cliente no cerró todavía (quedó en consultar, o dejó de responder).
   - "en_negociacion": Están conversando detalles o modificaciones.
   - "cerrado": El trabajo ya fue confirmado o aprobado.
   - "descartado": No le interesó o no era viable.
5. Asigná una prioridad:
   - "urgente": Si el cliente está esperando nuestra respuesta.
   - "alta": Si tiene presupuesto pendiente de cierre hace días.
   - "media": En negociación activa normal.
   - "baja": Cerrado o descartado.
6. Escribí una "notaSecretaria" breve, precisa y profesional de lo ocurrido.
7. Escribí la "accionRecomendada" para el vendedor.
8. Redactá un "mensajeWhatsAppSugerido" listo para copiar y enviar al cliente para retomar la venta amablemente.

Respondé ÚNICAMENTE un JSON válido con este formato:
{
  "tipoTrabajo": "Lona | Corpóreo Polifan | Cartel Luminoso / LED | Acrílico / Placas | Vinilo Impreso | Rotulación / Vehículos | Grabado Láser | Estructura / Bastidor | Diseño / Vectorización | Consulta General",
  "medidasDetectadas": "medidas en metros o cm o 'A definir'",
  "resumenTrabajo": "descripción corta del producto/medidas",
  "estadoVenta": "sin_responder | presupuesto_enviado | en_negociacion | cerrado | descartado",
  "prioridad": "urgente | alta | media | baja",
  "notaSecretaria": "resumen comercial breve",
  "accionRecomendada": "qué debe hacer el vendedor",
  "mensajeWhatsAppSugerido": "mensaje redactado para WhatsApp"
}`;

    // 1. Probar con Groq primero (ultra rápido y respuesta JSON confiable)
    if (OpenAI && groqKey) {
      if (!this.cachedGroqModel) {
        this.cachedGroqModel = 'llama-3.1-8b-instant';
      }
      const modelosGroq = [this.cachedGroqModel, 'openai/gpt-oss-120b', 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama3-70b-8192'];
      const unicosGroq = [...new Set(modelosGroq)];

      for (const nombreModelo of unicosGroq) {
        try {
          const groq = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1', timeout: 10000 });
          const comp = await groq.chat.completions.create({
            model: nombreModelo,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.2
          });
          this.cachedGroqModel = nombreModelo;
          const parsed = JSON.parse(comp.choices[0].message.content);
          if (parsed && typeof parsed === 'object') return parsed;
        } catch (err) { }
      }
    }

    // 2. Fallback con Google Gemini
    if (GoogleGenerativeAI && geminiKey) {
      const modelosGemini = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-flash'];
      for (const nombreModelo of modelosGemini) {
        try {
          const genAI = new GoogleGenerativeAI(geminiKey);
          const model = genAI.getGenerativeModel({
            model: nombreModelo,
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
          });
          const resp = await model.generateContent(prompt);
          return JSON.parse(resp.response.text());
        } catch (e) { }
      }
    }

    // 3. Fallback Heurístico si no hay conexión IA
    const metricas = this.analizarMetricasChat(conv.historial);
    const tipo = this.detectarTipoTrabajoHeuristico(conv.historial);
    return {
      tipoTrabajo: tipo,
      medidasDetectadas: "A definir",
      resumenTrabajo: `Consulta por ${tipo}`,
      estadoVenta: metricas.ultimoRol === 'cliente' ? 'sin_responder' : (metricas.envioPresupuesto ? 'presupuesto_enviado' : 'en_negociacion'),
      prioridad: metricas.ultimoRol === 'cliente' ? 'urgente' : 'alta',
      notaSecretaria: `Último mensaje recibido de ${metricas.ultimoRol}: "${metricas.ultimoTexto.slice(0, 80)}"`,
      accionRecomendada: metricas.ultimoRol === 'cliente' ? 'Responder al cliente de inmediato' : 'Realizar seguimiento de la cotización',
      mensajeWhatsAppSugerido: `Hola ${conv.nombre || ''}, ¿cómo estás? Te escribo de MR Letreros para saber si pudiste revisar la propuesta y si tenés alguna duda para avanzar. ¡Saludos!`
    };
  }

  // Ejecutar proceso de análisis completo
  async actualizarSecretaria(forzarTodos = false) {
    if (this.isAnalyzing) {
      return { success: false, message: 'Análisis ya en curso' };
    }
    this.isAnalyzing = true;

    try {
      const conversaciones = await this.obtenerTodasLasConversaciones();
      const registrosActuales = await readSafeJSON(SECRETARIA_FILE, {});

      let procesados = 0;

      // Ordenar por actividad reciente
      for (const conv of conversaciones) {
        const id = String(conv.numero);
        const actual = registrosActuales[id];

        // Verificar si necesita análisis nuevo (mensajes nuevos o forzado)
        const historialCount = conv.historial.length;
        const yaAnalizado = actual && actual.cantMensajes === historialCount && !forzarTodos;

        if (yaAnalizado) continue;

        try {
          const resultadoIA = await this.analizarConversacionConIA(conv);
          const metricas = this.analizarMetricasChat(conv.historial);

          // Si el usuario tenía notas manuales previas, las preservamos
          const notasManuales = (actual && actual.notasManuales) ? actual.notasManuales : [];

          registrosActuales[id] = {
            id,
            numero: conv.numero,
            chatId: conv.chatId || actual?.chatId || '',
            nombre: conv.nombre || actual?.nombre || conv.numero,
            ultimoMensaje: conv.ultimoMensaje,
            ultimoTexto: metricas.ultimoTexto,
            ultimoRol: metricas.ultimoRol,
            cantMensajes: historialCount,
            tipoTrabajo: resultadoIA.tipoTrabajo || this.detectarTipoTrabajoHeuristico(conv.historial),
            medidasDetectadas: resultadoIA.medidasDetectadas || '',
            resumenTrabajo: resultadoIA.resumenTrabajo || 'Consulta general',
            estadoVenta: (actual?.estadoManual) ? actual.estadoVenta : (resultadoIA.estadoVenta || 'en_negociacion'),
            estadoManual: actual?.estadoManual || false,
            prioridad: resultadoIA.prioridad || 'media',
            notaSecretaria: resultadoIA.notaSecretaria || '',
            accionRecomendada: resultadoIA.accionRecomendada || '',
            mensajeWhatsAppSugerido: resultadoIA.mensajeWhatsAppSugerido || '',
            notasManuales: notasManuales,
            actualizadoEn: new Date().toISOString()
          };

          procesados++;
          // Pequeño delay para respetar límites de cuota si hay muchos
          await new Promise(r => setTimeout(r, 400));
        } catch (itemErr) {
          logger.error(`[Secretaria IA] Error procesando lead ${conv.numero}:`, itemErr.message);
        }
      }

      await safeWrite(SECRETARIA_FILE, registrosActuales);
      logger.info(`[Secretaria IA] Actualización finalizada. ${procesados} conversaciones analizadas.`);
      return { success: true, procesados, total: Object.keys(registrosActuales).length };
    } catch (e) {
      logger.error('[Secretaria IA] Error en proceso de actualización:', e);
      return { success: false, error: e.message };
    } finally {
      this.isAnalyzing = false;
    }
  }

  // Obtener lista con estadísticas
  async getLeadsSecretaria() {
    const registros = await readSafeJSON(SECRETARIA_FILE, {});
    const lista = Object.values(registros);

    // Calcular estadísticas
    const stats = {
      total: lista.length,
      urgentes: lista.filter(l => l.prioridad === 'urgente' || l.estadoVenta === 'sin_responder').length,
      presupuestosSinCerrar: lista.filter(l => l.estadoVenta === 'presupuesto_enviado').length,
      enNegociacion: lista.filter(l => l.estadoVenta === 'en_negociacion').length,
      cerrados: lista.filter(l => l.estadoVenta === 'cerrado').length
    };

    // Ordenar: urgentes primero, luego alta prioridad, luego fecha reciente
    lista.sort((a, b) => {
      const peso = { urgente: 4, alta: 3, media: 2, baja: 1 };
      const diff = (peso[b.prioridad] || 0) - (peso[a.prioridad] || 0);
      if (diff !== 0) return diff;
      return new Date(b.ultimoMensaje || 0) - new Date(a.ultimoMensaje || 0);
    });

    return { stats, leads: lista };
  }

  // Guardar nota manual de un lead
  async agregarNotaManual(numero, nota, autor = 'Operador') {
    const registros = await readSafeJSON(SECRETARIA_FILE, {});
    const id = String(numero);
    if (!registros[id]) throw new Error('Lead no encontrado');

    if (!Array.isArray(registros[id].notasManuales)) {
      registros[id].notasManuales = [];
    }

    registros[id].notasManuales.push({
      texto: nota,
      autor: autor,
      fecha: new Date().toISOString()
    });

    await safeWrite(SECRETARIA_FILE, registros);
    return registros[id];
  }

  // Cambiar estado manual
  async cambiarEstado(numero, nuevoEstado) {
    const registros = await readSafeJSON(SECRETARIA_FILE, {});
    const id = String(numero);
    if (!registros[id]) throw new Error('Lead no encontrado');

    registros[id].estadoVenta = nuevoEstado;
    registros[id].estadoManual = true;
    if (nuevoEstado === 'cerrado' || nuevoEstado === 'descartado') {
      registros[id].prioridad = 'baja';
    }

    await safeWrite(SECRETARIA_FILE, registros);
    return registros[id];
  }
}

module.exports = SecretariaIAService;
