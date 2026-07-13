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
const BOT_API_URL = "http://localhost:3001/send-message";

// Rutas de datos
const BASE_PATH = 'C:\\MR_Letreros';
const DATA_DIR = path.join(BASE_PATH, 'datos_mr_letreros');
const TRABAJOS_FILE = path.join(DATA_DIR, 'trabajos.json');
const CLIENTES_FILE = path.join(DATA_DIR, 'clientes.json');
const MATERIALES_FILE = path.join(DATA_DIR, 'gremio_materiales.json');
const PRECIOS_FILE = path.join(DATA_DIR, 'gremio_precios_db.json');
const GASTOS_FILE = path.join(DATA_DIR, 'mr_letreros_gastos.json');
const TERCEROS_FILE = path.join(DATA_DIR, 'gremio_terceros.json');

module.exports = {
    syncData: async (io) => {
        try {
            // 0. Sincronizar clientes desde Google Sheets (PEDIDOS)
            try {
                const gremiosResponse = await axios.get(`${GOOGLE_SCRIPT_URL}?action=getGremios`, { timeout: 15000 });
                const gremiosData = gremiosResponse.data;
                
                if (gremiosData && typeof gremiosData === 'object' && !Array.isArray(gremiosData)) {
                    let clientes = [];
                    try {
                        const cData = await fs.readFile(CLIENTES_FILE, 'utf-8');
                        clientes = JSON.parse(cData);
                        if (!Array.isArray(clientes)) clientes = clientes.clientes || [];
                    } catch(e) {}
                    
                    let clientesCambiados = false;
                    for (const [gremio, whatsapp] of Object.entries(gremiosData)) {
                        const existe = clientes.some(c => (c.nombre || '').trim().toLowerCase() === gremio.trim().toLowerCase());
                        if (!existe) {
                            clientes.push({
                                id: `cli_auto_${String(Math.random()).slice(-6)}`,
                                tipo: 'gremio',
                                estado: 'activo',
                                nombre: gremio.trim(),
                                telefono: whatsapp ? whatsapp.toString() : '',
                                email: '',
                                direccion: '',
                                cuit: '',
                                condicionIVA: '',
                                descuento: 0,
                                notas: 'Importado de Google Sheets (PEDIDOS)',
                                fechaCreacion: new Date().toISOString(),
                                totalFacturado: 0,
                                cantidadTrabajos: 0,
                                ultimoTrabajo: null
                            });
                            clientesCambiados = true;
                        }
                    }
                    if (clientesCambiados) {
                        await fs.writeFile(CLIENTES_FILE, JSON.stringify(clientes, null, 2));
                        logger.info('[Google Sync] Clientes (Gremios) sincronizados con Google Sheets.');
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
                        await fs.writeFile(MATERIALES_FILE, JSON.stringify(locales, null, 2));
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
                    await fs.writeFile(PRECIOS_FILE, JSON.stringify(preRes.data, null, 2));
                    logger.info('[Google Sync] Precios sincronizados desde Google Sheets.');
                }
            } catch (err) {
                logger.warn('[Google Sync] Error al sincronizar precios: ' + err.message);
            }

            // 0.7 Sincronizar Gastos e Ingresos
            try {
                const gasRes = await axios.get(`${GOOGLE_SCRIPT_URL}?action=getGastos`, { timeout: 15000 });
                if (Array.isArray(gasRes.data) && gasRes.data.length > 0) {
                    await fs.writeFile(GASTOS_FILE, JSON.stringify(gasRes.data, null, 2));
                    logger.info('[Google Sync] Gastos e Ingresos sincronizados desde Google Sheets.');
                }
            } catch (err) {
                logger.warn('[Google Sync] Error al sincronizar gastos: ' + err.message);
            }

            // 0.8 Sincronizar Terceros (Proveedores)
            try {
                const terRes = await axios.get(`${GOOGLE_SCRIPT_URL}?action=getTerceros`, { timeout: 15000 });
                if (Array.isArray(terRes.data) && terRes.data.length > 0) {
                    await fs.writeFile(TERCEROS_FILE, JSON.stringify(terRes.data, null, 2));
                    logger.info('[Google Sync] Proveedores/Terceros sincronizados desde Google Sheets.');
                }
            } catch (err) {
                logger.warn('[Google Sync] Error al sincronizar terceros: ' + err.message);
            }

            // 1. Obtener pedidos pendientes de Google
            const response = await axios.get(`${GOOGLE_SCRIPT_URL}?action=getPending`, { timeout: 15000 });
            const orders = response.data;

            if (!Array.isArray(orders) || orders.length === 0) {
                return { success: true, message: 'Sin pedidos nuevos.' };
            }

            logger.info(`[Google Sync] Detectados ${orders.length} pedidos nuevos de Google.`);

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

            let addedCount = 0;
            for (let order of orders) {
                // --- LOG DE DIAGNÓSTICO PARA VER SI LLEGA EL WHATSAPP ---
                logger.info(`[Google Sync] Procesando Pedido: Gremio="${order.gremio}", WhatsApp="${order.whatsapp || 'VACÍO'}"`);

                const precioFinal = parseFloat(order.total) || 0;
                const costoEstimado = precioFinal * 0.7;

                // 3. DUPLICATE CHECK (Evitar doble entrada si el portal ya notificó al server)
                const isDuplicate = fullData.works.some(w => {
                    const timeDiff = Math.abs(new Date(w.createdAt).getTime() - new Date().getTime());
                    return w.clientName === order.gremio && 
                           Math.abs(w.total - precioFinal) < 1 && 
                           timeDiff < 60000; // 60 segundos
                });

                if (isDuplicate) {
                    logger.info(`[Google Sync] Ignorando duplicado reciente para ${order.gremio}`);
                    continue;
                }

                const workId = 'goog_' + Date.now() + Math.random().toString(36).substr(2, 5);

                // 4. Crear el trabajo
                const newWork = {
                    id: workId,
                    clientName: order.gremio,
                    clientPhone: order.whatsapp ? order.whatsapp.toString() : '',
                    total: precioFinal,
                    totalCost: costoEstimado,
                    profit: precioFinal - costoEstimado,
                    balance: precioFinal,
                    paidAmount: 0,
                    status: 'pending',
                    paymentStatus: 'unpaid',
                    priority: 'high',
                    createdAt: new Date().toISOString(),
                    descripcion: "Pedido desde Portal Web Google",
                    notes: [
                        { 
                            text: `Detalle del pedido:\n${order.detalle}\n\nLink a Drive: ${order.driveUrl}`, 
                            author: "Google Sync", 
                            date: new Date().toISOString() 
                        }
                    ],
                    timeline: [
                        { type: 'created', description: 'Pedido recibido desde Google Web App', timestamp: new Date().toISOString() }
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
                         '', '', 'gremio', 'Pedido desde Portal Web Google', precioFinal, costoEstimado,
                         precioFinal - costoEstimado, 0, precioFinal, 0,
                         'pending', 'unpaid', 'high', null, 'pending',
                         null, null, new Date().toISOString(), '[]', 0, '{}',
                         JSON.stringify(newWork.notes), '[]']
                    );

                    await db.run(
                        'INSERT INTO trabajo_timeline (trabajo_id, type, description, timestamp) VALUES (?,?,?,?)',
                        [workId, 'created', 'Pedido recibido desde Google Web App', new Date().toISOString()]
                    );

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

                // 6. NOTIFICACIÓN DE WINDOWS
                notifier.notify({
                    title: 'MR Letreros - Nuevo Pedido',
                    message: `Gremio: ${order.gremio}\nTotal: $${precioFinal.toLocaleString()}`,
                    icon: path.join(BASE_PATH, 'public', 'img', 'logo_negro.png'),
                    sound: true,
                    wait: true,
                    appID: 'MR Letreros'
                });

                // 7. WHATSAPP (SOLO SI ES GREMIO O IDENTIFICADO)
                if (order.whatsapp && order.whatsapp.toString().length > 5) {
                    const cleanPhone = order.whatsapp.toString().replace(/\D/g, '');
                    
                    // Buscar en clientes.json
                    const clienteEnBase = clientes.find(c => {
                        const cPhone = (c.telefono || '').toString().replace(/\D/g, '');
                        return (cPhone.includes(cleanPhone) || cleanPhone.includes(cPhone));
                    });

                    // Enviamos si es Gremio en base, o si el pedido indica que es Gremio (Portal Gremio)
                    const esGremio = (clienteEnBase && clienteEnBase.tipo === 'gremio') || true; // Asumimos true porque viene del Portal Gremio

                    if (esGremio) {
                        let mensaje = '';
                        try {
                            const detalleFormateado = order.detalle ? `\n\n*Detalle del pedido:*\n${order.detalle}` : '';
                            mensaje = `*MR Letreros - Confirmación de Recepción* ✅\n\nHola *${order.gremio}*, confirmamos que hemos recibido tu pedido correctamente.${detalleFormateado}\n\n💰 *Total Estimado:* $${precioFinal.toLocaleString()}\n📂 *Estado:* En cola de producción\n\nYa lo hemos ingresado en nuestro sistema administrativo. Ante cualquier duda, podés consultarnos por este medio.\n\n¡Muchas gracias por confiar en nosotros!`;
                            
                            await axios.post(BOT_API_URL, {
                                phone: order.whatsapp,
                                message: mensaje
                            });
                            logger.info(`✅ WhatsApp de confirmación enviado a ${order.whatsapp} (${order.gremio})`);
                        } catch (botErr) {
                            logger.error(`❌ El bot no pudo enviar el mensaje a ${order.whatsapp}: ${botErr.message}`);
                            // GUARDAR EN COLA PENDIENTE PARA CUANDO EL BOT DESPIERTE
                            try {
                                const pendingFile = path.join(DATA_DIR, 'pending_messages.json');
                                let pending = [];
                                try {
                                    pending = JSON.parse(await fs.readFile(pendingFile, 'utf-8'));
                                } catch (e) {}
                                pending.push({ phone: order.whatsapp, message: mensaje, date: new Date().toISOString() });
                                await fs.writeFile(pendingFile, JSON.stringify(pending, null, 2));
                                logger.info(`📥 Mensaje guardado en cola pendiente para ${order.whatsapp}`);
                            } catch (queueErr) {
                                logger.error(`❌ Error al guardar en cola pendiente: ${queueErr.message}`);
                            }
                        }
                    } else {
                        logger.info(`ℹ️ No se envía WhatsApp a ${order.gremio} (No es tipo Gremio)`);
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

                addedCount++;
            }

            // 7. Guardar cambios
            await fs.writeFile(TRABAJOS_FILE, JSON.stringify(fullData, null, 2));
            
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
        }
    }
};