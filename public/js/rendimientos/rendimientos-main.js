// ==================== RENDIMIENTOS MANAGEMENT SYSTEM ====================

const rendimientosManager = {
  chartBarras: null,
  chartPie: null,

  async init() {
    console.log('[RENDIMIENTOS] Inicializando...');
    this.setupEventListeners();
    await this.loadRendimientos();
    await this.loadGastos();
  },

  setupEventListeners() {
    const modal = document.getElementById('gastoModal');
    const btnOpen = document.querySelector('.btn-primary');
    const btnClose = document.querySelector('.btn-close');
    
    if (btnOpen) btnOpen.addEventListener('click', () => this.openGastoModal());
    if (btnClose) btnClose.addEventListener('click', () => this.closeGastoModal());
    if (modal) modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeGastoModal();
    });
  },

  async loadRendimientos() {
    try {
      console.log('[RENDIMIENTOS] Cargando datos financieros...');
      
      // Obtener todas las cotizaciones y gastos
      // FIX: Usar trabajos aprobados para cálculo real de ingresos
      const trabajosRes = await fetch('/api/trabajos');
      const trabajosData = await trabajosRes.json();
      const trabajos = trabajosData.works || [];
      
      const gastos = (await window.mrDataManager?.getGastos?.()) || [];
      
      console.log('[RENDIMIENTOS] Trabajos Aprobados:', trabajos.length);
      console.log('[RENDIMIENTOS] Gastos:', gastos.length);
      
      // Calcular totales desde trabajos (Ingresos reales)
      const totalIngresos = trabajos.reduce((sum, w) => sum + (parseFloat(w.total) || 0), 0);
      
      const totalGastos = gastos.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
      
      const ganancia = totalIngresos - totalGastos;
      const margenGanancia = totalIngresos > 0 ? ((ganancia / totalIngresos) * 100) : 0;
      
      console.log('[RENDIMIENTOS] Total Ingresos:', totalIngresos);
      console.log('[RENDIMIENTOS] Total Gastos:', totalGastos);
      console.log('[RENDIMIENTOS] Ganancia:', ganancia);
      
      // Actualizar estadísticas en UI
      this.updateStats({
        ingresos: totalIngresos,
        gastos: totalGastos,
        ganancia: ganancia,
        margen: margenGanancia
      });
      
      // Actualizar semáforo
      this.updateSemaforo(margenGanancia, ganancia);
      
      // Crear gráficos
      this.createCharts({
        ingresos: totalIngresos,
        gastos: totalGastos,
        ganancia: ganancia
      });
      
      console.log('[RENDIMIENTOS] ✅ Datos cargados correctamente');
      
    } catch (error) {
      console.error('[RENDIMIENTOS] Error cargando datos:', error);
    }
  },

  updateStats(data) {
    const ingresoEl = document.getElementById('totalIngresos');
    const gastosEl = document.getElementById('totalGastos');
    const gananciaEl = document.getElementById('ganancia');
    const margenEl = document.getElementById('margen');
    
    if (ingresoEl) ingresoEl.textContent = '$' + data.ingresos.toLocaleString('es-AR', {minimumFractionDigits: 2});
    
    if (gastosEl) {
      gastosEl.textContent = '-$' + data.gastos.toLocaleString('es-AR', {minimumFractionDigits: 2});
      gastosEl.className = 'stat-value negative';
    }
    
    if (gananciaEl) {
      gananciaEl.textContent = '$' + data.ganancia.toLocaleString('es-AR', {minimumFractionDigits: 2});
      gananciaEl.className = 'stat-value';
      if (data.ganancia < 0) gananciaEl.classList.add('negative');
      else if (data.ganancia < data.ingresos * 0.2) gananciaEl.classList.add('warning');
    }
    
    if (margenEl) {
      margenEl.textContent = data.margen.toFixed(1) + '%';
      margenEl.className = 'stat-value';
      if (data.margen < 0) margenEl.classList.add('negative');
      else if (data.margen < 20) margenEl.classList.add('warning');
    }
  },

  updateSemaforo(margen, ganancia) {
    const luces = {
      verde: document.querySelector('.luz.verde'),
      amarillo: document.querySelector('.luz.amarillo'),
      rojo: document.querySelector('.luz.rojo')
    };
    
    const titulo = document.getElementById('semaforoTitulo');
    const recomendacion = document.getElementById('recomendacion');
    
    // Resetear todas las luces
    Object.values(luces).forEach(luz => luz?.classList.remove('active'));
    
    if (margen >= 30 && ganancia > 0) {
      luces.verde?.classList.add('active');
      titulo.textContent = '✅ Excelente Rendimiento';
      recomendacion.textContent = 'El negocio está funcionando muy bien. Margen de ganancia saludable y positivo. Considera reinvertir las ganancias o expandir operaciones.';
    } else if (margen >= 15 && ganancia > 0) {
      luces.amarillo?.classList.add('active');
      titulo.textContent = '⚠️ Rendimiento Moderado';
      recomendacion.textContent = 'El negocio es rentable pero el margen es ajustado. Busca optimizar costos o aumentar precios donde sea posible para mejorar la rentabilidad.';
    } else {
      luces.rojo?.classList.add('active');
      titulo.textContent = '🚨 Atención Requerida';
      recomendacion.textContent = ganancia < 0 
        ? 'El negocio está operando con pérdidas. Revisa urgentemente tus costos y precios. Considera reducir gastos innecesarios.'
        : 'Margen de ganancia muy bajo. Analiza tus costos y ajusta precios para mejorar la rentabilidad del negocio.';
    }
  },

  createCharts(data) {
    // Gráfico de Barras
    const ctxBarras = document.getElementById('chartBarras');
    if (ctxBarras && window.Chart) {
      if (this.chartBarras) this.chartBarras.destroy();
      
      const ctx = ctxBarras.getContext('2d');
      this.chartBarras = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Ingresos', 'Gastos', 'Ganancia'],
          datasets: [{
            label: 'Monto ($)',
            data: [data.ingresos, data.gastos, data.ganancia],
            backgroundColor: ['#4CAF50', '#FF5252', data.ganancia >= 0 ? '#2196F3' : '#FF5252'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => {
                  return '$' + context.parsed.y.toLocaleString('es-AR', {minimumFractionDigits: 2});
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                color: '#a0a0a0',
                callback: (value) => '$' + value.toLocaleString('es-AR')
              },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            x: {
              ticks: { color: '#a0a0a0' },
              grid: { display: false }
            }
          }
        }
      });
    }
    
    // Gráfico de Pie
    const ctxPie = document.getElementById('chartPie');
    if (ctxPie && window.Chart) {
      if (this.chartPie) this.chartPie.destroy();
      
      const ctx = ctxPie.getContext('2d');
      this.chartPie = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Ganancia', 'Gastos'],
          datasets: [{
            data: [data.ganancia >= 0 ? data.ganancia : 0, data.gastos],
            backgroundColor: ['#4CAF50', '#FF5252'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#a0a0a0' }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label || '';
                  const value = context.parsed;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                  return label + ': $' + value.toLocaleString('es-AR', {minimumFractionDigits: 2}) + ' (' + percentage + '%)';
                }
              }
            }
          }
        }
      });
    }
  },

  // ==================== GESTOR DE GASTOS ====================

  async getGastos() {
    try {
      return (await window.mrDataManager?.getGastos?.()) || [];
    } catch (error) {
      console.error('[GASTOS] Error leyendo gastos:', error);
      return [];
    }
  },

  async saveGastosToStorage(gastos) {
    try {
      await window.mrDataManager?.saveGastos?.(gastos);
      console.log('[GASTOS] Guardados correctamente');
      return true;
    } catch (error) {
      console.error('[GASTOS] Error guardando gastos:', error);
      return false;
    }
  },

  async loadGastos() {
    try {
      const gastos = await this.getGastos();
      const container = document.getElementById('gastList');
      
      if (!container) return;
      
      if (gastos.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #a0a0a0; padding: 2rem;">No hay gastos registrados</p>';
        return;
      }
      
      container.innerHTML = gastos.map((g, index) => `
        <div class="gasto-item">
          <div>
            <strong>${g.descripcion}</strong><br>
            <small style="color: #a0a0a0;">${new Date(g.fecha).toLocaleDateString('es-AR')}</small>
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <strong style="color: #FF5252; font-size: 1.2rem;">-$${g.monto.toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
            <button class="btn btn-danger" style="padding: 0.5rem 1rem;" onclick="rendimientosManager.deleteGasto(${index})">🗑️</button>
          </div>
        </div>
      `).join('');
      
    } catch (error) {
      console.error('Error cargando gastos:', error);
    }
  },

  openGastoModal() {
    const modal = document.getElementById('gastoModal');
    if (modal) {
      modal.classList.add('active');
      const fechaInput = document.getElementById('gastoFecha');
      if (fechaInput) {
        fechaInput.valueAsDate = new Date();
      }
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
    
    if (!descripcion || !monto || !fecha) {
      alert('⚠️ Completá todos los campos');
      return;
    }
    
    if (monto <= 0) {
      alert('⚠️ El monto debe ser mayor a 0');
      return;
    }
    
    try {
      const gastos = await this.getGastos();
      
      gastos.push({
        id: Date.now(),
        descripcion,
        monto,
        fecha
      });
      
      const success = await this.saveGastosToStorage(gastos);
      
      if (success) {
        alert('✅ Gasto guardado correctamente');
        this.closeGastoModal();
        await this.loadGastos();
        await this.loadRendimientos();
      } else {
        alert('❌ Error al guardar gasto');
      }
    } catch (error) {
      console.error('Error guardando gasto:', error);
      alert('❌ Error al guardar gasto');
    }
  },

  async deleteGasto(index) {
    if (!confirm('¿Eliminar este gasto?')) return;
    
    try {
      const gastos = await this.getGastos();
      gastos.splice(index, 1);
      
      const success = await this.saveGastosToStorage(gastos);
      
      if (success) {
        alert('✅ Gasto eliminado');
        await this.loadGastos();
        await this.loadRendimientos();
      } else {
        alert('❌ Error al eliminar gasto');
      }
    } catch (error) {
      console.error('Error eliminando gasto:', error);
      alert('❌ Error al eliminar gasto');
    }
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
