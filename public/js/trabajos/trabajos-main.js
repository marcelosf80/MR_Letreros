/**
 * GESTIÓN DE TRABAJOS — MR LETREROS
 * Archivo: public/js/trabajos/trabajos-main.js
 *
 * CORRECCIONES:
 *  ✅ loadWorks() — agrega Authorization: Bearer mr_token
 *  ✅ saveWorks() — agrega Authorization: Bearer mr_token
 *  ✅ Muestra campo 'descripcion' de trabajos creados por el Asistente
 *  ✅ paymentStatus 'unpaid' agregado al badge
 */

let workManager;
let currentFilters = {};
let allWorks = [];
let allQuotes = {};  // Map quoteId -> cotización

function getToken() { return localStorage.getItem('mr_token') || ''; }

// ==================== INICIO ====================


// ==================== ELIMINAR TRABAJO ====================
async function deleteWork(id) {
    // Normalizar ID para la búsqueda (convertir a string para comparar)
    const work = allWorks.find(w => String(w.id) === String(id));
    if (!work) { 
        console.error('[TRABAJOS] No se encontró el trabajo para borrar. ID buscado:', id);
        alert('❌ Error: Trabajo no encontrado en la lista actual.'); 
        return; 
    }

    const confirmMsg = `¿Eliminar el trabajo de ${work.clientName}?\n\n` +
        `Total: $${fmt(work.total)} | Estado: ${getStatusLabel(work.status)}\n\n` +
        `⚠️ Esta acción no se puede deshacer.`;
    if (!confirm(confirmMsg)) return;

    try {
        // Obtener todos los trabajos via mrDataManager
        const worksData = await window.mrDataManager.request('/api/trabajos');
        if (!worksData || !Array.isArray(worksData.works)) {
            alert('❌ Error leyendo trabajos del servidor.');
            return;
        }

        worksData.works = worksData.works.filter(w => w.id !== id);

        const result = await window.mrDataManager.request('/api/trabajos', 'POST', worksData);
        if (!result?.success) {
            alert('❌ No se pudo eliminar el trabajo. Verificá la sesión.');
            return;
        }

        // Actualizar lista local
        allWorks = allWorks.filter(w => w.id !== id);
        renderWorks();
        updateStatistics();
        alert(`🗑️ Trabajo de ${work.clientName} eliminado.`);
    } catch (e) {
        console.error('[TRABAJOS] Error al eliminar:', e);
        alert('❌ Error al eliminar: ' + e.message);
    }
}
window.deleteWork = deleteWork;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[TRABAJOS] Inicializando...');
    
    // Obligar a activar notificaciones (controlado en bloque try/catch para no romper la carga)
    try {
        checkNotificationPermission();
    } catch (err) {
        console.error('[REALTIME] Error al verificar permisos de notificación:', err);
    }

    let attempts = 0;
    while (!window.mrDataManager && attempts < 20) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }

    if (!window.mrDataManager) {
        showError('No se pudo conectar al sistema. Recargá la página.');
        return;
    }

    workManager = new WorkManager();
    setupEventListeners();
    await loadWorks();
    setupSocketListeners();
    console.log('[TRABAJOS] ✅ Listo');
});

// Real-time synchronization
function setupSocketListeners() {
    const bindSocket = (socket) => {
        socket.on('works_updated', () => {
            console.log('[REALTIME] Trabajos actualizados en servidor. Recargando...');
            loadWorks();
        });
    };
    
    if (window.mrSocket) {
        bindSocket(window.mrSocket);
    } else {
        window.addEventListener('mrSocketReady', (e) => {
            bindSocket(e.detail);
        });
    }
}

// Forzar notificaciones del navegador
function checkNotificationPermission() {
    // Si no es un contexto seguro (HTTP sin localhost), el navegador deshabilita Notification
    if (window.isSecureContext === false || !("Notification" in window)) {
        console.warn("[REALTIME] Notificaciones desactivadas: Origen no seguro (HTTP) o no soportado.");
        return;
    }
    const permission = Notification.permission;
    if (permission === 'granted') {
        removeNotificationOverlay();
        return;
    }
    showNotificationOverlay(permission);
}

function showNotificationOverlay(state) {
    let banner = document.getElementById('notificationBannerSoft');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'notificationBannerSoft';
        banner.style.cssText = `
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.25);
            color: #93c5fd;
            padding: 1rem 1.25rem;
            border-radius: 12px;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-family: 'Inter', sans-serif;
            font-size: 0.95rem;
            gap: 1rem;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        `;
        
        // Insertar banner al tope de la zona de contenidos
        const container = document.querySelector('.content-container');
        if (container) {
            container.insertBefore(banner, container.firstChild);
        } else {
            document.body.insertBefore(banner, document.body.firstChild);
        }
    }

    if (state === 'denied') {
        banner.style.background = 'rgba(239, 68, 68, 0.08)';
        banner.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        banner.style.color = '#fca5a5';
        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.25rem;">⚠️</span>
                <span><strong>Notificaciones Bloqueadas:</strong> Se recomienda activarlas desde el ícono de candado (🔒) de tu navegador para recibir alertas en tiempo real.</span>
            </div>
            <button onclick="window.location.reload()" style="background: transparent; border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; white-space: nowrap;">
                🔄 Verificar
            </button>
        `;
    } else { // default
        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.25rem;">🔔</span>
                <span><strong>Habilita Alertas:</strong> Activa las notificaciones del navegador para recibir avisos automáticos de pedidos en tiempo real.</span>
            </div>
            <button id="btnRequestNotificationSoft" style="background: #3b82f6; border: none; color: white; padding: 0.45rem 1.25rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; white-space: nowrap; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">
                🔔 Activar
            </button>
        `;
        
        const btn = document.getElementById('btnRequestNotificationSoft');
        if (btn) {
            btn.addEventListener('click', async () => {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    removeNotificationOverlay();
                } else {
                    showNotificationOverlay(permission);
                }
            });
        }
    }
}

function removeNotificationOverlay() {
    const banner = document.getElementById('notificationBannerSoft');
    if (banner) banner.remove();
}

// ==================== CARGA ====================
async function loadWorks() {
    const loadingEl = document.getElementById('loadingState');
    const worksListEl = document.getElementById('worksList');

    try {
        loadingEl.style.display = 'block';
        worksListEl.style.display = 'none';

        // Cargar trabajos + cotizaciones en paralelo
        const [trabajosRes, gremioCots, clientesCots] = await Promise.all([
            fetch('/api/trabajos', { headers: { 'Authorization': `Bearer ${getToken()}` } }),
            window.mrDataManager.getGremioCotizaciones(),
            window.mrDataManager.getClientesCotizaciones()
        ]);

        if (!trabajosRes.ok) throw new Error(`HTTP ${trabajosRes.status}`);

        const data = await trabajosRes.json();
        if (data && data.works) {
            workManager.importData(data);
            allWorks = data.works;
            console.log('[TRABAJOS] Trabajos cargados:', allWorks.length);
        } else {
            allWorks = [];
        }

        // Indexar cotizaciones por ID para lookup rápido
        allQuotes = {};
        (gremioCots || []).forEach(q => { allQuotes[q.id] = q; });
        (clientesCots || []).forEach(q => { allQuotes[q.id] = q; });
        console.log('[TRABAJOS] Cotizaciones indexadas:', Object.keys(allQuotes).length);

        renderWorks();
        updateStatistics();
        updateMaterialAndProductWidgets();

    } catch (err) {
        console.error('[TRABAJOS] Error cargando:', err);
        showError('Error al cargar los trabajos: ' + err.message);
        allWorks = [];
        renderWorks();
    } finally {
        loadingEl.style.display = 'none';
        worksListEl.style.display = 'grid';
    }
}

// ==================== RENDERIZADO ====================
function renderWorks() {
    const container = document.getElementById('worksList');
    let works = [...allWorks];

    if (currentFilters.search) {
        const s = currentFilters.search.toLowerCase();
        works = works.filter(w =>
            (w.clientName || '').toLowerCase().includes(s) ||
            (w.descripcion || '').toLowerCase().includes(s)
        );
    }
    if (currentFilters.status) {
        if (currentFilters.status === 'delivered') {
            works = works.filter(w => w.deliveryStatus === 'delivered');
        } else {
            works = works.filter(w => w.status === currentFilters.status && w.deliveryStatus !== 'delivered');
        }
    } else {
        // Por defecto ocultar entregados PAGADOS, mantener visibles los entregados sin cobrar
        works = works.filter(w => !(w.deliveryStatus === 'delivered' && w.paymentStatus === 'paid'));
    }
    
    if (currentFilters.payment) works = works.filter(w => w.paymentStatus === currentFilters.payment);
    if (currentFilters.priority) works = works.filter(w => w.priority === currentFilters.priority);

    if (selectedProductGroup) {
        works = works.filter(w => {
            const items = getWorkItems(w);
            return items.some(item => getProductGroupName(item.name) === selectedProductGroup);
        });
    }

    works.sort((a, b) => {
        const aCompleted = (a.status === 'completed' || a.deliveryStatus === 'delivered') ? 1 : 0;
        const bCompleted = (b.status === 'completed' || b.deliveryStatus === 'delivered') ? 1 : 0;
        if (aCompleted !== bCompleted) {
            return aCompleted - bCompleted;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    if (!works.length) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <div class="empty-state-icon">📋</div>
                <h3>No hay trabajos para mostrar</h3>
                <p>Los trabajos creados por el Asistente IA o desde cotizaciones aparecen aquí.</p>
            </div>`;
        return;
    }

    container.innerHTML = works.map(w => generateWorkCard(w)).join('');
    setTimeout(() => loadDrivePreviews(), 100);
}

function generateWorkCard(w) {
    const isRetiradoNoPago = w.deliveryStatus === 'delivered' && w.paymentStatus !== 'paid';
    const priority = w.priority === 'urgent' ? 'priority-urgent' : w.priority === 'high' ? 'priority-high' : '';
    const statusClass = isRetiradoNoPago ? 'status-retirado-no-pago' : (w.status ? `status-${w.status}` : '');
    const itemsHtml = generateItemsDetail(w);
    return `
        <div class="work-card ${priority} ${statusClass}">
            <div class="work-header">
                <div>
                    <div class="work-client">${w.clientName || 'Sin nombre'}</div>
                    ${w.clientPhone ? `<div class="work-client-info">📞 ${w.clientPhone}</div>` : ''}
                    ${w.descripcion ? `<div class="work-client-info" style="font-size:.8rem;opacity:.6;">📝 ${w.descripcion}</div>` : ''}
                </div>
                <div style="display:flex;gap:.4rem;flex-wrap:wrap;justify-content:flex-end;">
                    ${w.deliveryStatus === 'delivered' ? 
                        (w.paymentStatus === 'paid' ? 
                            '<span class="badge bg-success">📦 Entregado</span>' : 
                            '<span class="badge badge-payment-unpaid">❌ No Pagado</span>'
                        ) : ''
                    }
                    ${w.printed ? '<span class="badge bg-info">🖨️ Impreso</span>' : ''}
                    ${getStatusBadge(w.status)}
                    ${getPaymentBadge(w.paymentStatus)}
                    ${getPriorityBadge(w.priority)}
                </div>
            </div>

            <div class="work-details">
                <div class="work-detail-item">
                    <div class="work-detail-label">ID</div>
                    <div class="work-detail-value" style="font-size:.85rem;">#${w.id.slice(-8)}</div>
                </div>
                <div class="work-detail-item">
                    <div class="work-detail-label">Total</div>
                    <div class="work-detail-value" style="color:#51CF66;">$${fmt(w.total)}</div>
                </div>
                <div class="work-detail-item">
                    <div class="work-detail-label">Pagado</div>
                    <div class="work-detail-value" style="color:#2196F3;">$${fmt(w.paidAmount || 0)}</div>
                </div>
                <div class="work-detail-item">
                    <div class="work-detail-label">Saldo</div>
                    <div class="work-detail-value" style="color:#FFC107;">$${fmt(w.balance)}</div>
                </div>
                ${(() => {
                    const q = allQuotes[w.quoteId];
                    if (!q) return '';
                    
                    let html = '';
                    // Descuento por Volumen
                    if (q.discountPercent > 0) {
                        html += `
                        <div class="work-detail-item" style="border-left: 2px solid #4CAF50; padding-left: 8px;">
                            <div class="work-detail-label" style="color:#4CAF50;">Desc. Volumen</div>
                            <div class="work-detail-value" style="color:#4CAF50; font-size:.85rem;">
                                ${q.discountPercent}% (-$${fmt(q.discountAmount)})
                            </div>
                        </div>`;
                    }
                    // Descuento Especial
                    if (q.porcentajeDescuento > 0) {
                        html += `
                        <div class="work-detail-item" style="border-left: 2px solid #F87171; padding-left: 8px;">
                            <div class="work-detail-label" style="color:#F87171;">Desc. Especial</div>
                            <div class="work-detail-value" style="color:#F87171; font-size:.85rem;">
                                ${q.porcentajeDescuento}% (-$${fmt(q.descuentoEspecial)})
                            </div>
                        </div>`;
                    }
                    return html;
                })()}
            </div>

            ${itemsHtml}

            <div style="font-size:.8rem;color:var(--text-secondary);margin-top:.5rem;">
                📅 ${fmtDate(w.createdAt)}
                ${w.deliveryDate ? ` &nbsp;|&nbsp; 🚚 ${fmtDate(w.deliveryDate)}` : ''}
            </div>

            <div class="work-actions">
                <button class="btn btn-small btn-primary"  onclick="changeStatus('${w.id}')">🔄 Estado</button>
                ${w.status === 'completed' ? `<button class="btn btn-small btn-info" onclick="resendReadyMessage('${w.id}')" title="Reenviar mensaje de trabajo terminado">📲 Reenviar listo</button>` : ''}
                <button class="btn btn-small ${w.printed ? 'btn-success' : 'btn-primary'}" onclick="togglePrinted('${w.id}')" title="Marcar como impreso">${w.printed ? '✅ Impreso' : '🖨️ Impreso'}</button>
                <button class="btn btn-small btn-success"  onclick="markPaid('${w.id}')" ${w.paymentStatus === 'paid' ? 'disabled' : ''}>💳 Pagar</button>
                <button class="btn btn-small btn-primary"  onclick="mergeWork('${w.id}')" title="Unificar con otro pedido del mismo cliente">🔗 Unificar</button>
                ${(w.mergedWorks && w.mergedWorks.length > 0) ? `<button class="btn btn-small btn-warning" onclick="unmergeWork('${w.id}')" title="Desunificar pedidos unificados">🔓 Desunificar</button>` : ''}
                ${(w.status === 'completed' && w.deliveryStatus !== 'delivered') ? `<button class="btn btn-small btn-dark" onclick="markDelivered('${w.id}')">🚚 Entregar</button>` : ''}
                <button class="btn btn-small btn-warning"  onclick="changePriority('${w.id}')">🎯 Prioridad</button>
                <button class="btn btn-small btn-info"     onclick="addNote('${w.id}')">📝 Nota</button>
                <button class="btn btn-small btn-danger"   onclick="deleteWork('${w.id}')" title="Eliminar trabajo">🗑️</button>
            </div>
        </div>`;
}

function generateItemsDetail(w) {
    // --- PEDIDOS DE GOOGLE (sin quoteId, con notas de detalle) ---
    if (!w.quoteId) {
        // Obtener todas las notas que tengan detalle del pedido (soporta múltiples notas unificadas)
        const notesDetalle = (w.notes || []).filter(n => n.author === 'Google Sync' || n.author === 'Google' || (n.text && n.text.includes('PRODUCTO')));
        if (notesDetalle.length === 0) return '';

        let rows = '';
        let prodIndex = 0;
        
        notesDetalle.forEach((note, noteIdx) => {
            const dateStr = note.date ? fmtDate(note.date) : '';
            if (dateStr) {
                rows += `
                    <tr style="background:rgba(255,255,255,0.03); border-bottom:1px solid rgba(255,255,255,0.06);">
                        <td colspan="3" style="padding:6px 8px;font-size:.8rem;color:#ffd700;font-weight:600;">
                            📅 Pedido Web del ${dateStr}
                        </td>
                    </tr>`;
            }
            
            const lines = (note.text || '').split('\n').filter(l => l.trim());
            lines.forEach(linea => {
                const l = linea.trim();
                if (l.startsWith('PRODUCTO') || l.startsWith('P#') || l.startsWith('ITEM') || l.startsWith('item')) {
                    prodIndex++;
                    const currentProd = l.replace(/^(PRODUCTO\s*#?\d+:\s*|P#\d+:\s*|ITEM\s*#?\d+:\s*)/i, '');
                    
                    const group = getProductGroupName(currentProd);
                    const colors = groupColorMap[group] || groupColorMap['Otros'];
                    
                    const itemKey = `item_${prodIndex - 1}_${noteIdx}`;
                    const isPrinted = w.printedItems && w.printedItems[itemKey];
                    const btnClass = isPrinted ? 'btn-success' : 'btn-primary';
                    const btnIcon = isPrinted ? '✅' : '🖨️';
                    const btnTitle = isPrinted ? 'Marcar como no impreso' : 'Marcar como impreso';
                    
                    rows += `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.06); ${isPrinted ? 'opacity: 0.65;' : ''}">
                            <td style="padding:6px 8px;font-size:.85rem;color:${colors.color};width:30px;">&#9655;</td>
                            <td style="padding:6px 8px;font-size:.85rem;font-weight:500;color:${colors.color}; ${isPrinted ? 'text-decoration: line-through;' : ''}">${currentProd}</td>
                            <td style="padding:6px 8px;text-align:right;width:90px;white-space:nowrap;">
                                <div style="display:inline-flex;gap:4px;justify-content:flex-end;align-items:center;width:100%;">
                                    <button class="btn ${btnClass} btn-xs" onclick="toggleItemPrinted('${w.id}', '${itemKey}')" style="padding:2px 6px;font-size:0.7rem;" title="${btnTitle}">${btnIcon}</button>
                                    <button class="btn btn-danger btn-xs" onclick="deleteWebItem('${w.id}', ${prodIndex - 1})" style="padding:2px 6px;font-size:0.7rem;background:rgba(239, 68, 68, 0.15) !important;color:#f87171 !important;border:1px solid rgba(239, 68, 68, 0.3) !important;" title="Eliminar este producto">🗑️</button>
                                </div>
                            </td>
                        </tr>`;
                } else if (l.startsWith('MEDIDAS') || l.includes('x') && l.includes('cm')) {
                    rows += `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                            <td></td>
                            <td style="padding:4px 8px;font-size:.8rem;color:#888;" colspan="2">📐 ${l}</td>
                        </tr>`;
                } else if (l.startsWith('NOTA') && !l.includes('Sin nota')) {
                    rows += `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                            <td></td>
                            <td style="padding:4px 8px;font-size:.8rem;color:#ffd700;" colspan="2">📝 ${l}</td>
                        </tr>`;
                } else if (l.startsWith('SUBTOTAL')) {
                    rows += `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                            <td></td>
                            <td style="padding:4px 8px;font-size:.8rem;color:#51CF66;font-weight:bold;" colspan="2">💰 ${l}</td>
                        </tr>`;
                } else if (l.startsWith('Link a Drive')) {
                    const url = l.replace('Link a Drive: ', '').trim();
                    const folderId = getFolderIdFromUrl(url) || 'unknown';
                    rows += `
                        <tr>
                            <td></td>
                            <td style="padding:6px 8px;" colspan="2">
                                <a href="${url}" target="_blank" style="color:#4facfe;font-size:.8rem;text-decoration:none;">
                                    📁 Ver archivos en Google Drive
                                </a>
                                <div id="drive_previews_${w.id}_${folderId}" class="drive-previews-container" data-work-id="${w.id}" data-folder-id="${folderId}" style="margin-top: 0.6rem; display: flex; gap: 0.6rem; flex-wrap: wrap;"></div>
                            </td>
                        </tr>`;
                } else if (l.startsWith('Detalle del pedido')) {
                    // Ignorar esta línea de encabezado
                } else if (l.length > 2) {
                    rows += `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                            <td></td>
                            <td style="padding:4px 8px;font-size:.8rem;color:#aaa;" colspan="2">${l}</td>
                        </tr>`;
                }
            });
        });

        if (!rows) return '';

        const uniqueId = 'items_' + w.id;
        return `
            <div style="margin-top:.6rem;">
                <button class="btn btn-small" style="width:100%;background:rgba(255,215,0,0.1);color:#ffd700;border:1px solid rgba(255,215,0,0.3);font-size:.8rem;" onclick="toggleItems('${uniqueId}')">
                    🌐 Detalle del Pedido Web (${prodIndex} producto${prodIndex !== 1 ? 's' : ''})
                </button>
                <div id="${uniqueId}" style="display:none;margin-top:.5rem;border-radius:8px;overflow:hidden;background:rgba(0,0,0,0.15);">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="background:rgba(255,215,0,0.08);">
                                <th style="padding:6px 8px;font-size:.75rem;text-align:left;color:#ffd700;width:30px;">#</th>
                                <th style="padding:6px 8px;font-size:.75rem;text-align:left;color:#ffd700;">Detalle</th>
                                <th style="padding:6px 8px;font-size:.75rem;text-align:right;color:#ffd700;width:50px;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    }

    // --- PEDIDOS INTERNOS (con quoteId) ---
    const quotesToRender = [];
    if (w.quoteId && allQuotes[w.quoteId]) {
        quotesToRender.push({
            quoteId: w.quoteId,
            quote: allQuotes[w.quoteId],
            createdAt: w.createdAt,
            id: w.id
        });
    }

    if (w.mergedWorks && Array.isArray(w.mergedWorks)) {
        w.mergedWorks.forEach(mw => {
            if (mw.quoteId && allQuotes[mw.quoteId]) {
                quotesToRender.push({
                    quoteId: mw.quoteId,
                    quote: allQuotes[mw.quoteId],
                    createdAt: mw.createdAt,
                    id: mw.id
                });
            }
        });
    }

    // Si no hay items, no mostrar nada
    if (quotesToRender.length === 0) return '';

    let rows = '';
    let totalItems = 0;

    quotesToRender.forEach((qItem, qIdx) => {
        const q = qItem.quote;
        const qDate = qItem.createdAt ? fmtDate(qItem.createdAt) : 'Sin fecha';
        const qIdShort = qItem.id.slice(-8);

        rows += `
            <tr style="background:rgba(99,102,241,0.06); border-bottom:1px solid rgba(255,255,255,0.08);">
                <td colspan="6" style="padding:6px 8px;font-size:.8rem;color:#a5b4fc;font-weight:600;">
                    📅 Pedido #${qIdShort} del ${qDate}
                </td>
            </tr>`;

        const categories = q.multiCategories?.categories || [];
        const productos = q.productos || [];
        const dims = q.multiCategories?.sharedDimensions || {};
        totalItems += categories.length + productos.length;

        categories.forEach((cat, i) => {
            const catWidth = cat.width || dims.width || '-';
            const catHeight = cat.height || dims.height || '-';
            const m2 = cat.m2 || cat.frozenM2 || 0;
            
            const group = getProductGroupName(cat.name);
            const colors = groupColorMap[group] || groupColorMap['Otros'];
            
            const itemKey = `cat_${i}_${qItem.id}`;
            const isPrinted = w.printedItems && w.printedItems[itemKey];
            const btnClass = isPrinted ? 'btn-success' : 'btn-primary';
            const btnIcon = isPrinted ? '✅' : '🖨️';
            const btnTitle = isPrinted ? 'Marcar como no impreso' : 'Marcar como impreso';
            
            rows += `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.06); ${isPrinted ? 'opacity: 0.65;' : ''}">
                    <td style="padding:6px 8px;font-size:.85rem;color:${colors.color};">${i + 1}</td>
                    <td style="padding:6px 8px;font-size:.85rem;font-weight:500;color:${colors.color}; ${isPrinted ? 'text-decoration: line-through;' : ''}">${cat.name || 'Sin nombre'}</td>
                    <td style="padding:6px 8px;font-size:.85rem;text-align:center;">${catWidth} x ${catHeight}</td>
                    <td style="padding:6px 8px;font-size:.85rem;text-align:center;">${m2.toFixed(2)}</td>
                    <td style="padding:6px 8px;font-size:.85rem;text-align:right;color:#51CF66;">$${fmt(cat.totalPrice || 0)}</td>
                    <td style="padding:6px 8px;text-align:right;">
                        <button class="btn ${btnClass} btn-xs" onclick="toggleItemPrinted('${w.id}', '${itemKey}')" style="padding:2px 6px;font-size:0.7rem;" title="${btnTitle}">${btnIcon}</button>
                    </td>
                </tr>`;
        });

        productos.forEach((prod, i) => {
            const name = prod.name || prod.nombre || 'Producto';
            const group = getProductGroupName(name);
            const colors = groupColorMap[group] || groupColorMap['Otros'];
            
            const itemKey = `prod_${i}_${qItem.id}`;
            const isPrinted = w.printedItems && w.printedItems[itemKey];
            const btnClass = isPrinted ? 'btn-success' : 'btn-primary';
            const btnIcon = isPrinted ? '✅' : '🖨️';
            const btnTitle = isPrinted ? 'Marcar como no impreso' : 'Marcar como impreso';
            
            rows += `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.06); ${isPrinted ? 'opacity: 0.65;' : ''}">
                    <td style="padding:6px 8px;font-size:.85rem;color:${colors.color};">${categories.length + i + 1}</td>
                    <td style="padding:6px 8px;font-size:.85rem;font-weight:500;color:${colors.color}; ${isPrinted ? 'text-decoration: line-through;' : ''}">${name}</td>
                    <td style="padding:6px 8px;font-size:.85rem;text-align:center;">—</td>
                    <td style="padding:6px 8px;font-size:.85rem;text-align:center;">${prod.quantity || prod.cantidad || 1}</td>
                    <td style="padding:6px 8px;font-size:.85rem;text-align:right;color:#51CF66;">$${fmt(prod.total || prod.price || 0)}</td>
                    <td style="padding:6px 8px;text-align:right;">
                        <button class="btn ${btnClass} btn-xs" onclick="toggleItemPrinted('${w.id}', '${itemKey}')" style="padding:2px 6px;font-size:0.7rem;" title="${btnTitle}">${btnIcon}</button>
                    </td>
                </tr>`;
        });
    });

    // Resumen de totales si hay descuentos
    let summaryHtml = '';
    const mainQuote = allQuotes[w.quoteId];
    if (mainQuote) {
        const hasVol = mainQuote.discountPercent > 0;
        const hasEsp = mainQuote.porcentajeDescuento > 0;

        if (hasVol || hasEsp) {
            const subtotalOriginal = mainQuote.originalSubtotal || (mainQuote.subtotal || 0) + (mainQuote.discountAmount || 0) + (mainQuote.descuentoEspecial || 0);
            const iva = mainQuote.iva || 0;
            const totalConIva = subtotalOriginal + iva;
            
            summaryHtml = `<div style="padding:8px; border-top:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03);">`;
            summaryHtml += `
                <div style="display:flex; justify-content:space-between; font-size:.8rem; opacity:.7; margin-bottom:2px;">
                    <span>Subtotal Original ${iva > 0 ? '(con IVA)' : ''}:</span>
                    <span>$${fmt(totalConIva)}</span>
                </div>`;

            if (hasVol) {
                summaryHtml += `
                    <div style="display:flex; justify-content:space-between; font-size:.8rem; color:#4CAF50; margin-bottom:2px;">
                        <span>Descuento por Volumen (${mainQuote.discountPercent}%):</span>
                        <span>-$${fmt(mainQuote.discountAmount)}</span>
                    </div>`;
            }

            if (hasEsp) {
                summaryHtml += `
                    <div style="display:flex; justify-content:space-between; font-size:.8rem; color:#F87171; margin-bottom:2px;">
                        <span>Descuento Especial (${mainQuote.porcentajeDescuento}%):</span>
                        <span>-$${fmt(mainQuote.descuentoEspecial)}</span>
                    </div>`;
            }

            summaryHtml += `
                    <div style="display:flex; justify-content:space-between; font-size:.9rem; color:#51CF66; font-weight:bold; margin-top:4px; border-top:1px dashed rgba(255,255,255,0.1); padding-top:4px;">
                        <span>Total Final:</span>
                        <span>$${fmt(mainQuote.totalCliente || mainQuote.total)}</span>
                    </div>
                </div>`;
        }
    }

    const uniqueId = 'items_' + w.id;
    return `
        <div style="margin-top:.6rem;">
            <button class="btn btn-small" style="width:100%;background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);font-size:.8rem;" onclick="toggleItems('${uniqueId}')">
                📦 Detalle del Pedido (${totalItems} items)
            </button>
            <div id="${uniqueId}" style="display:none;margin-top:.5rem;border-radius:8px;overflow:hidden;background:rgba(0,0,0,0.15);">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="background:rgba(99,102,241,0.1);">
                            <th style="padding:6px 8px;font-size:.75rem;text-align:left;color:#a5b4fc;">#</th>
                            <th style="padding:6px 8px;font-size:.75rem;text-align:left;color:#a5b4fc;">Material</th>
                            <th style="padding:6px 8px;font-size:.75rem;text-align:center;color:#a5b4fc;">Medidas</th>
                            <th style="padding:6px 8px;font-size:.75rem;text-align:center;color:#a5b4fc;">M² o Cant.</th>
                            <th style="padding:6px 8px;font-size:.75rem;text-align:right;color:#a5b4fc;">Precio</th>
                            <th style="padding:6px 8px;font-size:.75rem;text-align:right;color:#a5b4fc;width:50px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                ${summaryHtml}
            </div>
        </div>`;
}

// ==================== ESTADÍSTICAS ====================
function updateStatistics() {
    const pending = allWorks.filter(w => w.status === 'pending').length;
    const inProgress = allWorks.filter(w => w.status === 'in_progress').length;
    const completed = allWorks.filter(w => w.status === 'completed').length;
    const revenue = allWorks.filter(w => w.paymentStatus === 'paid').reduce((s, w) => s + (w.paidAmount || 0), 0);

    document.getElementById('countPending').textContent = pending;
    document.getElementById('countInProgress').textContent = inProgress;
    document.getElementById('countCompleted').textContent = completed;
    document.getElementById('totalRevenue').textContent = '$' + fmt(revenue);
}

// ==================== ACCIONES ====================
async function changeStatus(id) {
    const w = allWorks.find(x => String(x.id) === String(id));
    if (!w) return;
    const newStatus = await PremiumDialog.select(
        'Cambiar Estado', 
        `Actual: ${getStatusLabel(w.status)}`, 
        [
            { value: 'pending', label: 'Pendiente', colorClass: 'btn-warning' },
            { value: 'in_progress', label: 'En Proceso', colorClass: 'btn-info' },
            { value: 'completed', label: 'Completado', colorClass: 'btn-success' }
        ]
    );
    if (!newStatus) return;
    
    
    try {
        // Usar PUT para actualizar solo el estado y disparar la lógica del servidor (WhatsApp)
        const res = await fetch(`/api/trabajos/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!res.ok) throw new Error('Error en la respuesta del servidor');
        const result = await res.json();

        if (result.success) {
            // Actualizar localmente y recargar
            await loadWorks();
            
            if (newStatus === 'completed') {
                alert('✅ Estado actualizado.\n📱 El servidor está procesando el envío de WhatsApp al cliente.');
            } else {
                alert('✅ Estado actualizado correctamente.');
            }
        }
    } catch (e) {
        console.error('[TRABAJOS] Error al cambiar estado:', e);
        alert('❌ Error al actualizar estado: ' + e.message);
    }
}

async function resendReadyMessage(id) {
    const w = allWorks.find(x => String(x.id) === String(id));
    if (!w) return;
    
    if (!confirm(`¿Reenviar mensaje de trabajo terminado para ${w.clientName}?`)) return;
    
    try {
        const res = await fetch(`/api/trabajos/${id}/reenviar-listo`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Error en el servidor');
        }
        
        const result = await res.json();
        if (result.success) {
            alert('✅ Mensaje de retiro reenviado correctamente.');
        } else {
            alert('⚠️ ' + (result.message || 'No se pudo enviar el mensaje.'));
        }
    } catch (e) {
        console.error('[TRABAJOS] Error al reenviar mensaje:', e);
        alert('❌ Error al reenviar mensaje: ' + e.message);
    }
}

async function markPaid(id) {
    const w = allWorks.find(x => String(x.id) === String(id));
    if (!w) return;
    const amountStr = await PremiumDialog.text('Monto del pago:', w.balance, 'number');
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) return;
    w.paidAmount = (w.paidAmount || 0) + amount;
    w.balance = Math.max(0, w.total - w.paidAmount);
    w.paymentStatus = w.balance <= 1 ? 'paid' : 'partial';
    if (!w.timeline) w.timeline = [];
    w.timeline.push({ type: 'payment', description: `Pago: $${amount.toLocaleString('es-AR')}. Saldo: $${w.balance.toLocaleString('es-AR')}`, timestamp: new Date().toISOString() });
    await saveWorks(); await loadWorks();
    alert('✅ Pago registrado');
}

async function changePriority(id) {
    const w = allWorks.find(x => String(x.id) === String(id));
    if (!w) return;
    const priority = await PremiumDialog.select(
        'Cambiar Prioridad',
        null,
        [
            { value: 'normal', label: 'Normal', colorClass: 'btn-info' },
            { value: 'high', label: 'Alta', colorClass: 'btn-warning' },
            { value: 'urgent', label: 'URGENTE', colorClass: 'btn-danger' }
        ]
    );
    if (!priority) return;
    w.priority = priority;
    if (!w.timeline) w.timeline = [];
    w.timeline.push({ type: 'priority_changed', description: `Prioridad: ${w.priority}`, timestamp: new Date().toISOString() });
    await saveWorks(); await loadWorks();
}

async function markDelivered(id) {
    const w = allWorks.find(x => String(x.id) === String(id));
    if (!w) return;
    
    if (!confirm(`¿Marcar el trabajo de ${w.clientName} como ENTREGADO?\nSe ocultará de la lista activa.`)) return;
    
    w.deliveryStatus = 'delivered';
    w.actualDeliveryDate = new Date().toISOString();
    
    if (!w.timeline) w.timeline = [];
    w.timeline.push({ 
        type: 'delivery', 
        description: 'Trabajo marcado como ENTREGADO', 
        timestamp: new Date().toISOString() 
    });
    
    try {
        await saveWorks();
        await loadWorks();
        alert('📦 Trabajo entregado correctamente.');
    } catch (e) {
        alert('Error al guardar: ' + e.message);
    }
}

async function addNote(id) {
    const w = allWorks.find(x => String(x.id) === String(id));
    if (!w) return;
    const note = await PremiumDialog.text('Agregar nota:');
    if (!note) return;
    if (!w.notes) w.notes = [];
    w.notes.push({ text: note, date: new Date().toISOString(), author: 'Usuario' });
    if (!w.timeline) w.timeline = [];
    w.timeline.push({ type: 'note_added', description: `Nota: ${note}`, timestamp: new Date().toISOString() });
    await saveWorks(); await loadWorks();
}

async function saveWorks() {
    const payload = JSON.stringify({ works: allWorks, notifications: [] });
    console.log('[TRABAJOS] Guardando en servidor, tamaño del payload JSON:', (payload.length / 1024).toFixed(2), 'KB');

    // ✅ FIX: Authorization header con el token correcto
    const res = await fetch('/api/trabajos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: payload
    });
    if (!res.ok) throw new Error('Error al guardar: ' + res.status);
    console.log('[TRABAJOS] Guardado OK');
}

// ==================== FILTROS ====================
function applyFilters() {
    currentFilters = {
        search: document.getElementById('filterSearch').value.trim(),
        status: document.getElementById('filterStatus').value,
        payment: document.getElementById('filterPayment').value,
        priority: document.getElementById('filterPriority').value
    };
    renderWorks();
}

function clearFilters() {
    ['filterSearch', 'filterStatus', 'filterPayment', 'filterPriority'].forEach(id => {
        document.getElementById(id).value = '';
    });
    currentFilters = {};
    renderWorks();
}

function setupEventListeners() {
    const btnNotifications = document.getElementById('btnNotifications');
    if (btnNotifications) {
        btnNotifications.addEventListener('click', () => {
            const panel = document.getElementById('notificationPanel');
            if (panel) panel.classList.toggle('show');
        });
    }
    const filterSearch = document.getElementById('filterSearch');
    if (filterSearch) {
        filterSearch.addEventListener('input', applyFilters);
    }
}

// ==================== HELPERS ====================
function getStatusBadge(s) {
    return ({
        pending: '<span class="badge badge-status-pending">⏳ Pendiente</span>',
        in_progress: '<span class="badge badge-status-in_progress">🔧 En Proceso</span>',
        completed: '<span class="badge badge-status-completed">✅ Completado</span>'
    })[s] || '';
}

function getPaymentBadge(s) {
    return ({
        paid: '<span class="badge badge-payment-paid">💳 Pagado</span>',
        partial: '<span class="badge badge-payment-pending">💰 Parcial</span>',
        pending: '<span class="badge badge-payment-pending">💰 Pendiente</span>',
        unpaid: '<span class="badge badge-payment-pending">💰 Sin Pago</span>'
    })[s] || '';
}

function getPriorityBadge(p) {
    return ({
        normal: '<span class="badge badge-priority-normal">🟡 Normal</span>',
        high: '<span class="badge badge-priority-high">🟠 Alta</span>',
        urgent: '<span class="badge badge-priority-urgent">🔴 URGENTE</span>'
    })[p] || '';
}

function getStatusLabel(s) {
    return ({ pending: 'Pendiente', in_progress: 'En Proceso', completed: 'Completado' })[s] || s;
}

function fmt(n) {
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
}

function fmtDate(d) {
    if (!d) return '-';
    return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
}

function showError(msg) {
    document.getElementById('worksList').innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
            <div class="empty-state-icon">❌</div>
            <h3>Error</h3><p>${msg}</p>
            <button class="btn btn-primary" onclick="loadWorks()">Reintentar</button>
        </div>`;
}

function toggleItems(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
        // Cargar previews de Drive cuando se abre el detalle
        if (el.style.display === 'block') {
            setTimeout(() => loadDrivePreviews(), 50);
        }
    }
}
window.toggleItems = toggleItems;

// ==================== UNIFICAR PEDIDOS (MERGE) ====================
async function mergeWork(id) {
    const work = allWorks.find(w => String(w.id) === String(id));
    if (!work) return;

    // Buscar otros trabajos activos del mismo cliente (mismo nombre o teléfono, excluyendo el actual)
    const clientNameNorm = (work.clientName || '').trim().toLowerCase();
    const clientPhoneNorm = (work.clientPhone || '').trim().replace(/[^0-9]/g, '');

    const candidates = allWorks.filter(w => {
        if (String(w.id) === String(id)) return false;
        if (w.deliveryStatus === 'delivered') return false; // solo activos

        const otherNameNorm = (w.clientName || '').trim().toLowerCase();
        const otherPhoneNorm = (w.clientPhone || '').trim().replace(/[^0-9]/g, '');

        // Coincide nombre o teléfono (si tienen teléfono)
        const nameMatch = otherNameNorm && otherNameNorm === clientNameNorm;
        const phoneMatch = clientPhoneNorm && otherPhoneNorm && clientPhoneNorm === otherPhoneNorm;

        return nameMatch || phoneMatch;
    });

    if (candidates.length === 0) {
        alert(`ℹ️ No se encontraron otros trabajos activos para unificar con el cliente "${work.clientName}".`);
        return;
    }

    // Listar candidatos para seleccionar
    const selectOptions = candidates.map(w => {
        const descShort = w.descripcion ? ` - ${w.descripcion.substring(0, 30)}...` : '';
        return {
            value: w.id,
            label: `Trabajo #${w.id.slice(-6)} - $${fmt(w.total)}${descShort} (${fmtDate(w.createdAt)})`,
            colorClass: 'btn-secondary'
        };
    });

    const targetId = await PremiumDialog.select(
        'Unificar Pedidos',
        `Selecciona el pedido de ${work.clientName} que deseas unificar e integrar DENTRO de este:`,
        selectOptions
    );

    if (!targetId) return;

    const targetWork = allWorks.find(w => String(w.id) === String(targetId));
    if (!targetWork) return;

    const confirmMsg = `¿Confirmas la unificación?\n\n` +
        `Este trabajo se sumará al seleccionado:\n` +
        `- Total original: $${fmt(work.total)} + $${fmt(targetWork.total)} = $${fmt(work.total + targetWork.total)}\n` +
        `- Pagado original: $${fmt(work.paidAmount || 0)} + $${fmt(targetWork.paidAmount || 0)} = $${fmt((work.paidAmount || 0) + (targetWork.paidAmount || 0))}\n\n` +
        `⚠️ El otro trabajo (#${targetWork.id.slice(-6)}) será ELIMINADO del sistema y sus detalles se integrarán aquí.`;

    if (!confirm(confirmMsg)) return;

    try {
        // Combinar datos
        work.total = work.total + targetWork.total;
        work.paidAmount = (work.paidAmount || 0) + (targetWork.paidAmount || 0);
        work.balance = Math.max(0, work.total - work.paidAmount);
        work.paymentStatus = work.balance <= 1 ? 'paid' : (work.paidAmount > 0 ? 'partial' : 'pending');
        work.status = 'in_progress'; // Pasa al estado en proceso al unificarse

        // Combinar descripción
        if (work.descripcion && targetWork.descripcion && work.descripcion !== targetWork.descripcion) {
            work.descripcion = `${work.descripcion} + ${targetWork.descripcion}`;
        } else if (!work.descripcion && targetWork.descripcion) {
            work.descripcion = targetWork.descripcion;
        }

        // Combinar notas
        work.notes = deduplicateNotes([...(work.notes || []), ...(targetWork.notes || [])]);

        // Mantener registro detallado de trabajos unificados para notificaciones
        if (!work.mergedWorks) work.mergedWorks = [];
        if (targetWork.mergedWorks && Array.isArray(targetWork.mergedWorks)) {
            work.mergedWorks.push(...targetWork.mergedWorks);
        }
        work.mergedWorks.push({
            id: targetWork.id,
            quoteId: targetWork.quoteId || null,
            total: targetWork.total,
            paidAmount: targetWork.paidAmount || 0,
            status: targetWork.status || 'pending',
            priority: targetWork.priority || 'normal',
            deliveryStatus: targetWork.deliveryStatus || 'pending',
            timeline: targetWork.timeline || [],
            clientName: targetWork.clientName || '',
            descripcion: targetWork.descripcion || '',
            notes: targetWork.notes || [],
            createdAt: targetWork.createdAt || null
        });

        // Combinar timeline y registrar evento
        work.timeline = [...(work.timeline || []), ...(targetWork.timeline || [])];
        work.timeline.push({
            type: 'merge',
            description: `Unificado con Trabajo #${targetWork.id.slice(-6)} de $${targetWork.total.toLocaleString('es-AR')}`,
            timestamp: new Date().toISOString()
        });

        // Eliminar el trabajo unificado de la base local
        allWorks = allWorks.filter(w => String(w.id) !== String(targetId));

        // Guardar cambios en el servidor
        await saveWorks();
        await loadWorks();
        alert('✅ Pedidos unificados correctamente.');
    } catch (e) {
        console.error('[TRABAJOS] Error al unificar:', e);
        alert('❌ Error al unificar: ' + e.message);
    }
}
window.mergeWork = mergeWork;

async function unmergeWork(id) {
    const work = allWorks.find(w => String(w.id) === String(id));
    if (!work) return;

    if (!work.mergedWorks || work.mergedWorks.length === 0) {
        alert('ℹ️ No hay trabajos unificados en este pedido.');
        return;
    }

    // Listar candidatos para desunificar
    const selectOptions = work.mergedWorks.map((mw, index) => {
        const descShort = mw.descripcion ? ` - ${mw.descripcion.substring(0, 30)}...` : '';
        return {
            value: String(index),
            label: `Trabajo #${mw.id.slice(-6)} - $${fmt(mw.total)}${descShort}`,
            colorClass: 'btn-secondary'
        };
    });

    if (work.mergedWorks.length > 1) {
        selectOptions.push({
            value: 'all',
            label: '🔓 Separar TODOS',
            colorClass: 'btn-warning'
        });
    }

    const selection = await PremiumDialog.select(
        'Desunificar Pedidos',
        `Selecciona el pedido que deseas separar de este:`,
        selectOptions
    );

    if (selection === null) return;

    const worksToSplit = selection === 'all' 
        ? [...work.mergedWorks] 
        : [work.mergedWorks[parseInt(selection)]];

    const confirmMsg = selection === 'all'
        ? `¿Confirmas que deseas separar TODOS los trabajos unificados de este pedido?\nSe recrearán como pedidos individuales.`
        : `¿Confirmas que deseas separar el Trabajo #${worksToSplit[0].id.slice(-6)}?\nSe recreará como un pedido individual.`;

    if (!confirm(confirmMsg)) return;

    try {
        const recreatedWorks = [];

        for (const mw of worksToSplit) {
            const newWork = {
                id: mw.id,
                quoteId: mw.quoteId || null,
                total: mw.total,
                paidAmount: mw.paidAmount || 0,
                balance: Math.max(0, mw.total - (mw.paidAmount || 0)),
                paymentStatus: (mw.paidAmount || 0) >= mw.total - 1 ? 'paid' : ((mw.paidAmount || 0) > 0 ? 'partial' : 'pending'),
                clientName: mw.clientName || work.clientName,
                clientPhone: work.clientPhone || '',
                descripcion: mw.descripcion || '',
                notes: mw.notes || [],
                createdAt: mw.createdAt || new Date().toISOString(),
                status: mw.status || 'pending',
                priority: mw.priority || 'normal',
                deliveryStatus: mw.deliveryStatus || 'pending',
                timeline: mw.timeline && mw.timeline.length > 0 ? mw.timeline : []
            };

            newWork.timeline.push({
                type: 'unmerge',
                description: `Separado del Trabajo #${work.id.slice(-6)}`,
                timestamp: new Date().toISOString()
            });

            recreatedWorks.push(newWork);

            // Restar importes del trabajo principal
            work.total = Math.max(0, work.total - mw.total);
            work.paidAmount = Math.max(0, (work.paidAmount || 0) - (mw.paidAmount || 0));
            work.balance = Math.max(0, work.total - work.paidAmount);
            work.paymentStatus = work.balance <= 1 ? 'paid' : (work.paidAmount > 0 ? 'partial' : 'pending');

            // Remover las notas del trabajo desunido del trabajo principal
            if (work.notes && mw.notes && mw.notes.length > 0) {
                const childNotesTexts = mw.notes.map(n => n.text);
                work.notes = work.notes.filter(n => !childNotesTexts.includes(n.text));
            }
            work.notes = deduplicateNotes(work.notes);

            // Limpiar descripción si fue concatenada
            if (work.descripcion && mw.descripcion) {
                const pattern1 = ` + ${mw.descripcion}`;
                const pattern2 = `${mw.descripcion} + `;
                if (work.descripcion.includes(pattern1)) {
                    work.descripcion = work.descripcion.replace(pattern1, '');
                } else if (work.descripcion.includes(pattern2)) {
                    work.descripcion = work.descripcion.replace(pattern2, '');
                } else if (work.descripcion === mw.descripcion) {
                    work.descripcion = '';
                }
            }
        }

        if (selection === 'all') {
            work.mergedWorks = [];
        } else {
            work.mergedWorks.splice(parseInt(selection), 1);
        }

        if (!work.timeline) work.timeline = [];
        const splitIds = worksToSplit.map(w => `#${w.id.slice(-6)}`).join(', ');
        work.timeline.push({
            type: 'unmerge',
            description: `Separados los trabajos: ${splitIds}`,
            timestamp: new Date().toISOString()
        });

        allWorks.push(...recreatedWorks);

        await saveWorks();
        await loadWorks();
        alert('✅ Pedido(s) desunificado(s) correctamente.');
    } catch (e) {
        console.error('[TRABAJOS] Error al desunificar:', e);
        alert('❌ Error al desunificar: ' + e.message);
    }
}
window.unmergeWork = unmergeWork;
window.mergeWork = mergeWork;

async function deleteWebItem(workId, targetIndex) {
    const work = allWorks.find(w => String(w.id) === String(workId));
    if (!work) return;

    if (!confirm('¿Seguro que deseas eliminar este producto de la lista?')) return;

    let prodIndex = 0;
    let found = false;

    for (let nIdx = 0; nIdx < (work.notes || []).length; nIdx++) {
        const note = work.notes[nIdx];
        if (!note.text) continue;

        const isDetailNote = note.author === 'Google Sync' || note.author === 'Google' || note.text.includes('PRODUCTO') || note.text.includes('ITEM');
        if (!isDetailNote) continue;

        const lines = note.text.split('\n');
        const headerLines = [];
        const blocks = [];
        let currentBlock = null;

        lines.forEach(line => {
            const l = line.trim();
            if (l.startsWith('PRODUCTO') || l.startsWith('P#') || l.startsWith('ITEM') || l.startsWith('Item')) {
                if (currentBlock) blocks.push(currentBlock);
                currentBlock = { header: line, lines: [] };
            } else if (currentBlock) {
                currentBlock.lines.push(line);
            } else {
                headerLines.push(line);
            }
        });
        if (currentBlock) blocks.push(currentBlock);

        const blockStartIndex = prodIndex;
        const blockEndIndex = prodIndex + blocks.length;

        if (targetIndex >= blockStartIndex && targetIndex < blockEndIndex) {
            const localIndex = targetIndex - blockStartIndex;
            blocks.splice(localIndex, 1);

            let newText = headerLines.join('\n');
            if (blocks.length > 0) {
                blocks.forEach(b => {
                    newText += (newText ? '\n' : '') + b.header + '\n' + b.lines.join('\n');
                });
            }

            if (newText.trim() === '' || blocks.length === 0) {
                work.notes.splice(nIdx, 1);
            } else {
                note.text = newText;
            }

            found = true;
            break;
        }

        prodIndex += blocks.length;
    }

    if (found) {
        // Recalcular total del trabajo principal basándonos en los ítems restantes en sus notas
        let newTotal = 0;
        
        for (const note of work.notes || []) {
            if (!note.text) continue;
            const isDetailNote = note.author === 'Google Sync' || note.author === 'Google' || note.text.includes('PRODUCTO') || note.text.includes('ITEM');
            if (!isDetailNote) continue;
            
            const lines = note.text.split('\n');
            let currentBlock = null;
            const blocks = [];
            lines.forEach(line => {
                const l = line.trim();
                if (l.startsWith('PRODUCTO') || l.startsWith('P#') || l.startsWith('ITEM') || l.startsWith('Item')) {
                    if (currentBlock) blocks.push(currentBlock);
                    currentBlock = { header: line, lines: [] };
                } else if (currentBlock) {
                    currentBlock.lines.push(line);
                }
            });
            if (currentBlock) blocks.push(currentBlock);
            
            blocks.forEach(b => {
                const allLines = [b.header, ...b.lines];
                for (const line of allLines) {
                    const priceMatch = line.match(/\$\s*([\d\.,]+)/) || line.match(/(?:SUBTOTAL|Total|Precio|Subtotal)\s*:?\s*([\d\.,]+)/i);
                    if (priceMatch) {
                        const val = parsePriceString(priceMatch[1]);
                        if (val > 0) {
                            newTotal += val;
                            break;
                        }
                    }
                }
            });
        }
        
        // Sumar también los subtotales de trabajos unificados restantes
        if (work.mergedWorks && Array.isArray(work.mergedWorks)) {
            work.mergedWorks.forEach(mw => {
                newTotal += (mw.total || 0);
            });
        }

        const originalTotal = work.total;
        const diff = originalTotal - newTotal;

        work.total = newTotal;
        work.balance = Math.max(0, work.total - (work.paidAmount || 0));
        work.paymentStatus = work.balance <= 1 ? 'paid' : ((work.paidAmount || 0) > 0 ? 'partial' : 'pending');

        if (!work.timeline) work.timeline = [];
        work.timeline.push({
            type: 'delete_item',
            description: `Eliminado item #${targetIndex + 1}. Total recalculado de $${fmt(originalTotal)} a $${fmt(work.total)}`,
            timestamp: new Date().toISOString()
        });

        await saveWorks();
        await loadWorks();
        alert(`✅ Producto eliminado. El total del pedido se actualizó a $${fmt(work.total)} (se restaron $${fmt(diff)}).`);
    } else {
        alert('❌ No se encontró el producto en el pedido.');
    }
}
window.deleteWebItem = deleteWebItem;

function parsePriceString(str) {
    if (!str) return 0;
    let clean = str.replace(/[^\d.,]/g, '');
    
    if (clean.includes('.') && clean.includes(',')) {
        clean = clean.replace(/\./g, '').replace(/,/g, '.');
    } else if (clean.includes(',')) {
        const parts = clean.split(',');
        if (parts[1].length === 2) {
            clean = clean.replace(/,/g, '.');
        } else {
            clean = clean.replace(/,/g, '');
        }
    } else if (clean.includes('.')) {
        const parts = clean.split('.');
        if (parts[parts.length - 1].length === 3) {
            clean = clean.replace(/\./g, '');
        }
    }
    
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : val;
}

function deduplicateNotes(notes) {
    if (!notes || !Array.isArray(notes)) return [];
    const seen = new Set();
    return notes.filter(n => {
        if (!n.text) return true;
        const key = n.text.trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

console.log('[TRABAJOS] 📦 Módulo cargado');

let selectedProductGroup = null;

const groupColorMap = {
    'Lonas': { color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' },
    'Vinilos': { color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.3)' },
    'Corpóreos y Cortes': { color: '#fb923c', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)' },
    'Luminosos y LED': { color: '#facc15', bg: 'rgba(250, 204, 21, 0.15)', border: 'rgba(250, 204, 21, 0.3)' },
    'Otros': { color: '#a1a1aa', bg: 'rgba(161, 161, 170, 0.15)', border: 'rgba(161, 161, 170, 0.3)' }
};
window.groupColorMap = groupColorMap;

function getWorkItems(w) {
    const items = [];
    
    // 1. Google Web Orders (sin quoteId)
    if (!w.quoteId) {
        const notesDetalle = (w.notes || []).filter(n => n.author === 'Google Sync' || n.author === 'Google' || (n.text && n.text.includes('PRODUCTO')));
        for (const note of notesDetalle) {
            if (!note.text) continue;
            const lines = note.text.split('\n');
            let currentProd = '';
            lines.forEach(line => {
                const l = line.trim();
                if (l.startsWith('PRODUCTO') || l.startsWith('P#') || l.startsWith('ITEM') || l.startsWith('Item')) {
                    currentProd = l.replace(/^(PRODUCTO\s*#?\d+:\s*|P#\d+:\s*|ITEM\s*#?\d+:\s*)/i, '');
                    const nameMatch = currentProd.match(/^(.*?)(?:\s*-\s*|\s*\()/);
                    const name = nameMatch ? nameMatch[1].trim() : currentProd.split('-')[0].trim();
                    items.push({ name: name, rawName: currentProd });
                }
            });
        }
    } else {
        // 2. Internal Orders (con quoteId)
        const quote = allQuotes[w.quoteId];
        if (quote) {
            const categories = quote.multiCategories?.categories || [];
            const productos = quote.productos || [];
            categories.forEach(cat => {
                items.push({ name: cat.name || 'Componente', rawName: cat.name });
            });
            productos.forEach(prod => {
                items.push({ name: prod.name || prod.nombre || 'Producto', rawName: prod.name || prod.nombre });
            });
        }
    }
    return items;
}

function cleanMaterialName(name) {
    if (!name) return 'Otro';
    const n = name.toLowerCase().trim();
    if (n.includes('lona front')) return 'Lona Front';
    if (n.includes('lona back')) return 'Lona Backlight';
    if (n.includes('vinilo base gris')) return 'Vinilo Base Gris';
    if (n.includes('vinilo base blanca') || n.includes('vinilo brillante') || n.includes('vinilo mate')) return 'Vinilo Base Blanca';
    if (n.includes('vinilo') && (n.includes('corte') || n.includes('cortar') || n.includes('oracal'))) return 'Vinilo de Corte';
    if (n.includes('vinilo')) return 'Vinilo Impreso';
    if (n.includes('polifan') || n.includes('corte polifan')) return 'Polifan';
    if (n.includes('router') || n.includes('mdf') || n.includes('chapa') || (n.includes('corte') && !n.includes('vinilo') && !n.includes('polifan'))) return 'Corte Router/MDF/Chapa';
    if (n.includes('neon') || n.includes('neón') || n.includes('led')) return 'LED / Neón';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase().trim();
}

function getProductGroupName(name) {
    if (!name) return 'Otros';
    const n = name.toLowerCase().trim();
    if (n.includes('lona')) return 'Lonas';
    if (n.includes('vinilo')) return 'Vinilos';
    if (n.includes('polifan') || n.includes('router') || n.includes('mdf') || (n.includes('corte') && !n.includes('vinilo') && !n.includes('polifan'))) return 'Corpóreos y Cortes';
    if (n.includes('neon') || n.includes('neón') || n.includes('led') || n.includes('letrero luminoso') || n.includes('luminoso')) return 'Luminosos y LED';
    return 'Otros';
}

function selectProductGroup(groupName) {
    selectedProductGroup = groupName;
    renderWorks();
    updateMaterialAndProductWidgets();
}
window.selectProductGroup = selectProductGroup;

function updateMaterialAndProductWidgets() {
    const activeWorks = allWorks.filter(w => w.status !== 'completed' && w.deliveryStatus !== 'delivered');
    const activeUnprintedWorks = activeWorks.filter(w => !w.printed);
    
    const materialCounts = {};
    const productGroups = {};

    // 1. Calcular conteos de materiales solo para trabajos activos SIN IMPRIMIR
    activeUnprintedWorks.forEach(w => {
        const items = getWorkItems(w);
        items.forEach(item => {
            const matName = cleanMaterialName(item.name);
            materialCounts[matName] = (materialCounts[matName] || 0) + 1;
        });
    });

    // 2. Calcular grupos de productos para TODOS los trabajos activos
    activeWorks.forEach(w => {
        const items = getWorkItems(w);
        items.forEach(item => {
            const groupName = getProductGroupName(item.name);
            if (!productGroups[groupName]) {
                productGroups[groupName] = [];
            }
            if (!productGroups[groupName].includes(w.id)) {
                productGroups[groupName].push(w.id);
            }
        });
    });

    const notifierWidget = document.getElementById('materialNotifierWidget');
    const badgesContainer = document.getElementById('materialBadgesContainer');
    
    if (notifierWidget && badgesContainer) {
        const materials = Object.keys(materialCounts);
        if (materials.length > 0) {
            notifierWidget.style.display = 'block';
            badgesContainer.innerHTML = materials.map(mat => {
                const group = getProductGroupName(mat);
                const colors = groupColorMap[group] || groupColorMap['Otros'];
                return `
                    <span class="badge" style="background: ${colors.bg} !important; color: ${colors.color} !important; border: 1px solid ${colors.border} !important; font-size: 0.85rem; padding: 0.5rem 0.75rem; border-radius: 8px; font-weight: 600;">
                        🛠️ ${mat}: <strong>${materialCounts[mat]} pendientes</strong>
                    </span>
                `;
            }).join('');
        } else {
            notifierWidget.style.display = 'none';
        }
    }

    const groupsWidget = document.getElementById('productGroupsWidget');
    const groupsContainer = document.getElementById('productGroupsContainer');
    
    if (groupsWidget && groupsContainer) {
        const groups = Object.keys(productGroups);
        if (groups.length > 0) {
            groupsWidget.style.display = 'block';
            
            const btnTodosStyle = selectedProductGroup === null
                ? `background: #ffffff !important; color: #09090b !important; border: 1px solid #ffffff !important; font-weight: bold;`
                : `background: rgba(255,255,255,0.05) !important; color: #ffffff !important; border: 1px solid rgba(255,255,255,0.1) !important;`;
            
            let html = `
                <button class="btn btn-small" style="${btnTodosStyle}" onclick="selectProductGroup(null)">
                    🌐 Todos (${activeWorks.length})
                </button>
            `;
            
            html += groups.map(grp => {
                const isActive = selectedProductGroup === grp;
                const colors = groupColorMap[grp] || groupColorMap['Otros'];
                const btnStyle = isActive
                    ? `background: ${colors.color} !important; color: #09090b !important; border: 1px solid ${colors.color} !important; font-weight: bold;`
                    : `background: ${colors.bg} !important; color: ${colors.color} !important; border: 1px solid ${colors.border} !important;`;
                
                return `
                    <button class="btn btn-small" style="${btnStyle}" onclick="selectProductGroup('${grp}')">
                        📦 ${grp} (${productGroups[grp].length})
                    </button>
                `;
            }).join('');
            
            groupsContainer.innerHTML = html;
        } else {
            groupsWidget.style.display = 'none';
        }
    }
}

async function togglePrinted(id) {
    const w = allWorks.find(x => String(x.id) === String(id));
    if (!w) return;
    w.printed = !w.printed;
    
    if (!w.printedItems) w.printedItems = {};
    if (w.printed) {
        // Auto-marcar todos los items como impresos
        if (!w.quoteId) {
            const notesDetalle = (w.notes || []).filter(n => n.author === 'Google Sync' || n.author === 'Google' || (n.text && n.text.includes('PRODUCTO')));
            let prodIndex = 0;
            notesDetalle.forEach((note, noteIdx) => {
                const lines = (note.text || '').split('\n').filter(l => l.trim());
                lines.forEach(linea => {
                    const l = linea.trim();
                    if (l.startsWith('PRODUCTO') || l.startsWith('P#') || l.startsWith('ITEM') || l.startsWith('item')) {
                        w.printedItems[`item_${prodIndex}_${noteIdx}`] = true;
                        prodIndex++;
                    }
                });
            });
        } else {
            const quotesToRender = [];
            if (w.quoteId && allQuotes[w.quoteId]) {
                quotesToRender.push({ quoteId: w.quoteId, id: w.id, quote: allQuotes[w.quoteId] });
            }
            if (w.mergedWorks && Array.isArray(w.mergedWorks)) {
                w.mergedWorks.forEach(mw => {
                    if (mw.quoteId && allQuotes[mw.quoteId]) {
                        quotesToRender.push({ quoteId: mw.quoteId, id: mw.id, quote: allQuotes[mw.quoteId] });
                    }
                });
            }
            quotesToRender.forEach(qItem => {
                const categories = qItem.quote.multiCategories?.categories || [];
                const productos = qItem.quote.productos || [];
                categories.forEach((cat, i) => {
                    w.printedItems[`cat_${i}_${qItem.id}`] = true;
                });
                productos.forEach((prod, i) => {
                    w.printedItems[`prod_${i}_${qItem.id}`] = true;
                });
            });
        }
    } else {
        // Auto-desmarcar todos los items
        w.printedItems = {};
    }
    
    if (!w.timeline) w.timeline = [];
    w.timeline.push({
        type: 'printed_toggle',
        description: w.printed ? 'Trabajo marcado como IMPRESO' : 'Trabajo desmarcado como impreso',
        timestamp: new Date().toISOString()
    });
    
    try {
        const res = await fetch(`/api/trabajos/${w.id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ 
                printed: w.printed,
                printedItems: w.printedItems,
                timeline: w.timeline
            })
        });
        if (!res.ok) throw new Error('Error al actualizar en el servidor');
        await loadWorks();
    } catch (e) {
        alert('❌ Error al actualizar: ' + e.message);
    }
}
window.togglePrinted = togglePrinted;

async function toggleItemPrinted(workId, itemKey) {
    const w = allWorks.find(x => String(x.id) === String(workId));
    if (!w) return;
    
    if (!w.printedItems) w.printedItems = {};
    w.printedItems[itemKey] = !w.printedItems[itemKey];
    
    // Determinar si todos los items individuales están marcados como impresos
    let allItemsPrinted = true;
    let hasItems = false;
    
    if (!w.quoteId) {
        const notesDetalle = (w.notes || []).filter(n => n.author === 'Google Sync' || n.author === 'Google' || (n.text && n.text.includes('PRODUCTO')));
        let prodIndex = 0;
        notesDetalle.forEach((note, noteIdx) => {
            const lines = (note.text || '').split('\n').filter(l => l.trim());
            lines.forEach(linea => {
                const l = linea.trim();
                if (l.startsWith('PRODUCTO') || l.startsWith('P#') || l.startsWith('ITEM') || l.startsWith('item')) {
                    hasItems = true;
                    const currentKey = `item_${prodIndex}_${noteIdx}`;
                    if (!w.printedItems[currentKey]) {
                        allItemsPrinted = false;
                    }
                    prodIndex++;
                }
            });
        });
    } else {
        const quotesToRender = [];
        if (w.quoteId && allQuotes[w.quoteId]) {
            quotesToRender.push({ quoteId: w.quoteId, id: w.id, quote: allQuotes[w.quoteId] });
        }
        if (w.mergedWorks && Array.isArray(w.mergedWorks)) {
            w.mergedWorks.forEach(mw => {
                if (mw.quoteId && allQuotes[mw.quoteId]) {
                    quotesToRender.push({ quoteId: mw.quoteId, id: mw.id, quote: allQuotes[mw.quoteId] });
                }
            });
        }
        quotesToRender.forEach(qItem => {
            const categories = qItem.quote.multiCategories?.categories || [];
            const productos = qItem.quote.productos || [];
            categories.forEach((cat, i) => {
                hasItems = true;
                const currentKey = `cat_${i}_${qItem.id}`;
                if (!w.printedItems[currentKey]) {
                    allItemsPrinted = false;
                }
            });
            productos.forEach((prod, i) => {
                hasItems = true;
                const currentKey = `prod_${i}_${qItem.id}`;
                if (!w.printedItems[currentKey]) {
                    allItemsPrinted = false;
                }
            });
        });
    }
    
    const wasPrinted = w.printed;
    if (hasItems && allItemsPrinted) {
        w.printed = true;
    } else {
        w.printed = false;
    }
    
    if (!w.timeline) w.timeline = [];
    if (w.printed && !wasPrinted) {
        w.timeline.push({
            type: 'printed_toggle',
            description: 'Todos los ítems impresos.',
            timestamp: new Date().toISOString()
        });
    }
    
    try {
        const res = await fetch(`/api/trabajos/${w.id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ 
                printed: w.printed,
                printedItems: w.printedItems,
                timeline: w.timeline
            })
        });
        if (!res.ok) throw new Error('Error al actualizar el estado del item en el servidor');
        
        await loadWorks();
        
        // Mantener abierto el panel de detalles para no obligar al usuario a abrirlo de nuevo
        const uniqueId = 'items_' + workId;
        setTimeout(() => {
            const el = document.getElementById(uniqueId);
            if (el) el.style.display = 'block';
        }, 100);
    } catch (e) {
        alert('❌ Error al actualizar el estado del item: ' + e.message);
    }
}
window.toggleItemPrinted = toggleItemPrinted;

// ==================== VISTA PREVIA DE IMÁGENES DE DRIVE ====================
const driveImageCache = {};
const driveImageMap = {}; // Almacena datos de imagen por key para evitar base64 en atributos HTML

function getFolderIdFromUrl(url) {
    if (!url) return null;
    const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

async function loadDrivePreviews() {
    const cards = document.querySelectorAll('.drive-previews-container');
    for (const el of cards) {
        const folderId = el.getAttribute('data-folder-id');
        if (!folderId || folderId === 'unknown') continue;
        
        // Si ya está en caché, renderizar directamente
        if (driveImageCache[folderId]) {
            renderPreviewImages(el, driveImageCache[folderId]);
            continue;
        }
        
        // Evitar múltiples peticiones paralelas para la misma carpeta
        if (driveImageCache[folderId] === 'loading') continue;
        driveImageCache[folderId] = 'loading';
        
        try {
            const response = await fetch(`/api/google/folder-images?folderId=${folderId}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!response.ok) {
                driveImageCache[folderId] = null;
                continue;
            }
            const images = await response.json();
            driveImageCache[folderId] = images;
            renderPreviewImages(el, images);
        } catch (err) {
            console.error('Error cargando vistas previas de Drive:', err);
            driveImageCache[folderId] = null;
        }
    }
}

function renderPreviewImages(containerEl, images) {
    if (Array.isArray(images) && images.length > 0) {
        containerEl.innerHTML = images.map((img, i) => {
            const key = `${img.id}_${i}`;
            driveImageMap[key] = img;
            if (img.thumbData) {
                return `
                    <div class="drive-preview-item" style="position:relative; width:80px; height:80px; border-radius:8px; overflow:hidden; border:1px solid var(--border-color, rgba(255,255,255,0.1)); background:#111; cursor:pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='none';" onclick="openPreviewByKey('${key}')">
                        <img src="${img.thumbData}" style="width:100%; height:100%; object-fit:cover;">
                    </div>`;
            } else {
                return `
                    <a href="${img.fullUrl}" target="_blank" class="drive-preview-item" style="position:relative; width:80px; height:80px; border-radius:8px; overflow:hidden; border:1px solid var(--border-color, rgba(255,255,255,0.1)); background:#111; cursor:pointer; display:flex; align-items:center; justify-content:center; text-decoration:none; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='none';">
                        <div style="text-align:center;">
                            <div style="font-size:1.8rem;">🖼️</div>
                            <div style="font-size:.55rem; color:#aaa; margin-top:2px; max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${img.name}</div>
                        </div>
                    </a>`;
            }
        }).join('');
    } else {
        containerEl.innerHTML = '';
    }
}

function openPreviewModal(imgSrc, imgName, driveUrl) {
    const existing = document.getElementById('previewImageModal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'previewImageModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;';
    
    const driveLink = driveUrl ? `<a href="${driveUrl}" target="_blank" style="position:absolute; top:15px; left:15px; background:rgba(0,0,0,0.6); border:none; color:#4facfe; border-radius:8px; padding:6px 12px; cursor:pointer; font-size:0.8rem; text-decoration:none; z-index:10; display:flex; align-items:center; gap:4px;">📁 Abrir en Drive</a>` : '';
    
    modal.innerHTML = `
        <div style="position:relative; max-width:90%; max-height:85vh; border-radius:12px; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
            <button onclick="document.getElementById('previewImageModal').remove()" style="position:absolute; top:15px; right:15px; background:rgba(0,0,0,0.6); border:none; color:#fff; border-radius:50%; width:36px; height:36px; cursor:pointer; font-size:1.2rem; line-height:1; display:flex; align-items:center; justify-content:center; z-index:10;">✕</button>
            ${driveLink}
            <img src="${imgSrc}" style="max-width:100%; max-height:85vh; display:block; object-fit:contain;">
            <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.6); color:#fff; padding:10px 15px; font-size:0.9rem; text-align:center;">${imgName}</div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}
window.openPreviewModal = openPreviewModal;

function openPreviewByKey(key) {
    const img = driveImageMap[key];
    if (!img) return;
    openPreviewModal(img.thumbData || img.fullUrl, img.name, img.fullUrl);
}
window.openPreviewByKey = openPreviewByKey;
