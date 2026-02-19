// ==================== RENDIMIENTOS & DASHBOARD SYSTEM ====================

const rendimientosManager = {
  chartBarras: null,
  chartPie: null,
  profitChart: null,

  async init() {
    console.log('[RENDIMIENTOS] Inicializando Dashboard Completo...');
    this.setupEventListeners();
    await this.loadAllData();
  },

  setupEventListeners() {
    const modal = document.getElementById('gastoModal');
    const btnCloseGasto = document.getElementById('btnCloseGasto');
    const btnStrategy = document.getElementById('btnStrategy');
    const btnSyncGoogle = document.getElementById('btnSyncGoogle');
    
    if (btnCloseGasto) btnCloseGasto.addEventListener('click', () => this.closeGastoModal());
    if (modal) modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeGastoModal();
    });

    if (btnStrategy) {
        btnStrategy.addEventListener('click', () => this.generateStrategyReport());
    }
    
    if (btnSyncGoogle) {
        btnSyncGoogle.addEventListener('click', () => this.handleGoogleSync());
    }
  },

  async handleGoogleSync() {
    const statusDiv = document.getElementById('googleSyncStatus');
    const dot = document.getElementById('googleSyncDot');
    const text = document.getElementById('googleSyncText');
    const btn = document.getElementById('btnSyncGoogle');

    if (statusDiv) statusDiv.style.display = 'flex';
    if (dot) dot.className = 'status-dot syncing';
    if (text) text.textContent = 'Sincronizando...';
    if (btn) btn.disabled = true;

    try {
        const result = await window.mrDataManager.syncGoogleSheets();
        
        if (result.success) {
            if (dot) dot.className = 'status-dot connected';
            if (text) text.textContent = 'Sincronizado';
            if (window.showNotification) {
                window.showNotification({ title: '✅ Google Sheets', message: 'Sincronización completada', type: 'success' });
            }
        } else {
            throw new Error(result.error || 'Error desconocido');
        }
    } catch (error) {
        console.error(error);
        if (dot) dot.className = 'status-dot error';
        if (text) text.textContent = 'Error de conexión';
        if (window.showNotification) {
            window.showNotification({ title: '❌ Error Google Sheets', message: 'No se pudo sincronizar', type: 'error' });
        }
    } finally {
        if (btn) btn.disabled = false;
    }
  },

  async loadAllData() {
    try {
      console.log('[RENDIMIENTOS] Cargando datos...');
      
      // Carga paralela
      const [trabajosRes, clientesRes, gastosRes] = await Promise.all([
          fetch('/api/trabajos'),
          fetch('/api/clientes'),
          fetch('/api/gastos')
      ]);

      const trabajosData = await trabajosRes.json();
      const clientesData = await clientesRes.json();
      const gastosData = await gastosRes.json(); // Asumiendo que el endpoint devuelve array directo o {gastos: []}

      const works = trabajosData.works || [];
      const clients = Array.isArray(clientesData) ? clientesData : [];
      const gastos = Array.isArray(gastosData) ? gastosData : [];

      // 1. Calcular Financieros
      const totalIngresos = works.reduce((sum, w) => sum + (parseFloat(w.total) || 0), 0);
      const totalGastos = gastos.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
      const ganancia = totalIngresos - totalGastos;
      const margen = totalIngresos > 0 ? ((ganancia / totalIngresos) * 100) : 0;

      // Guardar datos para el reporte de estrategia
      this.data = {
          works,
          clients,
          rendimientos: {
              resumen: {
                  ingresos: totalIngresos,
                  margenTotal: margen
              }
          }
      };

      // 2. Actualizar UI Financiera
      this.updateFinancialStats(totalIngresos, totalGastos, ganancia, margen);
      this.renderFinancialCharts(totalIngresos, totalGastos, ganancia);
      this.renderGastosList(gastos);

      // 3. Actualizar UI Operativa (Dashboard)
      this.updateOperationalStats(works, clients);
      this.renderProfitChart(works);
      this.generateAITips(works, clients, margen);

    } catch (error) {
      console.error('[RENDIMIENTOS] Error cargando datos:', error);
    }
  },

  updateFinancialStats(ingresos, gastos, ganancia, margen) {
    document.getElementById('totalIngresos').textContent = '$' + ingresos.toLocaleString('es-AR', {minimumFractionDigits: 2});
    document.getElementById('totalGastos').textContent = '$' + gastos.toLocaleString('es-AR', {minimumFractionDigits: 2});
    
    const gananciaEl = document.getElementById('ganancia');
    gananciaEl.textContent = '$' + ganancia.toLocaleString('es-AR', {minimumFractionDigits: 2});
    gananciaEl.style.color = ganancia >= 0 ? '#4CAF50' : '#FF5252';

    const margenEl = document.getElementById('margen');
    margenEl.textContent = margen.toFixed(1) + '%';
    margenEl.style.color = margen >= 30 ? '#4CAF50' : margen >= 15 ? '#FFC107' : '#FF5252';
  },

  updateOperationalStats(works, clients) {
    // Clientes VIP
    const vipCount = clients.filter(c => (c.rating >= 4.5) || (c.categoria === 'VIP')).length;
    const vipEl = document.getElementById('statVipClients');
    if(vipEl) vipEl.textContent = vipCount;

    // Trabajos Activos
    const activeWorks = works.filter(w => w.status === 'in_progress' || w.status === 'pending').length;
    const activeEl = document.getElementById('statActiveWorks');
    if(activeEl) activeEl.textContent = activeWorks;

    // Para Entrega
    const readyCount = works.filter(w => w.status === 'completed' && w.deliveryStatus !== 'delivered').length;
    const readyEl = document.getElementById('statReadyDelivery');
    if(readyEl) readyEl.textContent = readyCount;

    // Pendiente de Cobro
    const pendingPayment = works.reduce((sum, w) => sum + (parseFloat(w.balance) || 0), 0);
    const pendingEl = document.getElementById('statPendingPayment');
    if(pendingEl) pendingEl.textContent = '$' + pendingPayment.toLocaleString('es-AR', {minimumFractionDigits: 2});
  },

  renderFinancialCharts(ingresos, gastos, ganancia) {
    // Gráfico de Barras
    const ctxBarras = document.getElementById('chartBarras');
    if (ctxBarras && window.Chart) {
      if (this.chartBarras) this.chartBarras.destroy();
      
      this.chartBarras = new Chart(ctxBarras.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Ingresos', 'Gastos', 'Ganancia'],
          datasets: [{
            label: 'Monto ($)',
            data: [ingresos, gastos, ganancia],
            backgroundColor: ['#4CAF50', '#FF5252', ganancia >= 0 ? '#2196F3' : '#FF5252'],
            borderWidth: 0
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }
    
    // Gráfico de Pie
    const ctxPie = document.getElementById('chartPie');
    if (ctxPie && window.Chart) {
      if (this.chartPie) this.chartPie.destroy();
      
      this.chartPie = new Chart(ctxPie.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Ganancia', 'Gastos'],
          datasets: [{
            data: [ganancia >= 0 ? ganancia : 0, gastos],
            backgroundColor: ['#4CAF50', '#FF5252'],
            borderWidth: 0
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  },

  renderProfitChart(works) {
    const ctx = document.getElementById('profitChart');
    if (!ctx || !window.Chart) return;
    
    if (this.profitChart) this.profitChart.destroy();

    // Agrupar ganancias por mes (últimos 6 meses)
    const months = {};
    const today = new Date();
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    for(let i=5; i>=0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${monthNames[d.getMonth()]}`;
        months[key] = 0;
    }

    works.forEach(w => {
        if (w.createdAt) {
            const date = new Date(w.createdAt);
            const key = `${monthNames[date.getMonth()]}`;
            if (months[key] !== undefined) {
                months[key] += (parseFloat(w.profit) || 0);
            }
        }
    });

    this.profitChart = new Chart(ctx.getContext('2d'), {
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
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
  },

  generateAITips(works, clients, margin) {
    const container = document.getElementById('aiTipsList');
    if (!container) return;
    container.innerHTML = '';

    const tips = [];
    if (margin < 30) tips.push('⚠️ Tu margen es bajo (<30%). Revisa costos.');
    else tips.push('✅ Margen saludable. ¡Sigue así!');

    const pending = works.filter(w => w.status === 'pending').length;
    if (pending > 5) tips.push(`🔥 Tienes ${pending} trabajos pendientes. ¡A trabajar!`);

    tips.forEach(t => {
        const div = document.createElement('div');
        div.className = 'ai-tip';
        div.textContent = t;
        container.appendChild(div);
    });
  },

  // --- GESTIÓN DE GASTOS ---
  renderGastosList(gastos) {
    const container = document.getElementById('gastList');
    if (!container) return;
    
    const egresos = gastos.filter(g => g.tipo !== 'ingreso').sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    if (egresos.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay gastos registrados</p>';
        return;
    }

    container.innerHTML = egresos.map((g, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div>
                <strong>${g.descripcion}</strong><br>
                <small style="color: #888;">${new Date(g.fecha).toLocaleDateString('es-AR')}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <strong style="color: #FF5252;">-$${parseFloat(g.monto).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                <button class="btn btn-danger btn-small" onclick="deleteGasto(${g.id || index})">🗑️</button>
            </div>
        </div>
    `).join('');
  },

  openGastoModal() {
    const modal = document.getElementById('gastoModal');
    if (modal) {
      modal.classList.add('active');
      const fechaInput = document.getElementById('gastoFecha');
      if(fechaInput) fechaInput.valueAsDate = new Date();
    }
  },

  closeGastoModal() {
    const modal = document.getElementById('gastoModal');
    if (modal) modal.classList.remove('active');
    document.getElementById('gastoDesc').value = '';
    document.getElementById('gastoMonto').value = '';
  },

  async saveGasto() {
    const descripcion = document.getElementById('gastoDesc').value.trim();
    const monto = parseFloat(document.getElementById('gastoMonto').value);
    const fecha = document.getElementById('gastoFecha').value;

    if (!descripcion || !monto || !fecha) return alert('Completa todos los campos');

    const nuevoGasto = {
        id: Date.now(),
        descripcion,
        monto,
        fecha,
        tipo: 'egreso'
    };

    try {
        const res = await fetch('/api/gastos');
        const gastos = await res.json();
        gastos.push(nuevoGasto);
        
        await fetch('/api/gastos', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(gastos)
        });
        
        this.closeGastoModal();
        this.loadAllData();
        alert('✅ Gasto guardado');
    } catch (e) { console.error(e); alert('Error al guardar'); }
  },

  async deleteGasto(id) {
    if (!confirm('¿Eliminar gasto?')) return;
    try {
        const res = await fetch('/api/gastos');
        let gastos = await res.json();
        
        if (id > 1000000) {
             gastos = gastos.filter(g => g.id !== id);
        } else {
             gastos = gastos.filter(g => g.id !== id);
        }

        await fetch('/api/gastos', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(gastos)
        });
        this.loadAllData();
    } catch (e) { console.error(e); }
  },

  generateStrategyReport() {
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
        const { works, clients, rendimientos } = this.data || { works: [], clients: [], rendimientos: {} };
        
        const margin = rendimientos.resumen?.margenTotal || 0;
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
                text: `Hay un total de $${pendingPayment.toLocaleString('es-AR', {minimumFractionDigits: 2})} pendiente de cobro. Revisa la lista de trabajos para gestionar los cobros.`
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
};

// Exponer funciones globales para HTML
function openGastoModal() {
  rendimientosManager.openGastoModal();
}

function closeGastoModal() {
  rendimientosManager.closeGastoModal();
}

function saveGasto() {
  rendimientosManager.saveGasto();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  rendimientosManager.init();
});
