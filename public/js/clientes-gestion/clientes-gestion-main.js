/**
 * MÓDULO DE GESTIÓN DE CLIENTES — MR LETREROS
 * Archivo: public/js/clientes-gestion/clientes-gestion-main.js
 *
 * CORRECCIONES:
 *  ✅ Archivo completamente reescrito (el original estaba corrupto)
 *  ✅ Token: usa localStorage.getItem('mr_token') — clave correcta
 *  ✅ Clientes del Asistente (sin id/tipo) → se normalizan al cargar
 *  ✅ calcularFacturacion usa fetch directo (getTrabajosAprobados no existe)
 *  ✅ IDs de estadísticas coinciden con clientes-gestion.html
 */

let todosLosClientes  = [];
let clientesFiltrados = [];
let editingClientId   = null;
let currentSort       = 'nombre';

function getToken() {
    return localStorage.getItem('mr_token') || '';
}

function formatCurrencyAR(num) {
    if (!num || isNaN(num)) return '0';
    return new Intl.NumberFormat('es-AR').format(num);
}

// ==================== INICIO ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[CLIENTES-GESTION] Inicializando...');
    setupEventListeners();
    await loadClientes();
    console.log('[CLIENTES-GESTION] ✅ Listo');
});

function setupEventListeners() {
    document.getElementById('btnCloseClient').addEventListener('click',  closeClientModal);
    document.getElementById('btnCancelClient').addEventListener('click', closeClientModal);
    document.getElementById('btnSaveClient').addEventListener('click',   saveCliente);
    document.getElementById('clientModal').addEventListener('click',   e => { if (e.target === e.currentTarget) closeClientModal(); });
    document.getElementById('detailsModal').addEventListener('click',  e => { if (e.target === e.currentTarget) closeDetailsModal(); });
}

// ==================== CARGAR ====================
async function loadClientes() {
    try {
        const response = await fetch('/api/clientes', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const raw = await response.json();

        // Normalizar: clientes del Asistente no tienen id ni tipo
        todosLosClientes = raw.map((c, i) => ({
            id:            c.id    || `cli_${i}_${String(Date.now()).slice(-5)}`,
            tipo:          c.tipo  || 'cliente',
            estado:        c.estado || 'activo',
            nombre:        c.nombre || c.name || 'Sin nombre',
            telefono:      c.telefono  || '',
            email:         c.email     || '',
            direccion:     c.direccion || '',
            cuit:          c.cuit      || '',
            condicionIVA:  c.condicionIVA || '',
            descuento:     c.descuento    || 0,
            notas:         c.notas        || '',
            fechaCreacion: c.fechaCreacion || c.createdAt || c.fechaRegistro || new Date().toISOString(),
            totalFacturado:   0,
            cantidadTrabajos: 0,
            ultimoTrabajo:    null
        }));

        console.log('[CLIENTES-GESTION] Clientes:', todosLosClientes.length);
        await calcularFacturacion();
        filterClientes();
        updateStatistics();

    } catch (err) {
        console.error('[CLIENTES-GESTION] Error cargando:', err);
        todosLosClientes = [];
        renderClientes();
    }
}

async function calcularFacturacion() {
    try {
        const res = await fetch('/api/trabajos', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) return;
        const { works = [] } = await res.json();

        todosLosClientes = todosLosClientes.map(c => {
            const nc = (c.nombre || '').toLowerCase();
            if (nc.length < 2) return c;
            const suyos = works.filter(t => {
                const nt = (t.clientName || '').toLowerCase();
                return nt.includes(nc) || nc.includes(nt);
            });
            return {
                ...c,
                totalFacturado:   suyos.reduce((s, t) => s + (t.total || 0), 0),
                cantidadTrabajos: suyos.length,
                ultimoTrabajo:    suyos.length ? suyos[suyos.length - 1].createdAt : null
            };
        });
    } catch (e) {
        console.warn('No se calculó facturación:', e.message);
    }
}

// ==================== FILTRAR ====================
function filterClientes() {
    const search  = document.getElementById('searchInput').value.toLowerCase();
    const tipo    = document.getElementById('filterType').value;
    const estado  = document.getElementById('filterStatus').value;

    clientesFiltrados = todosLosClientes.filter(c => {
        const okSearch = !search
            || (c.nombre   || '').toLowerCase().includes(search)
            || (c.telefono || '').includes(search)
            || (c.email    || '').toLowerCase().includes(search);
        const okTipo   = !tipo   || tipo   === 'todos' || c.tipo === tipo;
        const okEstado = !estado || estado === 'todos' || (c.estado || 'activo') === estado;
        return okSearch && okTipo && okEstado;
    });

    sortClientesArray(currentSort);
    renderClientes();
}

function sortClientes(tipo) { currentSort = tipo; sortClientesArray(tipo); renderClientes(); }

function sortClientesArray(tipo) {
    clientesFiltrados.sort((a, b) => {
        if (tipo === 'fecha')       return new Date(b.fechaCreacion||0) - new Date(a.fechaCreacion||0);
        if (tipo === 'facturacion') return (b.totalFacturado||0) - (a.totalFacturado||0);
        return (a.nombre||'').localeCompare(b.nombre||'');
    });
}

// ==================== RENDERIZAR ====================
function renderClientes() {
    const container = document.getElementById('clientesList');
    document.getElementById('clientesCount').textContent = clientesFiltrados.length;

    if (!clientesFiltrados.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p>No hay clientes con esos filtros</p>
                <button class="btn btn-secondary" onclick="clearFilters()">Limpiar Filtros</button>
            </div>`;
        return;
    }

    container.innerHTML = clientesFiltrados.map(c => `
        <div class="client-card">
            <div class="client-header">
                <div>
                    <span class="client-type ${c.tipo||'cliente'}">
                        ${c.tipo === 'gremio' ? '🟢 GREMIO' : '🔵 CLIENTE'}
                    </span>
                    <div class="client-name">${c.nombre}</div>
                </div>
                <div>${c.estado==='inactivo'
                    ? '<span style="color:#FFC107">⏸️ Inactivo</span>'
                    : '<span style="color:#51CF66">✅ Activo</span>'}</div>
            </div>

            <div class="client-info">
                ${c.telefono  ? `<div class="client-info-item"><span>📱</span><span>${c.telefono}</span></div>` : ''}
                ${c.email     ? `<div class="client-info-item"><span>📧</span><span>${c.email}</span></div>` : ''}
                ${c.direccion ? `<div class="client-info-item"><span>📍</span><span>${c.direccion}</span></div>` : ''}
            </div>

            ${c.cantidadTrabajos > 0 ? `
                <div class="client-stats">
                    <div class="client-stat">
                        <div class="client-stat-value">${c.cantidadTrabajos}</div>
                        <div class="client-stat-label">Trabajos</div>
                    </div>
                    <div class="client-stat">
                        <div class="client-stat-value">$${formatCurrencyAR(c.totalFacturado)}</div>
                        <div class="client-stat-label">Facturado</div>
                    </div>
                </div>` : ''}

            <div class="client-actions">
                <button class="btn btn-primary btn-small"   onclick="viewClientDetails('${c.id}')">👁️ Ver</button>
                <button class="btn btn-secondary btn-small" onclick="editCliente('${c.id}')">✏️ Editar</button>
                <button class="btn btn-danger btn-small"    onclick="deleteCliente('${c.id}','${(c.nombre).replace(/'/g,"\\'")}')">🗑️ Eliminar</button>
            </div>
        </div>
    `).join('');
}

function updateStatistics() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('totalClientes', todosLosClientes.length);
    set('totalGremio',   todosLosClientes.filter(c => c.tipo === 'gremio').length);
    set('totalFinales',  todosLosClientes.filter(c => c.tipo !== 'gremio').length);
    set('totalActivos',  todosLosClientes.filter(c => (c.estado||'activo') === 'activo').length);
    set('totalVIP',      todosLosClientes.filter(c => (c.totalFacturado||0) > 100000).length);
}

// ==================== MODAL ====================
function openAddClientModal() {
    editingClientId = null;
    document.getElementById('modalTitle').textContent = '➕ Nuevo Cliente';
    clearClientForm();
    document.getElementById('clientModal').classList.add('active');
}

function editCliente(id) {
    const c = todosLosClientes.find(x => x.id === id);
    if (!c) { alert('❌ Cliente no encontrado'); return; }
    editingClientId = id;
    document.getElementById('modalTitle').textContent = '✏️ Editar Cliente';
    document.getElementById('clientTipo').value         = c.tipo         || 'cliente';
    document.getElementById('clientNombre').value       = c.nombre       || '';
    document.getElementById('clientTelefono').value     = c.telefono     || '';
    document.getElementById('clientEmail').value        = c.email        || '';
    document.getElementById('clientDireccion').value    = c.direccion    || '';
    document.getElementById('clientCuit').value         = c.cuit         || '';
    document.getElementById('clientCondicionIVA').value = c.condicionIVA || '';
    document.getElementById('clientDescuento').value    = c.descuento    || 0;
    document.getElementById('clientEstado').value       = c.estado       || 'activo';
    document.getElementById('clientNotas').value        = c.notas        || '';
    document.getElementById('clientModal').classList.add('active');
}

function closeClientModal() {
    document.getElementById('clientModal').classList.remove('active');
    editingClientId = null;
    clearClientForm();
}

function clearClientForm() {
    const vals = { clientTipo:'cliente', clientNombre:'', clientTelefono:'', clientEmail:'',
        clientDireccion:'', clientCuit:'', clientCondicionIVA:'', clientDescuento:0,
        clientEstado:'activo', clientNotas:'' };
    Object.entries(vals).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v; });
}

async function saveCliente() {
    const nombre = document.getElementById('clientNombre').value.trim();
    if (!nombre) { alert('⚠️ El nombre es obligatorio'); return; }

    const data = {
        id:           editingClientId || Date.now().toString(),
        tipo:         document.getElementById('clientTipo').value,
        nombre,
        telefono:     document.getElementById('clientTelefono').value.trim(),
        email:        document.getElementById('clientEmail').value.trim(),
        direccion:    document.getElementById('clientDireccion').value.trim(),
        cuit:         document.getElementById('clientCuit').value.trim(),
        condicionIVA: document.getElementById('clientCondicionIVA').value,
        descuento:    parseFloat(document.getElementById('clientDescuento').value) || 0,
        estado:       document.getElementById('clientEstado').value,
        notas:        document.getElementById('clientNotas').value.trim(),
        fechaCreacion: editingClientId
            ? (todosLosClientes.find(c => c.id === editingClientId)?.fechaCreacion || new Date().toISOString())
            : new Date().toISOString(),
        fechaModificacion: new Date().toISOString()
    };

    const lista = editingClientId
        ? todosLosClientes.map(c => c.id === editingClientId ? {...c, ...data} : c)
        : [...todosLosClientes, data];

    try {
        const res = await fetch('/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify(lista)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        alert(editingClientId ? '✅ Cliente actualizado' : '✅ Cliente creado');
        closeClientModal();
        await loadClientes();
    } catch (err) {
        console.error(err);
        alert('❌ Error al guardar');
    }
}

async function deleteCliente(id, nombre) {
    if (!confirm(`¿Eliminar a "${nombre}"?\n\n⚠️ No se puede deshacer.`)) return;
    const lista = todosLosClientes.filter(c => c.id !== id);
    try {
        const res = await fetch('/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify(lista)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        alert('✅ Cliente eliminado');
        await loadClientes();
    } catch (err) {
        alert('❌ Error al eliminar');
    }
}

async function viewClientDetails(id) {
    const c = todosLosClientes.find(x => x.id === id);
    if (!c) { alert('❌ No encontrado'); return; }

    let works = [];
    try {
        const res = await fetch('/api/trabajos', { headers: { 'Authorization': `Bearer ${getToken()}` } });
        if (res.ok) {
            const d = await res.json();
            const nc = c.nombre.toLowerCase();
            works = (d.works||[]).filter(t => (t.clientName||'').toLowerCase().includes(nc));
        }
    } catch(e){}

    document.getElementById('detailsTitle').innerHTML = `👤 ${c.nombre}`;
    document.getElementById('detailsContent').innerHTML = `
        <div class="highlight-box">
            <span class="client-type ${c.tipo}">${c.tipo==='gremio'?'🟢 GREMIO':'🔵 CLIENTE'}</span>
            &nbsp;&nbsp;${c.estado==='activo'?'<span style="color:#51CF66">✅ Activo</span>':'<span style="color:#FFC107">⏸️ Inactivo</span>'}
        </div>
        <div class="highlight-box">
            <h4>📞 Contacto</h4>
            ${c.telefono  ? `<div>📱 ${c.telefono}</div>`  : ''}
            ${c.email     ? `<div>📧 ${c.email}</div>`     : ''}
            ${c.direccion ? `<div>📍 ${c.direccion}</div>` : ''}
            ${c.cuit      ? `<div>🆔 ${c.cuit}</div>`      : ''}
        </div>
        <div class="highlight-box">
            <h4>📊 Actividad</h4>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;text-align:center;">
                <div><div style="font-size:2rem;font-weight:bold;">${works.length}</div><div style="opacity:.6">Trabajos</div></div>
                <div><div style="font-size:1.4rem;font-weight:bold;color:#51CF66;">$${formatCurrencyAR(works.reduce((s,t)=>s+(t.total||0),0))}</div><div style="opacity:.6">Facturado</div></div>
                <div><div style="font-size:1.4rem;font-weight:bold;color:#FFC107;">$${formatCurrencyAR(works.reduce((s,t)=>s+(t.balance||0),0))}</div><div style="opacity:.6">Saldo</div></div>
            </div>
        </div>
        ${works.length ? `
            <div class="highlight-box">
                <h4>📋 Trabajos</h4>
                ${works.slice().reverse().map(t=>`
                    <div style="padding:.6rem;background:rgba(0,0,0,.2);border-radius:8px;margin-bottom:.4rem;display:flex;justify-content:space-between;">
                        <div>
                            <div>${t.descripcion||'Trabajo'}</div>
                            <div style="font-size:.8rem;opacity:.6">${new Date(t.createdAt).toLocaleDateString('es-AR')} · ${t.status==='completed'?'✅':'t.status==="in_progress"?🔧':'⏳'}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="color:#51CF66;">$${formatCurrencyAR(t.total||0)}</div>
                            <div style="font-size:.8rem;color:#FFC107;">Saldo $${formatCurrencyAR(t.balance||0)}</div>
                        </div>
                    </div>`).join('')}
            </div>` : ''}
        ${c.notas?`<div class="highlight-box"><h4>📝 Notas</h4><p>${c.notas}</p></div>`:''}
        <div style="text-align:center;margin-top:1rem;">
            <button class="btn btn-secondary" onclick="closeDetailsModal();editCliente('${c.id}')">✏️ Editar cliente</button>
        </div>
    `;
    document.getElementById('detailsModal').classList.add('active');
}

function closeDetailsModal() { document.getElementById('detailsModal').classList.remove('active'); }

function clearFilters() {
    document.getElementById('searchInput').value  = '';
    document.getElementById('filterType').value   = 'todos';
    document.getElementById('filterStatus').value = 'todos';
    filterClientes();
}

// Exportar al scope global para los onclick del HTML
window.openAddClientModal = openAddClientModal;
window.editCliente        = editCliente;
window.deleteCliente      = deleteCliente;
window.viewClientDetails  = viewClientDetails;
window.closeDetailsModal  = closeDetailsModal;
window.loadClientes       = loadClientes;
window.filterClientes     = filterClientes;
window.sortClientes       = sortClientes;
window.clearFilters       = clearFilters;

console.log('[CLIENTES-GESTION] 📦 Módulo cargado OK');
