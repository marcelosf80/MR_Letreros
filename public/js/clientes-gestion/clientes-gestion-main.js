/**
 * MÓDULO DE GESTIÓN DE CLIENTES
 * Sistema completo CRUD para gestionar clientes de Gremio y Clientes Finales
 */

// ==================== VARIABLES GLOBALES ====================

let todosLosClientes = [];
let clientesFiltrados = [];
let editingClientId = null;
let currentSort = 'nombre';

// Función de formato de moneda
function formatCurrencyAR(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0,00';
    }
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('[CLIENTES-GESTION] 🚀 Inicializando módulo...');
    
    // Configurar eventos
    setupEventListeners();
    
    // Cargar clientes
    await loadClientes();
    
    console.log('[CLIENTES-GESTION] ✅ Módulo listo');
});

function setupEventListeners() {
    // Modal handlers
    document.getElementById('btnCloseClient').addEventListener('click', closeClientModal);
    document.getElementById('btnCancelClient').addEventListener('click', closeClientModal);
    document.getElementById('btnSaveClient').addEventListener('click', saveCliente);
    
    // Filtros
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterClientes);
    }
    
    // Click fuera del modal para cerrar
    document.getElementById('clientModal').addEventListener('click', function(e) {
        if (e.target === this) closeClientModal();
    });
    
    document.getElementById('detailsModal').addEventListener('click', function(e) {
        if (e.target === this) closeDetailsModal();
    });
    
    console.log('[CLIENTES-GESTION] ✅ Event listeners configurados');
}

// ==================== CARGAR CLIENTES ====================

async function loadClientes() {
    try {
        console.log('[CLIENTES-GESTION] Cargando clientes...');
        
        // Cargar desde API
        const response = await fetch('/api/clientes');
        if (!response.ok) {
            throw new Error('Error al cargar clientes');
        }
        
        todosLosClientes = await response.json();
        console.log('[CLIENTES-GESTION] ✅ Clientes cargados:', todosLosClientes.length);
        
        // Calcular facturación desde trabajos
        await calcularFacturacion();
        
        // Aplicar filtros
        filterClientes();
        
        // Actualizar estadísticas
        updateStatistics();
        
    } catch (error) {
        console.error('[CLIENTES-GESTION] ❌ Error cargando clientes:', error);
        todosLosClientes = [];
        renderClientes();
    }
}

async function calcularFacturacion() {
    try {
        // Obtener trabajos para calcular facturación
        const trabajos = await window.mrDataManager.getTrabajosAprobados();
        
        todosLosClientes = todosLosClientes.map(cliente => {
            // Buscar trabajos de este cliente
            const trabajosCliente = trabajos.filter(t => {
                const nombreTrabajo = (t.clientName || t.cliente || '').toLowerCase();
                const nombreCliente = (cliente.nombre || '').toLowerCase();
                return nombreTrabajo.includes(nombreCliente) || nombreCliente.includes(nombreTrabajo);
            });
            
            // Calcular totales
            const totalFacturado = trabajosCliente.reduce((sum, t) => sum + (parseFloat(t.totalFinal || t.total || 0)), 0);
            const cantidadTrabajos = trabajosCliente.length;
            
            return {
                ...cliente,
                totalFacturado,
                cantidadTrabajos,
                ultimoTrabajo: trabajosCliente.length > 0 ? trabajosCliente[trabajosCliente.length - 1].fecha : null
            };
        });
    } catch (error) {
        console.error('[CLIENTES-GESTION] Error calculando facturación:', error);
    }
}

// ==================== FILTRAR Y ORDENAR ====================

function filterClientes() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filterType = document.getElementById('filterType').value;
    const filterStatus = document.getElementById('filterStatus').value;
    
    clientesFiltrados = todosLosClientes.filter(cliente => {
        // Filtro de búsqueda
        const matchSearch = !searchTerm || 
            (cliente.nombre || '').toLowerCase().includes(searchTerm) ||
            (cliente.telefono || '').toLowerCase().includes(searchTerm) ||
            (cliente.email || '').toLowerCase().includes(searchTerm) ||
            (cliente.direccion || '').toLowerCase().includes(searchTerm);
        
        // Filtro de tipo
        const matchType = filterType === 'todos' || cliente.tipo === filterType;
        
        // Filtro de estado
        const matchStatus = filterStatus === 'todos' || (cliente.estado || 'activo') === filterStatus;
        
        return matchSearch && matchType && matchStatus;
    });
    
    // Aplicar ordenamiento actual
    sortClientesArray(currentSort);
    
    // Renderizar
    renderClientes();
}

function sortClientes(tipo) {
    currentSort = tipo;
    sortClientesArray(tipo);
    renderClientes();
}

function sortClientesArray(tipo) {
    clientesFiltrados.sort((a, b) => {
        switch(tipo) {
            case 'nombre':
                return (a.nombre || '').localeCompare(b.nombre || '');
            case 'fecha':
                const fechaA = new Date(a.fechaCreacion || 0);
                const fechaB = new Date(b.fechaCreacion || 0);
                return fechaB - fechaA;
            case 'facturacion':
                return (b.totalFacturado || 0) - (a.totalFacturado || 0);
            default:
                return 0;
        }
    });
}

// ==================== RENDERIZAR ====================

function renderClientes() {
    const container = document.getElementById('clientesList');
    const countElement = document.getElementById('clientesCount');
    
    countElement.textContent = clientesFiltrados.length;
    
    if (clientesFiltrados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p>No se encontraron clientes con los filtros aplicados</p>
                <button class="btn btn-secondary" onclick="clearFilters()">Limpiar Filtros</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = clientesFiltrados.map(cliente => `
        <div class="client-card">
            <div class="client-header">
                <div>
                    <span class="client-type ${cliente.tipo || 'cliente'}">
                        ${cliente.tipo === 'gremio' ? '🟢 GREMIO' : '🔵 CLIENTE'}
                    </span>
                    <div class="client-name">${cliente.nombre || 'Sin nombre'}</div>
                </div>
                <div style="text-align: right;">
                    ${cliente.estado === 'inactivo' ? '<span style="color: #FFC107;">⏸️ Inactivo</span>' : '<span style="color: #51CF66;">✅ Activo</span>'}
                </div>
            </div>
            
            <div class="client-info">
                ${cliente.telefono ? `
                    <div class="client-info-item">
                        <span>📱</span>
                        <span>${cliente.telefono}</span>
                    </div>
                ` : ''}
                
                ${cliente.email ? `
                    <div class="client-info-item">
                        <span>📧</span>
                        <span>${cliente.email}</span>
                    </div>
                ` : ''}
                
                ${cliente.direccion ? `
                    <div class="client-info-item">
                        <span>📍</span>
                        <span>${cliente.direccion}</span>
                    </div>
                ` : ''}
                
                ${cliente.cuit ? `
                    <div class="client-info-item">
                        <span>🆔</span>
                        <span>${cliente.cuit}</span>
                    </div>
                ` : ''}
            </div>
            
            ${(cliente.totalFacturado > 0 || cliente.cantidadTrabajos > 0) ? `
                <div class="client-stats">
                    <div class="client-stat">
                        <div class="client-stat-value">${cliente.cantidadTrabajos || 0}</div>
                        <div class="client-stat-label">Trabajos</div>
                    </div>
                    <div class="client-stat">
                        <div class="client-stat-value">$${formatCurrencyAR(cliente.totalFacturado || 0)}</div>
                        <div class="client-stat-label">Facturado</div>
                    </div>
                    ${cliente.ultimoTrabajo ? `
                        <div class="client-stat">
                            <div class="client-stat-value" style="font-size: 1rem;">${new Date(cliente.ultimoTrabajo).toLocaleDateString('es-AR')}</div>
                            <div class="client-stat-label">Último trabajo</div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            <div class="client-actions">
                <button class="btn btn-primary btn-small" onclick="viewClientDetails('${cliente.id}')">👁️ Ver Detalles</button>
                <button class="btn btn-secondary btn-small" onclick="editCliente('${cliente.id}')">✏️ Editar</button>
                <button class="btn btn-danger btn-small" onclick="deleteCliente('${cliente.id}', '${cliente.nombre}')">🗑️ Eliminar</button>
            </div>
        </div>
    `).join('');
}

function updateStatistics() {
    const total = todosLosClientes.length;
    const gremio = todosLosClientes.filter(c => c.tipo === 'gremio').length;
    const clientes = todosLosClientes.filter(c => c.tipo === 'cliente').length;
    const totalFact = todosLosClientes.reduce((sum, c) => sum + (c.totalFacturado || 0), 0);
    
    document.getElementById('totalClientes').textContent = total;
    document.getElementById('totalGremio').textContent = gremio;
    document.getElementById('totalClientesFinales').textContent = clientes;
    document.getElementById('totalFacturacion').textContent = '$' + formatCurrencyAR(totalFact);
}

// ==================== MODAL AGREGAR/EDITAR ====================

function openAddClientModal() {
    editingClientId = null;
    document.getElementById('modalTitle').textContent = '➕ Nuevo Cliente';
    clearClientForm();
    document.getElementById('clientModal').classList.add('active');
}

function editCliente(clientId) {
    const cliente = todosLosClientes.find(c => c.id === clientId);
    if (!cliente) {
        alert('❌ Cliente no encontrado');
        return;
    }
    
    editingClientId = clientId;
    document.getElementById('modalTitle').textContent = '✏️ Editar Cliente';
    
    // Llenar formulario
    document.getElementById('clientTipo').value = cliente.tipo || 'cliente';
    document.getElementById('clientNombre').value = cliente.nombre || '';
    document.getElementById('clientTelefono').value = cliente.telefono || '';
    document.getElementById('clientEmail').value = cliente.email || '';
    document.getElementById('clientDireccion').value = cliente.direccion || '';
    document.getElementById('clientCuit').value = cliente.cuit || '';
    document.getElementById('clientCondicionIVA').value = cliente.condicionIVA || '';
    document.getElementById('clientDescuento').value = cliente.descuento || 0;
    document.getElementById('clientEstado').value = cliente.estado || 'activo';
    document.getElementById('clientNotas').value = cliente.notas || '';
    
    document.getElementById('clientModal').classList.add('active');
}

function closeClientModal() {
    document.getElementById('clientModal').classList.remove('active');
    editingClientId = null;
    clearClientForm();
}

function clearClientForm() {
    document.getElementById('clientTipo').value = 'cliente';
    document.getElementById('clientNombre').value = '';
    document.getElementById('clientTelefono').value = '';
    document.getElementById('clientEmail').value = '';
    document.getElementById('clientDireccion').value = '';
    document.getElementById('clientCuit').value = '';
    document.getElementById('clientCondicionIVA').value = '';
    document.getElementById('clientDescuento').value = 0;
    document.getElementById('clientEstado').value = 'activo';
    document.getElementById('clientNotas').value = '';
}

async function saveCliente() {
    const nombre = document.getElementById('clientNombre').value.trim();
    
    if (!nombre) {
        alert('⚠️ El nombre es obligatorio');
        return;
    }
    
    const clienteData = {
        id: editingClientId || Date.now().toString(),
        tipo: document.getElementById('clientTipo').value,
        nombre: nombre,
        telefono: document.getElementById('clientTelefono').value.trim(),
        email: document.getElementById('clientEmail').value.trim(),
        direccion: document.getElementById('clientDireccion').value.trim(),
        cuit: document.getElementById('clientCuit').value.trim(),
        condicionIVA: document.getElementById('clientCondicionIVA').value,
        descuento: parseFloat(document.getElementById('clientDescuento').value) || 0,
        estado: document.getElementById('clientEstado').value,
        notas: document.getElementById('clientNotas').value.trim(),
        fechaCreacion: editingClientId ? 
            (todosLosClientes.find(c => c.id === editingClientId)?.fechaCreacion) : 
            new Date().toISOString(),
        fechaModificacion: new Date().toISOString()
    };
    
    try {
        let updatedClientes;
        
        if (editingClientId) {
            // Actualizar existente
            updatedClientes = todosLosClientes.map(c => 
                c.id === editingClientId ? {...c, ...clienteData} : c
            );
        } else {
            // Agregar nuevo
            updatedClientes = [...todosLosClientes, clienteData];
        }
        
        // Guardar en servidor
        const response = await fetch('/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedClientes)
        });
        
        if (!response.ok) {
            throw new Error('Error al guardar cliente');
        }
        
        alert(editingClientId ? '✅ Cliente actualizado correctamente' : '✅ Cliente creado correctamente');
        
        closeClientModal();
        await loadClientes();
        
    } catch (error) {
        console.error('[CLIENTES-GESTION] Error guardando cliente:', error);
        alert('❌ Error al guardar el cliente');
    }
}

// ==================== ELIMINAR ====================

async function deleteCliente(clientId, clientName) {
    if (!confirm(`¿Estás seguro de que quieres eliminar a "${clientName}"?\n\n⚠️ Esta acción no se puede deshacer.`)) {
        return;
    }
    
    try {
        const updatedClientes = todosLosClientes.filter(c => c.id !== clientId);
        
        const response = await fetch('/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedClientes)
        });
        
        if (!response.ok) {
            throw new Error('Error al eliminar cliente');
        }
        
        alert('✅ Cliente eliminado correctamente');
        await loadClientes();
        
    } catch (error) {
        console.error('[CLIENTES-GESTION] Error eliminando cliente:', error);
        alert('❌ Error al eliminar el cliente');
    }
}

// ==================== VER DETALLES ====================

async function viewClientDetails(clientId) {
    const cliente = todosLosClientes.find(c => c.id === clientId);
    if (!cliente) {
        alert('❌ Cliente no encontrado');
        return;
    }
    
    // Obtener trabajos del cliente
    let trabajosCliente = [];
    try {
        const todosTrabajosRes = await fetch('/api/trabajos');
        const todosTrabajosData = await todosTrabajosRes.json();
        const todosTrabajosArray = Array.isArray(todosTrabajosData) ? todosTrabajosData : [];
        
        trabajosCliente = todosTrabajosArray.filter(t => {
            const nombreTrabajo = (t.clientName || t.cliente || '').toLowerCase();
            const nombreCliente = (cliente.nombre || '').toLowerCase();
            return nombreTrabajo.includes(nombreCliente) || nombreCliente.includes(nombreTrabajo);
        });
    } catch (error) {
        console.error('Error cargando trabajos:', error);
    }
    
    const detailsContent = `
        <div class="highlight-box">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <h3 style="margin: 0;">${cliente.nombre}</h3>
                    <span class="client-type ${cliente.tipo}">${cliente.tipo === 'gremio' ? '🟢 GREMIO' : '🔵 CLIENTE'}</span>
                </div>
                <div>
                    ${cliente.estado === 'activo' ? '<span style="color: #51CF66;">✅ Activo</span>' : '<span style="color: #FFC107;">⏸️ Inactivo</span>'}
                </div>
            </div>
        </div>
        
        <div class="highlight-box">
            <h4>📞 Información de Contacto</h4>
            <div class="form-row">
                <div><strong>Teléfono:</strong> ${cliente.telefono || 'No especificado'}</div>
                <div><strong>Email:</strong> ${cliente.email || 'No especificado'}</div>
            </div>
            <div style="margin-top: 0.5rem;">
                <strong>Dirección:</strong> ${cliente.direccion || 'No especificada'}
            </div>
        </div>
        
        <div class="highlight-box">
            <h4>💼 Información Comercial</h4>
            <div class="form-row">
                <div><strong>CUIT/DNI:</strong> ${cliente.cuit || 'No especificado'}</div>
                <div><strong>Condición IVA:</strong> ${cliente.condicionIVA || 'No especificada'}</div>
            </div>
            <div class="form-row" style="margin-top: 0.5rem;">
                <div><strong>Descuento:</strong> ${cliente.descuento || 0}%</div>
                <div><strong>Registrado:</strong> ${new Date(cliente.fechaCreacion).toLocaleDateString('es-AR')}</div>
            </div>
        </div>
        
        ${cliente.notas ? `
            <div class="highlight-box">
                <h4>📝 Notas</h4>
                <p style="color: rgba(255,255,255,0.8);">${cliente.notas}</p>
            </div>
        ` : ''}
        
        <div class="highlight-box">
            <h4>📊 Estadísticas</h4>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${cliente.cantidadTrabajos || 0}</div>
                    <div class="stat-label">Trabajos Realizados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">$${formatCurrencyAR(cliente.totalFacturado || 0)}</div>
                    <div class="stat-label">Total Facturado</div>
                </div>
                ${cliente.cantidadTrabajos > 0 ? `
                    <div class="stat-card">
                        <div class="stat-value">$${formatCurrencyAR((cliente.totalFacturado || 0) / (cliente.cantidadTrabajos || 1))}</div>
                        <div class="stat-label">Promedio por Trabajo</div>
                    </div>
                ` : ''}
            </div>
        </div>
        
        ${trabajosCliente.length > 0 ? `
            <div class="highlight-box">
                <h4>📋 Últimos Trabajos</h4>
                ${trabajosCliente.slice(-5).reverse().map(trabajo => `
                    <div style="padding: 0.75rem; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <strong>${trabajo.description || 'Trabajo sin descripción'}</strong>
                            <span style="color: #51CF66;">$${formatCurrencyAR(trabajo.totalFinal || trabajo.total || 0)}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: rgba(255,255,255,0.6);">
                            📅 ${new Date(trabajo.fecha).toLocaleDateString('es-AR')}
                            ${trabajo.estado ? ` • Estado: ${trabajo.estado}` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
    
    document.getElementById('detailsTitle').innerHTML = `👤 ${cliente.nombre}`;
    document.getElementById('detailsContent').innerHTML = detailsContent;
    document.getElementById('detailsModal').classList.add('active');
}

function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('active');
}

// ==================== UTILIDADES ====================

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterType').value = 'todos';
    document.getElementById('filterStatus').value = 'todos';
    filterClientes();
}

// Exportar funciones globales
window.openAddClientModal = openAddClientModal;
window.editCliente = editCliente;
window.deleteCliente = deleteCliente;
window.viewClientDetails = viewClientDetails;
window.closeDetailsModal = closeDetailsModal;
window.loadClientes = loadClientes;
window.filterClientes = filterClientes;
window.sortClientes = sortClientes;
window.clearFilters = clearFilters;

console.log('[CLIENTES-GESTION] 📦 Módulo cargado');

// ==================== INICIALIZACIÓN ====================

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    console.log('[CLIENTES-GESTION] 🚀 Inicializando...');
    
    // Configurar event listeners
    setupEventListeners();
    
    // Cargar clientes iniciales
    loadClientes();
    
    console.log('[CLIENTES-GESTION] ✅ Inicializado correctamente');
}

