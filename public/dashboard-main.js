let dashboardData = {
    works: [],
    clients: [],
    rendimientos: {}
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[DASHBOARD] 🚀 Inicializando...');
    
    // El mensaje de bienvenida ahora es una marquesina que se llena al cargar los datos

    const btnStrategy = document.getElementById('btnStrategy');
    if (btnStrategy) {
        btnStrategy.addEventListener('click', generateStrategyReport);
    }

    // Logout Logic
    document.body.addEventListener('click', e => {
        if (e.target.closest('#btn-logout, .btn-logout-sidebar')) {
            e.preventDefault();
            if(confirm('¿Cerrar sesión de forma segura?')) {
                localStorage.removeItem('mr_token');
                window.location.href = 'login.html';
            }
        }
    });

    // Motion Narrative: Reveal cards
    document.querySelectorAll('.stat-card, .card').forEach((el, i) => {
        el.classList.add('reveal-on-scroll');
        el.style.animationDelay = `${i * 0.1}s`;
    });

    await loadDashboardData();
});

async function loadDashboardData() {
    try {
        const token = localStorage.getItem('mr_token');
        if (!token) {
            console.warn('No hay token, redirigiendo a login...');
            window.location.href = 'login.html';
            return;
        }
        const headers = { 'Authorization': `Bearer ${token}` };

        // Carga paralela de datos
        const [trabajosRes, clientesRes, rendimientosRes] = await Promise.all([
            fetch('/api/trabajos', { headers }),
            fetch('/api/clientes', { headers }),
            fetch('/api/rendimientos', { headers }) // ✅ FIX: Agregar headers
        ]);

        if (trabajosRes.status === 401 || trabajosRes.status === 403) {
            localStorage.removeItem('mr_token');
            window.location.href = 'login.html';
            return;
        }

        // Parseo seguro para evitar errores si la API falla
        const trabajosData = trabajosRes.ok ? await trabajosRes.json() : { works: [] };
        const clientesData = clientesRes.ok ? await clientesRes.json() : [];
        let rendimientosData = rendimientosRes.ok ? await rendimientosRes.json() : null;
        
        console.log('📊 [DASHBOARD] Datos Rendimientos Recibidos:', rendimientosData);
        
        if (!rendimientosData || !rendimientosData.resumen) {
            console.warn('⚠️ [DASHBOARD] Sin datos de rendimientos, usando default.');
            rendimientosData = { resumen: { margenTotal: 0 } };
        }

        const works = trabajosData.works || [];
        const clients = Array.isArray(clientesData) ? clientesData : [];

        dashboardData.works = works;
        dashboardData.clients = clients;
        dashboardData.rendimientos = rendimientosData;

        updateStats(works, clients, rendimientosData);
        generateAITips(works, clients, rendimientosData);
        renderDeliveriesTable(works);

        // Llenar marquesina de trabajos
        const activeList = works.filter(w => w.status === 'pending' || w.status === 'in_progress');
        const marqueeEl = document.getElementById('welcomeMessage');
        if (marqueeEl) {
            if (activeList.length > 0) {
                const text = activeList.map(w => {
                    const isPending = w.status === 'pending';
                    const icon = isPending ? '⏳' : '🔨';
                    const badgeClass = isPending ? 'badge-warning' : 'badge-info';
                    const badgeStyle = "display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:20px; font-size:0.85rem; font-weight:700; backdrop-filter:blur(4px);";
                    return `<span class="badge ${badgeClass}" style="${badgeStyle}">${icon} ${w.clientName || 'Cliente'} (#${w.id.substr(-6)})</span>`;
                }).join(' &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ');
                
                marqueeEl.innerHTML = `<div style="display:flex; align-items:center; gap:15px; padding-top:2px;"><span style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--brand, #6366f1); font-weight:800;">🚀 TRABAJOS ACTIVOS</span> ${text}</div>`;
            } else {
                marqueeEl.innerHTML = `<span style="font-size:0.9rem; font-weight:600; color:var(--txt-2);">✅ No hay trabajos activos. ¡Todo al día!</span>`;
            }
        }

    } catch (error) {
        console.error('[DASHBOARD] ❌ Error cargando datos:', error);
    }
}

function updateStats(works, clients, rendimientos) {
    // Clientes VIP (Rating >= 4.5 o categoría VIP)
    // Asumimos que si no hay rating calculado, usamos una heurística simple o 0
    const vipCount = clients.filter(c => (c.rating >= 4.5) || (c.categoria === 'VIP')).length;
    document.getElementById('statVipClients').textContent = vipCount;

    // Trabajos Activos
    const activeWorks = works.filter(w => w.status === 'in_progress' || w.status === 'pending').length;
    document.getElementById('statActiveWorks').textContent = activeWorks;

    // Rendimiento Mensual (Margen)
    const margin = rendimientos.resumen ? rendimientos.resumen.margenTotal : 0;
    document.getElementById('statMonthlyPerformance').textContent = `${margin.toFixed(1)}%`;

    // Listos para Entrega (Completados pero no entregados)
    const readyCount = works.filter(w => w.status === 'completed' && w.deliveryStatus !== 'delivered').length;
    document.getElementById('statReadyDelivery').textContent = readyCount;
}

function generateAITips(works, clients, rendimientos) {
    const tipsContainer = document.getElementById('aiTipsList');
    if (!tipsContainer) return;
    tipsContainer.innerHTML = '';
    const tips = [];

    // Tip 1: Análisis de Margen
    const margin = rendimientos.resumen ? rendimientos.resumen.margenTotal : 0;
    if (margin < 30) {
        tips.push(`⚠️ Tu margen global es del ${margin.toFixed(1)}%. Considera revisar los costos de materiales o aumentar precios.`);
    } else {
        tips.push(`✅ Tu margen del ${margin.toFixed(1)}% es saludable. ¡Buen trabajo!`);
    }

    // Tip 2: Cobros Pendientes
    const pendingPayment = works.filter(w => w.paymentStatus === 'pending').reduce((sum, w) => sum + (w.balance || 0), 0);
    if (pendingPayment > 0) {
        tips.push(`💰 Tienes $${formatCurrency(pendingPayment)} pendientes de cobro en trabajos activos.`);
    }

    // Tip 3: Sugerencia Cliente VIP
    const topClient = clients.sort((a,b) => (b.totalFacturado || 0) - (a.totalFacturado || 0))[0];
    if (topClient) {
        tips.push(`🏆 ${topClient.nombre} es tu mejor cliente. ¿Qué tal ofrecerle un descuento especial en su próximo pedido?`);
    }

    // Renderizar tips
    tips.forEach(tip => {
        const div = document.createElement('div');
        div.className = 'ai-tip';
        div.textContent = tip;
        tipsContainer.appendChild(div);
    });
}

function renderDeliveriesTable(works) {
    const tbody = document.getElementById('deliveriesTableBody');
    tbody.innerHTML = '';

    // Filtrar trabajos activos (incluyendo completados no entregados) y ordenar por fecha
    const upcoming = works
        .filter(w => w.status !== 'cancelled' && w.deliveryStatus !== 'delivered')
        .sort((a, b) => {
            const dateA = new Date(a.deliveryDate || a.createdAt);
            const dateB = new Date(b.deliveryDate || b.createdAt);
            return (isNaN(dateA) ? 0 : dateA) - (isNaN(dateB) ? 0 : dateB);
        })
        .slice(0, 50);

    if (upcoming.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; opacity:0.5; padding: 2rem;">No hay entregas pendientes</td></tr>';
        return;
    }

    upcoming.forEach(w => {
        const date = w.deliveryDate ? new Date(w.deliveryDate).toLocaleDateString() : '<span style="color:#aaa;font-style:italic;">Sin fecha</span>';
        const tr = document.createElement('tr');
        tr.style.transition = 'all 0.2s ease';
        tr.onmouseover = () => tr.style.backgroundColor = '#f8fafc';
        tr.onmouseout = () => tr.style.backgroundColor = 'transparent';

        const isDelivered = w.deliveryStatus === 'delivered';
        const actionBtn = isDelivered ? 
            '<span style="color:#10b981; font-weight:600; font-size:0.75rem;">✅ Entregado</span>' : 
            `<button style="background:linear-gradient(135deg, #f59e0b, #d97706); color:#fff; border:none; padding:4px 10px; border-radius:14px; cursor:pointer; font-size:0.73rem; font-weight:600; white-space:nowrap; transition:opacity 0.15s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'" onclick="markAsDelivered('${w.id}')">📦 Entregar</button>`;

        const isPaid = w.paymentStatus === 'paid';
        const saldo = isPaid ? 0 : (w.balance || w.total || 0);
        const saldoStyle = isPaid
            ? 'color:#10b981; font-weight:700;'
            : (saldo > 0 ? 'color:#ef4444; font-weight:700;' : 'color:#94a3b8;');
        const saldoText = isPaid ? '✅ Pagado' : `$${formatCurrency(saldo)}`;
        
        const pagoBtn = isPaid
            ? `<span style="color:#10b981; font-weight:600; font-size:0.75rem;">💚 Cobrado</span>`
            : `<button style="background:linear-gradient(135deg, #10b981, #059669); color:#fff; border:none; padding:4px 10px; border-radius:14px; cursor:pointer; font-size:0.73rem; font-weight:600; white-space:nowrap; transition:opacity 0.15s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'" onclick="markAsPaid('${w.id}')">💵 Cobrar</button>`;

        const detailBtn = `<button style="background:linear-gradient(135deg, #3b82f6, #2563eb); color:#fff; border:none; padding:4px 10px; border-radius:14px; cursor:pointer; font-size:0.73rem; font-weight:600; white-space:nowrap; transition:opacity 0.15s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'" onclick="showOrderDetail('${w.id}')">🔍 Detalle</button>`;

        tr.innerHTML = `
            <td style="font-weight:600; font-size:0.8rem;">${w.clientName || 'Cliente'}</td>
            <td style="color:var(--txt-2); font-family:monospace; font-size:0.75rem;">#${w.id.substr(-6)}</td>
            <td><span style="${getStatusStyle(w.status)}">${getStatusLabel(w.status)}</span></td>
            <td style="font-weight:600; font-size:0.8rem;">$${formatCurrency(w.total)}</td>
            <td style="${saldoStyle} font-size:0.8rem;">${saldoText}</td>
            <td>
                <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
                    ${detailBtn}${pagoBtn}${actionBtn}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function formatCurrency(num) {
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(num || 0);
}

function getStatusStyle(status) {
    const baseStyle = "display:inline-flex; align-items:center; justify-content:center; padding:3px 8px; border-radius:20px; font-weight:700; font-size:0.68rem; letter-spacing:0.3px; white-space:nowrap; text-transform:uppercase; border: 1px solid transparent;";
    
    if (status === 'pending') {
        return `${baseStyle} background:#fffbeb; color:#d97706; border-color:#fde68a;`;
    }
    if (status === 'in_progress') {
        return `${baseStyle} background:#eff6ff; color:#2563eb; border-color:#bfdbfe;`;
    }
    return `${baseStyle} background:#f0fdf4; color:#16a34a; border-color:#bbf7d0;`;
}

function getStatusLabel(status) {
    const map = { 'pending': '⏳ Pendiente', 'in_progress': '⚙️ En Proceso', 'completed': '✅ Listo' };
    return map[status] || status;
}

function generateStrategyReport() {
    const modal = document.getElementById('strategyModal');
    const content = document.getElementById('strategyContent');
    
    if (!modal || !content) return;
    
    content.innerHTML = `
        <div style="text-align:center; padding: 2rem;">
            <div class="spinner" style="margin: 0 auto 1rem;"></div>
            <p>Analizando datos del negocio...</p>
        </div>
    `;
    modal.classList.add('active');
    
    setTimeout(() => {
        const { works, clients, rendimientos } = dashboardData;
        
        const margin = rendimientos.resumen ? rendimientos.resumen.margenTotal : 0;
        const activeWorks = works.filter(w => w.status === 'in_progress').length;
        const pendingWorks = works.filter(w => w.status === 'pending').length;
        const completedWorks = works.filter(w => w.status === 'completed').length;
        
        let recommendations = [];
        
        if (margin < 30) {
            recommendations.push({
                icon: '⚠️',
                title: 'Margen Bajo',
                text: 'El margen global está por debajo del 30%. Revisa los costos de materiales en la sección de Costos y considera ajustar los precios de venta.'
            });
        } else {
            recommendations.push({
                icon: '✅',
                title: 'Margen Saludable',
                text: 'Tu margen de ganancia es saludable. Es un buen momento para invertir en marketing o nuevos equipos.'
            });
        }
        
        if (pendingWorks > 5) {
            recommendations.push({
                icon: '🔥',
                title: 'Acumulación de Trabajos',
                text: `Tienes ${pendingWorks} trabajos pendientes. Prioriza los que tienen fecha de entrega próxima o mayor rentabilidad.`
            });
        }
        
        const pendingPayment = works.reduce((sum, w) => sum + (parseFloat(w.balance) || 0), 0);
        if (pendingPayment > 0) {
            recommendations.push({
                icon: '💰',
                title: 'Cobranzas Pendientes',
                text: `Hay un total de $${formatCurrency(pendingPayment)} pendiente de cobro. Revisa la lista de trabajos para gestionar los cobros.`
            });
        }

        let html = `
            <div class="strategy-report">
                <div class="report-header" style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="font-size: 2.5rem; font-weight: bold; color: #4f46e5;">${margin.toFixed(1)}%</div>
                    <div style="color: #64748b;">Margen de Rentabilidad Actual</div>
                </div>
                
                <h3 style="border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1rem;">Recomendaciones IA</h3>
                <div class="recommendations-list" style="display: flex; flex-direction: column; gap: 1rem;">
                    ${recommendations.map(rec => `
                        <div class="recommendation-item" style="display: flex; gap: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px;">
                            <div style="font-size: 1.5rem;">${rec.icon}</div>
                            <div>
                                <strong style="display: block; margin-bottom: 0.3rem; color: #1e293b;">${rec.title}</strong>
                                <div style="font-size: 0.9rem; color: #475569; line-height: 1.4;">${rec.text}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        content.innerHTML = html;
    }, 1000);
}

async function markAsDelivered(workId) {
    if (!confirm('¿Marcar este trabajo como entregado?')) return;

    try {
        const work = dashboardData.works.find(w => w.id === workId);
        if (!work) return;

        const updates = {
            deliveryStatus: 'delivered',
            actualDeliveryDate: new Date().toISOString()
        };
        if (work.paymentStatus === 'paid') {
            updates.status = 'completed';
        }

        const token = localStorage.getItem('mr_token');
        const res = await fetch(`/api/trabajos/${workId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(updates)
        });

        if (!res.ok) throw new Error('Error del servidor: ' + res.status);

        alert('✅ Trabajo marcado como entregado');
        loadDashboardData();
    } catch (error) {
        console.error('Error al marcar entregado:', error);
        alert('❌ Error al actualizar el estado');
    }
}

async function markAsPaid(workId) {
    if (!confirm('¿Marcar este trabajo como cobrado/pagado?')) return;

    try {
        const work = dashboardData.works.find(w => w.id === workId);
        if (!work) return;

        const updates = {
            paymentStatus: 'paid',
            balance: 0,
            paidAmount: work.total || 0,
            paidAt: new Date().toISOString()
        };

        const token = localStorage.getItem('mr_token');
        const res = await fetch(`/api/trabajos/${workId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(updates)
        });

        if (!res.ok) throw new Error('Error del servidor: ' + res.status);

        alert('💚 Trabajo marcado como cobrado');
        loadDashboardData();
    } catch (error) {
        console.error('Error al marcar como cobrado:', error);
        alert('❌ Error al actualizar el pago');
    }
}

async function showOrderDetail(workId) {
    const w = dashboardData.works.find(x => x.id === workId);
    if (!w) return;

    const formatC = (n) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(n || 0);
    const isPaid = w.paymentStatus === 'paid';
    const saldo = isPaid ? 0 : (w.balance || w.total || 0);
    const payBadge = isPaid
        ? '<span style="background:#e8f5e9;color:#2e7d32;border-radius:20px;padding:4px 14px;font-size:0.85rem;">💚 Cobrado</span>'
        : `<span style="background:#ffebee;color:#c62828;border-radius:20px;padding:4px 14px;font-size:0.85rem;font-weight:700;">💰 Debe: $${formatC(saldo)}</span>`;
    const delivBadge = w.deliveryStatus === 'delivered'
        ? '<span style="background:#e8f5e9;color:#2e7d32;border-radius:20px;padding:4px 14px;font-size:0.85rem;">📦 Entregado</span>'
        : '<span style="background:#fff3e0;color:#e65100;border-radius:20px;padding:4px 14px;font-size:0.85rem;">🚚 Pendiente entrega</span>';

    // Render modal shell with loading state
    const existingModal = document.getElementById('orderDetailModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'orderDetailModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="background:linear-gradient(135deg,#1a237e,#283593);color:#fff;padding:1.2rem 1.5rem;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center;">
            <div>
                <div style="font-size:1.1rem;font-weight:700;">${w.clientName || 'Cliente'}</div>
                <div style="opacity:0.75;font-size:0.82rem;">Trabajo #${w.id.substr(-6)} &nbsp;·&nbsp; ${w.deliveryDate ? new Date(w.deliveryDate).toLocaleDateString() : 'Sin fecha de entrega'} &nbsp;·&nbsp; ${(w.tipo_cliente || 'gremio').toUpperCase()}</div>
            </div>
            <button onclick="document.getElementById('orderDetailModal').remove()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:1.1rem;line-height:1;">✕</button>
        </div>
        <div style="padding:1.4rem 1.5rem;">
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:1.2rem;">
                ${delivBadge} ${payBadge}
            </div>
            <div style="font-weight:600;color:#333;margin-bottom:0.6rem;">📋 Ítems del pedido</div>
            <div id="orderDetailItems" style="margin-bottom:1.4rem;text-align:center;padding:1.5rem;color:#999;">⏳ Cargando ítems...</div>
            <div style="background:#f9f9f9;border-radius:10px;padding:1rem;display:flex;flex-direction:column;gap:6px;font-size:0.92rem;">
                <div style="display:flex;justify-content:space-between;"><span style="color:#666;">Total</span><span style="font-weight:700;color:#1a237e;">$${formatC(w.total)}</span></div>
                ${!isPaid ? `<div style="display:flex;justify-content:space-between;color:#c62828;font-weight:700;"><span>Saldo pendiente</span><span>$${formatC(saldo)}</span></div>` : ''}
            </div>
            ${w.notes && w.notes.length > 0 ? `
            <div style="margin-top:1rem;font-size:0.85rem;color:#555;">
                <strong>📝 Notas:</strong>
                ${w.notes.map(n => `<div style="margin-top:4px;padding:6px 10px;background:#fffde7;border-radius:6px;">${n.text || n}</div>`).join('')}
            </div>` : ''}
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:1.4rem;flex-wrap:wrap;">
                ${!isPaid ? `<button onclick="markAsPaid('${w.id}');document.getElementById('orderDetailModal').remove()" style="background:#43a047;color:#fff;border:none;padding:9px 20px;border-radius:20px;cursor:pointer;font-size:0.88rem;">💵 Marcar cobrado</button>` : ''}
                ${w.deliveryStatus !== 'delivered' ? `<button onclick="markAsDelivered('${w.id}');document.getElementById('orderDetailModal').remove()" style="background:#1565c0;color:#fff;border:none;padding:9px 20px;border-radius:20px;cursor:pointer;font-size:0.88rem;">📦 Marcar entregado</button>` : ''}
                <button onclick="document.getElementById('orderDetailModal').remove()" style="background:#eee;color:#333;border:none;padding:9px 20px;border-radius:20px;cursor:pointer;font-size:0.88rem;">Cerrar</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    // Fetch items from work or external quote
    try {
        const itemsDiv = document.getElementById('orderDetailItems');
        if (!itemsDiv) return;

        let itemsSource = null;

        // 1. Priorizar si el trabajo ya tiene los datos integrados (Snapshot)
        const hasEmbeddedItems = (w.multiCategories && w.multiCategories.categories && w.multiCategories.categories.length > 0) ||
                                 (w.productos && w.productos.length > 0) ||
                                 (w.products && w.products.length > 0) ||
                                 (w.terceros && w.terceros.length > 0);

        if (hasEmbeddedItems) {
            console.log('[DASHBOARD] Usando ítems integrados en el trabajo');
            itemsSource = w;
        } else {
            // 2. Si no los tiene, buscar la cotización original (Fallback)
            console.log('[DASHBOARD] Buscando cotización original...');
            const token = localStorage.getItem('mr_token');
            const headers = { 'Authorization': `Bearer ${token}` };
            const tipoCliente = w.tipo_cliente || 'gremio';
            const endpoint = tipoCliente === 'clientes' ? '/api/clientes/data' : '/api/gremio/data';
            const res = await fetch(endpoint, { headers });
            const quotes = await res.json();
            const quoteArr = Array.isArray(quotes) ? quotes : (quotes.cotizaciones || quotes.quotes || []);
            const quote = quoteArr.find(q => q.id === w.quoteId);
            
            if (quote) {
                itemsSource = quote;
            }
        }

        if (!itemsSource) {
            itemsDiv.innerHTML = '<p style="text-align:center;color:#999;padding:1rem;">No se encontró el detalle de los ítems (Cotización original no disponible)</p>';
            return;
        }

        // Build items from source
        const categories = itemsSource.multiCategories?.categories || [];
        const dims = itemsSource.multiCategories?.sharedDimensions || {};
        const productos = itemsSource.productos || itemsSource.products || [];
        const terceros = itemsSource.terceros || [];
        const allItems = [];

        categories.forEach(cat => {
            const width = cat.width || dims.width || '';
            const height = cat.height || dims.height || '';
            const dim = (width && height) ? `${width} × ${height} m` : '';
            const m2 = (cat.m2 || cat.frozenM2 || 0).toFixed(2);
            allItems.push({ nombre: cat.name || '—', dim, m2, cant: '—', precio: cat.totalPrice || 0, tipo: 'Material' });
        });
        productos.forEach(p => {
            const nombre = p.name || p.nombre || p.producto || '—';
            allItems.push({ nombre, dim: '', m2: '—', cant: p.quantity || p.cantidad || 1, precio: p.total || p.price || p.precio || 0, tipo: 'Producto' });
        });
        terceros.forEach(t => {
            const nombre = t.empresa || t.nombre || t.name || '—';
            const tw = t.ancho || ''; const th = t.alto || '';
            const dim = (tw && th) ? `${tw} × ${th} cm` : '';
            allItems.push({ nombre, dim, m2: '—', cant: t.cantidad || 1, precio: t.precioFinal || t.precio || 0, tipo: 'Tercero' });
        });

        if (allItems.length === 0) {
            itemsDiv.innerHTML = '<p style="text-align:center;color:#999;padding:1rem;">Sin ítems registrados</p>';
            return;
        }

        let rows = allItems.map((it, i) => `
            <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:7px 10px;font-size:0.8rem;"><span style="background:#e3f2fd;color:#1565c0;border-radius:4px;padding:2px 7px;">${it.tipo}</span></td>
                <td style="padding:7px 10px;font-weight:500;font-size:0.88rem;">${it.nombre}</td>
                <td style="padding:7px 10px;color:#666;font-size:0.85rem;text-align:center;">${it.dim || '—'}</td>
                <td style="padding:7px 10px;text-align:center;font-size:0.85rem;">${it.m2 !== '—' ? it.m2 + ' m²' : it.cant}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600;color:#1a237e;">$${formatC(it.precio)}</td>
            </tr>`).join('');

        itemsDiv.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
                <thead>
                    <tr style="background:#f5f5f5;color:#555;">
                        <th style="padding:8px 10px;text-align:left;">Tipo</th>
                        <th style="padding:8px 10px;text-align:left;">Descripción</th>
                        <th style="padding:8px 10px;text-align:center;">Medidas</th>
                        <th style="padding:8px 10px;text-align:center;">M² / Cant.</th>
                        <th style="padding:8px 10px;text-align:right;">Precio</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;
    } catch (err) {
        const itemsDiv = document.getElementById('orderDetailItems');
        if (itemsDiv) itemsDiv.innerHTML = '<p style="text-align:center;color:#e53935;padding:1rem;">❌ Error al cargar ítems</p>';
        console.error('Error fetching quote detail:', err);
    }
}

async function updateWorkStatus(works) {
    await fetch('/api/trabajos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ works: works, notifications: [] })
    });
}