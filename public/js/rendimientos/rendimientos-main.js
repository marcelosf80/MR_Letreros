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

    const btnExportPDF = document.getElementById('btnExportPDF');
    if (btnExportPDF) {
      btnExportPDF.addEventListener('click', () => this.exportToPDF());
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

      // Usar mrDataManager que envía el token JWT automáticamente
      const [rendimientosData, gastosData, clientesData] = await Promise.all([
        window.mrDataManager.getRendimientos(),
        window.mrDataManager.getGastos(),
        window.mrDataManager.getClientesClientes()
      ]);

      // Extraer datos del endpoint /api/rendimientos
      const resumen = rendimientosData.resumen || {};
      const totalIngresos = resumen.ingresos || 0;
      const totalGastos = resumen.gastosOperativos || 0;
      const ganancia = resumen.gananciaNeta || 0;
      const margen = resumen.margenTotal || 0;
      const pendienteCobrar = resumen.pendienteCobrar || 0;

      const gastos = Array.isArray(gastosData) ? gastosData : [];
      const clients = Array.isArray(clientesData) ? clientesData : [];

      // Guardar datos para el reporte de estrategia
      this.data = {
        works: [],  // No hay endpoint directo de trabajos, usamos datos del resumen
        clients,
        rendimientos: rendimientosData,
        pendienteCobrar
      };

      // 1. Actualizar UI Financiera
      this.updateFinancialStats(totalIngresos, totalGastos, ganancia, margen);
      this.renderFinancialCharts(totalIngresos, totalGastos, ganancia);
      this.renderGastosList(gastos);
      this.renderIngresosList(rendimientosData.ingresosList || gastos);

      // 2. Actualizar UI Operativa (Dashboard)
      this.updateOperationalStatsFromRendimientos(rendimientosData, clients, pendienteCobrar);
      this.renderProfitChartFromCategories(rendimientosData.porCategoria || []);
      this.generateAITips([], clients, margen);

      console.log('[RENDIMIENTOS] ✅ Datos cargados exitosamente');

    } catch (error) {
      console.error('[RENDIMIENTOS] Error cargando datos:', error);
    }
  },

  updateFinancialStats(ingresos, gastos, ganancia, margen) {
    document.getElementById('totalIngresos').textContent = '$' + ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2 });
    document.getElementById('totalGastos').textContent = '$' + gastos.toLocaleString('es-AR', { minimumFractionDigits: 2 });

    const gananciaEl = document.getElementById('ganancia');
    gananciaEl.textContent = '$' + ganancia.toLocaleString('es-AR', { minimumFractionDigits: 2 });
    gananciaEl.style.color = ganancia >= 0 ? '#4CAF50' : '#FF5252';

    const margenEl = document.getElementById('margen');
    margenEl.textContent = margen.toFixed(1) + '%';
    margenEl.style.color = margen >= 30 ? '#4CAF50' : margen >= 15 ? '#FFC107' : '#FF5252';
  },

  updateOperationalStatsFromRendimientos(rendimientosData, clients, pendienteCobrar) {
    // Clientes VIP
    const vipCount = clients.filter(c => (c.rating >= 4.5) || (c.categoria === 'VIP')).length;
    const vipEl = document.getElementById('statVipClients');
    if (vipEl) vipEl.textContent = vipCount;

    // Trabajos Activos - usar conteo de categorías como referencia
    const categorias = rendimientosData.porCategoria || [];
    const totalCategorias = categorias.reduce((sum, c) => sum + (c.cantidad || 0), 0);
    const activeEl = document.getElementById('statActiveWorks');
    if (activeEl) activeEl.textContent = totalCategorias;

    // Para Entrega - no disponible sin endpoint de trabajos
    const readyEl = document.getElementById('statReadyDelivery');
    if (readyEl) readyEl.textContent = '—';

    // Pendiente de Cobro
    const pendingEl = document.getElementById('statPendingPayment');
    if (pendingEl) pendingEl.textContent = '$' + pendienteCobrar.toLocaleString('es-AR', { minimumFractionDigits: 2 });
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

  renderProfitChartFromCategories(categorias) {
    const ctx = document.getElementById('profitChart');
    if (!ctx || !window.Chart) return;

    if (this.profitChart) this.profitChart.destroy();

    // Usar categorías como datos del gráfico de rentabilidad
    const labels = categorias.map(c => c.categoria || 'Sin Categoría');
    const data = categorias.map(c => c.ganancia || 0);

    this.profitChart = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['Sin datos'],
        datasets: [{
          label: 'Ganancia por Categoría ($)',
          data: data.length > 0 ? data : [0],
          backgroundColor: data.map(v => v >= 0 ? 'rgba(99, 102, 241, 0.7)' : 'rgba(255, 82, 82, 0.7)'),
          borderColor: data.map(v => v >= 0 ? '#6366f1' : '#FF5252'),
          borderWidth: 1
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

    const pendiente = this.data?.pendienteCobrar || 0;
    if (pendiente > 0) tips.push(`💰 Pendiente de cobro: $${pendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);

    tips.forEach(t => {
      const div = document.createElement('div');
      div.className = 'ai-tip';
      div.textContent = t;
      container.appendChild(div);
    });
  },

  // --- GESTIÓN DE FINANZAS (INGRESOS Y GASTOS) ---
  renderGastosList(gastos) {
    const container = document.getElementById('gastList');
    if (!container) return;

    const egresos = gastos.filter(g => g.tipo !== 'ingreso').sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    if (egresos.length === 0) {
      container.innerHTML = '<p class="empty-state">No hay gastos registrados</p>';
      return;
    }

    container.innerHTML = egresos.map((g, index) => {
      const gastoId = g.id || ('_index_' + index);
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div>
                <strong>${g.descripcion}</strong><br>
                <small style="color: #888;">${new Date(g.fecha).toLocaleDateString('es-AR')}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <strong style="color: #FF5252;">-$${parseFloat(g.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                <button class="btn btn-danger btn-small" onclick="deleteGasto('${gastoId}')">🗑️</button>
            </div>
        </div>
      `;
    }).join('');
  },

  renderIngresosList(data) {
    const container = document.getElementById('ingresosList');
    if (!container) return;

    // Si data es el listado de gastos crudo, filtrar. Si es el procesado por el servidor, usar directo.
    let ingresos = [];
    if (Array.isArray(data)) {
        if (data.length > 0 && (data[0].tipo === 'automatico' || data[0].tipo === 'manual')) {
            ingresos = data;
        } else {
            ingresos = data.filter(g => g.tipo === 'ingreso');
        }
    }

    ingresos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    if (ingresos.length === 0) {
      container.innerHTML = '<p class="empty-state">No hay ingresos registrados</p>';
      return;
    }

    container.innerHTML = ingresos.map((g, index) => {
      // Los ingresos automáticos vienen de cotizaciones aprobadas (no se pueden borrar)
      const isAuto = g.tipo === 'automatico';
      const ingresoId = g.id || ('_index_in_' + index);

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div>
                <strong>${g.descripcion}</strong><br>
                <small style="color: #888;">${new Date(g.fecha).toLocaleDateString('es-AR')}</small>
                ${isAuto ? '<span class="badge bg-primary ms-2" style="font-size: 0.6rem; opacity: 0.7;">AUTO</span>' : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <strong style="color: #4CAF50;">+$${parseFloat(g.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                ${!isAuto ? `<button class="btn btn-danger btn-small" onclick="deleteIngreso('${ingresoId}')" title="Eliminar ingreso">🗑️</button>` : ''}
            </div>
        </div>
      `;
    }).join('');
  },

  openGastoModal(tipo = 'egreso') {
    const modal = document.getElementById('gastoModal');
    if (modal) {
      const title = modal.querySelector('.modal-title');
      if (title) title.textContent = tipo === 'ingreso' ? '📥 Agregar Ingreso' : '💸 Agregar Gasto';
      
      this.currentModalType = tipo;
      
      modal.classList.add('active');
      const fechaInput = document.getElementById('gastoFecha');
      if (fechaInput) fechaInput.valueAsDate = new Date();
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
    const tipo = this.currentModalType || 'egreso';

    if (!descripcion || !monto || !fecha) return alert('Completa todos los campos');

    const nuevoGasto = {
      id: `${tipo}_manual_${Date.now()}`,
      descripcion,
      monto,
      fecha,
      tipo: tipo,
      categoria: tipo === 'ingreso' ? 'ingreso_manual' : 'gasto_manual'
    };

    try {
      const gastos = await window.mrDataManager.getGastos();
      gastos.push(nuevoGasto);

      await window.mrDataManager.saveGastos(gastos);

      this.closeGastoModal();
      this.loadAllData();
      alert(tipo === 'ingreso' ? '✅ Ingreso guardado' : '✅ Gasto guardado');
    } catch (e) { console.error(e); alert('Error al guardar'); }
  },

  async deleteGasto(id) {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      let gastos = await window.mrDataManager.getGastos();

      if (typeof id === 'string' && id.startsWith('_index_')) {
        // Items sin id — eliminar por índice
        const isIngreso = id.startsWith('_index_in_');
        const idx = parseInt(id.replace('_index_in_', '').replace('_index_', ''));
        const filtered = isIngreso
          ? gastos.filter(g => g.tipo === 'ingreso').sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
          : gastos.filter(g => g.tipo !== 'ingreso').sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        if (filtered[idx]) {
          const target = filtered[idx];
          const globalIdx = gastos.findIndex(g => g.descripcion === target.descripcion && g.monto === target.monto && g.fecha === target.fecha);
          if (globalIdx !== -1) gastos.splice(globalIdx, 1);
        }
      } else {
        // Items con id — filtrar por id (string o number)
        gastos = gastos.filter(g => String(g.id) !== String(id));
      }

      await window.mrDataManager.saveGastos(gastos);
      this.loadAllData();
      console.log('[RENDIMIENTOS] ✅ Registro eliminado:', id);
    } catch (e) { console.error('[RENDIMIENTOS] Error eliminando:', e); }
  },

  async deleteIngreso(id) {
    if (!confirm('¿Eliminar este ingreso?')) return;
    try {
      let gastos = await window.mrDataManager.getGastos();
      const originalLength = gastos.length;

      // Buscar el ingreso en gastos.json (almacenado con tipo 'ingreso')
      gastos = gastos.filter(g => {
        if (g.tipo !== 'ingreso') return true; // Mantener todo lo que NO es ingreso
        return String(g.id) !== String(id); // Eliminar el que coincida por ID
      });

      if (gastos.length === originalLength) {
        // Si no se encontró por ID, intentar buscar por índice
        if (typeof id === 'string' && id.startsWith('_index_in_')) {
          const idx = parseInt(id.replace('_index_in_', ''));
          const ingresosEnGastos = gastos.filter(g => g.tipo === 'ingreso').sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
          if (ingresosEnGastos[idx]) {
            const target = ingresosEnGastos[idx];
            const globalIdx = gastos.findIndex(g => 
              g.tipo === 'ingreso' && 
              g.descripcion === target.descripcion && 
              g.monto == target.monto && 
              g.fecha === target.fecha
            );
            if (globalIdx !== -1) {
              gastos.splice(globalIdx, 1);
            }
          }
        }
      }

      if (gastos.length < originalLength) {
        await window.mrDataManager.saveGastos(gastos);
        this.loadAllData();
        console.log('[RENDIMIENTOS] ✅ Ingreso eliminado:', id);
      } else {
        console.warn('[RENDIMIENTOS] ⚠️ No se encontró el ingreso para eliminar:', id);
        alert('No se pudo eliminar este ingreso. Puede ser un ingreso automático generado por una cotización aprobada.');
      }
    } catch (e) { 
      console.error('[RENDIMIENTOS] Error eliminando ingreso:', e); 
      alert('Error al eliminar el ingreso');
    }
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
      const { clients, rendimientos, pendienteCobrar } = this.data || { clients: [], rendimientos: {}, pendienteCobrar: 0 };

      const margin = rendimientos?.resumen?.margenTotal || 0;

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

      if (pendienteCobrar > 0) {
        recommendations.push({
          icon: '💰',
          title: 'Cobranzas Pendientes',
          text: `Hay un total de $${pendienteCobrar.toLocaleString('es-AR', { minimumFractionDigits: 2 })} pendiente de cobro. Revisa la lista de trabajos para gestionar los cobros.`
        });
      }

      // Mostrar categorías más rentables
      const categorias = rendimientos?.porCategoria || [];
      if (categorias.length > 0) {
        const top = categorias[0];
        recommendations.push({
          icon: '📊',
          title: 'Categoría Más Rentable',
          text: `"${top.categoria}" es tu categoría más fuerte con $${top.ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })} en ingresos y ${top.margen.toFixed(1)}% de margen.`
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
  },

  async exportToPDF() {
    console.log('[RENDIMIENTOS] Generando PDF...');
    
    if (!window.PDFGenerator) {
        alert('Error: No se pudo cargar el generador de PDF.');
        return;
    }

    const generator = new window.PDFGenerator();
    
    try {
        // Cargar jsPDF si no está
        if (!window.jspdf) {
            await generator.loadJsPDF();
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const margin = 20;
        let currentY = 20;

        // --- 1. HEADER ---
        doc.setFillColor(99, 102, 241); // Primary color
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('REPORTE FINANCIERO', 15, 25);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('SISTEMA MR LETREROS', 15, 32);
        doc.text(new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }), 195, 25, { align: 'right' });

        currentY = 55;

        // --- 2. RESUMEN FINANCIERO ---
        doc.setTextColor(30, 30, 40);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumen General', margin, currentY);
        currentY += 10;

        const resumen = this.data.rendimientos?.resumen || {};
        const resumenData = [
            ['Total Ingresos', `$${(resumen.ingresos || 0).toLocaleString('es-AR')}`],
            ['Total Gastos', `$${(resumen.gastosOperativos || 0).toLocaleString('es-AR')}`],
            ['Ganancia Neta', `$${(resumen.gananciaNeta || 0).toLocaleString('es-AR')}`],
            ['Margen %', `${(resumen.margenTotal || 0).toFixed(1)}%`]
        ];

        doc.autoTable({
            startY: currentY,
            body: resumenData,
            theme: 'plain',
            styles: { fontSize: 12, cellPadding: 2 },
            columnStyles: { 0: { fontStyle: 'bold', width: 50 }, 1: { halign: 'right' } },
            margin: { left: margin }
        });

        currentY = doc.autoTable.previous.finalY + 15;

        // --- 3. TABLA DE INGRESOS ---
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Detalle de Ingresos', margin, currentY);
        currentY += 5;

        const ingresosList = (this.data.rendimientos?.ingresosList || []).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        const ingresosTable = ingresosList.map(i => [
            new Date(i.fecha).toLocaleDateString('es-AR'),
            i.descripcion,
            `$${i.monto.toLocaleString('es-AR')}`
        ]);

        doc.autoTable({
            startY: currentY,
            head: [['Fecha', 'Concepto', 'Monto']],
            body: ingresosTable.length > 0 ? ingresosTable : [['-', 'No hay ingresos registrados', '-']],
            theme: 'striped',
            headStyles: { fillColor: [76, 175, 80] },
            margin: { left: margin, right: margin },
            styles: { fontSize: 9 }
        });

        currentY = doc.autoTable.previous.finalY + 15;

        // --- 4. TABLA DE GASTOS ---
        if (currentY > 230) { doc.addPage(); currentY = 20; }
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Detalle de Gastos', margin, currentY);
        currentY += 5;

        const gastosRAW = await window.mrDataManager.getGastos();
        const gastosList = gastosRAW.filter(g => g.tipo !== 'ingreso').sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        const gastosTable = gastosList.map(g => [
            new Date(g.fecha).toLocaleDateString('es-AR'),
            g.descripcion,
            `$${parseFloat(g.monto).toLocaleString('es-AR')}`
        ]);

        doc.autoTable({
            startY: currentY,
            head: [['Fecha', 'Concepto', 'Monto']],
            body: gastosTable.length > 0 ? gastosTable : [['-', 'No hay gastos registrados', '-']],
            theme: 'striped',
            headStyles: { fillColor: [255, 82, 82] },
            margin: { left: margin, right: margin },
            styles: { fontSize: 9 }
        });

        // --- FOOTER ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${pageCount} - Reporte Generado por MR Letreros`, 105, 285, { align: 'center' });
        }

        doc.save(`Reporte_Rendimientos_${new Date().toISOString().split('T')[0]}.pdf`);
        
        if (window.showNotification) {
            window.showNotification({ title: '✅ PDF', message: 'Reporte descargado correctamente', type: 'success' });
        }

    } catch (error) {
        console.error('Error generando PDF:', error);
        alert('Error al generar el PDF: ' + error.message);
    }
  }
};

// Exponer funciones globales para HTML
function openGastoModal(tipo) {
  rendimientosManager.openGastoModal(tipo);
}

function closeGastoModal() {
  rendimientosManager.closeGastoModal();
}

function saveGasto() {
  rendimientosManager.saveGasto();
}

function deleteGasto(id) {
  rendimientosManager.deleteGasto(id);
}

// Función específica para borrar ingresos manuales de gastos.json
function deleteIngreso(id) {
  rendimientosManager.deleteIngreso(id);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  rendimientosManager.init();
});
