// ==================== VARIABLES GLOBALES ====================
let workManager;
let currentFilters = {};
let allWorks = [];

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('[TRABAJOS] 🚀 Inicializando...');
    
    // Esperar a que mrDataManager esté disponible
    let attempts = 0;
    while (!window.mrDataManager && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!window.mrDataManager) {
        console.error('[TRABAJOS] ❌ mrDataManager no disponible');
        showError('No se pudo conectar al sistema. Recarga la página.');
        return;
    }
    
    // Inicializar WorkManager
    workManager = new WorkManager();
    
    // Setup listeners
    setupEventListeners();
    
    // Cargar trabajos
    await loadWorks();
    
    console.log('[TRABAJOS] ✅ Sistema listo');
});

// ==================== CARGA DE DATOS ====================
async function loadWorks() {
    const loadingEl = document.getElementById('loadingState');
    const worksListEl = document.getElementById('worksList');
    
    try {
        loadingEl.style.display = 'block';
        worksListEl.style.display = 'none';
        
        console.log('[TRABAJOS] Cargando trabajos desde servidor...');
        
        // Cargar directamente desde el endpoint
        const response = await fetch('/api/trabajos');
        if (!response.ok) {
            throw new Error('Error al cargar trabajos: ' + response.status);
        }
        
        const data = await response.json();
        console.log('[TRABAJOS] Datos recibidos:', data);
        
        // Guardar en WorkManager
        if (data && data.works) {
            workManager.importData(data);
            allWorks = data.works;
            console.log('[TRABAJOS] ✅ Trabajos cargados:', allWorks.length);
        } else {
            allWorks = [];
            console.warn('[TRABAJOS] No hay trabajos disponibles');
        }
        
        // Renderizar
        renderWorks();
        updateStatistics();
        
    } catch (error) {
        console.error('[TRABAJOS] ❌ Error cargando:', error);
        showError('Error al cargar los trabajos: ' + error.message);
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
    
    // Aplicar filtros
    let filteredWorks = [...allWorks];
    
    if (currentFilters.search) {
        const search = currentFilters.search.toLowerCase();
        filteredWorks = filteredWorks.filter(w =>
            (w.clientName || '').toLowerCase().includes(search)
        );
    }
    
    if (currentFilters.status) {
        filteredWorks = filteredWorks.filter(w => w.status === currentFilters.status);
    }
    
    if (currentFilters.payment) {
        filteredWorks = filteredWorks.filter(w => w.paymentStatus === currentFilters.payment);
    }
    
    if (currentFilters.priority) {
        filteredWorks = filteredWorks.filter(w => w.priority === currentFilters.priority);
    }
    
    // Ordenar por fecha (más recientes primero)
    filteredWorks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Renderizar
    if (filteredWorks.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">📋</div>
                <h3>No hay trabajos para mostrar</h3>
                <p>Los trabajos aparecerán aquí cuando apruebes cotizaciones.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredWorks.map(work => generateWorkCard(work)).join('');
}

function generateWorkCard(work) {
    const statusBadge = getStatusBadge(work.status);
    const paymentBadge = getPaymentBadge(work.paymentStatus);
    const priorityBadge = getPriorityBadge(work.priority);
    
    const priorityClass = work.priority === 'urgent' ? 'priority-urgent' : 
                         work.priority === 'high' ? 'priority-high' : '';
    
    return `
        <div class="work-card ${priorityClass}">
            <div class="work-header">
                <div>
                    <div class="work-client">${work.clientName || 'Sin nombre'}</div>
                    ${work.clientPhone ? `<div class="work-client-info">📞 ${work.clientPhone}</div>` : ''}
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end;">
                    ${statusBadge}
                    ${paymentBadge}
                    ${priorityBadge}
                </div>
            </div>
            
            <div class="work-details">
                <div class="work-detail-item">
                    <div class="work-detail-label">ID</div>
                    <div class="work-detail-value" style="font-size: 0.9rem;">#${work.id.substr(-8)}</div>
                </div>
                <div class="work-detail-item">
                    <div class="work-detail-label">Total</div>
                    <div class="work-detail-value" style="color: #51CF66;">$${formatCurrency(work.total)}</div>
                </div>
                <div class="work-detail-item">
                    <div class="work-detail-label">Costo</div>
                    <div class="work-detail-value" style="color: #FF6B6B;">$${formatCurrency(work.totalCost)}</div>
                </div>
                <div class="work-detail-item">
                    <div class="work-detail-label">Ganancia</div>
                    <div class="work-detail-value" style="color: #4CAF50;">$${formatCurrency(work.profit)}</div>
                </div>
                <div class="work-detail-item">
                    <div class="work-detail-label">Pagado</div>
                    <div class="work-detail-value" style="color: #2196F3;">$${formatCurrency(work.paidAmount || 0)}</div>
                </div>
                <div class="work-detail-item">
                    <div class="work-detail-label">Saldo</div>
                    <div class="work-detail-value" style="color: #FFC107;">$${formatCurrency(work.balance)}</div>
                </div>
            </div>
            
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">
                📅 Creado: ${formatDate(work.createdAt)}
            </div>
            
            <div class="work-actions">
                <button class="btn btn-small btn-primary" onclick="changeStatus('${work.id}')">
                    🔄 Cambiar Estado
                </button>
                <button class="btn btn-small btn-success" onclick="markPaid('${work.id}')" ${work.paymentStatus === 'paid' ? 'disabled' : ''}>
                    💳 Marcar Pagado
                </button>
                <button class="btn btn-small btn-warning" onclick="changePriority('${work.id}')">
                    🎯 Prioridad
                </button>
                <button class="btn btn-small btn-info" onclick="addNote('${work.id}')">
                    📝 Nota
                </button>
            </div>
        </div>
    `;
}

// ==================== ESTADÍSTICAS ====================
function updateStatistics() {
    const pending = allWorks.filter(w => w.status === 'pending').length;
    const inProgress = allWorks.filter(w => w.status === 'in_progress').length;
    const completed = allWorks.filter(w => w.status === 'completed').length;
    const revenue = allWorks
        .filter(w => w.paymentStatus === 'paid')
        .reduce((sum, w) => sum + (w.paidAmount || 0), 0);
    
    document.getElementById('countPending').textContent = pending;
    document.getElementById('countInProgress').textContent = inProgress;
    document.getElementById('countCompleted').textContent = completed;
    document.getElementById('totalRevenue').textContent = '$' + formatCurrency(revenue);
}

// ==================== ACCIONES ====================
async function changeStatus(workId) {
    const work = allWorks.find(w => w.id === workId);
    if (!work) return;
    
    const newStatus = prompt(
        'Cambiar estado del trabajo:\n\n' +
        '1 = Pendiente\n' +
        '2 = En Proceso\n' +
        '3 = Completado\n\n' +
        'Estado actual: ' + getStatusLabel(work.status)
    );
    
    const statusMap = {
        '1': 'pending',
        '2': 'in_progress',
        '3': 'completed'
    };
    
    if (statusMap[newStatus]) {
        work.status = statusMap[newStatus];
        work.timeline.push({
            type: 'status_changed',
            description: `Estado cambiado a: ${getStatusLabel(work.status)}`,
            timestamp: new Date().toISOString()
        });
        
        await saveWorks();
        await loadWorks();
    }
}

async function markPaid(workId) {
    const work = allWorks.find(w => w.id === workId);
    if (!work) return;
    
    const amount = parseFloat(prompt('Monto del pago:', work.balance));
    if (!amount || amount <= 0) return;
    
    work.paidAmount = (work.paidAmount || 0) + amount;
    work.balance = work.total - work.paidAmount;
    
    if (work.balance <= 1) {
        work.paymentStatus = 'paid';
    }
    
    work.timeline.push({
        type: 'payment',
        description: `Pago recibido: $${amount}`,
        timestamp: new Date().toISOString()
    });
    
    await saveWorks();
    await loadWorks();
    alert('✅ Pago registrado');
}

async function changePriority(workId) {
    const work = allWorks.find(w => w.id === workId);
    if (!work) return;
    
    const newPriority = prompt(
        'Cambiar prioridad:\n\n' +
        '1 = Normal\n' +
        '2 = Alta\n' +
        '3 = URGENTE'
    );
    
    const priorityMap = {
        '1': 'normal',
        '2': 'high',
        '3': 'urgent'
    };
    
    if (priorityMap[newPriority]) {
        work.priority = priorityMap[newPriority];
        work.timeline.push({
            type: 'priority_changed',
            description: `Prioridad: ${work.priority}`,
            timestamp: new Date().toISOString()
        });
        
        await saveWorks();
        await loadWorks();
    }
}

async function addNote(workId) {
    const work = allWorks.find(w => w.id === workId);
    if (!work) return;
    
    const note = prompt('Agregar nota:');
    if (!note) return;
    
    if (!work.notes) work.notes = [];
    work.notes.push({
        text: note,
        date: new Date().toISOString(),
        author: 'Usuario'
    });
    
    work.timeline.push({
        type: 'note_added',
        description: 'Nota agregada',
        timestamp: new Date().toISOString()
    });
    
    await saveWorks();
    await loadWorks();
}

async function saveWorks() {
    try {
        const data = { works: allWorks, notifications: [] };
        const response = await fetch('/api/trabajos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Error al guardar');
        }
        
        console.log('[TRABAJOS] ✅ Guardado exitoso');
    } catch (error) {
        console.error('[TRABAJOS] ❌ Error guardando:', error);
        alert('Error al guardar los cambios');
    }
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
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterPayment').value = '';
    document.getElementById('filterPriority').value = '';
    currentFilters = {};
    renderWorks();
}

// ==================== NOTIFICACIONES ====================
function setupEventListeners() {
    document.getElementById('btnNotifications').addEventListener('click', toggleNotificationPanel);
    document.getElementById('filterSearch').addEventListener('input', applyFilters);
}

function toggleNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    panel.classList.toggle('show');
}

// ==================== HELPERS ====================
function getStatusBadge(status) {
    const badges = {
        pending: '<span class="badge badge-status-pending">⏳ Pendiente</span>',
        in_progress: '<span class="badge badge-status-in_progress">🔧 En Proceso</span>',
        completed: '<span class="badge badge-status-completed">✅ Completado</span>'
    };
    return badges[status] || '';
}

function getPaymentBadge(status) {
    const badges = {
        paid: '<span class="badge badge-payment-paid">💳 Pagado</span>',
        pending: '<span class="badge badge-payment-pending">💰 Pendiente</span>'
    };
    return badges[status] || '';
}

function getPriorityBadge(priority) {
    const badges = {
        normal: '<span class="badge badge-priority-normal">🟡 Normal</span>',
        high: '<span class="badge badge-priority-high">🟠 Alta</span>',
        urgent: '<span class="badge badge-priority-urgent">🔴 URGENTE</span>'
    };
    return badges[priority] || '';
}

function getStatusLabel(status) {
    const labels = {
        pending: 'Pendiente',
        in_progress: 'En Proceso',
        completed: 'Completado'
    };
    return labels[status] || status;
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

function showError(message) {
    const container = document.getElementById('worksList');
    container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">❌</div>
            <h3>Error</h3>
            <p>${message}</p>
            <button class="btn btn-primary" onclick="loadWorks()">Reintentar</button>
        </div>
    `;
}

console.log('[TRABAJOS] 📦 Módulo cargado');
