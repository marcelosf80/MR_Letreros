const tercerosManager = {
  empresas: [],
  categorias: [],
  pagosManuales: [],
  currentEditingEmpresa: null,
  currentEditingServicio: null,
  presupuestoItems: [],

  async init() {
    console.log('[TERCEROS-INIT] Iniciando...');
    await this.loadEmpresas();
    await this.loadCategorias();
    await this.loadPagosPendientes();
    await this.loadHistorialPagos();
    this.setupEventListeners();
    this.render();
    this.updatePresupuestoSelects();
    this.generateParticles();
  },

  async loadEmpresas() {
    try {
      this.empresas = await window.mrDataManager.getTerceros() || [];
      console.log('[TERCEROS-LOAD] Empresas cargadas:', this.empresas.length);
    } catch (error) {
      console.error('[TERCEROS-LOAD-ERROR]', error);
      this.empresas = [];
    }
  },

  async loadCategorias() {
    try {
      this.categorias = await window.mrDataManager.getCategorias() || [];
      console.log('[TERCEROS-CATEGORIAS-LOAD] Categorías cargadas:', this.categorias.length);
    } catch (error) {
      console.error('[TERCEROS-CATEGORIAS-ERROR]', error);
      this.categorias = [];
    }
  },

  async loadPagosPendientes() {
    const container = document.getElementById('pagosPendientesList');
    if (!container) return;

    container.innerHTML = '<p class="empty-state">Calculando...</p>';

    try {
      let gremioQuotes = [];
      let clientQuotes = [];
      this.pagosManuales = [];

      // 1. Cargar datos
      if (window.mrDataManager) {
        gremioQuotes = await window.mrDataManager.getGremioCotizaciones();
        clientQuotes = await window.mrDataManager.getClientesCotizaciones();
        this.pagosManuales = await window.mrDataManager.getTercerosPagosManuales() || [];
      }

      const allQuotes = [...(Array.isArray(gremioQuotes) ? gremioQuotes : []), ...(Array.isArray(clientQuotes) ? clientQuotes : [])];
      const approved = allQuotes.filter(q => q.estado === 'aprobada' || q.approved === true);

      const pagosPorEmpresa = {};
      let totalDeuda = 0;

      // 2. Procesar cotizaciones
      approved.forEach(quote => {
        if (quote.terceros && Array.isArray(quote.terceros)) {
          quote.terceros.forEach(item => {
            if (item.pagado) return;
            const empresa = item.empresa || 'Sin Empresa Asignada';
            const monto = parseFloat(item.totalCosto) || 0;
            const cliente = quote.cliente?.nombre || quote.clientName || 'Sin Cliente';
            const m2 = item.m2 || item.cantidad || 0;
            const servicio = item.nombre || item.servicio || 'Servicio';

            if (!pagosPorEmpresa[empresa]) {
              pagosPorEmpresa[empresa] = { total: 0, detalles: [] };
            }
            
            pagosPorEmpresa[empresa].total += monto;
            pagosPorEmpresa[empresa].detalles.push({
              id: `${quote.id || quote.date}_${item.nombre}`,
              tipo: 'cotizacion',
              cliente,
              referencia: `${parseFloat(m2).toFixed(2)}m²`,
              servicio,
              monto
            });
            totalDeuda += monto;
          });
        }
      });

      // 3. Procesar pagos manuales
      this.pagosManuales.forEach(p => {
        if (p.pagado) return;
        const empresa = p.empresa || 'Sin Empresa Asignada';
        const monto = parseFloat(p.monto) || 0;

        if (!pagosPorEmpresa[empresa]) {
          pagosPorEmpresa[empresa] = { total: 0, detalles: [] };
        }

        pagosPorEmpresa[empresa].total += monto;
        pagosPorEmpresa[empresa].detalles.push({
          id: p.id,
          tipo: p.source === 'planilla' ? 'planilla' : 'manual',
          cliente: p.source === 'planilla' ? p.concepto : 'Gasto Manual',
          referencia: p.fecha ? new Date(p.fecha).toLocaleDateString('es-AR') : '',
          servicio: p.source === 'planilla' ? 'Costo Trabajo' : p.concepto,
          monto: monto,
          obs: p.observaciones
        });
        totalDeuda += monto;
      });

      if (Object.keys(pagosPorEmpresa).length === 0) {
        container.innerHTML = '<p class="empty-state">✅ Al día: No hay deudas pendientes con terceros.</p>';
        return;
      }

      let html = `
        <div class="stat-card" style="background: rgba(255, 193, 7, 0.1); border: 1px solid #FFC107; padding: 1rem; border-radius: 8px; display: flex; flex-direction: column; justify-content: center;">
          <div class="stat-label" style="color: #aaa; font-size: 0.9rem; text-transform: uppercase;">Total a Pagar</div>
          <div class="stat-value" style="color: #FFC107; font-size: 1.8rem; font-weight: bold;">$${totalDeuda.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
        </div>
      `;

      Object.entries(pagosPorEmpresa).forEach(([empresa, data]) => {
        const safeEmpresa = empresa.replace(/'/g, "\\'");
        
        const detallesHtml = data.detalles.map((d, i) => `
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #444; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 0.3rem; margin-top: 0.3rem;" title="${d.obs || ''}">
            <div style="display: flex; align-items: center; flex: 1; gap: 8px;">
              <input type="checkbox" class="pago-checkbox-${safeEmpresa}" data-id="${d.id}" data-monto="${d.monto}" checked style="width: 16px; height: 16px; cursor: pointer;">
              <div style="flex: 1;">
                <strong>${d.cliente}</strong>: ${d.servicio} (${d.referencia}) - 
                <span style="color: #2e7d32; font-weight: bold;">$${d.monto.toLocaleString('es-AR')}</span>
                ${d.tipo === 'manual' || d.tipo === 'planilla' ? `<span style="font-size:0.7rem; color:#f59e0b; margin-left:5px;">[${d.tipo}]</span>` : ''}
              </div>
            </div>
            <button class="btn btn-danger btn-small" style="padding: 1px 6px; font-size: 0.7rem; margin-left: 5px;" onclick="tercerosManager.deleteManualPayment('${d.id}', '${safeEmpresa}')" title="Eliminar este registro sin pagar">🗑️</button>
          </div>
        `).join('');

        html += `
          <div class="stat-card" style="background: white; border: 1px solid #e2e8f0; padding: 1.2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div class="stat-label" style="color: #1e293b; font-weight: 800; font-size: 1.1rem; margin-bottom: 0.5rem; text-transform: uppercase; border-bottom: 2px solid #6366f1; display: inline-block;">${empresa}</div>
            <div class="stat-value" style="color: #dc2626; font-size: 1.6rem; font-weight: 900; margin: 0.5rem 0;">$${data.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
            <div style="max-height: 150px; overflow-y: auto; margin-top: 1rem; background: #f8fafc; padding: 8px; border-radius: 8px;">
              ${detallesHtml}
            </div>
            <button class="btn btn-success btn-small" style="margin-top: 1rem; width: 100%; font-weight: bold; border-radius: 8px;" onclick="tercerosManager.markAsPaid('${safeEmpresa}')">✅ Pagar Seleccionados</button>
          </div>
        `;
      });

      container.innerHTML = html;

    } catch (e) {
      console.error('[TERCEROS] Error calculando pagos:', e);
      container.innerHTML = '<p class="empty-state" style="color: #FF5252;">Error al calcular pagos pendientes.</p>';
    }
  },

  async loadHistorialPagos() {
    const container = document.getElementById('historialPagosList');
    if (!container) return;

    container.innerHTML = '<p class="empty-state">Cargando historial...</p>';

    try {
      let gremioQuotes = [];
      let clientQuotes = [];
      let manuales = [];

      if (window.mrDataManager) {
        gremioQuotes = await window.mrDataManager.getGremioCotizaciones();
        clientQuotes = await window.mrDataManager.getClientesCotizaciones();
        manuales = await window.mrDataManager.getTercerosPagosManuales() || [];
      }

      const allQuotes = [...(Array.isArray(gremioQuotes) ? gremioQuotes : []), ...(Array.isArray(clientQuotes) ? clientQuotes : [])];
      const approved = allQuotes.filter(q => q.estado === 'aprobada' || q.approved === true);

      const pagos = [];

      approved.forEach(quote => {
        if (quote.terceros && Array.isArray(quote.terceros)) {
          quote.terceros.forEach(item => {
            if (item.pagado) {
              pagos.push({
                fecha: item.fechaPago || quote.fechaAprobacion || quote.date,
                empresa: item.empresa || 'Sin Empresa',
                servicio: item.nombre,
                monto: parseFloat(item.totalCosto) || 0,
                tipo: 'Cotización'
              });
            }
          });
        }
      });

      manuales.forEach(p => {
        if (p.pagado) {
          pagos.push({
            fecha: p.fechaPago || p.fecha,
            empresa: p.empresa || 'Sin Empresa',
            servicio: p.concepto,
            monto: parseFloat(p.monto) || 0,
            tipo: 'Manual'
          });
        }
      });

      pagos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      if (pagos.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay pagos registrados en el historial.</p>';
        return;
      }

      container.innerHTML = pagos.map(p => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02);">
          <div>
            <div style="font-weight: bold; color: #fff;">${p.empresa} <span style="font-size:0.7rem; color:#aaa; font-weight:normal;">[${p.tipo}]</span></div>
            <div style="font-size: 0.85rem; color: #aaa;">${new Date(p.fecha).toLocaleDateString('es-AR')} • ${p.servicio}</div>
          </div>
          <div style="font-weight: bold; color: #4CAF50;">$${p.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
        </div>
      `).join('');

    } catch (e) {
      console.error('[TERCEROS] Error cargando historial:', e);
    }
  },

  async deleteManualPayment(id, empresa) {
    if (!confirm('¿Seguro que querés eliminar este registro? \n\nSe borrará de las deudas sin contar como un pago (ideal para corregir errores).')) return;

    try {
      const manuales = await window.mrDataManager.getTercerosPagosManuales() || [];
      const nuevos = manuales.filter(p => p.id !== id);
      
      if (manuales.length !== nuevos.length) {
        await window.mrDataManager.saveTercerosPagosManuales(nuevos);
        alert('✅ Registro eliminado correctamente.');
        this.loadPagosPendientes();
      } else {
        alert('Este registro parece venir de un presupuesto. Para borrarlo, tendrías que modificar el presupuesto o la planilla.');
      }
    } catch (error) {
      console.error(error);
      alert('Error al borrar.');
    }
  },

  async markAsPaid(empresaName) {
    const checkboxes = document.querySelectorAll(`.pago-checkbox-${empresaName.replace(/'/g, "\\'")}`);
    const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.getAttribute('data-id'));

    if (selectedIds.length === 0) return alert('Seleccioná al menos un ítem para pagar.');

    if (!confirm(`¿Confirmas que has pagado los ${selectedIds.length} ítems seleccionados a "${empresaName}"?`)) return;

    try {
      const gremioQuotes = await window.mrDataManager.getGremioCotizaciones();
      const clientQuotes = await window.mrDataManager.getClientesCotizaciones();
      const manuales = await window.mrDataManager.getTercerosPagosManuales() || [];

      let gremioModified = false;
      let clientModified = false;
      let manualModified = false;
      let totalPagado = 0;
      const detallesJobs = [];

      // Marcamos cotizaciones
      [gremioQuotes, clientQuotes].forEach((list, idx) => {
        list.forEach(quote => {
          if (quote.terceros && Array.isArray(quote.terceros)) {
            quote.terceros.forEach(item => {
              const itemId = `${quote.id || quote.date}_${item.nombre}`;
              if (selectedIds.includes(itemId) && (item.empresa || 'Sin Empresa Asignada') === empresaName && !item.pagado) {
                item.pagado = true;
                item.fechaPago = new Date().toISOString();
                if (idx === 0) gremioModified = true; else clientModified = true;
                const monto = parseFloat(item.totalCosto) || 0;
                totalPagado += monto;
                detallesJobs.push(`${quote.cliente?.nombre || 'Cliente'} (${item.nombre})`);
              }
            });
          }
        });
      });

      // Marcamos manuales
      manuales.forEach(p => {
        if (selectedIds.includes(p.id) && (p.empresa || 'Sin Empresa Asignada') === empresaName && !p.pagado) {
          p.pagado = true;
          p.fechaPago = new Date().toISOString();
          manualModified = true;
          totalPagado += parseFloat(p.monto) || 0;
          detallesJobs.push(`Manual: ${p.concepto}`);
        }
      });

      if (gremioModified) await window.mrDataManager.saveGremioCotizaciones(gremioQuotes);
      if (clientModified) await window.mrDataManager.saveClientesCotizaciones(clientQuotes);
      if (manualModified) await window.mrDataManager.saveTercerosPagosManuales(manuales);

      if (totalPagado > 0) {
        try {
          const currentGastos = await window.mrDataManager.getGastos();
          const descripcion = `Pago Tercero: ${empresaName} - DETALLE: ${detallesJobs.join(', ')}`;
          currentGastos.push({
            id: 'gasto_tercero_' + Date.now(),
            tipo: 'egreso',
            categoria: 'costo_venta_terceros',
            descripcion: descripcion.substring(0, 500),
            monto: totalPagado,
            fecha: new Date().toISOString().split('T')[0],
            usuario: (window.AUTH && window.AUTH.user) ? window.AUTH.user.usuario : 'admin'
          });
          await window.mrDataManager.saveGastos(currentGastos);
        } catch (err) { console.error(err); }
      }

      alert('✅ Pagos registrados correctamente.');
      this.loadPagosPendientes();
      this.loadHistorialPagos();
    } catch (error) {
      console.error(error);
      alert('❌ Error al registrar el pago.');
    }
  },

  updateCategorySelect() {
    const selects = [document.getElementById('servicioCategoria'), document.getElementById('manualEmpresa')];
    
    // Categorías de servicio
    if (selects[0]) {
      selects[0].innerHTML = '<option value="">Seleccionar...</option>';
      this.categorias.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat; opt.textContent = cat;
        selects[0].appendChild(opt);
      });
    }

    // Empresas para gasto manual
    if (selects[1]) {
      selects[1].innerHTML = '<option value="">Seleccionar empresa...</option>';
      this.empresas.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.nombre; opt.textContent = emp.nombre;
        selects[1].appendChild(opt);
      });
    }
  },

  setupEventListeners() {
    // Los eventos de Empresa y Servicio ya están. Agrego los de Manual Pago si no están.
    const btnOpenEmpresa = document.getElementById('btnAddTercero');
    if (btnOpenEmpresa) btnOpenEmpresa.onclick = () => this.openEmpresaModal();
    
    document.getElementById('btnSaveEmpresa').onclick = () => this.saveEmpresa();
    document.getElementById('btnCloseEmpresa').onclick = () => this.closeEmpresaModal();
    document.getElementById('btnCancelEmpresa').onclick = () => this.closeEmpresaModal();
    
    document.getElementById('btnSaveServicio').onclick = () => this.saveServicio();
    document.getElementById('btnCloseServicio').onclick = () => this.closeServicioModal();
    document.getElementById('btnCancelServicio').onclick = () => this.closeServicioModal();

    document.getElementById('servicioCosto').oninput = () => this.updateMarginDisplay();
    document.getElementById('servicioPrecio').oninput = () => this.updateMarginDisplay();
    document.getElementById('servicioUnidad').onchange = () => this.toggleMaterialInputs();
  },

  openEmpresaModal(idx = null) {
    this.currentEditingEmpresa = idx;
    const modal = document.getElementById('empresaModal');
    document.getElementById('empresaNombre').value = idx !== null ? this.empresas[idx].nombre : '';
    document.getElementById('empresaContacto').value = idx !== null ? this.empresas[idx].contacto : '';
    modal.classList.add('active');
  },

  closeEmpresaModal() { document.getElementById('empresaModal').classList.remove('active'); },

  async saveEmpresa() {
    const nombre = document.getElementById('empresaNombre').value.trim();
    if (!nombre) return alert('Nombre requerido');
    const empresa = { 
      id: this.currentEditingEmpresa !== null ? this.empresas[this.currentEditingEmpresa].id : Date.now(),
      nombre, contacto: document.getElementById('empresaContacto').value.trim(),
      servicios: this.currentEditingEmpresa !== null ? this.empresas[this.currentEditingEmpresa].servicios : [],
      fecha: new Date().toISOString()
    };
    if (this.currentEditingEmpresa !== null) this.empresas[this.currentEditingEmpresa] = empresa;
    else this.empresas.push(empresa);
    await this.saveEmpresas();
    this.render();
    this.closeEmpresaModal();
  },

  openServicioModal(eIdx, sIdx = null) {
    this.currentEditingEmpresa = eIdx;
    this.currentEditingServicio = sIdx;
    const modal = document.getElementById('servicioModal');
    const emp = this.empresas[eIdx];
    document.getElementById('empresaSubtitle').innerHTML = `Empresa: <strong>${emp.nombre}</strong>`;
    
    const s = (sIdx !== null) ? emp.servicios[sIdx] : {};
    document.getElementById('servicioNombre').value = s.nombre || '';
    document.getElementById('servicioUnidad').value = s.unidad || 'm²';
    document.getElementById('servicioCosto').value = s.costo || '';
    document.getElementById('servicioPrecio').value = s.precio || '';
    
    this.updateCategorySelect();
    document.getElementById('servicioCategoria').value = s.categoria || '';
    modal.classList.add('active');
    this.updateMarginDisplay();
    this.toggleMaterialInputs();
  },

  closeServicioModal() { document.getElementById('servicioModal').classList.remove('active'); },

  async saveServicio() {
    const nombre = document.getElementById('servicioNombre').value.trim();
    const costo = parseFloat(document.getElementById('servicioCosto').value) || 0;
    const precio = parseFloat(document.getElementById('servicioPrecio').value) || 0;
    if (!nombre || costo <= 0 || precio <= 0) return alert('Completa los campos');

    const s = { 
      id: (this.currentEditingServicio !== null) ? this.empresas[this.currentEditingEmpresa].servicios[this.currentEditingServicio].id : Date.now(),
      nombre, costo, precio, margen: precio - costo,
      categoria: document.getElementById('servicioCategoria').value,
      unidad: document.getElementById('servicioUnidad').value,
      fecha: new Date().toISOString()
    };
    if (!this.empresas[this.currentEditingEmpresa].servicios) this.empresas[this.currentEditingEmpresa].servicios = [];
    if (this.currentEditingServicio !== null) this.empresas[this.currentEditingEmpresa].servicios[this.currentEditingServicio] = s;
    else this.empresas[this.currentEditingEmpresa].servicios.push(s);
    await this.saveEmpresas();
    this.render();
    this.closeServicioModal();
  },

  // --- MANUAL PAYMENTS LOGIC ---
  openManualPagoModal() {
    const modal = document.getElementById('modalManualPago');
    this.updateCategorySelect();
    document.getElementById('manualConcepto').value = '';
    document.getElementById('manualMonto').value = '';
    document.getElementById('manualFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('manualObs').value = '';
    modal.classList.add('active');
  },

  closeManualPagoModal() { document.getElementById('modalManualPago').classList.remove('active'); },

  async saveManualPago() {
    const empresa = document.getElementById('manualEmpresa').value;
    const concepto = document.getElementById('manualConcepto').value.trim();
    const monto = parseFloat(document.getElementById('manualMonto').value) || 0;
    const fecha = document.getElementById('manualFecha').value;

    if (!empresa || !concepto || monto <= 0) return alert('Completa los campos obligatorios (*)');

    const nuevo = {
      id: 'manual_' + Date.now(),
      empresa, concepto, monto, fecha,
      observaciones: document.getElementById('manualObs').value,
      pagado: false,
      fechaCarga: new Date().toISOString()
    };

    const actuales = await window.mrDataManager.getTercerosPagosManuales() || [];
    actuales.push(nuevo);
    const ok = await window.mrDataManager.saveTercerosPagosManuales(actuales);
    
    if (ok) {
      alert('✅ Gasto manual guardado.');
      this.closeManualPagoModal();
      this.loadPagosPendientes();
    } else {
      alert('❌ Error al guardar.');
    }
  },

  async deleteServicio(eIdx, sIdx) {
    if (!confirm('¿Eliminar servicio?')) return;
    this.empresas[eIdx].servicios.splice(sIdx, 1);
    await this.saveEmpresas(); this.render();
  },

  async deleteEmpresa(idx) {
    if (!confirm('¿Eliminar empresa?')) return;
    this.empresas.splice(idx, 1);
    await this.saveEmpresas(); this.render();
  },

  async saveEmpresas() { await window.mrDataManager.saveTerceros(this.empresas); },

  toggleMaterialInputs() {
    const group = document.getElementById('materialBaseGroup');
    if (group) group.style.display = (document.getElementById('servicioUnidad').value === 'unidad') ? 'block' : 'none';
  },

  updateMarginDisplay() {
    const c = parseFloat(document.getElementById('servicioCosto').value) || 0;
    const p = parseFloat(document.getElementById('servicioPrecio').value) || 0;
    const m = p - c;
    const d = document.getElementById('servicioMargen');
    if (d) d.textContent = (c > 0 || p > 0) ? `$${m.toFixed(2)} (${(c > 0 ? (m / c * 100) : 0).toFixed(1)}%)` : '--%';
  },

  render() {
    this.updatePresupuestoSelects();
    const container = document.getElementById('tercerosList');
    if (!container) return;
    if (this.empresas.length === 0) {
      container.innerHTML = '<p class="empty-state">No hay empresas registradas.</p>';
      return;
    }
    container.innerHTML = this.empresas.map((emp, eIdx) => `
      <div class="empresa-card">
        <div class="empresa-header">
          <div class="empresa-info">
            <h3>${emp.nombre}</h3>
            ${emp.contacto ? `<p class="empresa-contacto">${emp.contacto}</p>` : ''}
          </div>
          <div class="empresa-actions">
            <button class="btn btn-secondary btn-small" onclick="tercerosManager.openEmpresaModal(${eIdx})">✏️</button>
            <button class="btn btn-danger btn-small" onclick="tercerosManager.deleteEmpresa(${eIdx})">🗑️</button>
          </div>
        </div>
        <div class="servicios-list" style="display:grid; gap:0.5rem; margin:1rem 0;">
          ${(emp.servicios || []).map((s, sIdx) => `
            <div style="background:rgba(255,255,255,0.05); padding:0.8rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:bold;">${s.nombre}</div>
                <div style="font-size:0.8rem; color:#aaa;">${s.categoria} • ${s.unidad} • Costo: $${s.costo}</div>
              </div>
              <div style="display:flex; gap:0.3rem;">
                <button class="btn btn-secondary btn-small" onclick="tercerosManager.openServicioModal(${eIdx}, ${sIdx})">✏️</button>
                <button class="btn btn-danger btn-small" onclick="tercerosManager.deleteServicio(${eIdx}, ${sIdx})">🗑️</button>
              </div>
            </div>
          `).join('') || '<p style="font-size:0.8rem; color:#555;">Sin servicios</p>'}
        </div>
        <button class="btn btn-outline-primary btn-small w-100" onclick="tercerosManager.openServicioModal(${eIdx})">➕ Agregar Servicio</button>
      </div>
    `).join('');
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CALCULADORA DE PRESUPUESTOS (TERCEROS)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  updatePresupuestoSelects() {
    const selTercero = document.getElementById('presupuestoTercero');
    if (!selTercero) return;
    selTercero.innerHTML = '<option value="">Seleccionar empresa...</option>';
    this.empresas.forEach((emp, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = emp.nombre;
      selTercero.appendChild(opt);
    });
    this.onPresupuestoTerceroChange(); // Resetear el select de servicios
  },

  onPresupuestoTerceroChange() {
    const selTercero = document.getElementById('presupuestoTercero');
    const selServicio = document.getElementById('presupuestoServicio');
    if (!selTercero || !selServicio) return;

    const empIdx = selTercero.value;
    selServicio.innerHTML = '<option value="">Seleccionar servicio...</option>';
    
    if (empIdx === '') {
      selServicio.disabled = true;
      return;
    }

    const empresa = this.empresas[empIdx];
    if (empresa && empresa.servicios) {
      empresa.servicios.forEach((serv, sIdx) => {
        const opt = document.createElement('option');
        opt.value = sIdx;
        opt.textContent = `${serv.nombre} (${serv.unidad}) - Mío:$${serv.costo} / Cli:$${serv.precio}`;
        selServicio.appendChild(opt);
      });
    }
    selServicio.disabled = false;
  },

  agregarItemPresupuesto() {
    const empIdx = document.getElementById('presupuestoTercero').value;
    const servIdx = document.getElementById('presupuestoServicio').value;
    const cant = parseFloat(document.getElementById('presupuestoCant').value) || 0;

    if (empIdx === '' || servIdx === '' || cant <= 0) {
      return alert('Selecciona empresa, servicio y una cantidad válida.');
    }

    const empresa = this.empresas[empIdx];
    const serv = empresa.servicios[servIdx];

    const totalCosto = serv.costo * cant;
    const totalPrecio = serv.precio * cant;

    this.presupuestoItems.push({
      empresaNombre: empresa.nombre,
      servicioNombre: serv.nombre,
      unidad: serv.unidad,
      cantidad: cant,
      costoUnitario: serv.costo,
      precioUnitario: serv.precio,
      totalCosto: totalCosto,
      totalPrecio: totalPrecio
    });

    // Resetear formulario
    document.getElementById('presupuestoCant').value = 1;
    document.getElementById('presupuestoServicio').value = '';
    
    this.renderPresupuesto();
  },

  eliminarItemPresupuesto(idx) {
    this.presupuestoItems.splice(idx, 1);
    this.renderPresupuesto();
  },

  limpiarPresupuesto() {
    if (this.presupuestoItems.length === 0) return;
    if (confirm('¿Seguro que querés limpiar el presupuesto actual?')) {
      this.presupuestoItems = [];
      document.getElementById('presupuestoTercero').value = '';
      this.onPresupuestoTerceroChange();
      this.renderPresupuesto();
    }
  },

  renderPresupuesto() {
    const container = document.getElementById('presupuestoItems');
    let sumCosto = 0;
    let sumPrecio = 0;

    if (this.presupuestoItems.length === 0) {
      container.innerHTML = '<div style="padding: 1rem; text-align: center; color: #aaa;">No hay ítems agregados al presupuesto.</div>';
    } else {
      let html = '';
      
      this.presupuestoItems.forEach((item, idx) => {
        sumCosto += item.totalCosto;
        sumPrecio += item.totalPrecio;

        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02);">
            <div>
              <div style="font-weight: bold; color: #fff;">${item.empresaNombre}: ${item.servicioNombre}</div>
              <div style="font-size: 0.85rem; color: #aaa;">${item.cantidad} ${item.unidad} • Mi Costo: $${item.totalCosto.toLocaleString('es-AR')} • Sugerido: $${item.totalPrecio.toLocaleString('es-AR')}</div>
            </div>
            <button class="btn btn-danger btn-small" onclick="tercerosManager.eliminarItemPresupuesto(${idx})">🗑️</button>
          </div>
        `;
      });
      container.innerHTML = html;
    }

    // Actualizar totales
    let gananciaNeta = sumPrecio - sumCosto;
    
    document.getElementById('presupuestoCosto').textContent = '$' + sumCosto.toLocaleString('es-AR', {minimumFractionDigits: 2});
    document.getElementById('presupuestoPrecio').textContent = '$' + sumPrecio.toLocaleString('es-AR', {minimumFractionDigits: 2});
    document.getElementById('presupuestoGanancia').textContent = '$' + gananciaNeta.toLocaleString('es-AR', {minimumFractionDigits: 2});
  },

  generateParticles() {
    const c = document.getElementById('particles');
    if (!c) return;
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.cssText = `left:${Math.random() * 100}%; top:${Math.random() * 100}%; animation-duration:${Math.random() * 10 + 10}s; animation-delay:${Math.random() * 5}s;`;
      c.appendChild(p);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => tercerosManager.init());
