document.addEventListener('DOMContentLoaded', async () => {
    console.log('[DASHBOARD] 🚀 Inicializando...');
    
    // Mensaje de bienvenida dinámico
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    document.getElementById('welcomeMessage').textContent = `${greeting}, bienvenido a MR Letreros v2.0`;

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

        const works = trabajosData.works || [];
        const clients = Array.isArray(clientesData) ? clientesData : [];

        updateStats(works, clients, rendimientosData);
        renderChart(works);
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

function renderChart(works) {
    const ctx = document.getElementById('profitChart').getContext('2d');
    
    // Agrupar ganancias por mes (últimos 6 meses)
    const months = {};
    const today = new Date();
    for(let i=5; i>=0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${d.getMonth()+1}/${d.getFullYear()}`;
        months[key] = 0;
    }

    works.forEach(w => {
        if (w.status === 'completed' || w.paymentStatus === 'paid') {
            const date = new Date(w.createdAt);
            const key = `${date.getMonth()+1}/${date.getFullYear()}`;
            if (months[key] !== undefined) {
                months[key] += (w.profit || 0);
            }
        }
    });

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(months),
            datasets: [{
                label: 'Ganancia Neta ($)',
                data: Object.values(months),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#aaa' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#aaa' }
                }
            }
        }
    });
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

    // Filtrar trabajos activos y ordenar por fecha
    const upcoming = works
        .filter(w => w.status !== 'completed' && w.status !== 'cancelled')
        .sort((a, b) => new Date(a.deliveryDate || a.createdAt) - new Date(b.deliveryDate || b.createdAt))
        .slice(0, 5);

    if (upcoming.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; opacity:0.5;">No hay entregas pendientes</td></tr>';
        return;
    }

    upcoming.forEach(w => {
        const date = w.deliveryDate ? new Date(w.deliveryDate).toLocaleDateString() : 'Sin fecha';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${w.clientName || 'Cliente'}</td>
            <td>#${w.id.substr(-6)}</td>
            <td>${date}</td>
            <td><span class="status-badge" style="background:${getStatusColor(w.status)}">${getStatusLabel(w.status)}</span></td>
            <td>$${formatCurrency(w.total)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function formatCurrency(num) {
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(num);
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