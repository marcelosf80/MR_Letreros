/**
 * Trabajos Main - Sistema Principal de Gestión de Trabajos
 * 
 * @version 1.0.0
 * @author MR Letreros Team
 */

// ==================== VARIABLES GLOBALES ====================
let workManager;
let currentFilters = {};
let selectedWork = null;

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('[TRABAJOS] 🚀 Inicializando módulo de trabajos...');
    
    // Verificar conexión al servidor
    if (!window.mrDataManager || !(await window.mrDataManager.checkConnection())) {
        console.error('[TRABAJOS] ❌ No se pudo conectar al servidor');
        return;
    }
    
    // Inicializar work manager
    workManager = new WorkManager();
    
    // Cargar datos guardados
    await loadSavedWorks();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Renderizar trabajos
    renderWorks();
    
    // Actualizar estadísticas
    updateStatistics();
    
    // Escuchar por nuevas notificaciones
    window.addEventListener('workNotification', handleNewNotification);
    
    console.log('[TRABAJOS] ✅ Sistema listo');
});

// ==================== CARGA DE DATOS ====================

/**
 * Carga trabajos guardados
 */
async function loadSavedWorks() {
    try {
        const data = await window.mrDataManager.getWorks();
        if (data) {
            workManager.importData(data);
            console.log('[TRABAJOS] 📥 Trabajos cargados:', workManager.works.length);
        }
    } catch (error) {
        console.error('[TRABAJOS] Error cargando trabajos:', error);
    }
}

/**
 * Guarda trabajos
 */
async function saveWorks() {
    try {
        const data = workManager.exportData();
        await window.mrDataManager.saveWorks(data);
        console.log('[TRABAJOS] 💾 Trabajos guardados');
    } catch (error) {
        console.error('[TRABAJOS] Error guardando trabajos:', error);
    }
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    // Botón de notificaciones
    const btnNotifications = document.getElementById('btnNotifications');
    if (btnNotifications) {
        btnNotifications.addEventListener('click', toggleNotificationPanel);
    }
    
    // Actualizar contador de notificaciones cada 2 segundos
    setInterval(updateNotificationBadge, 2000);
}

/**
 * Maneja nuevas notificaciones
 */
function handleNewNotification(event) {
    const notification = event.detail;
    console.log('[TRABAJOS] 🔔 Nueva notificación:', notification.title);
    
    // Actualizar badge
    updateNotificationBadge();
    
    // Actualizar panel si está abierto
    const panel = document.getElementById('notificationPanel');
    if (panel && panel.classList.contains('show')) {
        renderNotifications();
    }
}

// ==================== RENDERIZADO ====================

/**
 * Renderiza lista de trabajos
 */
function renderWorks() {
    const works = workManager.getWorks(currentFilters);
    const container = document.getElementById('worksList');
    
    if (!container) return;
    
    if (works.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay trabajos que coincidan con los filtros</p>';
        return;
    }
    
    container.innerHTML = works.map(work => generateWorkCard(work)).join('');
}

/**
 * Genera HTML de una tarjeta de trabajo
 */
function generateWorkCard(work) {
    const statusBadge = getStatusBadgeHTML(work.status);
    const priorityBadge = getPriorityBadgeHTML(work.priority);
    const balance = parseFloat(work.balance || 0);
    const paymentBadge = work.paymentStatus === 'paid' ? 
        '<span class="badge" style="background: #4CAF50;">💳 Pagado</span>' : 
        `<span class="badge" style="background: #FFC107;">⏳ Resta: $${formatCurrency(balance)}</span>`;
    
    return `
        <div class="work-card priority-${work.priority} status-${work.status}" data-work-id="${work.id}">
            <div class="work-header">
                <div class="work-client">
                    ${work.clientName}
                    ${work.clientPhone ? `<small style="opacity: 0.7; font-size: 0.8rem; display: block;">📞 ${work.clientPhone}</small>` : ''}
                </div>
                <div class="work-badges">
                    ${priorityBadge}
                    ${statusBadge}
                    ${paymentBadge}
                </div>
            </div>
            
            <div class="work-details">
                <div class="work-detail-item">
                    <div class="work-detail-label">ID Trabajo</div>
                    <div class="work-detail-value">#${work.id.substr(-8)}</div>
                </div>
                <div class="work-detail-item">
                    <div class="work-detail-label">Total</div>
                    <div class="work-detail-value" style="color: #51CF66;">$${formatCurrency(work.total)}</div>
                </div>
                <div class="work-detail-item">
                    <div class="work-detail-label">Ganancia</div>
                    <div class="work-detail-value" style="color: #4CAF50;">$${formatCurrency(work.profit)}</div>
                </div>
                <div class="work-detail-item">
                    <div class="work-detail-label">Creado</div>
                    <div class="work-detail-value">${formatDate(work.createdAt)}</div>
                </div>
            </div>
            
            <div class="work-actions">
                <button class="btn btn-small btn-primary" onclick="viewWorkDetail('${work.id}')">
                    👁️ Ver Detalles
                </button>
                <button class="btn btn-small btn-secondary" onclick="editWork('${work.id}')">
                    ✏️ Editar
                </button>
                <button class="btn btn-small btn-success" onclick="markAsDone('${work.id}')">
                    ✅ Hecho
                </button>
                <button class="btn btn-small btn-info" onclick="markAsDelivered('${work.id}')">
                    📦 Entregar
                </button>
                <button class="btn btn-small btn-warning" onclick="registerPayment('${work.id}')" ${work.paymentStatus === 'paid' ? 'disabled' : ''}>
                    💳 Pago
                </button>
                <button class="btn btn-small btn-danger" onclick="deleteWork('${work.id}')">
                    🗑️ Borrar
                </button>
            </div>
        </div>
    `;
}

/**
 * Renderiza notificaciones
 */
function renderNotifications() {
    const notifications = workManager.notifications;
    const container = document.getElementById('notificationsList');
    
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = '<div style="padding: 2rem; text-align: center; opacity: 0.5;">No hay notificaciones</div>';
        return;
    }
    
    container.innerHTML = notifications.map(notif => `
        <div class="notification-item ${notif.read ? '' : 'unread'}" onclick="markNotificationRead('${notif.id}')">
            <div style="display: flex; justify-content: between; margin-bottom: 0.5rem;">
                <strong>${workManager.getNotificationIcon(notif.type)} ${notif.title}</strong>
                <small style="opacity: 0.7;">${formatTimeAgo(notif.createdAt)}</small>
            </div>
            <div style="opacity: 0.8;">${notif.message}</div>
        </div>
    `).join('');
}

// ==================== FUNCIONES DE INTERACCIÓN ====================

/**
 * Aplica filtros
 */
function applyFilters() {
    currentFilters = {
        status: document.getElementById('filterStatus')?.value || '',
        paymentStatus: document.getElementById('filterPayment')?.value || '',
        priority: document.getElementById('filterPriority')?.value || '',
        clientName: document.getElementById('filterSearch')?.value || ''
    };
    
    renderWorks();
    updateStatistics();
}

/**
 * Limpia filtros
 */
function clearFilters() {
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterPayment').value = '';
    document.getElementById('filterPriority').value = '';
    document.getElementById('filterSearch').value = '';
    
    currentFilters = {};
    renderWorks();
    updateStatistics();
}

/**
 * Refresca trabajos
 */
async function refreshWorks() {
    await loadSavedWorks();
    renderWorks();
    updateStatistics();
    console.log('[TRABAJOS] 🔄 Datos actualizados');
}

/**
 * Ver detalles de trabajo
 */
function viewWorkDetail(workId) {
    const work = workManager.getWork(workId);
    if (!work) return;
    
    selectedWork = work;
    
    const modal = document.getElementById('workDetailModal');
    const title = document.getElementById('workDetailTitle');
    const body = document.getElementById('workDetailBody');
    
    title.textContent = `Trabajo: ${work.clientName}`;
    body.innerHTML = generateWorkDetailHTML(work);
    
    modal.style.display = 'flex';
}

/**
 * Cierra detalles de trabajo
 */
function closeWorkDetail() {
    const modal = document.getElementById('workDetailModal');
    modal.style.display = 'none';
    selectedWork = null;
}

/**
 * Editar Trabajo (Notas y Prioridad)
 */
window.editWork = async function(workId) {
    const work = workManager.getWork(workId);
    if (!work) return;

    const newNote = prompt('Editar/Agregar Nota:', '');
    if (newNote) {
        workManager.addNote(workId, newNote);
    }
    
    await changePriority(workId); // Reutilizamos la lógica de prioridad
};

/**
 * Cambia estado de trabajo
 */
async function changeWorkStatus(workId) {
    const newStatus = prompt(
        'Selecciona nuevo estado:\n' +
        '1 = Pendiente\n' +
        '2 = En Progreso\n' +
        '3 = Completado\n' +
        '4 = Cancelado'
    );
    
    const statusMap = {
        '1': 'pending',
        '2': 'in_progress',
        '3': 'completed',
        '4': 'cancelled'
    };
    
    if (statusMap[newStatus]) {
        workManager.updateStatus(workId, statusMap[newStatus]);
        await saveWorks();
        renderWorks();
        updateStatistics();
    }
}

/**
 * Marcar como Hecho (Completed)
 */
window.markAsDone = async function(workId) {
    if(!confirm('¿Marcar trabajo como TERMINADO (Hecho)?')) return;
    workManager.updateStatus(workId, 'completed');
    await saveWorks();
    renderWorks();
    updateStatistics();
};

window.markAsDelivered = async function(workId) {
    if(!confirm('¿Marcar trabajo como ENTREGADO?')) return;
    // Podríamos tener un estado específico o usar notas
    workManager.addNote(workId, '📦 Trabajo ENTREGADO al cliente');
    await saveWorks();
    alert('✅ Trabajo marcado como entregado (nota agregada)');
};

/**
 * Cambia prioridad
 */
async function changePriority(workId) {
    const newPriority = prompt(
        'Selecciona prioridad:\n' +
        '1 = Baja\n' +
        '2 = Normal\n' +
        '3 = Alta\n' +
        '4 = URGENTE'
    );
    
    const priorityMap = {
        '1': 'low',
        '2': 'normal',
        '3': 'high',
        '4': 'urgent'
    };
    
    if (priorityMap[newPriority]) {
        workManager.setPriority(workId, priorityMap[newPriority]);
        await saveWorks();
        renderWorks();
    }
}

/**
 * Registrar Pago (Parcial o Total)
 */
window.registerPayment = async function(workId) {
    const work = workManager.getWork(workId);
    if (!work) return;

    const remaining = work.balance || (work.total - (work.paidAmount || 0));
    if (remaining <= 0) {
        alert('Este trabajo ya está pagado completamente.');
        return;
    }

    const amountStr = prompt(`Monto a pagar (Restante: $${formatCurrency(remaining)}):`, remaining);
    if (!amountStr) return;

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        alert('Monto inválido');
        return;
    }

    const method = prompt('Método de pago (Efectivo, Transferencia, etc):', 'Efectivo') || 'Efectivo';
    
    // 1. Actualizar Trabajo
    work.paidAmount = (work.paidAmount || 0) + amount;
    work.balance = work.total - work.paidAmount;
    
    if (work.balance <= 1) { // Tolerancia de $1
        work.paymentStatus = 'paid';
        work.balance = 0;
    }

    workManager.addNote(workId, `💰 Pago recibido: $${formatCurrency(amount)} (${method})`);
    
    // 2. Registrar en Gastos (Ingreso)
    const gastos = await window.mrDataManager.getGastos();
    gastos.push({
        id: `pago_trabajo_${Date.now()}`,
        tipo: 'ingreso',
        descripcion: `Pago Trabajo #${work.id.substr(-6)} - ${work.clientName}`,
        monto: amount,
        fecha: new Date().toISOString(),
        categoria: 'cobro_trabajo'
    });
    await window.mrDataManager.saveGastos(gastos);

    await saveWorks();
    renderWorks();
    updateStatistics();
}

/**
 * Agregar nota
 */
async function addWorkNote(workId) {
    const note = prompt('Escribe una nota:');
    if (!note) return;
    
    workManager.addNote(workId, note);
    await saveWorks();
    
    if (selectedWork && selectedWork.id === workId) {
        viewWorkDetail(workId);
    }
}

/**
 * Borrar Trabajo
 */
window.deleteWork = async function(workId) {
    if (!confirm('⚠️ ¿Estás seguro de BORRAR este trabajo?')) return;
    workManager.deleteWork(workId); // Necesitamos implementar esto en WorkManager o hacerlo manual aquí
    // Manual delete implementation since WorkManager might not have it exposed
    workManager.works = workManager.works.filter(w => w.id !== workId);
    await saveWorks();
    renderWorks();
    updateStatistics();
};

// ==================== NOTIFICACIONES ====================

/**
 * Toggle panel de notificaciones
 */
function toggleNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    panel.classList.toggle('show');
    
    if (panel.classList.contains('show')) {
        renderNotifications();
    }
}

/**
 * Actualiza badge de notificaciones
 */
function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    const count = workManager.getUnreadCount();
    
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

/**
 * Marca notificación como leída
 */
function markNotificationRead(notificationId) {
    workManager.markAsRead(notificationId);
    renderNotifications();
    updateNotificationBadge();
}

/**
 * Marca todas como leídas
 */
function markAllNotificationsRead() {
    workManager.markAllAsRead();
    renderNotifications();
    updateNotificationBadge();
}

// ==================== ESTADÍSTICAS ====================

/**
 * Actualiza estadísticas
 */
function updateStatistics() {
    const works = workManager.getWorks(currentFilters);
    
    const pending = works.filter(w => w.status === 'pending').length;
    const inProgress = works.filter(w => w.status === 'in_progress').length;
    const completed = works.filter(w => w.status === 'completed').length;
    const revenue = works.filter(w => w.paymentStatus === 'paid').reduce((sum, w) => sum + w.total, 0);
    
    document.getElementById('countPending').textContent = pending;
    document.getElementById('countInProgress').textContent = inProgress;
    document.getElementById('countCompleted').textContent = completed;
    document.getElementById('totalRevenue').textContent = '$' + formatCurrency(revenue);
}

// ==================== HELPERS ====================

function generateWorkDetailHTML(work) {
    return `
        <div style="display: grid; gap: 1.5rem;">
            <!-- Cliente -->
            <div>
                <h3 style="margin-bottom: 0.5rem;">👤 Cliente</h3>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
                    <p><strong>Nombre:</strong> ${work.clientName}</p>
                    ${work.clientPhone ? `<p><strong>Teléfono:</strong> ${work.clientPhone}</p>` : ''}
                    ${work.clientEmail ? `<p><strong>Email:</strong> ${work.clientEmail}</p>` : ''}
                    ${work.clientAddress ? `<p><strong>Dirección:</strong> ${work.clientAddress}</p>` : ''}
                </div>
            </div>
            
            <!-- Financiero -->
            <div>
                <h3 style="margin-bottom: 0.5rem;">💰 Financiero</h3>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
                    <p><strong>Subtotal:</strong> $${formatCurrency(work.subtotal)}</p>
                    <p><strong>IVA:</strong> $${formatCurrency(work.iva)}</p>
                    <p><strong>Total:</strong> <span style="color: #51CF66;">$${formatCurrency(work.total)}</span></p>
                    <p><strong>Costo:</strong> <span style="color: #FF6B6B;">$${formatCurrency(work.totalCost)}</span></p>
                    <p><strong>Ganancia:</strong> <span style="color: #4CAF50;">$${formatCurrency(work.profit)}</span></p>
                </div>
            </div>
            
            <!-- Timeline -->
            ${work.timeline && work.timeline.length > 0 ? `
                <div>
                    <h3 style="margin-bottom: 0.5rem;">📅 Historial</h3>
                    <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
                        ${work.timeline.map(item => `
                            <div class="timeline-item">
                                <div style="font-size: 0.85rem; opacity: 0.7;">${formatDate(item.timestamp)}</div>
                                <div>${item.description}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Notas -->
            ${work.notes && work.notes.length > 0 ? `
                <div>
                    <h3 style="margin-bottom: 0.5rem;">📝 Notas</h3>
                    <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
                        ${work.notes.map(note => `
                            <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <div style="font-size: 0.85rem; opacity: 0.7; margin-bottom: 0.25rem;">
                                    ${note.author} - ${formatDate(note.createdAt)}
                                </div>
                                <div>${note.text}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function getStatusBadgeHTML(status) {
    const config = {
        pending: { color: '#FFC107', icon: '⏳', text: 'Pendiente' },
        in_progress: { color: '#2196F3', icon: '🔧', text: 'En Progreso' },
        completed: { color: '#4CAF50', icon: '✅', text: 'Completado' },
        cancelled: { color: '#F44336', icon: '❌', text: 'Cancelado' }
    };
    
    const c = config[status] || config.pending;
    return `<span class="badge" style="background: ${c.color};">${c.icon} ${c.text}</span>`;
}

function getPriorityBadgeHTML(priority) {
    const config = {
        low: { class: 'badge-priority-low', text: '🟢 Baja' },
        normal: { class: 'badge-priority-normal', text: '🟡 Normal' },
        high: { class: 'badge-priority-high', text: '🟠 Alta' },
        urgent: { class: 'badge-priority-urgent', text: '🔴 URGENTE' }
    };
    
    const c = config[priority] || config.normal;
    return `<span class="badge ${c.class}">${c.text}</span>`;
}

function formatCurrency(num) {
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function formatTimeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Hace un momento';
    if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
    return `Hace ${Math.floor(seconds / 86400)} días`;
}

console.log('[TRABAJOS] 📦 Módulo cargado');
