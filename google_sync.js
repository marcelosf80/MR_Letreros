// c:\MR_Letreros\google_sync.js
// Sincronizador Real con Google Apps Script para MR Letreros
// Versión v8 con diagnóstico de WhatsApp y filtro de Gremios

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const notifier = require('node-notifier');
const db = require('./db');

// Configuración
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxCWY_Sre0t9V-4ilK-TWIXKAttWdUWqNBa2fTnneVJHbHxGQcWVKq9Ug6UYCf_ewCJ/exec";
const BOT_API_URL = "http://127.0.0.1:3001/send-message";

// Rutas de datos
const BASE_PATH = 'C:\\MR_Letreros';
const DATA_DIR = path.join(BASE_PATH, 'datos_mr_letreros');
const TRABAJOS_FILE = path.join(DATA_DIR, 'trabajos.json');
const CLIENTES_FILE = path.join(DATA_DIR, 'clientes.json');
const MATERIALES_FILE = path.join(DATA_DIR, 'gremio_materiales.json');
const PRECIOS_FILE = path.join(DATA_DIR, 'gremio_precios_db.json');
const GASTOS_FILE = path.join(DATA_DIR, 'mr_letreros_gastos.json');
const TERCEROS_FILE = path.join(DATA_DIR, 'gremio_terceros.json');
const GREMIO_HOJA_FILE = path.join(DATA_DIR, 'gremio_hoja_clientes.json');

// Escritura atómica (temp + rename) para no corromper archivos si el proceso muere a mitad
async function safeWrite(file, data) {
    const tmp = file + '.tmp';
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, file);
}

// Parsea montos con formato español ("$15.000,50", "1.500", "1500") sin romperse
function parseCurrency(val) {
    if (val === null || val === undefined) return 0;
    let s = String(val).replace(/[^\d.,-]/g, '');
    if (!s) return 0;
    if (s.includes('.') && s.includes(',')) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
        else s = s.replace(/,/g, '');
    } else if (s.includes(',') || s.includes('.')) {
        if (/[\.,]\d{3}$/.test(s)) s = s.replace(/[\.,]/g, '');
        else s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

// Fusiona items nuevos en un archivo JSON por "fingerprint" sin borrar los locales
// (evita que la sync de Google destruya datos locales con esquemas distintos).
async function mergeByFingerprint(file, newItems, fingerprintFn) {
    let current = [];
    try {
        const raw = await fs.readFile(file, 'utf-8');
        current = JSON.parse(raw);
        if (!Array.isArray(current)) current = [];
    } catch (e) { }
    let changed = false;
    const fps = new Set(current.map(fingerprintFn));
    for (const item of newItems) {
        const fp = fingerprintFn(item);
        if (!fps.has(fp)) {
            current.push(item);
            fps.add(fp);
            changed = true;
        }
    }
    if (changed) await safeWrite(file, JSON.stringify(current, null, 2));
    return changed;
}

let isSyncing = false;

module.exports = {
    syncData: async (io) => {
        if (isSyncing) {
            return { success: false, message: 'Sincronización ya en curso' };
        }
        isSyncing = true;
        try {
            // 0. Sincronizar clientes desde Google Sheets (Hoja GREMIO)
            try {
                const gremiosResponse = await axios.get(`${GOOGLE_SCRIPT_URL}?action=getGremios`, { timeout: 15000 });
                const gremiosData = gremiosResponse.data;
                
                if (gremiosData && typeof gremiosData === 'object' && !Array.isArray(gremiosData)) {
                    // --- GUARDAR LISTA PURA DE LA HOJA GREMIO (sin mezclar con datos viejos) ---
                    const hojaGremioClientes = [];
                    for (const [gremio, whatsapp] of Object.entries(gremiosData)) {
                        if (!gremio || gremio.toLowerCase() === 'nombre' || gremio.toLowerCase() === 'usuario') continue;
                        hojaGremioClientes.push({
                            id: `hoja_gremio_${gremio.trim().toLowerCase().replace(/\s+/g, '_')}`,
                            nombre: gremio.trim(),
                            name: gremio.trim(),
                            telefono: whatsapp ? whatsapp.toString() : '',
                            phone: whatsapp ? whatsapp.toString() : '',
                            tipo: 'gremio',
                            origen: 'hoja_gremio'
                        });
                    }
                    await safeWrite(GREMIO_HOJA_FILE, JSON.stringify(hojaGremioClientes, null, 2));
                    logger.info(`[Google Sync] Hoja GREMIO: ${hojaGremioClientes.length} clientes guardados en gremio_hoja_clientes.json`);

                    // --- También actualizar clientes.json (merge, sin borrar viejos) ---
                    let clientes = [];
                    try {
                        const cData = await fs.readFile(CLIENTES_FILE, 'utf-8');
                        clientes = JSON.parse(cData);
                        if (!Array.isArray(clientes)) clientes = clientes.clientes || [];
                    } catch(e) {}
                    
                    let clientesCambiados = false;
                    for (const [gremio, whatsapp] of Object.entries(gremiosData)) {
                        if (!gremio || gremio.toLowerCase() === 'nombre' || gremio.toLowerCase() === 'usuario') continue;
                        const existing = clientes.find(c => (c.nombre || c.name || '').trim().toLowerCase() === gremio.trim().toLowerCase());
                        if (!existing) {
                            clientes.push({
                                id: `gremio_cli_${Date.now()}_${String(Math.random()).slice(-4)}`,
                                tipo: 'gremio',
                                estado: 'activo',
                                nombre: gremio.trim(),
                                name: gremio.trim(),
                                telefono: whatsapp ? whatsapp.toString() : '',
                                phone: whatsapp ? whatsapp.toString() : '',
                                email: '',
                                direccion: '',
                                cuit: '',
                                condicionIVA: '',
                                descuento: 0,
                                notas: 'Importado de Google Sheets (GREMIO)',
                                fechaCreacion: new Date().toISOString(),
                                totalFacturado: 0,
                                cantidadTrabajos: 0,
                                ultimoTrabajo: null
                            });
                            clientesCambiados = true;
                        } else {
                            if (!existing.name) { existing.name = existing.nombre || gremio.trim(); clientesCambiados = true; }
                            if (!existing.phone && whatsapp) { existing.phone = whatsapp.toString(); clientesCambiados = true; }
                            if (!existing.telefono && whatsapp) { existing.telefono = whatsapp.toString(); clientesCambiados = true; }
                        }
                    }
                    if (clientesCambiados) {
                        await safeWrite(CLIENTES_FILE, JSON.stringify(clientes, null, 2));
                        logger.info('[Google Sync] Clientes (Gremios) sincronizados con la hoja GREMIO de Google Sheets.');
                    }
                }
            } catch (err) {
                logger.warn('[Google Sync] No se pudo obtener la lista de gremios (¿requiere actualizar Apps Script?): ' + err.message);
            }

            // 0.5 Sincronizar Costos
            try {
                const costosResponse = await axios.get(`${GOOGLE_SCRIPT_URL}?action=getCostos`, { timeout: 15000 });
                const costosData = costosResponse.data;
                if (Array.isArray(costosData) && costosData.length > 0) {
                    let locales = [];
                    try { locales = JSON.parse(await fs.readFile(MATERIALES_FILE, 'utf-8')); } catch(e) {}
                    
                    let cambiaron = false;
                    for (let c of costosData) {
                        const idx = locales.findIndex(m => (m.productoNombre || '').trim().toLowerCase() === c.material.toLowerCase());
                        // Usa precioM2 si existe, sino totalRollo - tinta
                        const costoM2 = c.precioM2 > 0 ? c.precioM2 : Math.max(0, c.totalRollo - (c.tintaM2 || 0)); 
                        
                        if (idx >= 0) {
                            if (locales[idx].costoPorM2 !== costoM2 || locales[idx].precioRollo !== c.totalRollo) {
                                locales[idx].costoPorM2 = costoM2;
                                locales[idx].precioRollo = c.totalRollo;
                                locales[idx].ultimaActualizacion = new Date().toISOString();
                                cambiaron = true;
                            }
                        } else {
                            locales.push({
                                id: 'mat_' + Date.now() + Math.random().toString(36).substr(2, 4),
                                productoNombre: c.material,
                                categoria: 'Lona/Vinilo',
                                costoPorM2: costoM2,
                                precioRollo: c.totalRollo,
                                ultimaActualizacion: new Date().toISOString()
                            });
                            cambiaron = true;
                        }
                    }
                    if (cambiaron) {
                        await safeWrite(MATERIALES_FILE, JSON.stringify(locales, null, 2));
                        logger.info('[Google Sync] Materiales (Costos) actualizados desde Google Sheets.');
                    }
                }
            } catch (err) {
                logger.warn('[Google Sync] No se pudo sincronizar costos: ' + err.message);
            }

            // 0.6 Sincronizar Precios de Gremio
            try {
                const preRes = await axios.get(`${GOOGLE_SCRIPT_URL}?action=getPrecios`, { timeout: 15000 });
                if (Array.isArray(preRes.data) && preRes.data.length > 0) {
                    await safeWrite(PRECIOS_FILE, JSON.stringify(preRes.data, null, 2));
                    logger.info('[Google Sync] Precios sincronizados desde Google Sheets.');
                }
            } catch (err) {
                logger.warn('[Google Sync] Error al sincronizar precios: ' + err.message);
            }

            // 0.7 Sincronizar Gastos e Ingresos
            try {
                const gasRes = await axios.get(`${GOOGLE_SCRIPT_URL}?action=getGastos`, { timeout: 15000 });
                if (Array.isArray(gasRes.data) && gasRes.data.length > 0) {
                    // FIX: fusionar en vez de sobrescribir (la sync destruía gastos locales)
                    const fp = g => `${String(g.fecha || '')}|${String(g.detalle || g.descripcion || '')}|${parseCurrency(g.monto)}|${String(g.tipo || '')}`;
                    const changed = await mergeByFingerprint(GASTOS_FILE, gasRes.data, fp);
                    logger.info(changed
                        ? '[Google Sync] Gastos fusionados desde Google Sheets (nuevos agregados).'
                        : '[Google Sync] Gastos: sin cambios nuevos desde Google Sheets.');
                }
            } catch (err) {
                logger.warn('[Google Sync] Error al sincronizar gastos: ' + err.message);
            }

            // 0.8 Sincronizar Terceros (Proveedores)
            try {
                const terRes = await axios.get(`${GOOGLE_SCRIPT_URL}?action=getTerceros`, { timeout: 15000 });
                if (Array.isArray(terRes.data) && terRes.data.length > 0) {
                    // FIX: la hoja devuelve registros de pago {proveedor,fecha,detalle,monto},
                    // que NO son la lista local de terceros {id,nombre,contacto,servicios}.
                    // Sobrescribir destruía el esquema rico local → ahora solo se sincroniza
                    // si el archivo local está vacío o no tiene el esquema rico.
                    let localTerceros = [];
                    try {
                        const raw = await fs.readFile(TERCEROS_FILE, 'utf-8');
                        localTerceros = JSON.parse(raw);
                        if (!Array.isArray(localTerceros)) localTerceros = [];
                    } catch (e) { }
                    const tieneEsquemaRico = localTerceros.some(t => t && (t.nombre || t.contacto || t.servicios));
                    if (!tieneEsquemaRico && localTerceros.length === 0) {
                        await safeWrite(TERCEROS_FILE, JSON.stringify(terRes.data, null, 2));
                        logger.info('[Google Sync] Proveedores/Terceros sincronizados desde Google Sheets (archivo vacío).');
                    } else if (!tieneEsquemaRico) {
                        const fp = t => `${String(t.proveedor || '')}|${parseCurrency(t.monto)}|${String(t.fecha || '')}`;
                        const changed = await mergeByFingerprint(TERCEROS_FILE, terRes.data, fp);
                        logger.info('[Google Sync] Terceros fusionados desde Google Sheets.');
                    } else {
                        logger.warn('[Google Sync] Terceros: se omite sobrescritura para no destruir el esquema local rico.');
                    }
                }
            } catch (err) {
                logger.warn('[Google Sync] Error al sincronizar terceros: ' + err.message);
            }

            // 1. Obtener pedidos pendientes de Google
            let orders = [];

            try {
                const response = await axios.get(`${GOOGLE_SCRIPT_URL}?action=getPending`, { timeout: 30000 });
                const rData = response.data;

                if (Array.isArray(rData)) {
                    orders = rData;
                } else if (rData && typeof rData === 'object') {
                    orders = Array.isArray(rData.pending) ? rData.pending : [];
                }
            } catch (err) {
                logger.warn('[Google Sync] Error al obtener pedidos pendientes: ' + err.message);
                return { success: false, error: err.message };
            }


            // 2. Leer base de datos local
            let fullData = { works: [], notifications: [] };
            let clientes = [];
            
            try {
                const data = await fs.readFile(TRABAJOS_FILE, 'utf-8');
                fullData = JSON.parse(data);
                if (!fullData.works) fullData.works = [];
                if (!fullData.notifications) fullData.notifications = [];
            } catch (e) {
                logger.warn('[Google Sync] Iniciando trabajos.json nuevo.');
            }

            try {
                const cData = await fs.readFile(CLIENTES_FILE, 'utf-8');
                clientes = JSON.parse(cData);
            } catch (e) {
                logger.warn('[Google Sync] No se pudo leer clientes.json para filtrar.');
            }

            if (!Array.isArray(orders) || orders.length === 0) {
                return { success: true, message: 'Sin pedidos nuevos.' };
            }

            logger.info(`[Google Sync] Detectados ${orders.length} pedidos a sincronizar.`);

            const ackRows = [];
            let addedCount = 0;
            for (let order of orders) {
                // --- LOG DE DIAGNÓSTICO PARA VER SI LLEGA EL WHATSAPP ---
                logger.info(`[Google Sync] Procesando Pedido: Gremio="${order.gremio}", WhatsApp="${order.whatsapp || 'VACÍO'}"`);

                const precioFinal = parseCurrency(order.total);
                const costoEstimado = precioFinal * 0.7;

                // 3. DUPLICATE CHECK (Evitar duplicar si ya existe el trabajo para ese cliente)
                const isDuplicate = fullData.works.some(w => {
                    // Coincidencia directa por número de fila de Google Sheets
                    if (w.google_row && order.row && w.google_row === order.row) return true;

                    const wClient = String(w.clientName || w.cliente_nombre || w.gremio || '').trim().toLowerCase();
                    const orderClient = String(order.gremio || '').trim().toLowerCase();
                    const wDesc = String(w.descripcion || '').trim();
                    const orderDesc = String(order.detalle || '').trim();
                    const wNotes = Array.isArray(w.notes) ? w.notes : [];
                    
                    // Coincidencia por URL de Google Drive
                    if (order.driveUrl && order.driveUrl.trim()) {
                        const hasDriveMatch = wNotes.some(n => n && n.text && n.text.includes(order.driveUrl.trim()));
                        if (hasDriveMatch) return true;
                    }

                    // Coincidencia por cliente y precio idéntico
                    if (wClient === orderClient && Math.abs((w.total || 0) - precioFinal) < 1) {
                        if (!orderDesc || wDesc === orderDesc || wDesc.includes(orderDesc) || orderDesc.includes(wDesc)) {
                            return true;
                        }
                    }

                    // Coincidencia temporal por fecha
                    if (order.fecha) {
                        const parsedOrderTime = Date.parse(order.fecha);
                        const workTime = Date.parse(w.createdAt || w.created_at || '');
                        if (!isNaN(parsedOrderTime) && !isNaN(workTime)) {
                            if (wClient === orderClient && Math.abs((w.total || 0) - precioFinal) < 1 && Math.abs(workTime - parsedOrderTime) < 300000) {
                                return true;
                            }
                        }
                    }

                    return false;
                });

                if (isDuplicate) {
                    logger.info(`[Google Sync] Ignorando trabajo duplicado para ${order.gremio}`);
                    continue;
                }

                const workId = 'goog_' + Date.now() + Math.random().toString(36).substr(2, 5);
                const descripcionWork = order.detalle || "Trabajo importado desde Hoja Gremio";

                // 4. Crear el trabajo
                const newWork = {
                    id: workId,
                    google_row: order.row || null,
                    tipo_cliente: 'gremio',
                    clientName: order.gremio,
                    clientPhone: order.whatsapp ? order.whatsapp.toString() : '',
                    total: precioFinal,
                    totalCost: costoEstimado,
                    profit: precioFinal - costoEstimado,
                    balance: precioFinal,
                    paidAmount: 0,
                    status: 'pending',
                    paymentStatus: 'unpaid',
                    priority: 'normal',
                    createdAt: order.fecha || new Date().toISOString(),
                    descripcion: descripcionWork,
                    notes: [
                        { 
                            text: `Detalle:\n${descripcionWork}${order.driveUrl ? '\n\nLink a Drive: ' + order.driveUrl : ''}`, 
                            author: "Google Sync (Hoja Gremio)", 
                            date: new Date().toISOString() 
                        }
                    ],
                    timeline: [
                        { type: 'created', description: 'Trabajo sincronizado desde Hoja Gremio', timestamp: new Date().toISOString() }
                    ]
                };

                fullData.works.push(newWork);

                // Guardar en SQLite en tiempo real
                try {
                    const clienteRow = await db.get({ sql: 'SELECT id FROM clientes WHERE nombre = ? LIMIT 1', params: [order.gremio || ''] });
                    const clienteId = clienteRow?.id || null;

                    await db.run(
                        `INSERT OR REPLACE INTO trabajos
                         (id, quote_id, cliente_id, cliente_nombre, cliente_telefono, cliente_email, cliente_address,
                          tipo_cliente, descripcion, total, total_cost, profit, paid_amount, balance, senia,
                          status, payment_status, priority, delivery_date, delivery_status, actual_delivery_date,
                          paid_at, created_at, productos_json, is_merged, costos_json, notes_json, merged_works_json)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                        [workId, null, clienteId, order.gremio || '', order.whatsapp ? order.whatsapp.toString() : '',
                         '', '', 'gremio', descripcionWork, precioFinal, costoEstimado,
                         precioFinal - costoEstimado, 0, precioFinal, 0,
                         'pending', 'unpaid', 'high', null, 'pending',
                         null, null, new Date().toISOString(), '[]', 0, '{}',
                         JSON.stringify(newWork.notes), '[]']
                    );

                    await db.run(
                        'INSERT INTO trabajo_timeline (trabajo_id, type, description, timestamp) VALUES (?,?,?,?)',
                        [workId, 'created', 'Pedido recibido desde Google Web App', new Date().toISOString()]
                    );

                    if (Number(newWork.paidAmount || newWork.senia || 0) > 0) {
                        await db.run(
                            'INSERT INTO trabajo_pagos (trabajo_id, monto, fecha, nota) VALUES (?,?,?,?)',
                            [workId, Number(newWork.paidAmount || newWork.senia || 0), new Date().toISOString(), newWork.senia ? 'Seña / Anticipo' : 'Pago registrado']
                        );
                    }

                    logger.info(`[Google Sync] SQLite: Trabajo guardado para ${order.gremio}`);
                } catch (dbErr) {
                    logger.error(`[Google Sync] Error insertando en SQLite: ${dbErr.message}`);
                }

                // 5. Notificación para Dashboard
                fullData.notifications.push({
                    id: 'notif_' + Date.now() + addedCount,
                    title: 'Nuevo Pedido Web',
                    message: `Gremio: ${order.gremio} - $${precioFinal.toLocaleString()}`,
                    type: 'success',
                    workId: workId,
                    read: false,
                    date: new Date().toISOString()
                });

                // 6. NOTIFICACIÓN DE WINDOWS (Modo Seguro y Asíncrono)
                try {
                    notifier.notify({
                        title: 'MR Letreros - Nuevo Pedido',
                        message: `Gremio: ${order.gremio}\nTotal: $${precioFinal.toLocaleString()}`,
                        icon: path.join(BASE_PATH, 'public', 'img', 'logo_negro.png'),
                        sound: true,
                        wait: false,
                        appID: 'MR Letreros'
                    }, (err) => {
                        if (err) logger.warn(`[Notifier] Error enviando notificación: ${err.message}`);
                    });
                } catch (notiErr) {
                    logger.warn(`[Notifier] Error al invocar notificador: ${notiErr.message}`);
                }

                // 7. WHATSAPP (CONFIRMACIÓN AUTOMÁTICA)
                let targetPhone = order.whatsapp ? order.whatsapp.toString() : '';
                if (!targetPhone || targetPhone.replace(/\D/g, '').length < 6) {
                    const matchedClient = clientes.find(c => (c.nombre || c.name || '').trim().toLowerCase() === (order.gremio || '').trim().toLowerCase());
                    if (matchedClient && (matchedClient.telefono || matchedClient.phone)) {
                        targetPhone = (matchedClient.telefono || matchedClient.phone).toString();
                    }
                }

                if (targetPhone && targetPhone.replace(/\D/g, '').length > 5) {
                    let mensaje = '';
                    try {
                        const detalleFormateado = order.detalle ? `\n\n*Detalle del pedido:*\n${order.detalle}` : '';
                        mensaje = `*MR Letreros - Confirmación de Recepción* ✅\n\nHola *${order.gremio}*, confirmamos que hemos recibido tu pedido correctamente.${detalleFormateado}\n\n💰 *Total Estimado:* $${precioFinal.toLocaleString()}\n📂 *Estado:* En cola de producción\n\nYa lo hemos ingresado en nuestro sistema administrativo. Ante cualquier duda, podés consultarnos por este medio.\n\n¡Muchas gracias por confiar en nosotros!`;

                        // FIX: msgId (idempotencia en el bot) + timeout (antes sin timeout podía colgar)
                        const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(-4);
                        await axios.post(BOT_API_URL, {
                            phone: targetPhone,
                            message: mensaje,
                            msgId
                        }, { timeout: 30000 });
                        logger.info(`✅ WhatsApp de confirmación enviado a ${targetPhone} (${order.gremio})`);
                    } catch (botErr) {
                        logger.error(`❌ El bot no pudo enviar el mensaje a ${targetPhone}: ${botErr.message}`);
                        try {
                            const pendingFile = path.join(DATA_DIR, 'pending_messages.json');
                            let pending = [];
                            try {
                                pending = JSON.parse(await fs.readFile(pendingFile, 'utf-8'));
                            } catch (e) {}
                            pending.push({ phone: targetPhone, message: mensaje, msgId, date: new Date().toISOString() });
                            await fs.writeFile(pendingFile, JSON.stringify(pending, null, 2));
                            logger.info(`📥 Mensaje guardado en cola pendiente para ${targetPhone}`);
                        } catch (queueErr) {
                            logger.error(`❌ Error al guardar en cola pendiente: ${queueErr.message}`);
                        }
                    }
                } else {
                    logger.warn(`⚠️ No hay un número de WhatsApp válido para el pedido de ${order.gremio}`);
                }

                // 8. NOTIFICACIÓN TIEMPO REAL (SOCKET.IO)
                if (io) {
                    io.emit('new_order', {
                        title: '📦 Nuevo Pedido Gremio',
                        message: `Gremio: ${order.gremio} - $${precioFinal.toLocaleString()}`,
                        workId: workId
                    });
                }

                if (order.row) ackRows.push(order.row);
                addedCount++;
            }

            // 7. Guardar cambios
            await safeWrite(TRABAJOS_FILE, JSON.stringify(fullData, null, 2));

            // Confirmar a Google Sheets solo los pedidos que se guardaron exitosamente (Two-Phase Commit)
            if (ackRows.length > 0) {
                try {
                    await axios.get(`${GOOGLE_SCRIPT_URL}?action=ackOrders&rows=${encodeURIComponent(JSON.stringify(ackRows))}`, { timeout: 15000 });
                    logger.info(`[Google Sync] Filas confirmadas en Google Sheets: ${ackRows.join(', ')}`);
                } catch (ackErr) {
                    logger.warn(`[Google Sync] Error confirmando filas en Google Sheets: ${ackErr.message}`);
                }
            }
            
            // 🔔 Emitir evento de actualización en tiempo real
            if (addedCount > 0 && io) {
                io.emit('works_updated', { source: 'google_sync' });
            }
            
            logger.info(`[Google Sync] Sincronización finalizada: ${addedCount} trabajos añadidos.`);
            return { success: true, count: addedCount };

        } catch (error) {
            if (!error.message.includes('timeout')) {
                logger.error('[Google Sync] Error en el proceso:', error.message);
            }
            return { success: false, error: error.message };
        } finally {
            isSyncing = false;
        }
    },

    // Elimina un pedido de la planilla de Google Sheets y mueve sus archivos de Google Drive a la papelera
    deleteOrderFromGoogle: async (work) => {
        try {
            if (!work) return { success: false, error: 'Sin datos de trabajo' };

            const driveUrls = new Set();
            const folderIds = new Set();

            const scanText = (txt) => {
                if (!txt || typeof txt !== 'string') return;
                const matches = txt.match(/https?:\/\/[^\s"'<>]+drive\.google\.com[^\s"'<>]+/gi);
                if (matches) {
                    matches.forEach(url => {
                        const clean = url.replace(/[,\);]+$/, '');
                        driveUrls.add(clean);
                        const fidMatch = clean.match(/folders\/([a-zA-Z0-9_-]+)/i) || clean.match(/id=([a-zA-Z0-9_-]+)/i);
                        if (fidMatch) folderIds.add(fidMatch[1]);
                    });
                }
            };

            scanText(work.descripcion);
            scanText(work.driveUrl);

            let notesArr = [];
            if (Array.isArray(work.notes)) notesArr = work.notes;
            else if (typeof work.notes_json === 'string') {
                try { notesArr = JSON.parse(work.notes_json); } catch(e) {}
            }
            notesArr.forEach(n => scanText(n.text || n.contenido || n.detalle));

            let mergedArr = [];
            if (Array.isArray(work.mergedWorks)) mergedArr = work.mergedWorks;
            else if (typeof work.merged_works_json === 'string') {
                try { mergedArr = JSON.parse(work.merged_works_json); } catch(e) {}
            }
            mergedArr.forEach(mw => {
                scanText(mw.descripcion);
                scanText(mw.driveUrl);
                const mwNotes = Array.isArray(mw.notes) ? mw.notes : [];
                mwNotes.forEach(n => scanText(n.text || n.contenido || n.detalle));
            });

            const gremio = String(work.clientName || work.cliente_nombre || work.gremio || '').trim();
            const total = parseFloat(work.total) || 0;
            const detalle = work.descripcion || '';
            const fIds = Array.from(folderIds);
            const dUrls = Array.from(driveUrls);

            logger.info(`[Google Sync] Solicitando eliminación de pedido en Google: Gremio="${gremio}", Total=$${total}, Carpetas Drive=${fIds.length}`);

            // 1. Intentar primero con POST
            try {
                const postRes = await axios.post(GOOGLE_SCRIPT_URL, {
                    action: 'deleteOrder',
                    folderIds: fIds,
                    driveUrls: dUrls,
                    folderId: fIds.join(','),
                    driveUrl: dUrls.join(','),
                    gremio: gremio,
                    total: total,
                    detalle: detalle
                }, { timeout: 12000, maxRedirects: 5 });

                if (postRes.data && postRes.data.success) {
                    logger.info(`[Google Sync] Eliminado correctamente en Google Sheets/Drive (POST):`, postRes.data);
                    return { success: true, ...postRes.data };
                }
            } catch (postErr) {
                logger.warn(`[Google Sync] POST deleteOrder falló (${postErr.message}), intentando fallback vía GET...`);
            }

            // 2. Fallback vía GET (maneja 302 redirects automáticamente sin perder parámetros)
            const queryParams = new URLSearchParams({
                action: 'deleteOrder',
                gremio: gremio,
                total: total.toString(),
                folderId: fIds.join(','),
                driveUrl: dUrls.join(',')
            });

            const getRes = await axios.get(`${GOOGLE_SCRIPT_URL}?${queryParams.toString()}`, { timeout: 15000 });
            logger.info(`[Google Sync] Resultado de eliminación vía GET:`, getRes.data);
            return { success: true, data: getRes.data };
        } catch (err) {
            logger.error(`[Google Sync] Error al eliminar pedido en Google Sheets/Drive: ${err.message}`);
            return { success: false, error: err.message };
        }
    }
};