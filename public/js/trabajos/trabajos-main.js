/**

 * GESTIÓN DE TRABAJOS — MR LETREROS
 * Archivo: public/js/trabajos/trabajos-main.js
 * 
 * Módulo refactorizado y ultra-optimizado.
 * - Unificación estricta de pedidos únicamente entre el mismo cliente o número de WhatsApp.
 * - Carga instantánea de trabajos (Renderizado no bloqueante en <100ms).
 * - Cotizaciones asociadas y Drive Previews cargadas asincrónicamente en segundo plano.
 * - Función de enviar Recordatorio de Pago por WhatsApp para trabajos retirados/entregados NO pagados.
 * - Cambio de estado instantáneo en UI mediante PremiumDialog con confirmación opcional de envío de WhatsApp.
 * - Gestión de pagos, notas y prioridades con actualización UI reactiva inmediata.
 * - Muestra en vista principal resaltados en rojo los trabajos retirados/entregados NO pagados.
 * - Incluye todas las mejoras recientes (Drive previews, Google Sheets Sync, 
 *   widgets de productos/materiales, acciones por ítem, bulk actions y modal Gremio).
 */

// ==================== ESTADO GLOBAL ====================
let currentFilters = {};
let allWorks = [];
let allQuotes = {};  // Map quoteId -> cotización
let selectedWorks = new Set();
let selectedWorkItemsMap = new Map(); // workId -> Set of itemKeys
let selectedProductGroup = null;

let modalGremioClients = [];
let modalPreciosCatalog = [];

// ===== OPTIMIZACIÓN DE RENDIMIENTO =====
// Coalesce renders: muchas acciones llaman renderWorks() varias veces seguidas;
// se ejecuta UNA sola vez por frame para no reconstruir toda la lista repetidas veces.
let renderPending = false;
// Evita recargar tras guardar nosotros mismos (el servidor hace eco con works_updated)
let selfSaveCooldown = 0;
// Vista previa de Drive: debounce + una sola pasada a la vez (las fetches van en paralelo)
let driveTimer = null;
let driveRunning = false;

const groupColorMap = {
    'Lonas': { color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' },
    'Vinilos': { color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.3)' },
    'Corpóreos y Cortes': { color: '#fb923c', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)' },
    'Luminosos y LED': { color: '#facc15', bg: 'rgba(250, 204, 21, 0.15)', border: 'rgba(250, 204, 21, 0.3)' },
    'Otros': { color: '#a1a1aa', bg: 'rgba(161, 161, 170, 0.15)', border: 'rgba(161, 161, 170, 0.3)' }
};

function getToken() { 
    return localStorage.getItem('mr_token') || ''; 
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[TRABAJOS] Inicializando módulo...');
    
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

    setupEventListeners();
    await loadWorks();
    setupSocketListeners();
    console.log('[TRABAJOS] ✅ Listo');
});

function setupSocketListeners() {
    const bindSocket = (socket) => {
        socket.on('works_updated', (data) => {
            if (data && data.source === 'put_api') {
                return;
            }
            // FIX rendimiento: si el cambio lo hicimos nosotros hace un instante,
            // la UI ya está actualizada → no hace falta recargar todo de nuevo.
            if (Date.now() < selfSaveCooldown) return;
            console.log('[REALTIME] Trabajos actualizados en servidor. Recargando...');
            loadWorks();
        });
        socket.on('new_order', (data) => {
            console.log('[REALTIME] 📦 Nuevo pedido recibido desde Google/App:', data);
            if (data) {
                showSoftNotification(`📦 ${data.title || 'Nuevo Pedido Gremio'}: ${data.message || ''}`);
            }
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

    window.addEventListener('new_order_received', (e) => {
        const data = e.detail;
        console.log('[REALTIME] Evento custom new_order_received:', data);
        if (data) {
            showSoftNotification(`📦 ${data.title || 'Nuevo Pedido Gremio'}: ${data.message || ''}`);
        }
        loadWorks();
    });

    window.addEventListener('works_updated_signal', () => {
        loadWorks();
    });
}

function checkNotificationPermission() {
    if (window.isSecureContext === false || !('Notification' in window)) {
        console.warn('[REALTIME] Notificaciones desactivadas: Origen no seguro (HTTP) o no soportado.');
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
    } else {
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

// ==================== CARGA DE DATOS ULTRA RÁPIDA ====================
async function loadWorks() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) loadingState.style.display = 'block';

    try {
        const result = await window.mrDataManager.request('/api/trabajos');
        allWorks = result?.works || [];

        // 1. Renderizado instantáneo de la lista de trabajos (Carga inmediata)
        renderWorks();
        updateStatistics();
        updateMaterialAndProductWidgets();

        // 2. Cargar cotizaciones asociadas en segundo plano (No bloqueante)
        const quoteIds = allWorks.map(w => w.quoteId).filter(id => id && !String(id).startsWith('direct_'));
        const quotesToFetch = [...new Set(quoteIds)].filter(id => !allQuotes[id]);

        if (quotesToFetch.length > 0) {
            Promise.all(quotesToFetch.map(async id => {
                try {
                    const q = await window.mrDataManager.request(`/api/cotizaciones/${id}`);
                    if (q) allQuotes[id] = q;
                } catch (e) {
                    // Cotización no encontrada
                }
            })).then(() => {
                renderWorks();
            });
        }

        scheduleDrivePreviews();
    } catch (e) {
        console.error('[TRABAJOS] Error al cargar:', e);
        showError('Error al cargar los trabajos: ' + e.message);
    } finally {
        if (loadingState) loadingState.style.display = 'none';
    }
}

async function saveWorks() {
    // FIX rendimiento: marcar que el próximo works_updated (eco de nuestro propio
    // guardado) no dispare un loadWorks() completo e innecesario.
    selfSaveCooldown = Date.now() + 3000;
    try {
        const result = await window.mrDataManager.request('/api/trabajos', 'POST', { works: allWorks, notifications: [] });
        return result?.success ?? true;
    } catch (e) {
        console.error('[TRABAJOS] Error al guardar:', e);
        return false;
    }
}

async function manualSyncGoogleSheets() {
    try {
        const res = await fetch('/api/sync-google', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        if (data.success) {
            alert('🔄 ✅ Planilla de Google Sheets sincronizada exitosamente.');
            await loadWorks();
        } else {
            alert('❌ Error al sincronizar: ' + (data.error || 'Error desconocido'));
        }
    } catch(e) {
        console.error('[TRABAJOS] Error sincronizando planilla:', e);
        alert('❌ Error de conexión al sincronizar la planilla.');
    }
}

// ==================== FILTRADO Y CATEGORIZACIÓN ====================
function getVisibleWorks() {
    return allWorks.filter(w => {
        const isRetiradoPago = (w.deliveryStatus === 'delivered' || w.status === 'delivered') && w.paymentStatus === 'paid';

        if (currentFilters.status === 'delivered') {
            if (w.deliveryStatus !== 'delivered' && w.status !== 'delivered') return false;
        } else if (currentFilters.status === 'missing_from_sheet') {
            if (!w.missingFromSheet && !w.missing_from_sheet && w.sheetStatus !== 'not_in_sheet') return false;
        } else if (currentFilters.status) {
            if (w.status !== currentFilters.status && w.deliveryStatus !== currentFilters.status) return false;
        } else {
            // Vista general sin filtro: ocultar entregados pagados, CANCELADOS y eliminados de planilla.
            // (Los cancelados solo se ven con el filtro "🚫 Cancelados" / "⚠️ Eliminados de Planilla")
            if (isRetiradoPago) return false;
            if (w.status === 'cancelled' || w.missingFromSheet || w.missing_from_sheet || w.sheetStatus === 'not_in_sheet') return false;
        }

        if (currentFilters.paymentStatus && w.paymentStatus !== currentFilters.paymentStatus) return false;
        if (currentFilters.priority && w.priority !== currentFilters.priority) return false;

        if (currentFilters.search) {
            const q = currentFilters.search.toLowerCase().trim();
            const clientMatch = (w.clientName || w.cliente_nombre || '').toLowerCase().includes(q);
            const descMatch = (w.descripcion || '').toLowerCase().includes(q);
            const phoneMatch = (w.clientPhone || w.cliente_telefono || '').toLowerCase().includes(q);
            const idMatch = String(w.id || '').toLowerCase().includes(q);
            const notesMatch = (w.notes || []).some(n => (n.text || '').toLowerCase().includes(q));
            const prodsMatch = (w.productos || w.products || []).some(p => (p.nombre || p.name || '').toLowerCase().includes(q));
            if (!clientMatch && !descMatch && !phoneMatch && !idMatch && !notesMatch && !prodsMatch) return false;
        }

        if (selectedProductGroup) {
            const items = getWorkItems(w);
            const matchesGroup = items.some(item => getProductGroupName(item.name) === selectedProductGroup);
            if (!matchesGroup) return false;
        }

        return true;
    });
}

function applyFilters() {
    currentFilters = {
        search: document.getElementById('filterSearch')?.value || '',
        status: document.getElementById('filterStatus')?.value || '',
        paymentStatus: document.getElementById('filterPayment')?.value || '',
        priority: document.getElementById('filterPriority')?.value || ''
    };
    renderWorks();
    updateMaterialAndProductWidgets();
}

function clearFilters() {
    ['filterSearch', 'filterStatus', 'filterPayment', 'filterPriority'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    currentFilters = {};
    selectedProductGroup = null;
    renderWorks();
    updateMaterialAndProductWidgets();
}

function setupEventListeners() {
    const searchInput = document.getElementById('filterSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => applyFilters());
    }
    ['filterStatus', 'filterPayment', 'filterPriority'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => applyFilters());
    });
}

// ==================== RENDERIZADO DE TRABAJOS ====================
// FIX rendimiento: renderWorks se llama muchas veces por acción; se agrupa a UN solo
// render por frame (la UI siempre queda con el último estado, que es lo que importa).
function renderWorks() {
    if (renderPending) return;
    renderPending = true;
    const flush = () => { renderPending = false; renderWorksNow(); };
    if (window.requestAnimationFrame) requestAnimationFrame(flush);
    else setTimeout(flush, 0);
}

function renderWorksNow() {
    const worksList = document.getElementById('worksList');
    if (!worksList) return;

    const visibleWorks = getVisibleWorks();

    if (visibleWorks.length === 0) {
        worksList.innerHTML = `
            <div class="empty-state w-100">
                <div class="empty-state-icon">📦</div>
                <h3>No se encontraron trabajos</h3>
                <p>No hay trabajos que coincidan con los filtros seleccionados.</p>
            </div>`;
        return;
    }

    worksList.innerHTML = visibleWorks.map(w => {
        try {
            return generateWorkCard(w);
        } catch (err) {
            console.error('[TRABAJOS] Error renderizando trabajo:', w.id, err);
            return `
                <div class="work-card border border-danger">
                    <div class="p-3 text-danger">
                        <strong>⚠️ Error al mostrar trabajo #${String(w.id || '').slice(-8)} (${w.clientName || 'Sin nombre'})</strong>
                        <div style="font-size:0.8rem;color:#888;">${w.descripcion || 'Sin descripción'}</div>
                    </div>
                </div>`;
        }
    }).join('');
    updateSelectionUI();
    scheduleDrivePreviews();
}

// FIX rendimiento: carga diferida + con debounce de las vistas previas de Drive
function scheduleDrivePreviews() {
    if (driveTimer) clearTimeout(driveTimer);
    driveTimer = setTimeout(() => { driveTimer = null; loadDrivePreviews(); }, 150);
}

function generateWorkCard(w) {
    const isSelected = selectedWorks.has(String(w.id));
    const isRetiradoNoPago = w.deliveryStatus === 'delivered' && w.paymentStatus !== 'paid';
    const priorityClass = w.priority === 'urgent' ? 'priority-urgent' : w.priority === 'high' ? 'priority-high' : '';
    const statusClass = isRetiradoNoPago ? 'status-retirado-no-pago' : (w.status ? `status-${w.status}` : '');
    const selectedClass = isSelected ? 'selected' : '';
    const itemsHtml = generateItemsDetail(w);

    // --- Conteo directo de ítems (todas las fuentes posibles) ---
    let itemsCount = 0;
    // Fuente 1: Cotización interna
    if (w.quoteId && allQuotes[w.quoteId]) {
        const q = allQuotes[w.quoteId];
        itemsCount += (q.multiCategories?.categories || []).length;
        itemsCount += (q.productos || []).length;
    }
    // Fuente 2: mergedWorks con cotizaciones
    if (w.mergedWorks && Array.isArray(w.mergedWorks)) {
        w.mergedWorks.forEach(mw => {
            if (mw.quoteId && allQuotes[mw.quoteId]) {
                const q2 = allQuotes[mw.quoteId];
                itemsCount += (q2.multiCategories?.categories || []).length;
                itemsCount += (q2.productos || []).length;
            }
        });
    }
    // Fuente 3: productos / products array
    if (itemsCount === 0) {
        const prods = (w.productos && w.productos.length > 0) ? w.productos : ((w.products && w.products.length > 0) ? w.products : []);
        itemsCount += prods.length;
    }
    // Fuente 4: notas de detalle / descripción (contar líneas tipo PRODUCTO/ITEM)
    if (itemsCount === 0 && (w.notes || w.descripcion)) {
        let notesD = (w.notes || []).filter(n => n && n.text && (n.type === 'detalle' || n.type === 'detail' || /PRODUCTO|ITEM|P#/i.test(n.text)));
        if (notesD.length === 0 && w.descripcion) notesD = [{ text: w.descripcion }];
        notesD.forEach(n => {
            const txt = (n.text || '').replace(/\\n/g, '\n');
            txt.split(/\r?\n/).forEach(l => {
                const cl = l.trim().replace(/^Detalle:\s*/i, '');
                const splits = cl.split(/(?=(?:ITEM|PRODUCTO|P#)\s*\d+:?)/i).filter(s => s.trim());
                splits.forEach(s => {
                    if (/^(PRODUCTO|ITEM|P#|item|producto)\s*\d*:?/i.test(s.trim())) itemsCount++;
                });
                if (splits.length === 0 && cl.length > 2 && !cl.toLowerCase().startsWith('link') && !cl.toUpperCase().startsWith('MEDIDAS') && !cl.toUpperCase().startsWith('SUBTOTAL') && !cl.toUpperCase().startsWith('NOTA') && !cl.toLowerCase().startsWith('detalle del pedido')) {
                    itemsCount++;
                }
            });
        });
    }

    const isMultiItem = itemsCount > 1;
    const multiItemClass = isMultiItem ? 'multi-item-card' : '';

    // Estilos inline directos para garantizar visibilidad
    const cardInlineStyle = isMultiItem 
        ? 'border: 2px solid #f59e0b !important; background: linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(168, 85, 247, 0.12) 100%) !important; box-shadow: 0 0 16px rgba(245, 158, 11, 0.25);' 
        : '';
    const clientNameStyle = isMultiItem 
        ? 'color: #fbbf24 !important;' 
        : '';

    // Limpiar URLs de Drive y recortar a la primera línea para el encabezado
    let cleanDesc = '';
    if (w.descripcion) {
        let firstLine = w.descripcion
            .replace(/https?:\/\/[^\s]*drive\.google\.com[^\s]*/gi, '')
            .replace(/Link a Drive:\s*/gi, '')
            .split(/\r?\n/)[0].trim();
        if (firstLine.length > 50) firstLine = firstLine.substring(0, 50) + '...';
        cleanDesc = firstLine;
    }

    return `
        <div class="work-card ${priorityClass} ${statusClass} ${selectedClass} ${multiItemClass}" style="${cardInlineStyle}">
            <div class="work-header">
                <div class="d-flex align-items-center gap-2">
                    <input type="checkbox" class="work-select-checkbox" data-id="${w.id}" onchange="toggleSelectWork('${w.id}')" ${isSelected ? 'checked' : ''} title="Seleccionar trabajo">
                    <div>
                        <div class="work-client" style="${clientNameStyle}">${w.clientName || 'Sin nombre'}</div>
                        ${w.clientPhone ? `<div class="work-client-info">📞 ${w.clientPhone}</div>` : ''}
                        ${cleanDesc ? `<div class="work-client-info" style="font-size:.8rem;opacity:.75;margin-top:2px;">📝 ${cleanDesc}</div>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:.4rem;flex-wrap:wrap;justify-content:flex-end;">
                    ${w.missingFromSheet || w.missing_from_sheet || w.sheetStatus === 'not_in_sheet' ? '<span class="badge" style="background:#dc2626 !important; color:#fff !important; font-weight:700; box-shadow: 0 0 10px rgba(220, 38, 38, 0.5);" title="Este pedido fue eliminado de la planilla de Google Sheets">⚠️ Eliminado de Planilla</span>' : ''}
                    ${isMultiItem ? `<span class="badge" style="background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); color: #fff; font-weight: 700; box-shadow: 0 2px 6px rgba(168, 85, 247, 0.4);" title="Pedido con ${itemsCount} productos o ítems">📦 ${itemsCount} Ítems</span>` : ''}
                    ${w.deliveryStatus === 'delivered' ? 
                        (w.paymentStatus === 'paid' ? 
                            '<span class="badge bg-success">📦 Entregado</span>' : 
                            '<span class="badge badge-payment-unpaid" style="background:#ef4444 !important; color:#fff !important;">📦 Retirado (NO PAGADO)</span>'
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
                    <div class="work-detail-value" style="font-size:.85rem;">#${String(w.id).slice(-8)}</div>
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
                ${generateDiscountsSummaryHtml(w.quoteId)}
            </div>

            ${itemsHtml}

            <div style="font-size:.8rem;color:var(--text-secondary);margin-top:.5rem;">
                📅 ${fmtDate(w.createdAt)}
                ${w.deliveryDate ? ` &nbsp;|&nbsp; 🚚 ${fmtDate(w.deliveryDate)}` : ''}
            </div>

            <div class="work-actions-container">
                <div class="work-actions-primary">
                    <button class="btn btn-primary btn-action-primary" onclick="changeStatus('${w.id}')">🔄 Estado</button>
                    <button class="btn btn-success btn-action-primary" onclick="markPaid('${w.id}')" ${w.paymentStatus === 'paid' ? 'disabled' : ''}>💳 Pagar</button>
                    ${isRetiradoNoPago ? `<button class="btn btn-warning btn-action-primary" onclick="sendPaymentReminder('${w.id}')" style="background:#ef4444 !important; border-color:#ef4444 !important; color:#fff !important;" title="Enviar recordatorio de saldo por WhatsApp">📲 Recordar Pago</button>` : ''}
                    <button class="btn btn-info btn-action-primary" onclick="addNote('${w.id}')">📝 Nota</button>
                </div>
                
                <div class="dropdown">
                    <button class="btn btn-outline-secondary btn-action-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        ⚙️ Más
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow dark-dropdown">
                        ${isRetiradoNoPago ? `<li><a class="dropdown-item text-danger fw-bold" href="#" onclick="event.preventDefault(); sendPaymentReminder('${w.id}')">📲 Recordar Pago por WhatsApp</a></li>` : ''}
                        ${w.status === 'completed' ? `<li><a class="dropdown-item" href="#" onclick="event.preventDefault(); resendReadyMessage('${w.id}')">📲 Reenviar mensaje de Listo</a></li>` : ''}
                        <li><a class="dropdown-item" href="#" onclick="event.preventDefault(); resendConfirmMessage('${w.id}')">📲 Reenviar Confirmación Recepción</a></li>
                        <li><a class="dropdown-item" href="#" onclick="event.preventDefault(); togglePrinted('${w.id}')">${w.printed ? '✅ Desmarcar Impreso' : '🖨️ Marcar Impreso'}</a></li>
                        <li><a class="dropdown-item" href="#" onclick="event.preventDefault(); mergeWork('${w.id}')">🔗 Unificar con otro pedido</a></li>
                        ${(w.mergedWorks && w.mergedWorks.length > 0) ? `<li><a class="dropdown-item text-warning" href="#" onclick="event.preventDefault(); unmergeWork('${w.id}')">🔓 Desunificar (elegir cuáles)</a></li>` : ''}
                        ${(w.status === 'completed' && w.deliveryStatus !== 'delivered') ? `<li><a class="dropdown-item text-success" href="#" onclick="event.preventDefault(); markDelivered('${w.id}')">🚚 Marcar Entregado</a></li>` : ''}
                        <li><a class="dropdown-item" href="#" onclick="event.preventDefault(); changePriority('${w.id}')">🎯 Cambiar Prioridad</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#" onclick="event.preventDefault(); deleteWork('${w.id}')">🗑️ Eliminar Trabajo</a></li>
                    </ul>
                </div>
            </div>
        </div>`;
}

function generateDiscountsSummaryHtml(quoteId) {
    if (!quoteId) return '';
    const q = allQuotes[quoteId];
    if (!q) return '';
    
    let html = '';
    if (q.discountPercent > 0) {
        html += `
        <div class="work-detail-item" style="border-left: 2px solid #4CAF50; padding-left: 8px;">
            <div class="work-detail-label" style="color:#4CAF50;">Desc. Volumen</div>
            <div class="work-detail-value" style="color:#4CAF50; font-size:.85rem;">
                ${q.discountPercent}% (-$${fmt(q.discountAmount)})
            </div>
        </div>`;
    }
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
}

function isDetailNote(n) {
    if (!n) return false;
    const author = (n.author || '').toLowerCase();
    const text = n.text || '';
    if (['google sync', 'google', 'sistema', 'portal web', 'gremio'].some(a => author.includes(a))) return true;
    return text.includes('PRODUCTO') || text.includes('ITEM') || text.includes('item') || text.includes('P#') || text.includes('Detalle') || text.includes('Link a Drive') || text.includes('drive.google.com');
}

function getAllDetailNotes(w) {
    const allNotes = [];
    const processWork = (work) => {
        if (!work) return;
        let notesDetalle = (work.notes || []).filter(isDetailNote);
        if (notesDetalle.length === 0 && (work.descripcion || '').trim()) {
            notesDetalle = [{
                text: work.descripcion,
                author: 'Portal Web',
                date: work.createdAt
            }];
        }
        allNotes.push(...notesDetalle);
        if (work.mergedWorks && Array.isArray(work.mergedWorks)) {
            work.mergedWorks.forEach(mw => processWork(mw));
        }
    };
    processWork(w);
    return allNotes;
}

function renderStructuredProductRow(w, itemKey, prod, index, selectedKeysSet) {
    const name = prod.nombre || prod.name || prod.producto || 'Producto';
    const group = getProductGroupName(name);
    const colors = groupColorMap[group] || groupColorMap['Otros'];
    const qty = parseInt(prod.cantidad || prod.qty || 1, 10);
    const price = prod.precio || prod.unitPrice || prod.price || 0;
    const subtotal = prod.subtotal || (qty * price) || 0;
    const notes = prod.instrucciones || prod.notes || '';
    const cat = prod.categoria || prod.category || '';

    const isMultiQty = qty > 1;
    const isPrinted = w.printedItems && w.printedItems[itemKey];
    const isCompleted = w.completedItems && w.completedItems[itemKey];
    const isBilled = w.billedItems && w.billedItems[itemKey];
    const isChecked = selectedKeysSet.has(itemKey);
    const safeName = name.replace(/'/g, "\\'");

    const rowBg = isMultiQty 
        ? 'background: rgba(234, 179, 8, 0.28) !important; border-left: 6px solid #eab308 !important; border-bottom: 2px solid rgba(234, 179, 8, 0.6) !important;' 
        : 'border-bottom:1px solid rgba(255,255,255,0.06);';
    const textColor = isMultiQty ? '#fde047' : colors.color;

    return `
        <tr style="${rowBg} ${(isPrinted || isCompleted) ? 'opacity: 0.8;' : ''}">
            <td style="padding:6px 8px;width:30px;text-align:center;">
                <input type="checkbox" class="work-select-checkbox item-checkbox" data-work-id="${w.id}" data-item-key="${itemKey}" onchange="toggleWorkItemSelect('${w.id}', '${itemKey}')" ${isChecked ? 'checked' : ''} title="Seleccionar ítem">
            </td>
            <td style="padding:6px 8px;font-size:.85rem;color:${textColor};font-weight:${isMultiQty ? '800' : 'normal'};">${index + 1}</td>
            <td style="padding:6px 8px;font-size:.9rem;font-weight:${isMultiQty ? '800' : '500'};color:${textColor}; ${(isPrinted || isCompleted) ? 'text-decoration: line-through;' : ''}">
                ${name} ${cat ? `<span class="badge bg-secondary ms-1" style="font-size:0.65rem;">${cat}</span>` : ''}
                ${isMultiQty ? `<span class="badge" style="background:#eab308 !important; color:#000000 !important; font-weight:900; font-size:0.82rem; padding:3px 9px; border-radius:6px; box-shadow:0 0 10px rgba(234,179,8,0.7); margin-left:6px; display:inline-block; border:1px solid #ca8a04;" title="Múltiples unidades (x${qty})">⚡ x${qty} (${qty} UNIDADES)</span>` : ''}
                ${notes ? `<div style="font-size:0.75rem;color:#facc15;margin-top:2px;">📝 ${notes}</div>` : ''}
                ${isCompleted ? '<span class="badge bg-success ms-1" style="font-size:0.65rem;">✅ Terminado</span>' : ''}
                ${isBilled ? '<span class="badge bg-warning text-dark ms-1" style="font-size:0.65rem;">💰 A Cobrar</span>' : ''}
            </td>
            <td style="padding:6px 8px;font-size:.95rem;text-align:center;font-weight:${isMultiQty ? '900' : 'normal'};color:${textColor};">${qty}</td>
            <td style="padding:6px 8px;font-size:.85rem;text-align:right;color:#51CF66;">$${fmt(subtotal || price)}</td>
            <td style="padding:6px 8px;text-align:right;white-space:nowrap;">
                <div style="display:inline-flex;gap:4px;justify-content:flex-end;align-items:center;">
                    <button class="btn ${isPrinted ? 'btn-success' : 'btn-outline-info'} btn-xs" onclick="toggleItemPrinted('${w.id}', '${itemKey}')" style="padding:2px 6px;font-size:0.7rem;" title="Marcar impreso">${isPrinted ? '✅' : '🖨️'}</button>
                    <button class="btn ${isCompleted ? 'btn-success' : 'btn-outline-success'} btn-xs" onclick="toggleItemCompleted('${w.id}', '${itemKey}', '${safeName}')" style="padding:2px 6px;font-size:0.7rem;" title="Marcar terminado / Notificar">${isCompleted ? '✅' : '📲'}</button>
                    <button class="btn ${isBilled ? 'btn-warning text-dark' : 'btn-outline-warning'} btn-xs" onclick="toggleItemBilled('${w.id}', '${itemKey}', '${safeName}')" style="padding:2px 6px;font-size:0.7rem;" title="Marcar a cobrar / pagado">${isBilled ? '💳' : '💰'}</button>
                </div>
            </td>
        </tr>`;
}

function renderWebItemRow(w, itemKey, currentProd, itemIdx, selectedKeysSet) {
    const group = getProductGroupName(currentProd);
    const colors = groupColorMap[group] || groupColorMap['Otros'];

    let qtyVal = 1;
    const qtyMatch = currentProd.match(/(?:\]|\)|m²|m2|\s|^)\s*x\s*(\d+)\b/i) 
        || currentProd.match(/(?:cant:?|cantidad:?|unidades:?)\s*(\d+)/i)
        || currentProd.match(/\b([2-9]|\d{2,})\s*(?:unidades|u\b|unid)/i)
        || currentProd.match(/\bx\s*([2-9]|\d{2,})\b/i);
    if (qtyMatch) {
        qtyVal = parseInt(qtyMatch[1], 10);
    }
    const isMultiQty = qtyVal > 1;

    const isPrinted = w.printedItems && w.printedItems[itemKey];
    const isCompleted = w.completedItems && w.completedItems[itemKey];
    const isBilled = w.billedItems && w.billedItems[itemKey];
    const isChecked = selectedKeysSet.has(itemKey);

    const safeProdName = currentProd.replace(/'/g, "\\'");

    const rowBg = isMultiQty 
        ? 'background: rgba(234, 179, 8, 0.28) !important; border-left: 6px solid #eab308 !important; border-bottom: 2px solid rgba(234, 179, 8, 0.6) !important;' 
        : 'border-bottom:1px solid rgba(255,255,255,0.06);';
    const textColor = isMultiQty ? '#fde047' : colors.color;

    return `
        <tr style="${rowBg} ${(isPrinted || isCompleted) ? 'opacity: 0.8;' : ''}">
            <td style="padding:6px 8px;width:30px;text-align:center;">
                <input type="checkbox" class="work-select-checkbox item-checkbox" data-work-id="${w.id}" data-item-key="${itemKey}" onchange="toggleWorkItemSelect('${w.id}', '${itemKey}')" ${isChecked ? 'checked' : ''} title="Seleccionar producto">
            </td>
            <td style="padding:6px 8px;font-size:.9rem;font-weight:${isMultiQty ? '800' : '600'};color:${textColor}; ${(isPrinted || isCompleted) ? 'text-decoration: line-through;' : ''}">
                <span class="badge" style="background:#8b5cf6 !important; color:#ffffff !important; font-weight:800; font-size:0.7rem; padding:2px 6px; border-radius:4px; margin-right:4px;">ÍTEM #${itemIdx + 1}</span>
                ${currentProd}
                ${isMultiQty ? `<span class="badge" style="background:#eab308 !important; color:#000000 !important; font-weight:900; font-size:0.82rem; padding:3px 9px; border-radius:6px; box-shadow:0 0 10px rgba(234,179,8,0.7); margin-left:6px; display:inline-block; border:1px solid #ca8a04;" title="Múltiples unidades (x${qtyVal})">⚡ x${qtyVal} (${qtyVal} UNIDADES)</span>` : ''}
                ${isCompleted ? '<span class="badge bg-success ms-1" style="font-size:0.65rem;">✅ Terminado</span>' : ''}
                ${isBilled ? '<span class="badge bg-warning text-dark ms-1" style="font-size:0.65rem;">💰 A Cobrar</span>' : ''}
            </td>
            <td style="padding:6px 8px;text-align:right;white-space:nowrap;">
                <div style="display:inline-flex;gap:4px;justify-content:flex-end;align-items:center;">
                    <button class="btn ${isPrinted ? 'btn-success' : 'btn-outline-info'} btn-xs" onclick="toggleItemPrinted('${w.id}', '${itemKey}')" style="padding:2px 6px;font-size:0.7rem;" title="${isPrinted ? 'Impreso (click para desmarcar)' : 'Marcar impreso'}">${isPrinted ? '✅' : '🖨️'}</button>
                    <button class="btn ${isCompleted ? 'btn-success' : 'btn-outline-success'} btn-xs" onclick="toggleItemCompleted('${w.id}', '${itemKey}', '${safeProdName}')" style="padding:2px 6px;font-size:0.7rem;" title="${isCompleted ? 'Terminado (click para desmarcar)' : 'Marcar terminado / Notificar'}">${isCompleted ? '✅' : '📲'}</button>
                    <button class="btn ${isBilled ? 'btn-warning text-dark' : 'btn-outline-warning'} btn-xs" onclick="toggleItemBilled('${w.id}', '${itemKey}', '${safeProdName}')" style="padding:2px 6px;font-size:0.7rem;" title="${isBilled ? 'Pagado (click para desmarcar)' : 'Marcar a cobrar / pagado'}">${isBilled ? '💳' : '💰'}</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteWebItem('${w.id}', ${itemIdx})" style="padding:2px 6px;font-size:0.7rem;background:rgba(239, 68, 68, 0.15) !important;color:#f87171 !important;border:1px solid rgba(239, 68, 68, 0.3) !important;" title="Eliminar este producto">🗑️</button>
                </div>
            </td>
        </tr>`;
}

function renderInternalCategoryRow(w, itemKey, cat, index, catWidth, catHeight, m2, selectedKeysSet) {
    const group = getProductGroupName(cat.name);
    const colors = groupColorMap[group] || groupColorMap['Otros'];
    const qty = parseInt(cat.quantity || cat.qty || 1, 10);
    const isMultiQty = qty > 1;

    const isPrinted = w.printedItems && w.printedItems[itemKey];
    const isCompleted = w.completedItems && w.completedItems[itemKey];
    const isBilled = w.billedItems && w.billedItems[itemKey];
    const isChecked = selectedKeysSet.has(itemKey);
    const safeName = (cat.name || 'Material').replace(/'/g, "\\'");

    const rowBg = isMultiQty 
        ? 'background: rgba(234, 179, 8, 0.28) !important; border-left: 6px solid #eab308 !important; border-bottom: 2px solid rgba(234, 179, 8, 0.6) !important;' 
        : 'border-bottom:1px solid rgba(255,255,255,0.06);';
    const textColor = isMultiQty ? '#fde047' : colors.color;

    return `
        <tr style="${rowBg} ${(isPrinted || isCompleted) ? 'opacity: 0.8;' : ''}">
            <td style="padding:6px 8px;width:30px;text-align:center;">
                <input type="checkbox" class="work-select-checkbox item-checkbox" data-work-id="${w.id}" data-item-key="${itemKey}" onchange="toggleWorkItemSelect('${w.id}', '${itemKey}')" ${isChecked ? 'checked' : ''} title="Seleccionar ítem">
            </td>
            <td style="padding:6px 8px;font-size:.85rem;color:${textColor};font-weight:${isMultiQty ? '800' : 'normal'};">${index + 1}</td>
            <td style="padding:6px 8px;font-size:.9rem;font-weight:${isMultiQty ? '800' : '500'};color:${textColor}; ${(isPrinted || isCompleted) ? 'text-decoration: line-through;' : ''}">
                ${cat.name || 'Sin nombre'}
                ${isMultiQty ? `<span class="badge" style="background:#eab308 !important; color:#000000 !important; font-weight:900; font-size:0.82rem; padding:3px 9px; border-radius:6px; box-shadow:0 0 10px rgba(234,179,8,0.7); margin-left:6px; display:inline-block; border:1px solid #ca8a04;" title="Múltiples unidades (x${qty})">⚡ x${qty} (${qty} UNIDADES)</span>` : ''}
                ${isCompleted ? '<span class="badge bg-success ms-1" style="font-size:0.65rem;">✅ Terminado</span>' : ''}
                ${isBilled ? '<span class="badge bg-warning text-dark ms-1" style="font-size:0.65rem;">💰 A Cobrar</span>' : ''}
            </td>
            <td style="padding:6px 8px;font-size:.85rem;text-align:center;">${catWidth} x ${catHeight}</td>
            <td style="padding:6px 8px;font-size:.85rem;text-align:center; ${isMultiQty ? 'font-weight:900; color:#fde047; font-size:0.95rem;' : ''}">${m2.toFixed(2)}</td>
            <td style="padding:6px 8px;font-size:.85rem;text-align:right;color:#51CF66;">$${fmt(cat.totalPrice || 0)}</td>
            <td style="padding:6px 8px;text-align:right;white-space:nowrap;">
                <div style="display:inline-flex;gap:4px;justify-content:flex-end;align-items:center;">
                    <button class="btn ${isPrinted ? 'btn-success' : 'btn-outline-info'} btn-xs" onclick="toggleItemPrinted('${w.id}', '${itemKey}')" style="padding:2px 6px;font-size:0.7rem;" title="Marcar impreso">${isPrinted ? '✅' : '🖨️'}</button>
                    <button class="btn ${isCompleted ? 'btn-success' : 'btn-outline-success'} btn-xs" onclick="toggleItemCompleted('${w.id}', '${itemKey}', '${safeName}')" style="padding:2px 6px;font-size:0.7rem;" title="Marcar terminado / Notificar">${isCompleted ? '✅' : '📲'}</button>
                    <button class="btn ${isBilled ? 'btn-warning text-dark' : 'btn-outline-warning'} btn-xs" onclick="toggleItemBilled('${w.id}', '${itemKey}', '${safeName}')" style="padding:2px 6px;font-size:0.7rem;" title="Marcar a cobrar / pagado">${isBilled ? '💳' : '💰'}</button>
                </div>
            </td>
        </tr>`;
}

function renderInternalProductRow(w, itemKey, prod, index, offsetIndex, name, selectedKeysSet) {
    const group = getProductGroupName(name);
    const colors = groupColorMap[group] || groupColorMap['Otros'];
    const qty = parseInt(prod.quantity || prod.cantidad || 1, 10);
    const isMultiQty = qty > 1;

    const isPrinted = w.printedItems && w.printedItems[itemKey];
    const isCompleted = w.completedItems && w.completedItems[itemKey];
    const isBilled = w.billedItems && w.billedItems[itemKey];
    const isChecked = selectedKeysSet.has(itemKey);
    const safeName = name.replace(/'/g, "\\'");

    const rowBg = isMultiQty 
        ? 'background: rgba(234, 179, 8, 0.28) !important; border-left: 6px solid #eab308 !important; border-bottom: 2px solid rgba(234, 179, 8, 0.6) !important;' 
        : 'border-bottom:1px solid rgba(255,255,255,0.06);';
    const textColor = isMultiQty ? '#fde047' : colors.color;

    return `
        <tr style="${rowBg} ${(isPrinted || isCompleted) ? 'opacity: 0.8;' : ''}">
            <td style="padding:6px 8px;width:30px;text-align:center;">
                <input type="checkbox" class="work-select-checkbox item-checkbox" data-work-id="${w.id}" data-item-key="${itemKey}" onchange="toggleWorkItemSelect('${w.id}', '${itemKey}')" ${isChecked ? 'checked' : ''} title="Seleccionar ítem">
            </td>
            <td style="padding:6px 8px;font-size:.85rem;color:${textColor};font-weight:${isMultiQty ? '800' : 'normal'};">${offsetIndex + index + 1}</td>
            <td style="padding:6px 8px;font-size:.9rem;font-weight:${isMultiQty ? '800' : '500'};color:${textColor}; ${(isPrinted || isCompleted) ? 'text-decoration: line-through;' : ''}">
                ${name}
                ${isMultiQty ? `<span class="badge" style="background:#eab308 !important; color:#000000 !important; font-weight:900; font-size:0.82rem; padding:3px 9px; border-radius:6px; box-shadow:0 0 10px rgba(234,179,8,0.7); margin-left:6px; display:inline-block; border:1px solid #ca8a04;" title="Múltiples unidades (x${qty})">⚡ x${qty} (${qty} UNIDADES)</span>` : ''}
                ${isCompleted ? '<span class="badge bg-success ms-1" style="font-size:0.65rem;">✅ Terminado</span>' : ''}
                ${isBilled ? '<span class="badge bg-warning text-dark ms-1" style="font-size:0.65rem;">💰 A Cobrar</span>' : ''}
            </td>
            <td style="padding:6px 8px;font-size:.85rem;text-align:center;">—</td>
            <td style="padding:6px 8px;font-size:.95rem;text-align:center;font-weight:${isMultiQty ? '900' : 'normal'};color:${textColor};">${qty}</td>
            <td style="padding:6px 8px;font-size:.85rem;text-align:right;color:#51CF66;">$${fmt(prod.total || prod.price || 0)}</td>
            <td style="padding:6px 8px;text-align:right;white-space:nowrap;">
                <div style="display:inline-flex;gap:4px;justify-content:flex-end;align-items:center;">
                    <button class="btn ${isPrinted ? 'btn-success' : 'btn-outline-info'} btn-xs" onclick="toggleItemPrinted('${w.id}', '${itemKey}')" style="padding:2px 6px;font-size:0.7rem;" title="Marcar impreso">${isPrinted ? '✅' : '🖨️'}</button>
                    <button class="btn ${isCompleted ? 'btn-success' : 'btn-outline-success'} btn-xs" onclick="toggleItemCompleted('${w.id}', '${itemKey}', '${safeName}')" style="padding:2px 6px;font-size:0.7rem;" title="Marcar terminado / Notificar">${isCompleted ? '✅' : '📲'}</button>
                    <button class="btn ${isBilled ? 'btn-warning text-dark' : 'btn-outline-warning'} btn-xs" onclick="toggleItemBilled('${w.id}', '${itemKey}', '${safeName}')" style="padding:2px 6px;font-size:0.7rem;" title="Marcar a cobrar / pagado">${isBilled ? '💳' : '💰'}</button>
                </div>
            </td>
        </tr>`;
}

function generateItemsDetail(w) {
    const selectedKeysSet = selectedWorkItemsMap.get(String(w.id)) || new Set();

    // 1. Caso A: Si tiene Cotización cargada en allQuotes (o cotizaciones en mergedWorks)
    const quotesToRender = [];
    if (w.quoteId && allQuotes[w.quoteId]) {
        quotesToRender.push({ quoteId: w.quoteId, quote: allQuotes[w.quoteId], createdAt: w.createdAt, id: w.id });
    }
    if (w.mergedWorks && Array.isArray(w.mergedWorks)) {
        w.mergedWorks.forEach(mw => {
            if (mw.quoteId && allQuotes[mw.quoteId]) {
                quotesToRender.push({ quoteId: mw.quoteId, quote: allQuotes[mw.quoteId], createdAt: mw.createdAt, id: mw.id });
            }
        });
    }

    if (quotesToRender.length > 0) {
        let rows = '';
        let totalItems = 0;

        quotesToRender.forEach((qItem) => {
            const q = qItem.quote;
            const qDate = qItem.createdAt ? fmtDate(qItem.createdAt) : 'Sin fecha';
            const qIdShort = String(qItem.id).slice(-8);

            rows += `
                <tr style="background:rgba(99,102,241,0.06); border-bottom:1px solid rgba(255,255,255,0.08);">
                    <td colspan="7" style="padding:6px 8px;font-size:.8rem;color:#a5b4fc;font-weight:600;">
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
                const itemKey = `cat_${i}_${qItem.id}`;

                rows += renderInternalCategoryRow(w, itemKey, cat, i, catWidth, catHeight, m2, selectedKeysSet);
            });

            productos.forEach((prod, i) => {
                const name = prod.name || prod.nombre || 'Producto';
                const itemKey = `prod_${i}_${qItem.id}`;

                rows += renderInternalProductRow(w, itemKey, prod, i, categories.length, name, selectedKeysSet);
            });
        });

        const uniqueId = 'items_' + w.id;
        const isMultiItemInternal = totalItems > 1;
        const btnStyleInternal = isMultiItemInternal 
            ? 'background: linear-gradient(135deg, #7e22ce 0%, #a855f7 100%) !important; color: #ffffff !important; font-weight: 800; font-size: 0.88rem; border-radius: 8px; padding: 8px 12px; box-shadow: 0 4px 12px rgba(126, 34, 206, 0.5);' 
            : '';
        return `
            <div style="margin-top:.6rem;">
                <button class="btn btn-small work-items-toggle-btn type-internal" onclick="toggleItems('${uniqueId}')" style="${btnStyleInternal}">
                    <span>📦 ${isMultiItemInternal ? '⚠️ PEDIDO MULTI-ÍTEM' : 'Detalle del Pedido'} (${totalItems} ítems)</span>
                    <span>▼</span>
                </button>
                <div id="${uniqueId}" style="display:none;margin-top:.5rem;border-radius:8px;overflow:hidden;background:rgba(0,0,0,0.15);">
                    <div class="d-flex align-items-center justify-content-between p-2" style="background:rgba(99,102,241,0.08); border-bottom:1px solid rgba(99,102,241,0.2); flex-wrap:wrap; gap:6px;">
                        <div class="d-flex align-items-center gap-2">
                            <input type="checkbox" class="work-select-checkbox" onchange="toggleAllItemsInWork('${w.id}', this.checked)" title="Seleccionar todos los ítems de este pedido">
                            <span style="font-size:.75rem; color:#a5b4fc; font-weight:600;">Seleccionar todos</span>
                        </div>
                        <div class="d-flex gap-1 flex-wrap ms-auto">
                            <button class="btn btn-xs btn-success" onclick="bulkMarkWorkItemsCompleted('${w.id}')" title="Marcar seleccionados como terminados y notificar">✅ Terminados</button>
                            <button class="btn btn-xs btn-warning" onclick="bulkMarkWorkItemsBilled('${w.id}')" title="Marcar seleccionados para cobrar">💰 A Cobrar</button>
                            <button class="btn btn-xs btn-info" onclick="bulkMarkWorkItemsPrinted('${w.id}')" title="Marcar seleccionados como impresos">🖨️ Impresos</button>
                        </div>
                    </div>
                    <table class="work-items-table">
                        <thead>
                            <tr style="background:rgba(99,102,241,0.1);">
                                <th style="padding:6px 8px;font-size:.75rem;text-align:center;color:#a5b4fc;width:30px;">✓</th>
                                <th style="padding:6px 8px;font-size:.75rem;text-align:left;color:#a5b4fc;">#</th>
                                <th style="padding:6px 8px;font-size:.75rem;text-align:left;color:#a5b4fc;">Material / Producto</th>
                                <th style="padding:6px 8px;font-size:.75rem;text-align:center;color:#a5b4fc;">Medidas</th>
                                <th style="padding:6px 8px;font-size:.75rem;text-align:center;color:#a5b4fc;">M² / Cant.</th>
                                <th style="padding:6px 8px;font-size:.75rem;text-align:right;color:#a5b4fc;">Precio</th>
                                <th style="padding:6px 8px;font-size:.75rem;text-align:right;color:#a5b4fc;width:120px;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    }

    // 2. Caso B: Si tiene array estructurado de productos (w.productos o w.products)
    const prodsList = (w.productos && w.productos.length > 0) ? w.productos : ((w.products && w.products.length > 0) ? w.products : []);
    if (prodsList.length > 0) {
        let rows = '';
        prodsList.forEach((prod, i) => {
            const itemKey = `prod_${i}_${w.id}`;
            rows += renderStructuredProductRow(w, itemKey, prod, i, selectedKeysSet);
        });

        const uniqueId = 'items_' + w.id;
        const isMultiItemProds = prodsList.length > 1;
        const btnStyleProds = isMultiItemProds 
            ? 'background: linear-gradient(135deg, #7e22ce 0%, #a855f7 100%) !important; color: #ffffff !important; font-weight: 800; font-size: 0.88rem; border-radius: 8px; padding: 8px 12px; box-shadow: 0 4px 12px rgba(126, 34, 206, 0.5);' 
            : '';
        return `
            <div style="margin-top:.6rem;">
                <button class="btn btn-small work-items-toggle-btn type-internal" onclick="toggleItems('${uniqueId}')" style="${btnStyleProds}">
                    <span>📦 ${isMultiItemProds ? '⚠️ PEDIDO MULTI-ÍTEM' : 'Productos del Pedido'} (${prodsList.length} ítems)</span>
                    <span>▼</span>
                </button>
                <div id="${uniqueId}" style="display:none;margin-top:.5rem;border-radius:8px;overflow:hidden;background:rgba(0,0,0,0.15);">
                    <div class="d-flex align-items-center justify-content-between p-2" style="background:rgba(99,102,241,0.08); border-bottom:1px solid rgba(99,102,241,0.2); flex-wrap:wrap; gap:6px;">
                        <div class="d-flex align-items-center gap-2">
                            <input type="checkbox" class="work-select-checkbox" onchange="toggleAllItemsInWork('${w.id}', this.checked)" title="Seleccionar todos los ítems de este pedido">
                            <span style="font-size:.75rem; color:#a5b4fc; font-weight:600;">Seleccionar todos</span>
                        </div>
                        <div class="d-flex gap-1 flex-wrap ms-auto">
                            <button class="btn btn-xs btn-success" onclick="bulkMarkWorkItemsCompleted('${w.id}')" title="Marcar seleccionados como terminados y notificar">✅ Terminados</button>
                            <button class="btn btn-xs btn-warning" onclick="bulkMarkWorkItemsBilled('${w.id}')" title="Marcar seleccionados para cobrar">💰 A Cobrar</button>
                            <button class="btn btn-xs btn-info" onclick="bulkMarkWorkItemsPrinted('${w.id}')" title="Marcar seleccionados como impresos">🖨️ Impresos</button>
                        </div>
                    </div>
                    <table class="work-items-table">
                        <thead>
                            <tr style="background:rgba(99,102,241,0.1);">
                                <th style="padding:6px 8px;font-size:.75rem;text-align:center;color:#a5b4fc;width:30px;">✓</th>
                                <th style="padding:6px 8px;font-size:.75rem;text-align:left;color:#a5b4fc;">#</th>
                                <th style="padding:6px 8px;font-size:.75rem;text-align:left;color:#a5b4fc;">Detalle / Producto</th>
                                <th style="padding:6px 8px;font-size:.75rem;text-align:center;color:#a5b4fc;">Cant.</th>
                                <th style="padding:6px 8px;font-size:.75rem;text-align:right;color:#a5b4fc;">Precio</th>
                                <th style="padding:6px 8px;font-size:.75rem;text-align:right;color:#a5b4fc;width:120px;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    }

    // 3. Caso C: Pedido web / notas de detalle / descripción
    const notesDetalle = getAllDetailNotes(w);
    if (notesDetalle.length > 0) {
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
            
            const textToParse = (note.text || '').replace(/\\n/g, '\n');
            const rawLines = textToParse.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            
            const lines = [];
            rawLines.forEach(rl => {
                let clean = rl.replace(/^Detalle:\s*/i, '');
                const splits = clean.split(/(?=(?:ITEM|PRODUCTO|P#)\s*\d+:?)/i).map(s => s.trim()).filter(Boolean);
                lines.push(...splits);
            });

            const driveUrls = new Set();

            lines.forEach(linea => {
                let l = linea.trim();
                if (!l) return;

                const driveMatches = l.match(/(https?:\/\/[^\s]*drive\.google\.com[^\s]*)/gi);
                if (driveMatches) {
                    driveMatches.forEach(url => driveUrls.add(url.replace(/[,\);]+$/, '')));
                }

                let lineClean = l.replace(/(https?:\/\/[^\s]*drive\.google\.com[^\s]*)/gi, '').replace(/Link a Drive:\s*/gi, '').trim();

                if (!lineClean) return;

                if (/^(PRODUCTO|ITEM|P#|item|producto)\s*\d*:?/i.test(lineClean) || /^P\d+:?/i.test(lineClean)) {
                    prodIndex++;
                    const currentProd = lineClean.replace(/^(PRODUCTO|ITEM|P#|item|producto)\s*\d*:?\s*/i, '').replace(/^P\d+:?\s*/i, '').trim() || lineClean;
                    const itemKey = `item_${prodIndex - 1}_${noteIdx}`;
                    rows += renderWebItemRow(w, itemKey, currentProd, prodIndex - 1, selectedKeysSet);
                } else if (lineClean.toUpperCase().startsWith('MEDIDAS') || (lineClean.includes('x') && (lineClean.includes('cm') || lineClean.includes('m²')))) {
                    rows += `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                            <td></td>
                            <td style="padding:4px 8px;font-size:.8rem;color:#888;" colspan="2">📐 ${lineClean}</td>
                        </tr>`;
                } else if (/^(NOTA|INSTRUCCIONES|INDICACIONES|OBSERVACIONES|COMENTARIOS?):?/i.test(lineClean)) {
                    const instText = lineClean.replace(/^(NOTA|INSTRUCCIONES|INDICACIONES|OBSERVACIONES|COMENTARIOS?):?\s*/i, '').trim();
                    if (instText && !instText.toLowerCase().includes('sin nota')) {
                        rows += `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.04); background:rgba(255,215,0,0.03);">
                                </td>
                                <td style="padding:5px 8px;font-size:.82rem;color:#ffd700;" colspan="2">📝 <strong>Instrucciones:</strong> ${instText}</td>
                            </tr>`;
                    }
                } else if (lineClean.toUpperCase().startsWith('SUBTOTAL')) {
                    rows += `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                            <td></td>
                            <td style="padding:4px 8px;font-size:.8rem;color:#51CF66;font-weight:bold;" colspan="2">💰 ${lineClean}</td>
                        </tr>`;
                } else if (lineClean.length > 2 && !lineClean.toLowerCase().startsWith('detalle del pedido')) {
                    if (prodIndex === 0 && !lineClean.toLowerCase().startsWith('link')) {
                        prodIndex++;
                        const itemKey = `item_${prodIndex - 1}_${noteIdx}`;
                        rows += renderWebItemRow(w, itemKey, lineClean, prodIndex - 1, selectedKeysSet);
                    } else {
                        rows += `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                                <td></td>
                                <td style="padding:4px 8px;font-size:.8rem;color:#d1d5db;" colspan="2">ℹ️ ${lineClean}</td>
                            </tr>`;
                    }
                }
            });

            driveUrls.forEach(url => {
                const folderId = getFolderIdFromUrl(url) || 'unknown';
                rows += `
                    <tr style="border-top:1px solid rgba(255,255,255,0.08); background:rgba(79, 172, 254, 0.06);">
                        <td></td>
                        <td style="padding:8px;" colspan="2">
                            <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                                <a href="${url}" target="_blank" class="btn btn-sm" style="background:#3b82f6; color:#fff; font-size:.8rem; font-weight:600; padding:4px 12px; border-radius:6px; text-decoration:none; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 4px rgba(0,0,0,0.2);">
                                    📁 Abrir archivos en Google Drive ↗
                                </a>
                            </div>
                            <div id="drive_previews_${w.id}_${folderId}" class="drive-previews-container" data-work-id="${w.id}" data-folder-id="${folderId}" style="margin-top: 0.6rem; display: flex; gap: 0.6rem; flex-wrap: wrap;"></div>
                        </td>
                    </tr>`;
            });
        });

        if (rows) {
            const uniqueId = 'items_' + w.id;
            return `
                <div style="margin-top:.6rem;">
                    <button class="btn btn-small work-items-toggle-btn type-web" onclick="toggleItems('${uniqueId}')">
                        <span>🌐 Detalle del Pedido Web (${prodIndex} producto${prodIndex !== 1 ? 's' : ''})</span>
                        <span>▼</span>
                    </button>
                    <div id="${uniqueId}" style="display:none;margin-top:.5rem;border-radius:8px;overflow:hidden;background:rgba(0,0,0,0.15);">
                        <div class="d-flex align-items-center justify-content-between p-2" style="background:rgba(255,215,0,0.05); border-bottom:1px solid rgba(255,215,0,0.15); flex-wrap:wrap; gap:6px;">
                            <div class="d-flex align-items-center gap-2">
                                <input type="checkbox" class="work-select-checkbox" onchange="toggleAllItemsInWork('${w.id}', this.checked)" title="Seleccionar todos los ítems de este pedido">
                                <span style="font-size:.75rem; color:#ffd700; font-weight:600;">Seleccionar todos</span>
                            </div>
                            <div class="d-flex gap-1 flex-wrap ms-auto">
                                <button class="btn btn-xs btn-success" onclick="bulkMarkWorkItemsCompleted('${w.id}')" title="Marcar seleccionados como terminados y notificar">✅ Terminados</button>
                                <button class="btn btn-xs btn-warning" onclick="bulkMarkWorkItemsBilled('${w.id}')" title="Marcar seleccionados para cobrar">💰 A Cobrar</button>
                                <button class="btn btn-xs btn-info" onclick="bulkMarkWorkItemsPrinted('${w.id}')" title="Marcar seleccionados como impresos">🖨️ Impresos</button>
                            </div>
                        </div>
                        <table class="work-items-table">
                            <thead>
                                <tr style="background:rgba(255,215,0,0.08);">
                                    <th style="padding:6px 8px;font-size:.75rem;text-align:center;color:#ffd700;width:30px;">✓</th>
                                    <th style="padding:6px 8px;font-size:.75rem;text-align:left;color:#ffd700;">Detalle</th>
                                    <th style="padding:6px 8px;font-size:.75rem;text-align:right;color:#ffd700;width:120px;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>`;
        }
    }

    return '';
}

// ==================== ACCIONES POR TRABAJO ====================
async function deleteWork(id) {
    const work = allWorks.find(w => String(w.id) === String(id));
    if (!work) { 
        alert('❌ Error: Trabajo no encontrado en la lista actual.'); 
        return; 
    }

    const mergedCount = (work.mergedWorks || []).length;
    let confirmMsg = `¿Eliminar el trabajo de ${work.clientName}?\n\n` +
        `Total: $${fmt(work.total)} | Estado: ${getStatusLabel(work.status)}`;
    if (mergedCount > 0) {
        confirmMsg += `\n\n⚠️ Este pedido tiene ${mergedCount} trabajo(s) unificado(s) que también se eliminarán.`;
    }
    confirmMsg += `\n\n🗑️ Esta acción borrará el trabajo del sistema, lo eliminará de la planilla de Google Sheets y enviará sus archivos de Google Drive a la papelera.\n\n¿Continuar?`;
    if (!confirm(confirmMsg)) return;

    selfSaveCooldown = Date.now() + 3000;
    allWorks = allWorks.filter(w => String(w.id) !== String(id));
    renderWorks();
    updateStatistics();
    updateMaterialAndProductWidgets();

    try {
        const res = await window.mrDataManager.request(`/api/trabajos/${id}`, 'DELETE');
    } catch (e) {
        console.error('[TRABAJOS] Error al eliminar:', e);
        // Revertir en la UI si falla el borrado en el servidor
        allWorks.push(work);
        renderWorks();
        alert('❌ Error al eliminar en servidor: ' + e.message);
    }
}

async function changeStatus(id) {
    const w = allWorks.find(x => String(x.id) === String(id));
    if (!w) return;

    let newStatus = null;
    if (window.PremiumDialog && typeof window.PremiumDialog.select === 'function') {
        newStatus = await window.PremiumDialog.select(
            'Cambiar Estado del Trabajo', 
            `Cliente: ${w.clientName || 'Sin nombre'} (Estado actual: ${getStatusLabel(w.status)})`, 
            [
                { value: 'pending', label: '⏳ Pendiente', colorClass: 'btn-warning' },
                { value: 'in_progress', label: '🔧 En Proceso', colorClass: 'btn-info' },
                { value: 'completed', label: '✅ Completado (Listo para retirar)', colorClass: 'btn-success' },
                { value: 'cancelled', label: '❌ Cancelar Pedido (Eliminar de planilla y archivos)', colorClass: 'btn-danger' }
            ]
        );
    } else {
        const statuses = ['pending', 'in_progress', 'completed', 'cancelled'];
        const idx = statuses.indexOf(w.status);
        newStatus = statuses[(idx + 1) % statuses.length];
    }

    if (!newStatus || newStatus === w.status) return;

    // Si el usuario cancela el pedido, confirmar y eliminar de todo el flujo
    if (newStatus === 'cancelled') {
        if (confirm(`¿Confirmás cancelar el pedido de ${w.clientName || 'Cliente'}?\n\nEsta acción borrará el trabajo del sistema, lo eliminará de la planilla de Google Sheets y enviará los archivos de Google Drive a la papelera.`)) {
            await deleteWork(id);
        }
        return;
    }

    let notifyWhatsApp = true;
    if (newStatus === 'completed') {
        if (window.PremiumDialog && typeof window.PremiumDialog.select === 'function') {
            const choice = await window.PremiumDialog.select(
                'Notificación de WhatsApp',
                `El trabajo de ${w.clientName || 'Cliente'} se marcará como COMPLETADO. ¿Deseás enviar el aviso de listo por WhatsApp?`,
                [
                    { value: 'send', label: '📲 Sí, enviar mensaje de WhatsApp', colorClass: 'btn-success' },
                    { value: 'dont_send', label: '🔕 No, solo cambiar estado', colorClass: 'btn-secondary' }
                ]
            );
            if (choice === null) return; // Si cancela, no cambia el estado
            notifyWhatsApp = (choice === 'send');
        } else {
            notifyWhatsApp = confirm(`¿Enviar notificación de WhatsApp a ${w.clientName || 'el cliente'} informando que el trabajo está listo?`);
        }
    }

    // Actualización inmediata en UI
    w.status = newStatus;
    if (newStatus === 'completed') {
        w.completedAt = new Date().toISOString();
    }
    renderWorks();
    updateStatistics();
    updateMaterialAndProductWidgets();

    // Sincronización en servidor
    try {
        let success = false;
        try {
            const res = await window.mrDataManager.request(`/api/trabajos/${id}`, 'PUT', { 
                status: newStatus, 
                completedAt: w.completedAt,
                notifyWhatsApp: notifyWhatsApp
            });
            if (res && res.success) success = true;
        } catch (e) {
            console.warn('[TRABAJOS] PUT falló, sincronizando con POST:', e);
        }

        if (!success) {
            await saveWorks();
        }

        if (newStatus === 'completed') {
            if (notifyWhatsApp) {
                alert('✅ Estado actualizado a COMPLETADO.\\n📲 Se envió la notificación de WhatsApp al cliente.');
            } else {
                alert('✅ Estado actualizado a COMPLETADO.\\n🔕 No se envió mensaje de WhatsApp.');
            }
        }
    } catch (e) {
        console.error('[TRABAJOS] Error guardando estado:', e);
    }
}

async function sendPaymentReminder(id) {
    const work = allWorks.find(w => String(w.id) === String(id));
    if (!work) return;

    const confirmMsg = `¿Enviar recordatorio de pago por WhatsApp a ${work.clientName || 'Cliente'}?\\n\\n` +
        `Saldo pendiente: $${fmt(work.balance)} (Total: $${fmt(work.total)})`;
    if (!confirm(confirmMsg)) return;

    try {
        const res = await window.mrDataManager.request(`/api/trabajos/${id}/reenviar-recordatorio-pago`, 'POST');
        if (res?.success) {
            alert(`📲 Recordatorio de pago enviado exitosamente a ${work.clientName || 'Cliente'}.`);
        } else {
            alert(`⚠️ ${res?.message || res?.error || 'Error al enviar el recordatorio'}`);
        }
    } catch (e) {
        console.error('[TRABAJOS] Error enviando recordatorio:', e);
        alert('❌ Error al conectar con el servidor.');
    }
}

async function resendReadyMessage(id) {
    const work = allWorks.find(w => String(w.id) === String(id));
    if (!work) return;

    try {
        const res = await window.mrDataManager.request(`/api/trabajos/${id}/reenviar-listo`, 'POST');
        if (res?.success) {
            alert(`📲 Mensaje de trabajo terminado enviado a ${work.clientName}.`);
        } else {
            alert(`⚠️ Error enviando mensaje: ${res?.error || 'Verifique conexión WhatsApp'}`);
        }
    } catch (e) {
        alert('❌ Error de red enviando mensaje de WhatsApp.');
    }
}

async function resendConfirmMessage(id) {
    const work = allWorks.find(w => String(w.id) === String(id));
    if (!work) return;

    try {
        const res = await window.mrDataManager.request(`/api/trabajos/${id}/reenviar-confirmacion`, 'POST');
        if (res?.success) {
            alert(`📲 Notificación de recepción enviada a ${work.clientName}.`);
        } else {
            alert(`⚠️ Error enviando notificación: ${res?.error || 'Verifique conexión WhatsApp'}`);
        }
    } catch (e) {
        alert('❌ Error de red enviando notificación.');
    }
}

async function markPaid(id) {
    const w = allWorks.find(x => String(x.id) === String(id));
    if (!w) return;

    let amountStr = null;
    if (window.PremiumDialog && typeof window.PremiumDialog.text === 'function') {
        amountStr = await window.PremiumDialog.text('Monto del pago ($):', w.balance, 'number');
    } else {
        amountStr = prompt('Monto del pago ($):', w.balance);
    }

    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    w.paidAmount = (parseFloat(w.paidAmount) || 0) + amount;
    w.balance = Math.max(0, w.total - w.paidAmount);
    w.paymentStatus = w.balance <= 1 ? 'paid' : 'pending';

    if (!w.timeline) w.timeline = [];
    w.timeline.push({ 
        type: 'payment', 
        description: `Pago: $${fmt(amount)}. Saldo: $${fmt(w.balance)}`, 
        timestamp: new Date().toISOString() 
    });

    renderWorks();
    updateStatistics();

    try {
        let success = false;
        try {
            const res = await window.mrDataManager.request(`/api/trabajos/${id}`, 'PUT', { 
                paidAmount: w.paidAmount, 
                balance: w.balance, 
                paymentStatus: w.paymentStatus,
                timeline: w.timeline 
            });
            if (res && res.success) success = true;
        } catch (e) {}

        if (!success) {
            await saveWorks();
        }
    } catch (e) {
        console.error('[TRABAJOS] Error guardando pago:', e);
    }
}

async function changePriority(id) {
    const w = allWorks.find(x => String(x.id) === String(id));
    if (!w) return;

    let priority = null;
    if (window.PremiumDialog && typeof window.PremiumDialog.select === 'function') {
        priority = await window.PremiumDialog.select(
            'Cambiar Prioridad del Trabajo',
            `Prioridad actual: ${w.priority || 'normal'}`,
            [
                { value: 'normal', label: '🟡 Normal', colorClass: 'btn-info' },
                { value: 'high', label: '🟠 Alta', colorClass: 'btn-warning' },
                { value: 'urgent', label: '🔴 Urgente', colorClass: 'btn-danger' }
            ]
        );
    } else {
        const priorities = ['normal', 'high', 'urgent'];
        const currentIdx = priorities.indexOf(w.priority || 'normal');
        priority = priorities[(currentIdx + 1) % priorities.length];
    }

    if (!priority || priority === w.priority) return;
    w.priority = priority;

    renderWorks();

    try {
        let success = false;
        try {
            const res = await window.mrDataManager.request(`/api/trabajos/${id}`, 'PUT', { priority: w.priority });
            if (res && res.success) success = true;
        } catch (e) {}

        if (!success) {
            await saveWorks();
        }
    } catch (e) {
        console.error('[TRABAJOS] Error guardando prioridad:', e);
    }
}

async function markDelivered(id) {
    const w = allWorks.find(x => String(x.id) === String(id));
    if (!w) return;

    if (!confirm(`¿Marcar el trabajo de ${w.clientName} como ENTREGADO?\\nSe ocultará de la lista activa.`)) return;

    w.deliveryStatus = 'delivered';
    w.deliveredAt = new Date().toISOString();

    if (!w.timeline) w.timeline = [];
    w.timeline.push({ 
        type: 'delivery', 
        description: 'Trabajo marcado como ENTREGADO', 
        timestamp: new Date().toISOString() 
    });

    renderWorks();
    updateStatistics();
    updateMaterialAndProductWidgets();

    try {
        let success = false;
        try {
            const res = await window.mrDataManager.request(`/api/trabajos/${id}`, 'PUT', { 
                deliveryStatus: 'delivered', 
                actualDeliveryDate: w.deliveredAt, 
                timeline: w.timeline 
            });
            if (res && res.success) success = true;
        } catch (e) {}

        if (!success) {
            await saveWorks();
        }
    } catch (e) {
        console.error('[TRABAJOS] Error guardando entrega:', e);
    }
}

async function addNote(id) {
    const w = allWorks.find(x => String(x.id) === String(id));
    if (!w) return;

    let text = null;
    if (window.PremiumDialog && typeof window.PremiumDialog.text === 'function') {
        text = await window.PremiumDialog.text(`Agregar nota para ${w.clientName}:`);
    } else {
        text = prompt(`Agregar nota para ${w.clientName}:`);
    }

    if (!text || !text.trim()) return;

    if (!w.notes) w.notes = [];
    w.notes.push({
        text: text.trim(),
        author: 'Usuario',
        date: new Date().toISOString()
    });

    renderWorks();

    try {
        let success = false;
        try {
            const res = await window.mrDataManager.request(`/api/trabajos/${id}`, 'PUT', { notes: w.notes });
            if (res && res.success) success = true;
        } catch (e) {}

        if (!success) {
            await saveWorks();
        }
    } catch (e) {
        console.error('[TRABAJOS] Error guardando nota:', e);
    }
}

async function togglePrinted(id) {
    const work = allWorks.find(w => String(w.id) === String(id));
    if (!work) return;

    work.printed = !work.printed;
    renderWorks();
    updateMaterialAndProductWidgets();

    try {
        let success = false;
        try {
            const res = await window.mrDataManager.request(`/api/trabajos/${id}`, 'PUT', { printed: work.printed });
            if (res && res.success) success = true;
        } catch (e) {}

        if (!success) {
            await saveWorks();
        }
    } catch (e) {
        console.error('[TRABAJOS] Error guardando impreso:', e);
    }
}

// ==================== UNIFICACIÓN DE PEDIDOS (MERGE RESTRINGIDO) ====================
function cleanPhoneStr(p) {
    if (!p) return '';
    let str = p.toString().replace(/\D/g, '');
    if (str.startsWith('549')) str = str.substring(3);
    else if (str.startsWith('54')) str = str.substring(2);
    if (str.startsWith('0')) str = str.substring(1);
    if (str.length >= 10 && str.substring(2, 4) === '15') {
        str = str.substring(0, 2) + str.substring(4);
    }
    return str;
}

function isSameClientOrPhone(w1, w2) {
    const getClientName = (w) => (w.clientName || w.gremio || w.cliente_nombre || w.nombre || w.name || '').trim().toLowerCase();
    const getClientPhone = (w) => cleanPhoneStr(w.clientPhone || w.whatsapp || w.cliente_telefono || w.telefono || w.phone);

    const name1 = getClientName(w1);
    const name2 = getClientName(w2);
    
    // 1. Coincidencia por Nombre de Cliente
    if (name1 && name2) {
        if (name1 === name2) return true;
        const cleanName1 = name1.replace(/\(gremio\)|gremio|cliente|público|publico/gi, '').trim();
        const cleanName2 = name2.replace(/\(gremio\)|gremio|cliente|público|publico/gi, '').trim();
        if (cleanName1.length >= 3 && cleanName2.length >= 3) {
            if (cleanName1 === cleanName2 || cleanName1.includes(cleanName2) || cleanName2.includes(cleanName1)) {
                return true;
            }
        }
    }

    // 2. Coincidencia por Número de WhatsApp (últimos 7 dígitos, sin includes laxos)
    const phone1 = getClientPhone(w1);
    const phone2 = getClientPhone(w2);

    if (phone1 && phone2 && phone1.length >= 7 && phone2.length >= 7) {
        if (phone1.slice(-7) === phone2.slice(-7)) {
            return true;
        }
    }

    return false;
}

async function mergeWork(id) {
    const sourceWork = allWorks.find(w => String(w.id) === String(id));
    if (!sourceWork) return;

    // No permitir unificar un pedido que ya está unificado (evita anidamiento de mergedWorks)
    if (sourceWork.mergedWorks && sourceWork.mergedWorks.length > 0) {
        alert('⚠️ Este pedido ya está unificado. Desunificalo primero para poder unirlo a otro.');
        return;
    }

    const otherWorks = allWorks.filter(w => 
        String(w.id) !== String(id) && 
        w.deliveryStatus !== 'delivered' &&
        isSameClientOrPhone(sourceWork, w)
    );

    if (otherWorks.length === 0) {
        alert(`⚠️ No se encontraron otros trabajos activos del mismo cliente (${sourceWork.clientName || 'Cliente'}) o teléfono para unificar.`);
        return;
    }

    let targetId = null;
    if (window.PremiumDialog && typeof window.PremiumDialog.select === 'function') {
        const choices = otherWorks.map(w => {
            const desc = (w.descripcion || 'Sin detalle').replace(/\s+/g, ' ').trim();
            const descShort = desc.length > 30 ? desc.substring(0, 30) + '...' : desc;
            const client = w.clientName || w.gremio || 'Cliente';
            return {
                value: String(w.id),
                label: `${client} — ${descShort} | Total: $${fmt(w.total)} (${getStatusLabel(w.status)})`,
                colorClass: 'btn-primary'
            };
        });
        targetId = await window.PremiumDialog.select(
            'Unificar Pedidos del Mismo Cliente',
            `Seleccioná el trabajo de ${sourceWork.clientName || 'Cliente'} con el cual querés unificar este pedido:`,
            choices
        );
    } else {
        const options = otherWorks.map(w => {
            const desc = (w.descripcion || 'Sin detalle').replace(/\s+/g, ' ').trim();
            const descShort = desc.length > 25 ? desc.substring(0, 25) + '...' : desc;
            const client = w.clientName || w.gremio || 'Cliente';
            return `${client} (${descShort}) - Total: $${fmt(w.total)} (${getStatusLabel(w.status)}) [ID: #${String(w.id).slice(-6)}]`;
        }).join('\n');
        const targetIdInput = prompt(`Ingresá el trabajo para unificar con ${sourceWork.clientName || 'Cliente'}:\n\n${options}`);
        if (targetIdInput) targetId = targetIdInput.trim();
    }

    if (!targetId) return;

    const targetWork = allWorks.find(w => String(w.id) === String(targetId));
    if (!targetWork) {
        alert('❌ Trabajo destino no encontrado.');
        return;
    }

    // Capturar los totales propios ANTES de modificar la estructura
    const targetBase = Number(targetWork.total || 0);
    const sourceTotal = Number(sourceWork.total || 0);

    if (!targetWork.mergedWorks) targetWork.mergedWorks = [];
    targetWork.mergedWorks.push(sourceWork);
    targetWork.paidAmount = (targetWork.paidAmount || 0) + (sourceWork.paidAmount || 0);

    // Unificar costos de materiales y terceros
    if (!targetWork.costos) targetWork.costos = { materiales: {}, terceros: {} };
    if (!targetWork.costos.materiales) targetWork.costos.materiales = {};
    if (!targetWork.costos.terceros) targetWork.costos.terceros = {};

    if (sourceWork.costos) {
        if (sourceWork.costos.materiales) {
            for (const [mat, val] of Object.entries(sourceWork.costos.materiales)) {
                targetWork.costos.materiales[mat] = Number(((parseFloat(targetWork.costos.materiales[mat]) || 0) + (parseFloat(val) || 0)).toFixed(2));
            }
        }
        if (sourceWork.costos.terceros) {
            for (const [terc, val] of Object.entries(sourceWork.costos.terceros)) {
                targetWork.costos.terceros[terc] = Number(((parseFloat(targetWork.costos.terceros[terc]) || 0) + (parseFloat(val) || 0)).toFixed(2));
            }
        }
    }

    allWorks = allWorks.filter(w => String(w.id) !== String(id));

    // Fijar el total unificado explícitamente para que recalculateWorkTotal sea idempotente
    targetWork.total = Number((targetBase + sourceTotal).toFixed(2));
    recalculateWorkTotal(targetWork);

    renderWorks();
    updateStatistics();
    await saveWorks();
    alert(`🔗 Trabajos unificados correctamente en #${targetWork.id}.`);
}

function parseArgentinePrice(str) {
    if (str === null || str === undefined) return 0;
    let s = str.toString().replace(/[^\d\.,]/g, '').trim();
    if (!s) return 0;

    if (s.includes('.') && s.includes(',')) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            s = s.replace(/,/g, '');
        }
    } else if (s.includes(',') || s.includes('.')) {
        if (/[\.,]\d{3}$/.test(s)) {
            s = s.replace(/[\.,]/g, '');
        } else {
            s = s.replace(',', '.');
        }
    }

    const val = parseFloat(s);
    return isNaN(val) ? 0 : val;
}

// Devuelve el total parseado desde cotización/notas/descripción, o null si no hay items parseables.
function parseItemsTotal(w) {
    if (!w) return null;
    let itemsSum = 0;
    let hasParsedPrice = false;

    if (w.quoteId && allQuotes[w.quoteId]) {
        const q = allQuotes[w.quoteId];
        (q.multiCategories?.categories || []).forEach(c => {
            itemsSum += Number(c.totalPrice || 0);
            hasParsedPrice = true;
        });
        (q.productos || []).forEach(p => {
            itemsSum += Number(p.total || p.price || 0);
            hasParsedPrice = true;
        });
    }

    const textToParse = (w.notes || []).map(n => n.text || '').join('\n') || (w.descripcion || '');
    if (textToParse) {
        const rawLines = textToParse.replace(/\\n/g, '\n').split(/\r?\n/);
        rawLines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.toLowerCase().startsWith('link') || trimmed.toLowerCase().startsWith('nota') || trimmed.toLowerCase().startsWith('instrucciones')) return;
            
            const cleanLine = trimmed.replace(/^(?:ITEM\s*\d+|P#\d+|PRODUCTO\s*\d+|P\d+)\s*:\s*/i, '').replace(/^Detalle:\s*/i, '');
            const match = cleanLine.match(/^(.*?)\s*-\s*\$?\s*([\d\.,]+)\s*$/i) || cleanLine.match(/^(.*?)\s*\(\$?\s*([\d\.,]+)\)\s*$/i);
            if (match) {
                const priceNum = parseArgentinePrice(match[2]);
                if (priceNum > 0) {
                    itemsSum += priceNum;
                    hasParsedPrice = true;
                }
            }
        });
    }

    return (hasParsedPrice && itemsSum > 0) ? itemsSum : null;
}

function calcSingleWorkCost(w) {
    let costSum = 0;
    let hasCost = false;

    if (w.costos) {
        if (w.costos.materiales) {
            Object.values(w.costos.materiales).forEach(v => {
                const num = parseFloat(v) || 0;
                if (num > 0) { costSum += num; hasCost = true; }
            });
        }
        if (w.costos.terceros) {
            Object.values(w.costos.terceros).forEach(v => {
                const num = parseFloat(v) || 0;
                if (num > 0) { costSum += num; hasCost = true; }
            });
        }
    }

    if (hasCost) return costSum;
    if (w.totalCost !== undefined && w.totalCost !== null) {
        const tc = parseFloat(w.totalCost);
        if (!isNaN(tc) && tc > 0) return tc;
    }
    if (w.total_cost !== undefined && w.total_cost !== null) {
        const tc = parseFloat(w.total_cost);
        if (!isNaN(tc) && tc > 0) return tc;
    }
    if (w.quoteId && allQuotes[w.quoteId]) {
        const q = allQuotes[w.quoteId];
        if (q.costoTotal || q.totalCost) return parseFloat(q.costoTotal || q.totalCost) || 0;
    }
    return 0;
}

function recalculateWorkTotal(work) {
    if (!work) return;

    const mws = (Array.isArray(work.mergedWorks) ? work.mergedWorks : []);
    const mergedSum = mws.reduce((s, mw) => s + (Number(mw.total) || 0), 0);

    // Total propio del trabajo base (sin contar mergedWorks)
    let baseTotal;
    const parsedBase = parseItemsTotal(work);
    if (parsedBase !== null) {
        baseTotal = parsedBase;
    } else if (mws.length > 0) {
        // work.total ya incluye la suma de mergedWorks → restar para obtener la base
        baseTotal = Math.max(0, (Number(work.total) || 0) - mergedSum);
    } else {
        baseTotal = Number(work.total || 0);
    }

    const newTotal = baseTotal + mergedSum;
    if (newTotal > 0) {
        work.total = Number(newTotal.toFixed(2));
    }

    // El costo ya está unificado en work.costos (mergeWork suma los costos del source),
    // así que calcSingleWorkCost(work) ya incluye el costo total. NO sumar mergedWorks de nuevo.
    work.totalCost = Number(calcSingleWorkCost(work).toFixed(2));
    work.profit = Number(((work.total || 0) - (work.totalCost || 0)).toFixed(2));
    work.balance = Math.max(0, Number(((work.total || 0) - (work.paidAmount || 0)).toFixed(2)));
}

// Abre un selector para elegir QUÉ pedidos unificados se separan (desunificación selectiva).
// Resuelve con el array de mergedWorks elegidos, o null si cancela.
function openUnmergeSelector(work) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:1rem;font-family:\'Segoe UI\',sans-serif;';
        const panel = document.createElement('div');
        panel.style.cssText = 'background:#111827;border:1px solid rgba(255,215,0,.35);border-radius:16px;width:100%;max-width:560px;max-height:82vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 25px 80px rgba(0,0,0,.7);color:#e5e7eb;';

        const close = (val) => { document.body.removeChild(overlay); resolve(val); };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });

        const mws = work.mergedWorks || [];
        const descCorta = (t) => { t = (t || '').replace(/\s+/g, ' ').trim(); return t.length > 60 ? t.substring(0, 60) + '…' : t; };

        let head = `
            <div style="padding:1rem 1.25rem;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <div>
                    <b style="color:#ffd700;font-size:1.05rem;">🔓 Desunificar pedidos</b>
                    <div style="font-size:.75rem;color:#94a3b8;margin-top:2px;">Pedido principal: ${escapeHtml(work.clientName || 'Cliente')} · Total: $${fmt(work.total)}</div>
                </div>
                <button data-unm-close style="background:none;border:none;color:#94a3b8;font-size:1.3rem;cursor:pointer;line-height:1;">✕</button>
            </div>`;

        let list = mws.map((mw, i) => {
            const pago = Number(mw.paidAmount) || 0;
            const badge = (mw.total || 0) > 0 ? `$ ${fmt(mw.total)}${pago > 0 ? ' · Pagado $' + fmt(pago) : ''}` : 'Sin total';
            return `
                <label style="display:flex;gap:10px;padding:10px 12px;margin:0 12px 8px;border:1px solid rgba(255,255,255,.1);border-radius:10px;cursor:pointer;align-items:flex-start;background:rgba(255,255,255,.02);">
                    <input type="checkbox" data-unm-idx="${i}" style="margin-top:5px;width:17px;height:17px;accent-color:#ffd700;">
                    <span style="flex:1;min-width:0;">
                        <span style="display:block;font-weight:700;font-size:.85rem;color:#f1f5f9;">${escapeHtml(mw.clientName || ('Pedido ' + String(mw.id || '').slice(-6)))}</span>
                        <span style="display:block;font-size:.78rem;color:#94a3b8;">${escapeHtml(descCorta(mw.descripcion || '')) || 'Sin detalle'}</span>
                        <span style="display:block;font-size:.72rem;color:#ffd700;margin-top:3px;">${badge}</span>
                    </span>
                </label>`;
        }).join('');

        let body = `
            <div style="padding:1rem 0.5rem 0.25rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0 8px 8px;flex-wrap:wrap;gap:6px;">
                    <label style="font-size:.78rem;color:#cbd5e1;cursor:pointer;display:flex;align-items:center;gap:6px;">
                        <input type="checkbox" data-unm-all style="accent-color:#ffd700;"> Seleccionar todos
                    </label>
                    <span style="font-size:.75rem;color:#94a3b8;">Marcá qué pedidos querés sacar de la unión (vuelven como trabajos aparte).</span>
                </div>
                <div style="overflow-y:auto;max-height:46vh;">${list}</div>
            </div>`;

        let foot = `
            <div style="padding:12px 16px;border-top:1px solid rgba(255,255,255,.08);display:flex;gap:8px;align-items:center;">
                <button data-unm-cancel style="flex:1;padding:11px;border-radius:10px;border:1px solid #334155;background:transparent;color:#cbd5e1;font-weight:800;font-size:.8rem;cursor:pointer;">Cancelar</button>
                <button data-unm-ok style="flex:2;padding:11px;border-radius:10px;border:none;background:linear-gradient(135deg,#ffd700,#ccac00);color:#000;font-weight:900;font-size:.8rem;cursor:pointer;">🔓 Separar seleccionados</button>
            </div>`;

        panel.innerHTML = head + body + foot;
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        panel.querySelector('[data-unm-close]').onclick = () => close(null);
        panel.querySelector('[data-unm-cancel]').onclick = () => close(null);
        const allChk = panel.querySelector('[data-unm-all]');
        const boxes = Array.from(panel.querySelectorAll('[data-unm-idx]'));
        allChk.onchange = () => boxes.forEach(b => { b.checked = allChk.checked; });
        panel.querySelector('[data-unm-ok]').onclick = () => {
            const selected = mws.filter((_, i) => boxes[i] && boxes[i].checked);
            if (selected.length === 0) { alert('Seleccioná al menos un pedido para separar.'); return; }
            close(selected);
        };
    });
}

async function unmergeWork(id) {
    const work = allWorks.find(w => String(w.id) === String(id));
    if (!work || !work.mergedWorks || work.mergedWorks.length === 0) return;

    // 1) Elegir cuáles separar (desunificación selectiva)
    const elegidos = await openUnmergeSelector(work);
    if (!elegidos || elegidos.length === 0) return;
    const sepAll = elegidos.length === work.mergedWorks.length;
    if (!confirm(`¿Separar ${elegidos.length} pedido(s) de la unificación?${sepAll ? '\n\nSe va a desarmar toda la unión.' : ''}\n\nSe descuenta su monto y lo pagado del pedido principal.`)) return;

    // 2) Descontar del principal lo aportado por los seleccionados
    const idsSep = new Set(elegidos.map(m => m.id));
    const sumaElegida = elegidos.reduce((s, mw) => s + (Number(mw.total) || 0), 0);

    elegidos.forEach(mw => {
        work.paidAmount = Math.max(0, (work.paidAmount || 0) - (mw.paidAmount || 0));

        // Descontar costos
        if (work.costos && mw.costos) {
            if (work.costos.materiales && mw.costos.materiales) {
                for (const [mat, val] of Object.entries(mw.costos.materiales)) {
                    work.costos.materiales[mat] = Math.max(0, Number(((parseFloat(work.costos.materiales[mat]) || 0) - (parseFloat(val) || 0)).toFixed(2)));
                }
            }
            if (work.costos.terceros && mw.costos.terceros) {
                for (const [terc, val] of Object.entries(mw.costos.terceros)) {
                    work.costos.terceros[terc] = Math.max(0, Number(((parseFloat(work.costos.terceros[terc]) || 0) - (parseFloat(val) || 0)).toFixed(2)));
                }
            }
        }
    });

    // 3) Sacarlos de la unión y devolverlos como trabajos aparte
    work.mergedWorks = work.mergedWorks.filter(mw => !idsSep.has(mw.id));
    elegidos.forEach(mw => allWorks.push(mw));

    // 4) Restar del total lo que se llevaron y recalcular
    work.total = Math.max(0, (Number(work.total) || 0) - sumaElegida);
    recalculateWorkTotal(work);

    renderWorks();
    updateStatistics();
    await saveWorks();
    alert(`🔓 Se separaron ${elegidos.length} pedido(s) de la unificación.`);
}

// ==================== ACCIONES POR ÍTEM (ITEM-LEVEL) ====================
// Guarda cambios puntuales con PUT; si falla, cae al bulk sync (saveWorks).
async function persistWork(workId, updates) {
    try {
        const res = await window.mrDataManager.request(`/api/trabajos/${workId}`, 'PUT', updates);
        if (res && res.success) return true;
    } catch (e) {
        console.warn('[TRABAJOS] PUT falló, sincronizando con POST:', e);
    }
    await saveWorks();
    return false;
}

async function toggleItemPrinted(workId, itemKey) {
    const work = allWorks.find(w => String(w.id) === String(workId));
    if (!work) return;

    if (!work.printedItems) work.printedItems = {};
    work.printedItems[itemKey] = !work.printedItems[itemKey];

    renderWorks();
    updateMaterialAndProductWidgets();
    await persistWork(workId, { printedItems: work.printedItems });
}

async function toggleItemCompleted(workId, itemKey, prodName) {
    const work = allWorks.find(w => String(w.id) === String(workId));
    if (!work) return;

    if (!work.completedItems) work.completedItems = {};
    const isNowCompleted = !work.completedItems[itemKey];
    work.completedItems[itemKey] = isNowCompleted;

    renderWorks();
    updateMaterialAndProductWidgets();

    if (isNowCompleted && confirm(`¿Notificar al cliente ${work.clientName} por WhatsApp que '${prodName}' está terminado?`)) {
        try {
            await window.mrDataManager.request(`/api/trabajos/${workId}/notify-item-ready`, 'POST', { itemKey, prodName });
        } catch (e) {
            console.error('Error notificando ítem listo:', e);
        }
    }

    await persistWork(workId, { completedItems: work.completedItems });
}

async function toggleItemBilled(workId, itemKey, prodName) {
    const work = allWorks.find(w => String(w.id) === String(workId));
    if (!work) return;

    if (!work.billedItems) work.billedItems = {};
    work.billedItems[itemKey] = !work.billedItems[itemKey];

    renderWorks();
    await persistWork(workId, { billedItems: work.billedItems });
}

async function deleteWebItem(workId, itemIndex) {
    const work = allWorks.find(w => String(w.id) === String(workId));
    if (!work) return;

    if (!confirm('¿Eliminar este producto del pedido?')) return;

    if ((!work.notes || work.notes.length === 0) && (work.descripcion || '').trim()) {
        work.notes = [{
            text: work.descripcion,
            author: 'Portal Web',
            date: work.createdAt
        }];
    }

    let currentProdIndex = 0;
    let itemDeleted = false;

    function processWorkItemDeletion(targetWork) {
        if (!targetWork.notes || !Array.isArray(targetWork.notes)) return;

        targetWork.notes.forEach(note => {
            if (!isDetailNote(note) && targetWork.notes.length > 1) return;

            const rawText = (note.text || '').replace(/\\n/g, '\n');
            const lines = rawText.split(/\r?\n/);
            const newLines = [];
            let inTargetProductBlock = false;

            lines.forEach(linea => {
                const l = linea.trim();
                if (!l) {
                    if (!inTargetProductBlock) newLines.push(linea);
                    return;
                }

                let lineClean = l.replace(/(https?:\/\/[^\s]*drive\.google\.com[^\s]*)/gi, '').replace(/Link a Drive:\s*/gi, '').trim();

                const isProductLine = /^(PRODUCTO|ITEM|P#|item|producto)\s*\d*:?/i.test(lineClean) || 
                                     /^P\d+:?/i.test(lineClean) || 
                                     (currentProdIndex === 0 && lineClean.length > 2 && 
                                      !lineClean.toLowerCase().startsWith('detalle') && 
                                      !lineClean.toLowerCase().startsWith('link') && 
                                      !lineClean.toLowerCase().startsWith('nota') && 
                                      !lineClean.toLowerCase().startsWith('instrucciones') && 
                                      !lineClean.toLowerCase().startsWith('subtotal') && 
                                      !lineClean.toLowerCase().startsWith('medidas'));

                if (isProductLine) {
                    if (currentProdIndex === itemIndex) {
                        itemDeleted = true;
                    } else {
                        newLines.push(linea);
                    }
                    currentProdIndex++;
                } else {
                    newLines.push(linea);
                }
            });

            note.text = newLines.join('\n');
        });

        if (targetWork.notes.length > 0) {
            const firstLine = (targetWork.notes[0]?.text || '').split(/\r?\n/)[0] || '';
            targetWork.descripcion = firstLine;
        }
    }

    processWorkItemDeletion(work);

    if (!itemDeleted && work.mergedWorks && Array.isArray(work.mergedWorks)) {
        work.mergedWorks.forEach(mw => {
            if (!itemDeleted) processWorkItemDeletion(mw);
        });
    }

    recalculateWorkTotal(work);
    renderWorks();
    updateMaterialAndProductWidgets();
    await saveWorks();
}

// ==================== ACCIONES EN LOTE (BULK ACTIONS) ====================
function toggleSelectWork(id) {
    const strId = String(id);
    if (selectedWorks.has(strId)) {
        selectedWorks.delete(strId);
    } else {
        selectedWorks.add(strId);
    }
    updateSelectionUI();
}

function toggleSelectAllWorks(checked) {
    const visibleWorks = getVisibleWorks();
    if (checked) {
        visibleWorks.forEach(w => selectedWorks.add(String(w.id)));
    } else {
        selectedWorks.clear();
    }
    renderWorks();
}

function updateSelectionUI() {
    const bulkBar = document.getElementById('bulkActionsBar');
    const badge = document.getElementById('selectedCountBadge');
    const selectAllCheckbox = document.getElementById('selectAllWorks');

    const visibleWorks = getVisibleWorks();
    const count = selectedWorks.size;

    if (bulkBar) {
        bulkBar.style.display = count > 0 ? 'block' : 'none';
    }
    if (badge) {
        badge.innerText = `${count} seleccionado${count !== 1 ? 's' : ''}`;
    }
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = visibleWorks.length > 0 && visibleWorks.every(w => selectedWorks.has(String(w.id)));
    }
}

async function bulkMarkCompleted() {
    if (selectedWorks.size === 0) return;
    if (!confirm(`¿Marcar los ${selectedWorks.size} trabajos seleccionados como COMPLETADOS?`)) return;

    selectedWorks.forEach(id => {
        const w = allWorks.find(work => String(work.id) === id);
        if (w) {
            w.status = 'completed';
            w.completedAt = new Date().toISOString();
        }
    });

    selectedWorks.clear();
    renderWorks();
    updateStatistics();
    updateMaterialAndProductWidgets();
    await saveWorks();
}

async function bulkMarkPaid() {
    if (selectedWorks.size === 0) return;
    if (!confirm(`¿Marcar los ${selectedWorks.size} trabajos seleccionados como PAGADOS?`)) return;

    selectedWorks.forEach(id => {
        const w = allWorks.find(work => String(work.id) === id);
        if (w) {
            w.paymentStatus = 'paid';
            w.paidAmount = w.total;
            w.balance = 0;
        }
    });

    selectedWorks.clear();
    renderWorks();
    updateStatistics();
    await saveWorks();
}

async function bulkMarkDelivered() {
    if (selectedWorks.size === 0) return;
    if (!confirm(`¿Marcar los ${selectedWorks.size} trabajos seleccionados como ENTREGADOS?`)) return;

    selectedWorks.forEach(id => {
        const w = allWorks.find(work => String(work.id) === id);
        if (w) {
            w.deliveryStatus = 'delivered';
            w.deliveredAt = new Date().toISOString();
        }
    });

    selectedWorks.clear();
    renderWorks();
    updateStatistics();
    updateMaterialAndProductWidgets();
    await saveWorks();
}

async function bulkMarkPrinted() {
    if (selectedWorks.size === 0) return;
    if (!confirm(`¿Marcar los ${selectedWorks.size} trabajos seleccionados como IMPRESOS?`)) return;

    selectedWorks.forEach(id => {
        const w = allWorks.find(work => String(work.id) === id);
        if (w) w.printed = true;
    });

    selectedWorks.clear();
    renderWorks();
    updateMaterialAndProductWidgets();
    await saveWorks();
}

// ==================== BARRA DE PROGRESO FLOTANTE ====================
function showProgressBar(title, initialText) {
    let overlay = document.getElementById('mrProgressOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mrProgressOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);backdrop-filter:blur(5px);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
        overlay.innerHTML = `
            <div style="background:#1e293b;border:1px solid rgba(255,215,0,0.3);border-radius:14px;padding:24px;width:90%;max-width:420px;box-shadow:0 15px 35px rgba(0,0,0,0.6);text-align:center;color:#fff;">
                <div style="display:inline-block;width:38px;height:38px;border:3px solid rgba(255,255,255,0.1);border-left-color:#ffd700;border-radius:50%;animation:mrSpin 0.9s linear infinite;margin-bottom:12px;"></div>
                <h4 id="mrProgressTitle" style="margin:0 0 8px;font-size:1.15rem;font-weight:700;color:#ffd700;"></h4>
                <p id="mrProgressText" style="margin:0 0 16px;font-size:0.9rem;color:#cbd5e1;"></p>
                <div style="width:100%;background:#0f172a;border-radius:999px;height:14px;overflow:hidden;border:1px solid #334155;">
                    <div id="mrProgressBar" style="width:0%;height:100%;background:linear-gradient(90deg,#eab308,#ffd700);transition:width 0.2s ease;"></div>
                </div>
            </div>
            <style>@keyframes mrSpin { 0% { transform:rotate(0deg); } 100% { transform:rotate(360deg); } }</style>`;
        document.body.appendChild(overlay);
    }
    document.getElementById('mrProgressTitle').textContent = title;
    document.getElementById('mrProgressText').textContent = initialText;
    document.getElementById('mrProgressBar').style.width = '0%';
    overlay.style.display = 'flex';
}

function updateProgressBar(percent, text) {
    const bar = document.getElementById('mrProgressBar');
    const txt = document.getElementById('mrProgressText');
    if (bar) bar.style.width = Math.min(100, Math.max(0, percent)) + '%';
    if (txt && text) txt.textContent = text;
}

function hideProgressBar() {
    const overlay = document.getElementById('mrProgressOverlay');
    if (overlay) overlay.style.display = 'none';
}

async function bulkDeleteWorks() {
    if (selectedWorks.size === 0) return;
    const count = selectedWorks.size;
    if (!confirm(`¿Eliminar definitivamente los ${count} trabajos seleccionados?\n\nEsta acción borrará los pedidos del sistema, de la planilla de Google Sheets y moverá sus carpetas de Google Drive a la papelera.`)) return;

    const idsToDelete = Array.from(selectedWorks);
    selectedWorks.clear();

    // Congelar recargas por WebSockets para que no trabe la UI
    selfSaveCooldown = Date.now() + 6000;

    // Actualización visual instantánea (Optimistic UI)
    allWorks = allWorks.filter(w => !idsToDelete.includes(String(w.id)));
    renderWorks();
    updateStatistics();
    updateMaterialAndProductWidgets();

    showProgressBar('Eliminando Trabajos', `Eliminando ${count} trabajos seleccionados...`);
    updateProgressBar(50, 'Procesando en lote...');

    try {
        await window.mrDataManager.request('/api/trabajos/batch-delete', 'POST', { ids: idsToDelete });
        updateProgressBar(100, '¡Eliminación completada!');
    } catch (e) {
        console.error('[TRABAJOS] Error en batch-delete, usando fallback paralelo:', e);
        await Promise.allSettled(idsToDelete.map(id => window.mrDataManager.request(`/api/trabajos/${id}`, 'DELETE')));
        updateProgressBar(100, '¡Eliminación completada!');
    }

    setTimeout(hideProgressBar, 400);
}

function toggleWorkItemSelect(workId, itemKey) {
    const strWorkId = String(workId);
    if (!selectedWorkItemsMap.has(strWorkId)) {
        selectedWorkItemsMap.set(strWorkId, new Set());
    }
    const set = selectedWorkItemsMap.get(strWorkId);
    if (set.has(itemKey)) {
        set.delete(itemKey);
    } else {
        set.add(itemKey);
    }
    updateSelectionUI();
}

function toggleAllItemsInWork(workId, checked) {
    const strWorkId = String(workId);
    const work = allWorks.find(w => String(w.id) === strWorkId);
    if (!work) return;

    const allKeys = getWorkAllItemKeys(work);
    if (checked) {
        selectedWorkItemsMap.set(strWorkId, new Set(allKeys));
    } else {
        selectedWorkItemsMap.delete(strWorkId);
    }
    renderWorks();
}

function getWorkAllItemKeys(work) {
    const keys = [];
    const prods = (work.productos && work.productos.length > 0) ? work.productos : ((work.products && work.products.length > 0) ? work.products : []);
    if (prods.length > 0) {
        prods.forEach((_, i) => keys.push(`prod_${i}_${work.id}`));
    }
    
    if (work.quoteId && allQuotes[work.quoteId]) {
        const pushQuoteKeys = (w) => {
            const q = allQuotes[w.quoteId];
            if (q) {
                (q.multiCategories?.categories || []).forEach((_, i) => keys.push(`cat_${i}_${w.id}`));
                (q.productos || []).forEach((_, i) => keys.push(`prod_${i}_${w.id}`));
            }
        };
        pushQuoteKeys(work);
        if (work.mergedWorks && Array.isArray(work.mergedWorks)) {
            work.mergedWorks.forEach(mw => pushQuoteKeys(mw));
        }
    }

    // Notes keys
    const notesDetalle = getAllDetailNotes(work);
    let prodIndex = 0;
    notesDetalle.forEach((note, noteIdx) => {
        const textToParse = (note.text || '').replace(/\\n/g, '\n');
        const rawLines = textToParse.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const lines = [];
        rawLines.forEach(rl => {
            let clean = rl.replace(/^Detalle:\s*/i, '');
            const splits = clean.split(/(?=(?:ITEM|PRODUCTO|P#)\s*\d+:?)/i).map(s => s.trim()).filter(Boolean);
            lines.push(...splits);
        });

        lines.forEach(linea => {
            const l = linea.trim();
            if (!l) return;
            const lineClean = l.replace(/(https?:\/\/[^\s]*drive\.google\.com[^\s]*)/gi, '').replace(/Link a Drive:\s*/gi, '').trim();
            if (!lineClean) return;

            const isProduct = /^(PRODUCTO|ITEM|P#|item|producto)\s*\d*:?/i.test(lineClean) || /^P\d+:?/i.test(lineClean);
            if (isProduct) {
                keys.push(`item_${prodIndex}_${noteIdx}`);
                prodIndex++;
            } else if (lineClean.length > 2 &&
                !lineClean.toLowerCase().startsWith('detalle') &&
                !lineClean.toLowerCase().startsWith('link') &&
                !lineClean.toLowerCase().startsWith('nota') &&
                !lineClean.toLowerCase().startsWith('instrucciones') &&
                !lineClean.toLowerCase().startsWith('subtotal') &&
                !lineClean.toLowerCase().startsWith('medidas')) {
                if (prodIndex === 0) {
                    keys.push(`item_${prodIndex}_${noteIdx}`);
                    prodIndex++;
                }
            }
        });
    });
    return [...new Set(keys)];
}

async function bulkMarkWorkItemsCompleted(workId) {
    const strWorkId = String(workId);
    const keys = selectedWorkItemsMap.get(strWorkId);
    if (!keys || keys.size === 0) {
        alert('⚠️ Seleccioná al menos un ítem.');
        return;
    }
    const work = allWorks.find(w => String(w.id) === strWorkId);
    if (!work) return;

    if (!work.completedItems) work.completedItems = {};
    keys.forEach(k => work.completedItems[k] = true);

    renderWorks();
    updateMaterialAndProductWidgets();
    await saveWorks();
}

async function bulkMarkWorkItemsBilled(workId) {
    const strWorkId = String(workId);
    const keys = selectedWorkItemsMap.get(strWorkId);
    if (!keys || keys.size === 0) {
        alert('⚠️ Seleccioná al menos un ítem.');
        return;
    }
    const work = allWorks.find(w => String(w.id) === strWorkId);
    if (!work) return;

    if (!work.billedItems) work.billedItems = {};
    keys.forEach(k => work.billedItems[k] = true);

    renderWorks();
    await saveWorks();
}

async function bulkMarkWorkItemsPrinted(workId) {
    const strWorkId = String(workId);
    const keys = selectedWorkItemsMap.get(strWorkId);
    if (!keys || keys.size === 0) {
        alert('⚠️ Seleccioná al menos un ítem.');
        return;
    }
    const work = allWorks.find(w => String(w.id) === strWorkId);
    if (!work) return;

    if (!work.printedItems) work.printedItems = {};
    keys.forEach(k => work.printedItems[k] = true);

    renderWorks();
    updateMaterialAndProductWidgets();
    await saveWorks();
}

// ==================== WIDGETS Y HELPERS DE MATERIALES/PRODUCTOS ====================
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

function getWorkItems(w) {
    const items = [];
    const collectFromWork = (work) => {
        if (!work) return;
        if (work.quoteId && allQuotes[work.quoteId]) {
            const q = allQuotes[work.quoteId];
            (q.multiCategories?.categories || []).forEach(c => items.push({ name: c.name }));
            (q.productos || []).forEach(p => items.push({ name: p.name || p.nombre }));
        } else if ((work.productos && work.productos.length > 0) || (work.products && work.products.length > 0)) {
            const prods = work.productos || work.products || [];
            prods.forEach(p => items.push({ name: p.nombre || p.name || p.producto || 'Producto' }));
        } else if (work.notes || work.descripcion) {
            let notesDetalle = (work.notes || []).filter(isDetailNote);
            if (notesDetalle.length === 0 && work.descripcion) {
                notesDetalle = [{ text: work.descripcion }];
            }
            notesDetalle.forEach(n => {
                const textToParse = (n.text || '').replace(/\\n/g, '\n');
                textToParse.split(/\r?\n/).forEach(l => {
                    let clean = l.trim().replace(/^Detalle:\s*/i, '');
                    if (/^(PRODUCTO|ITEM|P#|item|producto)\s*\d*:?/i.test(clean)) {
                        const name = clean.replace(/^(PRODUCTO|ITEM|P#|item|producto)\s*\d*:?\s*/i, '').trim();
                        if (name) items.push({ name });
                    } else if (clean && !clean.toLowerCase().startsWith('link') && !clean.toUpperCase().startsWith('MEDIDAS') && !clean.toUpperCase().startsWith('SUBTOTAL') && !clean.toUpperCase().startsWith('NOTA') && clean.length > 2 && !clean.toLowerCase().startsWith('detalle del pedido')) {
                        items.push({ name: clean });
                    }
                });
            });
        }
        if (work.mergedWorks && Array.isArray(work.mergedWorks)) {
            work.mergedWorks.forEach(mw => collectFromWork(mw));
        }
    };
    collectFromWork(w);
    return items;
}

function selectProductGroup(groupName) {
    selectedProductGroup = groupName;
    renderWorks();
    updateMaterialAndProductWidgets();
}

function updateMaterialAndProductWidgets() {
    const activeWorks = allWorks.filter(w => w.status !== 'completed' && w.deliveryStatus !== 'delivered' && w.status !== 'cancelled' && !w.missingFromSheet && !w.missing_from_sheet && w.sheetStatus !== 'not_in_sheet');
    const activeUnprintedWorks = activeWorks.filter(w => !w.printed);
    
    const materialCounts = {};
    const productGroups = {};

    activeUnprintedWorks.forEach(w => {
        getWorkItems(w).forEach(item => {
            const matName = cleanMaterialName(item.name);
            materialCounts[matName] = (materialCounts[matName] || 0) + 1;
        });
    });

    activeWorks.forEach(w => {
        getWorkItems(w).forEach(item => {
            const groupName = getProductGroupName(item.name);
            if (!productGroups[groupName]) productGroups[groupName] = [];
            if (!productGroups[groupName].includes(w.id)) productGroups[groupName].push(w.id);
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
                    </span>`;
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
                </button>`;
            
            html += groups.map(grp => {
                const isActive = selectedProductGroup === grp;
                const colors = groupColorMap[grp] || groupColorMap['Otros'];
                const btnStyle = isActive
                    ? `background: ${colors.color} !important; color: #09090b !important; border: 1px solid ${colors.color} !important; font-weight: bold;`
                    : `background: ${colors.bg} !important; color: ${colors.color} !important; border: 1px solid ${colors.border} !important;`;
                
                return `
                    <button class="btn btn-small" style="${btnStyle}" onclick="selectProductGroup('${grp}')">
                        📦 ${grp} (${productGroups[grp].length})
                    </button>`;
            }).join('');
            
            groupsContainer.innerHTML = html;
        } else {
            groupsWidget.style.display = 'none';
        }
    }
}

// ==================== VISTA PREVIA DRIVE ====================
const driveImageCache = {};
const driveImageMap = {};

function getFolderIdFromUrl(url) {
    if (!url) return null;
    const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/) || 
                  url.match(/\/d\/([a-zA-Z0-9_-]+)/) || 
                  url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

async function loadDrivePreviews() {
    // FIX rendimiento: si ya hay una pasada en curso, no arrancar otra en paralelo
    if (driveRunning) return;
    driveRunning = true;

    const pendientes = [];
    document.querySelectorAll('.drive-previews-container').forEach(el => {
        const folderId = el.getAttribute('data-folder-id');
        if (!folderId || folderId === 'unknown') return;
        pendientes.push({ el, folderId });
    });

    // FIX rendimiento: las fetch se lanzan en PARALELO (antes eran secuenciales)
    await Promise.all(pendientes.map(async ({ el, folderId }) => {
        try {
            if (driveImageCache[folderId] && driveImageCache[folderId] !== 'loading') {
                renderPreviewImages(el, driveImageCache[folderId]);
                return;
            }
            if (driveImageCache[folderId] === 'loading') return;
            driveImageCache[folderId] = 'loading';

            const response = await fetch(`/api/google/folder-images?folderId=${folderId}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!response.ok) {
                driveImageCache[folderId] = null;
                return;
            }
            const images = await response.json();
            driveImageCache[folderId] = images;
            renderPreviewImages(el, images);
        } catch (err) {
            console.error('Error cargando vistas previas de Drive:', err);
            driveImageCache[folderId] = null;
        }
    }));

    driveRunning = false;
}

function renderPreviewImages(containerEl, images) {
    if (Array.isArray(images) && images.length > 0) {
        containerEl.innerHTML = images.map((img, i) => {
            const key = `${img.id}_${i}`;
            driveImageMap[key] = img;
            const isImg = img.isImage || !!img.thumbData || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(img.name);
            
            if (isImg) {
                const srcUrl = img.thumbData || `https://drive.google.com/thumbnail?id=${img.id}&sz=w220`;
                return `
                    <div class="drive-preview-item" style="position:relative; width:70px; height:70px; border-radius:8px; overflow:hidden; border:1px solid rgba(255,255,255,0.15); background:#111; cursor:pointer; display:flex; align-items:center; justify-content:center;" onclick="openPreviewByKey('${key}')">
                        <img src="${srcUrl}" class="drive-preview-thumb" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div style="display:none; text-align:center; padding: 4px;">
                            <div style="font-size:1.5rem;">🖼️</div>
                            <div style="font-size:.55rem; color:#aaa; margin-top:2px; max-width:60px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${img.name}</div>
                        </div>
                    </div>`;
            } else {
                return `
                    <a href="${img.fullUrl}" target="_blank" class="drive-preview-item" style="position:relative; width:70px; height:70px; border-radius:8px; overflow:hidden; border:1px solid rgba(255,255,255,0.15); background:#111; cursor:pointer; display:flex; align-items:center; justify-content:center; text-decoration:none;">
                        <div style="text-align:center; padding: 4px;">
                            <div style="font-size:1.5rem;">📄</div>
                            <div style="font-size:.55rem; color:#aaa; margin-top:2px; max-width:60px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${img.name}</div>
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
            <img src="${imgSrc}" style="max-width:100%; max-height:85vh; display:block; object-fit:contain;" onerror="this.onerror=null; this.src='https://drive.google.com/thumbnail?id=${driveUrl ? driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] : ''}&sz=w1000';">
            <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.6); color:#fff; padding:10px 15px; font-size:0.9rem; text-align:center;">${imgName}</div>
        </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function openPreviewByKey(key) {
    const img = driveImageMap[key];
    if (!img) return;
    const previewUrl = `https://drive.google.com/thumbnail?id=${img.id}&sz=w1000`;
    openPreviewModal(previewUrl, img.name, img.fullUrl);
}

// ==================== MODAL NUEVO TRABAJO (GREMIO) ====================
async function openNewWorkModal() {
    const modalEl = document.getElementById('modalNuevoTrabajo');
    if (!modalEl) return;

    if (modalEl.parentElement !== document.body) {
        document.body.appendChild(modalEl);
    }

    const selectEl = document.getElementById('selectClienteGremioModal');
    const container = document.getElementById('modalItemsContainer');
    
    if (selectEl) {
        selectEl.innerHTML = '<option value="">Cargando clientes de la planilla GREMIO...</option>';
        try {
            const res = await fetch('/api/gremio/hoja-clientes', {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const clients = await res.json();
            modalGremioClients = (clients || []).sort((a, b) => {
                const nameA = (a.name || a.nombre || '').toLowerCase();
                const nameB = (b.name || b.nombre || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
            if (modalGremioClients.length === 0) {
                selectEl.innerHTML = '<option value="">Sin clientes en la hoja GREMIO. Sincronice primero.</option>';
            } else {
                selectEl.innerHTML = '<option value="">-- Seleccionar Cliente --</option>' +
                    modalGremioClients.map(c => {
                        const name = c.name || c.nombre || 'Sin nombre';
                        const tel = c.telefono || c.phone || '';
                        return `<option value="${c.id}">${name}${tel ? ' (' + tel + ')' : ''}</option>`;
                    }).join('');
            }
        } catch (e) {
            console.error('[TRABAJOS] Error cargando clientes de hoja GREMIO:', e);
            selectEl.innerHTML = '<option value="">Error al cargar clientes</option>';
        }
    }

    try {
        const resPrecios = await fetch('/api/gremio/precios', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        modalPreciosCatalog = await resPrecios.json() || [];
    } catch (e) {
        console.error('[TRABAJOS] Error cargando lista de precios:', e);
        modalPreciosCatalog = [];
    }

    if (container) {
        container.innerHTML = '';
        addModalItemRow();
    }

    document.getElementById('modalClientPhone').value = '';
    document.getElementById('modalTotalWork').value = '0';
    document.getElementById('modalPaidAmount').value = '0';
    document.getElementById('modalDeliveryDate').value = '';
    document.getElementById('modalPriority').value = 'normal';

    const modalInst = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInst.show();
}

function onModalGremioClientSelect(clientId) {
    const client = modalGremioClients.find(c => String(c.id) === String(clientId));
    const phoneInput = document.getElementById('modalClientPhone');
    if (phoneInput) {
        phoneInput.value = client ? (client.telefono || client.phone || '') : '';
    }
}

function addModalItemRow() {
    const container = document.getElementById('modalItemsContainer');
    if (!container) return;

    const categories = [...new Set(modalPreciosCatalog.map(p => (p.categoria || 'IMPRESIÓN').trim()))].sort();
    if (categories.length === 0) categories.push('IMPRESIÓN');

    const catOptions = categories.map(c => `<option value="${c}">${c}</option>`).join('');

    const row = document.createElement('div');
    row.className = 'modal-item-row mr-card p-3 mb-3 position-relative';
    row.innerHTML = `
        <button type="button" class="btn btn-sm btn-outline-danger position-absolute top-0 end-0 m-2 border-0" onclick="removeModalItemRow(this)" title="Eliminar ítem">🗑️</button>
        <div class="row g-2 mb-2 pe-4">
            <div class="col-md-6">
                <label class="form-label text-muted small mb-1">Categoría</label>
                <select class="form-select mr-input item-category" onchange="onModalCategoryChange(this)">
                    <option value="">Categoría...</option>
                    ${catOptions}
                </select>
            </div>
            <div class="col-md-6">
                <label class="form-label text-muted small mb-1">Producto</label>
                <select class="form-select mr-input item-product" onchange="onModalProductChange(this)">
                    <option value="">Producto...</option>
                </select>
            </div>
        </div>
        <div class="item-dims-container mb-2"></div>
        <div class="mb-2">
            <label class="form-label text-muted small mb-1">Instrucciones / Notas</label>
            <textarea class="form-control mr-input item-notes" rows="2" placeholder="Instrucciones adicionales..." oninput="recalculateModalItemSubtotal(this)"></textarea>
        </div>
        <div class="d-flex justify-content-between align-items-center pt-2 border-top border-secondary">
            <div class="small text-muted fw-bold">Subtotal ítem</div>
            <div class="mr-badge-price item-price-display">$0</div>
        </div>`;
    container.appendChild(row);

    const catSelect = row.querySelector('.item-category');
    if (catSelect && categories.length > 0) {
        catSelect.value = categories[0];
        onModalCategoryChange(catSelect);
    }
}

function onModalCategoryChange(catSelect) {
    const row = catSelect.closest('.modal-item-row');
    if (!row) return;
    const cat = catSelect.value;
    const prodSelect = row.querySelector('.item-product');
    if (!prodSelect) return;

    const filtered = modalPreciosCatalog.filter(p => (p.categoria || '').trim().toLowerCase() === cat.trim().toLowerCase());
    
    prodSelect.innerHTML = '<option value="">Seleccionar Producto...</option>' +
        filtered.map(p => {
            const precio = parseFloat(p.precioGremio) || 0;
            const unidad = p.unidad ? ` [${p.unidad}]` : '';
            return `<option value="${p.id || p.productoId}" data-precio="${precio}" data-unidad="${p.unidad || 'm2'}" data-ancho="${p.ancho || 0}">${p.producto} - $${precio.toLocaleString()}${unidad}</option>`;
        }).join('');

    if (filtered.length > 0) {
        prodSelect.selectedIndex = 1;
    }

    onModalProductChange(prodSelect);
}

function onModalProductChange(prodSelect) {
    const row = prodSelect.closest('.modal-item-row');
    if (!row) return;

    const dimsContainer = row.querySelector('.item-dims-container');
    const opt = prodSelect.options[prodSelect.selectedIndex];
    const unidad = (opt ? (opt.getAttribute('data-unidad') || 'm2') : 'm2').toLowerCase();

    if (dimsContainer) {
        if (unidad.indexOf('ml') > -1) {
            dimsContainer.innerHTML = `
                <div class="row g-2 align-items-center">
                    <div class="col-md-6">
                        <label class="form-label text-muted small mb-1">Metros Lineales (ml) *</label>
                        <input type="number" class="form-control mr-input item-ml" placeholder="ml" min="0.1" step="0.1" value="1" oninput="recalculateModalItemSubtotal(this)">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label text-muted small mb-1">Cantidad *</label>
                        <input type="number" class="form-control mr-input item-qty" placeholder="Cant." min="1" value="1" oninput="recalculateModalItemSubtotal(this)">
                    </div>
                </div>`;
        } else if (unidad === 'unidad') {
            dimsContainer.innerHTML = `
                <div class="row g-2 align-items-center">
                    <div class="col-md-6">
                        <label class="form-label text-muted small mb-1">Cantidad *</label>
                        <input type="number" class="form-control mr-input item-qty" placeholder="Cant." min="1" value="1" oninput="recalculateModalItemSubtotal(this)">
                    </div>
                </div>`;
        } else {
            dimsContainer.innerHTML = `
                <div class="row g-2 align-items-center">
                    <div class="col-md-4">
                        <label class="form-label text-muted small mb-1">Ancho (cm) *</label>
                        <input type="number" class="form-control mr-input item-width" placeholder="Ancho (cm)" min="1" value="100" oninput="recalculateModalItemSubtotal(this)">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label text-muted small mb-1">Alto / Largo (cm) *</label>
                        <input type="number" class="form-control mr-input item-height" placeholder="Alto (cm)" min="1" value="100" oninput="recalculateModalItemSubtotal(this)">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label text-muted small mb-1">Cantidad *</label>
                        <input type="number" class="form-control mr-input item-qty" placeholder="Cant." min="1" value="1" oninput="recalculateModalItemSubtotal(this)">
                    </div>
                </div>`;
        }
    }

    recalculateModalItemSubtotal(prodSelect);
}

function recalculateModalItemSubtotal(el) {
    const row = el.closest('.modal-item-row');
    if (!row) return;

    const prodSelect = row.querySelector('.item-product');
    const qtyInput = row.querySelector('.item-qty');
    const priceDisplay = row.querySelector('.item-price-display');

    const opt = prodSelect?.options[prodSelect.selectedIndex];
    const unitPrice = opt ? parseFloat(opt.getAttribute('data-precio')) || 0 : 0;
    const unidad = opt ? (opt.getAttribute('data-unidad') || 'unidad').toLowerCase() : 'unidad';
    const qty = parseFloat(qtyInput?.value) || 1;

    let subtotal = 0;
    if (unidad === 'm2') {
        const w = parseFloat(row.querySelector('.item-width')?.value) || 0;
        const h = parseFloat(row.querySelector('.item-height')?.value) || 0;
        subtotal = ((w / 100) * (h / 100)) * unitPrice * qty;
    } else if (unidad.indexOf('ml') > -1) {
        const ml = parseFloat(row.querySelector('.item-ml')?.value) || 1;
        subtotal = ml * unitPrice * qty;
    } else {
        subtotal = unitPrice * qty;
    }

    if (priceDisplay) {
        priceDisplay.innerText = '$' + Math.round(subtotal).toLocaleString('es-AR');
    }

    recalculateModalTotal();
}

function removeModalItemRow(btn) {
    const row = btn.closest('.modal-item-row');
    if (row) {
        row.remove();
        recalculateModalTotal();
    }
}

function recalculateModalTotal() {
    const rows = document.querySelectorAll('#modalItemsContainer .modal-item-row');
    let grandTotal = 0;
    rows.forEach(r => {
        const prodSelect = r.querySelector('.item-product');
        const qtyInput = r.querySelector('.item-qty');
        const opt = prodSelect?.options[prodSelect.selectedIndex];
        const unitPrice = opt ? parseFloat(opt.getAttribute('data-precio')) || 0 : 0;
        const unidad = opt ? (opt.getAttribute('data-unidad') || 'unidad').toLowerCase() : 'unidad';
        const qty = parseFloat(qtyInput?.value) || 1;

        let subtotal = 0;
        if (unidad === 'm2') {
            const w = parseFloat(r.querySelector('.item-width')?.value) || 0;
            const h = parseFloat(r.querySelector('.item-height')?.value) || 0;
            subtotal = ((w / 100) * (h / 100)) * unitPrice * qty;
        } else if (unidad.indexOf('ml') > -1) {
            const ml = parseFloat(r.querySelector('.item-ml')?.value) || 1;
            subtotal = ml * unitPrice * qty;
        } else {
            subtotal = unitPrice * qty;
        }
        grandTotal += subtotal;
    });
    const totalEl = document.getElementById('modalTotalWork');
    if (totalEl) totalEl.value = Math.round(grandTotal);
}

async function saveNewWorkFromModal() {
    const clientId = document.getElementById('selectClienteGremioModal')?.value;
    const client = modalGremioClients.find(c => String(c.id) === String(clientId));

    if (!client) {
        alert('⚠️ Seleccioná un cliente de gremio.');
        return;
    }

    const itemRows = document.querySelectorAll('#modalItemsContainer .modal-item-row');
    const products = [];
    itemRows.forEach(r => {
        const catSelect = r.querySelector('.item-category');
        const prodSelect = r.querySelector('.item-product');
        const qtyInput = r.querySelector('.item-qty');
        const notesInput = r.querySelector('.item-notes');
        
        const cat = catSelect?.value || '';
        const opt = prodSelect?.options[prodSelect.selectedIndex];
        let prodName = opt && prodSelect.value ? opt.text.split(' - $')[0] : '';
        const unitPrice = opt ? parseFloat(opt.getAttribute('data-precio')) || 0 : 0;
        const unidad = opt ? (opt.getAttribute('data-unidad') || 'unidad').toLowerCase() : 'unidad';
        const qty = parseFloat(qtyInput?.value) || 1;
        const notes = notesInput?.value.trim() || '';

        let subtotal = 0;
        let dimStr = '';
        if (unidad === 'm2') {
            const w = parseFloat(r.querySelector('.item-width')?.value) || 0;
            const h = parseFloat(r.querySelector('.item-height')?.value) || 0;
            dimStr = ` (${w}x${h}cm)`;
            subtotal = ((w / 100) * (h / 100)) * unitPrice * qty;
        } else if (unidad.indexOf('ml') > -1) {
            const ml = parseFloat(r.querySelector('.item-ml')?.value) || 1;
            dimStr = ` (${ml}ml)`;
            subtotal = ml * unitPrice * qty;
        } else {
            subtotal = unitPrice * qty;
        }

        if (prodName && prodSelect.value) {
            const fullName = `${prodName}${dimStr}${notes ? ' | ' + notes : ''}`;
            products.push({
                categoria: cat,
                nombre: fullName,
                producto: fullName,
                cantidad: qty,
                precio: unitPrice,
                instrucciones: notes,
                subtotal: Math.round(subtotal)
            });
        }
    });

    if (products.length === 0) {
        alert('⚠️ Seleccioná al menos un ítem / producto al trabajo.');
        return;
    }

    const total = parseFloat(document.getElementById('modalTotalWork')?.value) || 0;
    const paidAmount = parseFloat(document.getElementById('modalPaidAmount')?.value) || 0;
    const deliveryDate = document.getElementById('modalDeliveryDate')?.value || null;
    const priority = document.getElementById('modalPriority')?.value || 'normal';
    const clientName = client.name || client.nombre || 'Cliente Gremio';

    const descripcion = products.map(p => `${p.cantidad}x ${p.nombre}`).join(', ');

    const newWork = {
        id: `work_${Date.now()}`,
        quoteId: `direct_${Date.now()}`,
        tipo_cliente: 'gremio',
        clientName: clientName,
        clientPhone: client.telefono || client.phone || '',
        clientEmail: client.email || '',
        clientAddress: client.direccion || client.address || '',
        descripcion: descripcion,
        productos: products,
        products: products,
        terceros: [],
        total: total,
        totalCost: total * 0.4,
        profit: total * 0.6,
        paidAmount: paidAmount,
        balance: total - paidAmount,
        status: 'pending',
        paymentStatus: (paidAmount >= total - 1) ? 'paid' : 'pending',
        priority: priority,
        deliveryDate: deliveryDate,
        createdAt: new Date().toISOString(),
        timeline: [{ type: 'created', description: 'Trabajo creado desde modal por Administrador', timestamp: new Date().toISOString() }],
        notes: []
    };

    allWorks.push(newWork);
    renderWorks();
    updateStatistics();
    updateMaterialAndProductWidgets();

    try {
        const result = await saveWorks();
        if (result) {
            const modalEl = document.getElementById('modalNuevoTrabajo');
            if (modalEl) {
                const modalInst = bootstrap.Modal.getInstance(modalEl);
                if (modalInst) modalInst.hide();
            }
            alert(`🔨 ✅ ¡Trabajo creado correctamente para ${clientName}!`);
        } else {
            alert('❌ Error al guardar el trabajo en el servidor.');
        }
    } catch (e) {
        console.error('[TRABAJOS] Error guardando trabajo desde modal:', e);
        alert('❌ Error al crear trabajo: ' + e.message);
    }
}

// ==================== ESTADÍSTICAS Y FORMATO ====================
function updateStatistics() {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let totalRevenue = 0;

    allWorks.forEach(w => {
        if (w.deliveryStatus === 'delivered' && w.paymentStatus === 'paid') return;
        // No contar cancelados ni eliminados de planilla (salen de producción)
        if (w.status === 'cancelled' || w.missingFromSheet || w.missing_from_sheet || w.sheetStatus === 'not_in_sheet') return;
        if (w.status === 'pending') pending++;
        else if (w.status === 'in_progress') inProgress++;
        else if (w.status === 'completed') completed++;

        if (w.paidAmount) {
            totalRevenue += parseFloat(w.paidAmount) || 0;
        }
    });

    const countPending = document.getElementById('countPending');
    const countInProgress = document.getElementById('countInProgress');
    const countCompleted = document.getElementById('countCompleted');
    const totalRev = document.getElementById('totalRevenue');

    if (countPending) countPending.innerText = pending;
    if (countInProgress) countInProgress.innerText = inProgress;
    if (countCompleted) countCompleted.innerText = completed;
    if (totalRev) totalRev.innerText = '$' + fmt(totalRevenue);
}

function getStatusBadge(status) {
    switch (status) {
        case 'pending': return '<span class="badge badge-status-pending">⏳ Pendiente</span>';
        case 'in_progress': return '<span class="badge badge-status-in_progress">🔧 En Proceso</span>';
        case 'completed': return '<span class="badge badge-status-completed">✅ Completado</span>';
        case 'cancelled': return '<span class="badge bg-danger">❌ Cancelado</span>';
        default: return '<span class="badge bg-secondary">' + (status || 'Desconocido') + '</span>';
    }
}

function getPaymentBadge(paymentStatus) {
    switch (paymentStatus) {
        case 'paid': return '<span class="badge badge-payment-paid">💳 Pagado</span>';
        case 'pending': return '<span class="badge badge-payment-pending">⏳ Pago Pendiente</span>';
        case 'unpaid': return '<span class="badge badge-payment-unpaid">❌ No Pagado</span>';
        default: return '<span class="badge bg-secondary">' + (paymentStatus || 'Sin estado') + '</span>';
    }
}

function getPriorityBadge(priority) {
    switch (priority) {
        case 'urgent': return '<span class="badge badge-priority-urgent">🔴 Urgente</span>';
        case 'high': return '<span class="badge badge-priority-high">🟠 Alta</span>';
        case 'normal': return '<span class="badge badge-priority-normal">🟡 Normal</span>';
        default: return '';
    }
}

function getStatusLabel(status) {
    switch (status) {
        case 'pending': return 'Pendiente';
        case 'in_progress': return 'En Proceso';
        case 'completed': return 'Completado';
        case 'cancelled': return 'Cancelado';
        default: return status || '';
    }
}

function fmt(val) {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

function showError(msg) {
    const worksList = document.getElementById('worksList');
    if (worksList) {
        worksList.innerHTML = `<div class="alert alert-danger m-3">❌ ${msg}</div>`;
    }
}

function toggleItems(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ==================== EXPORTACIÓN A WINDOW ====================
window.loadWorks = loadWorks;
window.saveWorks = saveWorks;
window.manualSyncGoogleSheets = manualSyncGoogleSheets;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.toggleSelectWork = toggleSelectWork;
window.toggleSelectAllWorks = toggleSelectAllWorks;
window.bulkMarkCompleted = bulkMarkCompleted;
window.bulkMarkPaid = bulkMarkPaid;
window.bulkMarkDelivered = bulkMarkDelivered;
window.bulkMarkPrinted = bulkMarkPrinted;
window.bulkDeleteWorks = bulkDeleteWorks;
window.deleteWork = deleteWork;
window.changeStatus = changeStatus;
window.sendPaymentReminder = sendPaymentReminder;
window.resendReadyMessage = resendReadyMessage;
window.resendConfirmMessage = resendConfirmMessage;
window.markPaid = markPaid;
window.changePriority = changePriority;
window.markDelivered = markDelivered;
window.addNote = addNote;
window.togglePrinted = togglePrinted;
window.mergeWork = mergeWork;
window.unmergeWork = unmergeWork;
window.toggleItemPrinted = toggleItemPrinted;
window.toggleItemCompleted = toggleItemCompleted;
window.toggleItemBilled = toggleItemBilled;
window.deleteWebItem = deleteWebItem;
window.toggleWorkItemSelect = toggleWorkItemSelect;
window.toggleAllItemsInWork = toggleAllItemsInWork;
window.bulkMarkWorkItemsCompleted = bulkMarkWorkItemsCompleted;
window.bulkMarkWorkItemsBilled = bulkMarkWorkItemsBilled;
window.bulkMarkWorkItemsPrinted = bulkMarkWorkItemsPrinted;
window.selectProductGroup = selectProductGroup;
window.openPreviewModal = openPreviewModal;
window.openPreviewByKey = openPreviewByKey;
window.openNewWorkModal = openNewWorkModal;
window.onModalGremioClientSelect = onModalGremioClientSelect;
window.addModalItemRow = addModalItemRow;
window.onModalCategoryChange = onModalCategoryChange;
window.onModalProductChange = onModalProductChange;
window.recalculateModalItemSubtotal = recalculateModalItemSubtotal;
window.removeModalItemRow = removeModalItemRow;
window.recalculateModalTotal = recalculateModalTotal;
window.saveNewWorkFromModal = saveNewWorkFromModal;
window.toggleItems = toggleItems;
