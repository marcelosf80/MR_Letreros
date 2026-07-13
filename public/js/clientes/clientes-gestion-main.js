/**
 * MÃ“DULO DE GESTIÃ“N DE CLIENTES
 * Sistema completo CRUD para gestionar clientes de Gremio y Clientes Finales
 */

// ==================== VARIABLES GLOBALES ====================

let todosLosClientes = [];
let clientesFiltrados = [];
let editingClientId = null;
let currentSort = 'nombre';

// FunciÃ³n de formato de moneda
function formatCurrencyAR(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0,00';
    }
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}

// ==================== INICIALIZACIÃ“N ====================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('[CLIENTES-GESTION] ðŸš€ Inicializando mÃ³dulo...');
    
    // Configurar eventos
    setupEventListeners();
    
    // Cargar clientes
    await loadClientes();
    
    console.log('[CLIENTES-GESTION] âœ… MÃ³dulo listo');
});

function setupEventListeners() {
    // Modal handlers
    const btnClose = document.getElementById('btnCloseClient');
    if (btnClose) btnClose.addEventListener('click', closeClientModal);
    
    const btnCancel = document.getElementById('btnCancelClient');
    if (btnCancel) btnCancel.addEventListener('click', closeClientModal);
    
    const btnSave = document.getElementById('btnSaveClient');
    if (btnSave) btnSave.addEventListener('click', saveCliente);
    
    // Click fuera del modal para cerrar
    const clientModal = document.getElementById('clientModal');
    if (clientModal) clientModal.addEventListener('click', function(e) { if (e.target === this) closeClientModal(); });
    
    const detailsModal = document.getElementById('detailsModal');
    if (detailsModal) detailsModal.addEventListener('click', function(e) { if (e.target === this) closeDetailsModal(); });

    // BÃºsqueda en tiempo real
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterClientes);
    }
}

// ==================== CARGAR CLIENTES ====================

async function loadClientes() {
    try {
        console.log('[CLIENTES-GESTION] ðŸ”— Conectando con base de datos unificada (clientes.json)...');
        
        const token = localStorage.getItem('mr_token');
        if (!token) {
            console.warn('[CLIENTES-GESTION] No hay token, no se pueden cargar clientes.');
            alert('âš ï¸� No has iniciado sesiÃ³n. Por favor, ingresa nuevamente.');
            window.location.href = '/login.html'; // Redirigir si es necesario
            return;
        }
        
        // Cargar desde API (que lee datos_mr_letreros/clientes.json)
        const response = await (window.AUTH ? window.AUTH.fetch('/api/clientes') : fetch('/api/clientes', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }));
        if (!response.ok) {
            throw new Error('Error al cargar clientes');
        }
        
        const data = await response.json();
        todosLosClientes = Array.isArray(data) ? data : (data.clientes || []);
        console.log('[CLIENTES-GESTION] âœ… Clientes cargados:', todosLosClientes.length);
        
        // 1. Renderizar INMEDIATAMENTE (sin esperar facturaciÃ³n)
        filterClientes();
        updateStatistics();

        // Calcular facturaciÃ³n desde trabajos
        await calcularFacturacion();
        
        // Aplicar filtros
        filterClientes();
        
        // Actualizar estadÃ­sticas
        updateStatistics();
        
    } catch (error) {
        console.error('[CLIENTES-GESTION] â�Œ Error cargando clientes:', error);
        todosLosClientes = [];
        const container = document.getElementById('clientesList');
        if (container) {
            container.innerHTML = `<div class="empty-state"><p>â�Œ Error de conexiÃ³n: ${error.message}</p></div>`;
        }
        renderClientes();
    }
}

async function calcularFacturacion() {
    try {
        let trabajos = [];
        
        // 1. Intentar obtener trabajos (Soporte hÃ­brido: mrDataManager o Fetch directo)
        if (window.mrDataManager && typeof window.mrDataManager.getWorks === 'function') {
            const worksData = await window.mrDataManager.getWorks();
            trabajos = worksData.works || [];
        } else {
            // Fallback si no estÃ¡ cargado el manager
            const res = await fetch('/api/trabajos', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('mr_token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                trabajos = data.works || [];
            }
        }
        
        if (!Array.isArray(todosLosClientes)) return;
        
        // La importación de clientes ahora la maneja el backend directamente desde Google Sheets
        
        todosLosClientes = todosLosClientes.map(cliente => {
            // Buscar trabajos de este cliente
            const trabajosCliente = trabajos.filter(t => {
                const nombreTrabajo = (t.clientName || t.cliente || '').trim().toLowerCase();
                const nombreCliente = (cliente.nombre || '').trim().toLowerCase();
                return nombreTrabajo !== '' && nombreTrabajo === nombreCliente;
            });
            
            // Calcular totales
            const totalFacturado = trabajosCliente.reduce((sum, t) => sum + (parseFloat(t.total || t.totalFinal || 0)), 0);
            const cantidadTrabajos = trabajosCliente.length;
            
            return {
                ...cliente,
                totalFacturado,
                cantidadTrabajos,
                ultimoTrabajo: trabajosCliente.length > 0 ? (trabajosCliente[trabajosCliente.length - 1].createdAt || trabajosCliente[trabajosCliente.length - 1].fecha) : null
            };
        });
    } catch (error) {
        console.warn('[CLIENTES-GESTION] Advertencia en cÃ¡lculo de facturaciÃ³n (los clientes se mostrarÃ¡n igual):', error);
    }
}

// ==================== FILTRAR Y ORDENAR ====================

function filterClientes() {
    const searchInput = document.getElementById('searchInput');
    const typeInput = document.getElementById('filterType');
    const statusInput = document.getElementById('filterStatus');

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const filterType = typeInput ? typeInput.value : 'todos';
    const filterStatus = statusInput ? statusInput.value : 'todos';
    
    clientesFiltrados = todosLosClientes.filter(cliente => {
        // Filtro de bÃºsqueda
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
    if (!container) return;
    
    countElement.textContent = clientesFiltrados.length;
    
    if (clientesFiltrados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">ðŸ”�</div>
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
                        ${cliente.tipo === 'gremio' ? 'ðŸŸ¢ GREMIO' : 'ðŸ”µ CLIENTE'}
                    </span>
                    <div class="client-name">${cliente.nombre || 'Sin nombre'}</div>
                </div>
                <div style="text-align: right;">
                    ${cliente.estado === 'inactivo' ? '<span style="color: #FFC107;">â�¸ï¸� Inactivo</span>' : '<span style="color: #51CF66;">âœ… Activo</span>'}
                </div>
            </div>
            
            <div class="client-info">
                ${cliente.telefono ? `
                    <div class="client-info-item">
                        <span>ðŸ“±</span>
                        <span>${cliente.telefono}</span>
                    </div>
                ` : ''}
                
                ${cliente.email ? `
                    <div class="client-info-item">
                        <span>ðŸ“§</span>
                        <span>${cliente.email}</span>
                    </div>
                ` : ''}
                
                ${cliente.direccion ? `
                    <div class="client-info-item">
                        <span>ðŸ“�</span>
                        <span>${cliente.direccion}</span>
                    </div>
                ` : ''}
                
                ${cliente.cuit ? `
                    <div class="client-info-item">
                        <span>ðŸ†”</span>
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
                            <div class="client-stat-label">Ãšltimo trabajo</div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            <div class="client-actions">
                <button class="btn btn-primary btn-small" onclick="viewClientDetails('${cliente.id}')">ðŸ‘�ï¸� Ver Detalles</button>
                <button class="btn btn-secondary btn-small" onclick="editCliente('${cliente.id}')">âœ�ï¸� Editar</button>
                <button class="btn btn-danger btn-small" onclick="deleteCliente('${cliente.id}', '${cliente.nombre}')">ðŸ—‘ï¸� Eliminar</button>
            </div>
        </div>
    `).join('');
}

function updateStatistics() {
    const total = todosLosClientes.length;
    const gremio = todosLosClientes.filter(c => c.tipo === 'gremio').length;
    const clientes = todosLosClientes.filter(c => c.tipo === 'cliente').length;
    const activos = todosLosClientes.filter(c => (c.estado || 'activo') === 'activo').length;
    // VIP si tiene descuento > 0 o muchas compras
    const vip = todosLosClientes.filter(c => (c.descuento > 0) || (c.cantidadTrabajos > 5)).length;
    
    const totalFact = todosLosClientes.reduce((sum, c) => sum + (c.totalFacturado || 0), 0);
    
    if(document.getElementById('totalClientes')) document.getElementById('totalClientes').textContent = total;
    if(document.getElementById('totalGremio')) document.getElementById('totalGremio').textContent = gremio;
    if(document.getElementById('totalClientesFinales')) document.getElementById('totalClientesFinales').textContent = clientes;
    if(document.getElementById('totalActivos')) document.getElementById('totalActivos').textContent = activos;
    if(document.getElementById('totalVIP')) document.getElementById('totalVIP').textContent = vip;
    if(document.getElementById('totalFacturacion')) document.getElementById('totalFacturacion').textContent = '$' + formatCurrencyAR(totalFact);
}

// ==================== MODAL AGREGAR/EDITAR ====================

function openAddClientModal() {
    editingClientId = null;
    document.getElementById('modalTitle').textContent = 'âž• Nuevo Cliente';
    clearClientForm();
    document.getElementById('clientModal').classList.add('active');
}

function editCliente(clientId) {
    const cliente = todosLosClientes.find(c => c.id === clientId);
    if (!cliente) {
        alert('â�Œ Cliente no encontrado');
        return;
    }
    
    editingClientId = clientId;
    document.getElementById('modalTitle').textContent = 'âœ�ï¸� Editar Cliente';
    
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
        alert('âš ï¸� El nombre es obligatorio');
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
        const response = await (window.AUTH ? window.AUTH.fetch('/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedClientes)
        }) : fetch('/api/clientes', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('mr_token')}`
            },
            body: JSON.stringify(updatedClientes)
        }));
        
        if (!response.ok) {
            throw new Error('Error al guardar cliente');
        }
        
        alert(editingClientId ? 'âœ… Cliente actualizado correctamente' : 'âœ… Cliente creado correctamente');
        
        closeClientModal();
        await loadClientes();
        
    } catch (error) {
        console.error('[CLIENTES-GESTION] Error guardando cliente:', error);
        alert('â�Œ Error al guardar el cliente');
    }
}

// ==================== ELIMINAR ====================

async function deleteCliente(clientId, clientName) {
    if (!confirm(`Â¿EstÃ¡s seguro de que quieres eliminar a "${clientName}"?\n\nâš ï¸� Esta acciÃ³n no se puede deshacer.`)) {
        return;
    }
    
    try {
        const updatedClientes = todosLosClientes.filter(c => c.id !== clientId);
        
        const response = await (window.AUTH ? window.AUTH.fetch('/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedClientes)
        }) : fetch('/api/clientes', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('mr_token')}`
            },
            body: JSON.stringify(updatedClientes)
        }));
        
        if (!response.ok) {
            throw new Error('Error al eliminar cliente');
        }
        
        alert('âœ… Cliente eliminado correctamente');
        await loadClientes();
        
    } catch (error) {
        console.error('[CLIENTES-GESTION] Error eliminando cliente:', error);
        alert('â�async function viewClientDetails(clientId) {
    const cliente = todosLosClientes.find(c => c.id === clientId);
    if (!cliente) {
        alert('â�Œ Cliente no encontrado');
        return;
    }
    
    // Obtener trabajos del cliente
    let trabajosCliente = [];
    try {
        const todosTrabajosRes = await fetch('/api/trabajos', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('mr_token')}` }
        });
        const todosTrabajosData = await todosTrabajosRes.json();
        const todosTrabajosArray = todosTrabajosData.works || [];
        
        trabajosCliente = todosTrabajosArray.filter(t => {
            const nombreTrabajo = (t.clientName || t.cliente || '').trim().toLowerCase();
            const nombreCliente = (cliente.nombre || '').trim().toLowerCase();
            return nombreTrabajo !== '' && nombreTrabajo === nombreCliente;
        });
    } catch (error) {
        console.error('Error cargando trabajos:', error);
    }
    
    const detailsContent = `
        <div class="highlight-box">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <h3 style="margin: 0;">${cliente.nombre}</h3>
                    <span class="client-type ${cliente.tipo}">${cliente.tipo === 'gremio' ? 'ðŸŸ¢ GREMIO' : 'ðŸ”µ CLIENTE'}</span>
                </div>
                <div>
                    ${cliente.estado === 'activo' ? '<span style="color: #51CF66;">âœ… Activo</span>' : '<span style="color: #FFC107;">â�¸ï¸� Inactivo</span>'}
                </div>
            </div>
        </div>
        
        <div class="highlight-box">
            <h4>ðŸ“ž InformaciÃ³n de Contacto</h4>
            <div class="form-row">
                <div><strong>TelÃ©fono:</strong> ${cliente.telefono || 'No especificado'}</div>
                <div><strong>Email:</strong> ${cliente.email || 'No especificado'}</div>
            </div>
            <div style="margin-top: 0.5rem;">
                <strong>DirecciÃ³n:</strong> ${cliente.direccion || 'No especificada'}
            </div>
        </div>
        
        <div class="highlight-box">
            <h4>ðŸ’¼ InformaciÃ³n Comercial</h4>
            <div class="form-row">
                <div><strong>CUIT/DNI:</strong> ${cliente.cuit || 'No especificado'}</div>
                <div><strong>CondiciÃ³n IVA:</strong> ${cliente.condicionIVA || 'No especificada'}</div>
            </div>
            <div class="form-row" style="margin-top: 0.5rem;">
                <div><strong>Descuento:</strong> ${cliente.descuento || 0}%</div>
                <div><strong>Registrado:</strong> ${cliente.fechaCreacion ? new Date(cliente.fechaCreacion).toLocaleDateString('es-AR') : 'No especificada'}</div>
            </div>
        </div>
        
        ${cliente.notas ? `
            <div class="highlight-box">
                <h4>ðŸ“� Notas</h4>
                <p style="color: rgba(255,255,255,0.8);">${cliente.notas}</p>
            </div>
        ` : ''}
        
        <div class="highlight-box">
            <h4>ðŸ“Š EstadÃ­sticas</h4>
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
                <h4>ðŸ“‹ Ãšltimos Trabajos</h4>
                ${trabajosCliente.slice(-5).reverse().map(trabajo => `
                    <div style="padding: 0.75rem; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <strong>${trabajo.descripcion || trabajo.description || 'Trabajo sin descripciÃ³n'}</strong>
                            <span style="color: #51CF66;">$${formatCurrencyAR(trabajo.total || trabajo.totalFinal || 0)}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: rgba(255,255,255,0.6);">
                            ðŸ“… ${new Date(trabajo.createdAt || trabajo.fecha || trabajo.createdAt).toLocaleDateString('es-AR')}
                            ${(trabajo.status || trabajo.estado) ? ` â€¢ Estado: ${trabajo.status || trabajo.estado}` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
    
    document.getElementById('detailsTitle').innerHTML = `ðŸ‘¤ ${cliente.nombre}`;
    document.getElementById('detailsContent').innerHTML = detailsContent;
    document.getElementById('detailsModal').classList.add('active');
}stado}` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
    
    document.getElementById('detailsTitle').innerHTML = `ðŸ‘¤ ${cliente.nombre}`;
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
window.buscarClientes = filterClientes; // Conectar botÃ³n buscar

console.log('[CLIENTES-GESTION] ðŸ“¦ MÃ³dulo cargado');
