/**
 * Centralized Quote Management
 */

let allQuotes = [];

document.addEventListener('DOMContentLoaded', () => {
    loadAllQuotes();
});

async function loadAllQuotes() {
    const listContainer = document.getElementById('quotesList');
    listContainer.innerHTML = '<div class="col-12 text-center p-5"><div class="spinner-border text-primary"></div><p>Sincronizando con base de datos...</p></div>';

    try {
        // Cargar cotizaciones de ambos mundos
        const [gremioData, clientesData] = await Promise.all([
            window.mrDataManager.getGremioCotizaciones(),
            window.mrDataManager.getClientesCotizaciones()
        ]);

        // Normalizar los datos
        const normalizedGremio = gremioData.map(q => ({ ...q, _source: 'gremio', id: q.id || q.fecha }));
        const normalizedClientes = clientesData.map(q => ({ ...q, _source: 'cliente', id: q.id || q.fecha }));

        allQuotes = [...normalizedGremio, ...normalizedClientes];
        
        // Ordenar por fecha descendente
        allQuotes.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        renderQuotes(allQuotes);
        updateStats();

    } catch (error) {
        console.error('Error loading quotes:', error);
        listContainer.innerHTML = `<div class="col-12 alert alert-danger">Error al cargar datos: ${error.message}</div>`;
    }
}

function renderQuotes(quotesToRender) {
    const listContainer = document.getElementById('quotesList');
    if (quotesToRender.length === 0) {
        listContainer.innerHTML = '<div class="col-12 text-center p-5"><h3>No se encontraron presupuestos</h3><p>Prueba ajustando los filtros</p></div>';
        return;
    }

    listContainer.innerHTML = quotesToRender.map(q => {
        const date = new Date(q.fecha).toLocaleDateString();
        const clientName = q.cliente?.nombre || 'Cliente sin nombre';
        const total = q.totalCliente || q.total || 0;
        const status = q.aprobada ? 'approved' : 'pending';
        const statusLabel = q.aprobada ? '✅ Aprobado' : '⏳ Pendiente';
        const sourceLabel = q._source === 'gremio' ? 'Gremio' : 'Publico';
        const sourceClass = q._source === 'gremio' ? 'badge-gremio' : 'badge-cliente';

        return `
            <div class="col">
                <div class="card h-100 quote-card ${status} ${q._source}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge ${status === 'approved' ? 'bg-success' : 'bg-warning text-dark'}">${statusLabel}</span>
                            <span class="badge-system ${sourceClass}">${sourceLabel}</span>
                        </div>
                        <h5 class="card-title text-truncate mb-1" title="${clientName}">${clientName}</h5>
                        <div class="text-muted small mb-3">📅 ${date}</div>
                        
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="text-muted small">Total:</span>
                            <span class="h5 mb-0 text-primary">$ ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        
                        <div class="d-grid gap-2">
                            <div class="btn-group w-100">
                                <button class="btn btn-outline-primary btn-sm" onclick="downloadPDF('${q.id}', '${q._source}')">📄 PDF</button>
                                ${!q.aprobada ? `<button class="btn btn-success btn-sm" onclick="approveQuote('${q.id}', '${q._source}')">✔️ Aprobar</button>` : ''}
                            </div>
                            <div class="d-flex gap-1">
                                <button class="btn btn-outline-secondary btn-sm flex-grow-1" onclick="viewQuoteDetails('${q.id}', '${q._source}')">👁️ Ver Detalles</button>
                                <button class="btn btn-outline-danger btn-sm" onclick="deleteQuote('${q.id}', '${q._source}')" title="Eliminar">🗑️</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function filterQuotes() {
    const search = document.getElementById('searchClient').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;
    const source = document.getElementById('filterSource').value;

    const filtered = allQuotes.filter(q => {
        const matchSearch = (q.cliente?.nombre || '').toLowerCase().includes(search);
        const matchStatus = status === 'all' || (status === 'approved' && q.aprobada) || (status === 'pending' && !q.aprobada);
        const matchSource = source === 'all' || q._source === source;
        return matchSearch && matchStatus && matchSource;
    });

    renderQuotes(filtered);
}

function updateStats() {
    const pending = allQuotes.filter(q => !q.aprobada);
    const approvedThisMonth = allQuotes.filter(q => {
        if (!q.aprobada) return false;
        const qDate = new Date(q.fecha);
        const now = new Date();
        return qDate.getMonth() === now.getMonth() && qDate.getFullYear() === now.getFullYear();
    });
    
    const totalPendingAmount = pending.reduce((sum, q) => sum + (q.totalCliente || q.total || 0), 0);

    document.getElementById('statsPending').textContent = pending.length;
    document.getElementById('statsApproved').textContent = approvedThisMonth.length;
    document.getElementById('statsTotalAmount').textContent = `$ ${totalPendingAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

window.downloadPDF = async function(id, source) {
    const quote = allQuotes.find(q => q.id === id && q._source === source);
    if (!quote) return;

    try {
        const generator = new PDFGenerator();
        let doc;
        if (source === 'gremio') {
            doc = await generator.generateGremioQuote(quote);
        } else {
            doc = await generator.generateClientesQuote(quote);
        }
        
        const fileName = `Presupuesto_${source}_${(quote.cliente?.nombre || 'sin_nombre').replace(/[^a-z0-0]/gi, '_')}.pdf`;
        doc.save(fileName);
    } catch (e) {
        alert('Error al generar PDF: ' + e.message);
    }
}

window.approveQuote = async function(id, source) {
    console.log('[APPROVE] Intentando aprobar:', id, source);
    
    // Búsqueda muy flexible del presupuesto
    const quote = allQuotes.find(q => (q.id === id || q.fecha === id) && q._source === source);
    
    if (!quote) {
        console.error('[APPROVE] No se encontró el presupuesto en allQuotes');
        alert('❌ Error: No se encontró el presupuesto en la lista actual. Por favor, actualiza la página.');
        return;
    }

    const nombreCliente = quote.cliente?.nombre || 'Cliente';
    if (!confirm(`¿Confirmas la aprobación del presupuesto para ${nombreCliente}?`)) return;

    try {
        // 1. Datos básicos del trabajo
        const montoTotal = parseFloat(quote.totalCliente || quote.total || 0);
        const costoTotal = parseFloat(quote.costoTotal || 0);
        const anticipo = parseFloat(quote.anticipo || 0);

        // 2. Crear el objeto de Trabajo manualmente (sin depender de WorkManager)
        const nuevoTrabajo = {
            id: 'work_' + Date.now(),
            quoteId: id,
            tipo_cliente: source,
            clientName: nombreCliente,
            clientPhone: quote.cliente?.telefono || '',
            clientEmail: quote.cliente?.email || '',
            clientAddress: quote.cliente?.direccion || '',
            descripcion: quote.isCustomBudget ? `Presupuesto Nº ${quote.budgetNumber}` : (quote.descripcion || 'Trabajo de ' + source),
            total: montoTotal,
            totalCost: costoTotal,
            profit: montoTotal - costoTotal,
            paidAmount: anticipo,
            balance: montoTotal - anticipo,
            status: 'pending',
            paymentStatus: (anticipo >= montoTotal - 1) ? 'paid' : (anticipo > 0 ? 'partial' : 'pending'),
            priority: 'normal',
            deliveryDate: quote.fechaEntrega || null,
            createdAt: new Date().toISOString(),
            timeline: [{
                type: 'created',
                description: 'Trabajo aprobado desde Seguimiento',
                timestamp: new Date().toISOString()
            }],
            isCustomBudget: !!quote.isCustomBudget,
            budgetNumber: quote.budgetNumber || null
        };

        console.log('[APPROVE] Objeto trabajo creado:', nuevoTrabajo);

        // 3. Guardar en Trabajos
        const dataTrabajos = await window.mrDataManager.request('/api/trabajos');
        let listaTrabajos = [];
        if (dataTrabajos && Array.isArray(dataTrabajos.works)) {
            listaTrabajos = dataTrabajos.works;
        } else if (Array.isArray(dataTrabajos)) {
            listaTrabajos = dataTrabajos;
        }
        
        listaTrabajos.push(nuevoTrabajo);
        await window.mrDataManager.request('/api/trabajos', 'POST', { 
            works: listaTrabajos, 
            notifications: dataTrabajos.notifications || [] 
        });

        // 4. Actualizar estado de la cotización original
        if (source === 'gremio') {
            const cotsGremio = await window.mrDataManager.getGremioCotizaciones();
            const idx = cotsGremio.findIndex(q => (q.id === id || q.fecha === id));
            if (idx !== -1) {
                cotsGremio[idx].estado = 'aprobada';
                cotsGremio[idx].aprobada = true;
                await window.mrDataManager.saveGremioCotizaciones(cotsGremio);
            }
        } else {
            const cotsClientes = await window.mrDataManager.getClientesCotizaciones();
            const idx = cotsClientes.findIndex(q => (q.id === id || q.fecha === id));
            if (idx !== -1) {
                cotsClientes[idx].estado = 'aprobada';
                cotsClientes[idx].aprobada = true;
                await window.mrDataManager.saveClientesCotizaciones(cotsClientes);
            }
        }

        // 5. Registrar movimientos de dinero (opcional pero recomendado)
        try {
            const gastos = await window.mrDataManager.getGastos();
            const tag = quote.budgetNumber || id.toString().slice(-4);
            
            // Registro de Ingreso
            gastos.push({
                id: 'ingreso_' + Date.now(),
                tipo: 'ingreso',
                descripcion: `Venta - ${source} #${tag} (${nombreCliente})`,
                monto: montoTotal,
                fecha: new Date().toISOString(),
                categoria: 'venta'
            });

            // FIX: registrar también el egreso del costo (antes faltaba → ganancia inflada)
            if (costoTotal > 0) {
                gastos.push({
                    id: 'gasto_' + Date.now(),
                    tipo: 'egreso',
                    descripcion: `Costo Total - ${source} #${tag} (${nombreCliente})`,
                    monto: costoTotal,
                    fecha: new Date().toISOString(),
                    categoria: 'costo_venta_' + source
                });
            }
            
            await window.mrDataManager.saveGastos(gastos);
        } catch (err) { console.warn('[APPROVE] Error al registrar finanzas:', err); }

        alert(`✅ ¡Aprobado con éxito!\n\nSe creó el trabajo para ${nombreCliente}.\nYa puedes verlo en la sección de Trabajos.`);
        
        // Recargar la lista
        if (window.loadAllQuotes) window.loadAllQuotes();
        
        // Cerrar modal si existe
        const modalElement = document.getElementById('quoteDetailsModal');
        if (modalElement && typeof bootstrap !== 'undefined') {
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) modalInstance.hide();
        }

    } catch (error) {
        console.error('[APPROVE] Error crítico:', error);
        alert('❌ Error al aprobar: ' + error.message);
    }
};

window.deleteQuote = async function(id, source) {
    if (!confirm('¿Seguro que deseas ELIMINAR este presupuesto? Esta acción no se puede deshacer.')) return;

    try {
        if (source === 'gremio') {
            const allGremio = await window.mrDataManager.getGremioCotizaciones();
            // Comparación robusta (string)
            const filtered = allGremio.filter(q => String(q.id) !== String(id) && String(q.fecha) !== String(id));
            await window.mrDataManager.saveGremioCotizaciones(filtered);
        } else {
            const allClientes = await window.mrDataManager.getClientesCotizaciones();
            // Comparación robusta (string)
            const filtered = allClientes.filter(q => String(q.id) !== String(id) && String(q.fecha) !== String(id));
            await window.mrDataManager.saveClientesCotizaciones(filtered);
        }

        alert('🗑️ Presupuesto eliminado.');
        try {
            const modalEl = document.getElementById('quoteDetailsModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        } catch(e) {}
        loadAllQuotes();
    } catch (e) {
        alert('❌ Error al eliminar: ' + e.message);
    }
}

window.viewQuoteDetails = function(id, source) {
    const quote = allQuotes.find(q => q.id === id && q._source === source);
    if (!quote) return;
    
    const modal = new bootstrap.Modal(document.getElementById('quoteDetailsModal'));
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');
    
    title.innerHTML = `Presupuesto: <span class="text-primary">${quote.cliente?.nombre || 'Cliente'}</span>`;
    
    let itemsHtml = '';
    if (quote.productos && quote.productos.length > 0) {
        itemsHtml += `
            <h6 class="border-bottom pb-2 mb-3">Productos</h6>
            <table class="table table-sm mb-4">
                <thead class="table-light">
                    <tr><th>Producto</th><th>Cant.</th><th class="text-end">Total</th></tr>
                </thead>
                <tbody>
                    ${quote.productos.map(p => `
                        <tr>
                            <td>${p.producto || p.name || 'Producto'}</td>
                            <td>${p.cantidad || 1}</td>
                            <td class="text-end">$${(p.total || p.price || 0).toLocaleString('es-AR')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    if (quote.multiCategories?.categories) {
        itemsHtml += `
            <h6 class="border-bottom pb-2 mb-3">Multi-Categorías</h6>
            <table class="table table-sm mb-4">
                <thead class="table-light">
                    <tr><th>Categoría</th><th>Medidas</th><th class="text-end">Total</th></tr>
                </thead>
                <tbody>
                    ${quote.multiCategories.categories.map(c => `
                        <tr>
                            <td>${c.name}</td>
                            <td>${c.width || quote.multiCategories.sharedDimensions?.width || '-'}x${c.height || quote.multiCategories.sharedDimensions?.height || '-'} cm</td>
                            <td class="text-end">$${(c.totalPrice || 0).toLocaleString('es-AR')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    if (quote.terceros && quote.terceros.length > 0) {
        itemsHtml += `
            <h6 class="border-bottom pb-2 mb-3">Terceros / Servicios</h6>
            <ul class="list-group list-group-flush mb-4">
                ${quote.terceros.map(t => `
                    <li class="list-group-item d-flex justify-content-between align-items-center bg-transparent">
                        <div>
                            <div>${t.empresa || t.servicio || t.nombre}</div>
                            <small class="text-muted">${t.descripcion || ''}</small>
                        </div>
                        <span class="fw-bold">$${(t.total || 0).toLocaleString('es-AR')}</span>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    body.innerHTML = `
        <div class="row mb-4">
            <div class="col-md-6">
                <p class="mb-1"><small class="text-muted">Fecha:</small><br><strong>${new Date(quote.fecha).toLocaleString()}</strong></p>
                <p class="mb-1"><small class="text-muted">Sistema:</small><br><span class="badge ${quote._source === 'gremio' ? 'badge-gremio' : 'badge-cliente'}">${quote._source.toUpperCase()}</span></p>
            </div>
            <div class="col-md-6 text-md-end">
                <p class="mb-1"><small class="text-muted">Estado:</small><br><span class="badge ${quote.aprobada ? 'bg-success' : 'bg-warning text-dark'}">${quote.aprobada ? 'APROBADA' : 'PENDIENTE'}</span></p>
                <p class="mb-1"><small class="text-muted">Total Final:</small><br><span class="h4 text-primary">$${(quote.totalCliente || quote.total || 0).toLocaleString('es-AR')}</span></p>
            </div>
        </div>
        ${itemsHtml}
        ${quote.anticipo ? `<div class="alert alert-info py-2"><strong>Anticipo:</strong> $${quote.anticipo.toLocaleString('es-AR')} | <strong>Saldo:</strong> $${(quote.saldo || 0).toLocaleString('es-AR')}</div>` : ''}
    `;

    // Configurar botones del modal
    document.getElementById('btnDeleteQuote').onclick = () => deleteQuote(id, source);
    document.getElementById('btnDownloadPDFFromModal').onclick = () => downloadPDF(id, source);
    
    const btnApprove = document.getElementById('btnApproveFromModal');
    if (quote.aprobada) {
        btnApprove.style.display = 'none';
    } else {
        btnApprove.style.display = 'inline-block';
        btnApprove.onclick = () => approveQuote(id, source);
    }

    modal.show();
}
