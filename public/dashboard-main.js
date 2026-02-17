let dashboardData = {
    works: [],
    clients: [],
    rendimientos: {}
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[DASHBOARD] 🚀 Inicializando...');
    
    // Mensaje de bienvenida dinámico
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    document.getElementById('welcomeMessage').textContent = `${greeting}, bienvenido a MR Letreros v2.0`;

    const btnStrategy = document.getElementById('btnStrategy');
    if (btnStrategy) {
        btnStrategy.addEventListener('click', generateStrategyReport);
    }

    await loadDashboardData();
});

async function loadDashboardData() {
    try {
        // Carga paralela de datos
        const [trabajosRes, clientesRes, rendimientosRes] = await Promise.all([
            fetch('/api/trabajos'),
            fetch('/api/clientes'),
            fetch('/api/rendimientos')
        ]);

        const trabajosData = await trabajosRes.json();
        const clientesData = await clientesRes.json();
        const rendimientosData = await rendimientosRes.json();
        
        console.log('📊 [DASHBOARD] Datos Rendimientos Recibidos:', rendimientosData);
        
        if (!rendimientosData || !rendimientosData.resumen) {
            console.error('❌ [DASHBOARD] Estructura de rendimientos incorrecta o vacía:', rendimientosData);
            // Evitar crash si no hay datos
            if (!rendimientosData) rendimientosData = { resumen: { margenTotal: 0 } };
        }

        const works = trabajosData.works || [];
        const clients = Array.isArray(clientesData) ? clientesData : [];

        dashboardData.works = works;
        dashboardData.clients = clients;
        dashboardData.rendimientos = rendimientosData;

        updateStats(works, clients, rendimientosData);
        generateAITips(works, clients, rendimientosData);
        renderDeliveriesTable(works);

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
        .slice(0, 10);

    if (upcoming.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; opacity:0.5;">No hay entregas pendientes</td></tr>';
        return;
    }

    upcoming.forEach(w => {
        const date = w.deliveryDate ? new Date(w.deliveryDate).toLocaleDateString() : 'Sin fecha';
        const tr = document.createElement('tr');
        const isDelivered = w.deliveryStatus === 'delivered';
        const actionBtn = isDelivered ? 
            '<span style="color:#4CAF50">✅ Entregado</span>' : 
            `<button class="btn btn-small btn-primary" onclick="markAsDelivered('${w.id}')">📦 Entregar</button>`;

        tr.innerHTML = `
            <td>${w.clientName || 'Cliente'}</td>
            <td>#${w.id.substr(-6)}</td>
            <td>${date}</td>
            <td><span class="status-badge" style="background:${getStatusColor(w.status)}">${getStatusLabel(w.status)}</span></td>
            <td>$${formatCurrency(w.total)}</td>
            <td>${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

function formatCurrency(num) {
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(num || 0);
}

function getStatusColor(status) {
    if (status === 'pending') return '#FFC107; color: #000';
    if (status === 'in_progress') return '#2196F3; color: #fff';
    return '#4CAF50; color: #fff';
}

function getStatusLabel(status) {
    const map = { 'pending': 'Pendiente', 'in_progress': 'En Proceso', 'completed': 'Listo' };
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
                    <div style="font-size: 2.5rem; font-weight: bold; color: #6366f1;">${margin.toFixed(1)}%</div>
                    <div style="color: var(--text-secondary);">Margen de Rentabilidad Actual</div>
                </div>
                
                <h3 style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; margin-bottom: 1rem;">Recomendaciones IA</h3>
                <div class="recommendations-list" style="display: flex; flex-direction: column; gap: 1rem;">
                    ${recommendations.map(rec => `
                        <div class="recommendation-item" style="display: flex; gap: 1rem; background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px;">
                            <div style="font-size: 1.5rem;">${rec.icon}</div>
                            <div>
                                <strong style="display: block; margin-bottom: 0.3rem;">${rec.title}</strong>
                                <div style="font-size: 0.9rem; opacity: 0.8; line-height: 1.4;">${rec.text}</div>
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

        work.deliveryStatus = 'delivered';
        work.actualDeliveryDate = new Date().toISOString();
        
        // Si ya estaba pagado, marcar como completado
        if (work.paymentStatus === 'paid') {
            work.status = 'completed';
        }

        await updateWorkStatus(dashboardData.works);
        alert('✅ Trabajo marcado como entregado');
        loadDashboardData(); // Recargar dashboard
    } catch (error) {
        console.error('Error al marcar entregado:', error);
        alert('❌ Error al actualizar el estado');
    }
}

async function updateWorkStatus(works) {
    await fetch('/api/trabajos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ works: works, notifications: [] })
    });
}