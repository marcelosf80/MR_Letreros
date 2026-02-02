// ==================== TERCEROS MANAGEMENT SYSTEM ====================
// Estructura: Empresas → Cada empresa tiene múltiples servicios

const tercerosManager = {
  empresas: [],
  categorias: [],
  currentEditingEmpresa: null,
  currentEditingServicio: null,

  async init() {
    console.log('[TERCEROS-INIT] Iniciando...');
    await this.loadEmpresas();
    await this.loadCategorias();
    await this.loadPagosPendientes();
    await this.loadHistorialPagos();
    this.setupEventListeners();
    this.render();
    this.generateParticles();
  },

  async loadEmpresas() {
    try {
      const response = await fetch('/api/terceros');
      if (response.ok) {
        const data = await response.json();
        this.empresas = Array.isArray(data) ? data : [];
        console.log('[TERCEROS-LOAD] Empresas cargadas:', this.empresas.length);
      }
    } catch (error) {
      console.error('[TERCEROS-LOAD-ERROR]', error);
      this.empresas = [];
    }
  },

  async loadCategorias() {
    try {
      const response = await fetch('/api/categorias');
      if (response.ok) {
        const data = await response.json();
        this.categorias = Array.isArray(data) ? data : [];
        console.log('[TERCEROS-CATEGORIAS-LOAD] Categorías cargadas:', this.categorias.length);
      }
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

      // Intentar usar mrDataManager si está disponible
      if (window.mrDataManager) {
          gremioQuotes = await window.mrDataManager.getGremioCotizaciones();
          clientQuotes = await window.mrDataManager.getClientesCotizaciones();
      } else {
          // Fallback a fetch directo
          try {
            const resG = await fetch('/api/gremio/data');
            if (resG.ok) gremioQuotes = await resG.json();
            const resC = await fetch('/api/clientes/data');
            if (resC.ok) clientQuotes = await resC.json();
          } catch(err) { console.error(err); }
      }
      
      const allQuotes = [...(Array.isArray(gremioQuotes) ? gremioQuotes : []), ...(Array.isArray(clientQuotes) ? clientQuotes : [])];
      
      // Filtrar solo las APROBADAS
      const approved = allQuotes.filter(q => q.estado === 'aprobada' || q.approved === true);
      
      const pagosPorEmpresa = {};
      let totalDeuda = 0;
      
      approved.forEach(quote => {
        if (quote.terceros && Array.isArray(quote.terceros)) {
          quote.terceros.forEach(item => {
            if (item.pagado) return; // Ignorar ítems ya pagados
            const empresa = item.empresa || 'Sin Empresa Asignada';
            const monto = parseFloat(item.totalCosto) || 0;
            
            if (!pagosPorEmpresa[empresa]) pagosPorEmpresa[empresa] = 0;
            pagosPorEmpresa[empresa] += monto;
            totalDeuda += monto;
          });
        }
      });
      
      if (Object.keys(pagosPorEmpresa).length === 0) {
        container.innerHTML = '<p class="empty-state">✅ Al día: No hay deudas pendientes con terceros.</p>';
        return;
      }
      
      let html = `
        <div class="stat-card" style="background: rgba(255, 193, 7, 0.1); border: 1px solid #FFC107; padding: 1rem; border-radius: 8px; display: flex; flex-direction: column; justify-content: center;">
          <div class="stat-label" style="color: #aaa; font-size: 0.9rem; text-transform: uppercase;">Total a Pagar</div>
          <div class="stat-value" style="color: #FFC107; font-size: 1.8rem; font-weight: bold;">$${totalDeuda.toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
        </div>
      `;

      Object.entries(pagosPorEmpresa).forEach(([empresa, monto]) => {
        const safeEmpresa = empresa.replace(/'/g, "\\'"); // Escapar comillas para el onclick
        html += `
          <div class="stat-card" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 8px;">
            <div class="stat-label" style="color: #fff; font-weight: bold; font-size: 1.1rem; margin-bottom: 0.5rem;">${empresa}</div>
            <div class="stat-value" style="color: #FF5252; font-size: 1.4rem; font-weight: bold;">$${monto.toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
            <div style="font-size: 0.8rem; color: #aaa; margin-top: 0.5rem;">Acumulado Aprobado</div>
            <button class="btn btn-success btn-small" style="margin-top: 1rem; width: 100%;" onclick="tercerosManager.markAsPaid('${safeEmpresa}')">✅ Marcar como Pagado</button>
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

      if (window.mrDataManager) {
          gremioQuotes = await window.mrDataManager.getGremioCotizaciones();
          clientQuotes = await window.mrDataManager.getClientesCotizaciones();
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
                 monto: parseFloat(item.totalCosto) || 0
               });
            }
          });
        }
      });

      // Ordenar por fecha (más reciente primero)
      pagos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      if (pagos.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay pagos registrados en el historial.</p>';
        return;
      }

      container.innerHTML = pagos.map(p => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02);">
          <div>
            <div style="font-weight: bold; color: #fff;">${p.empresa}</div>
            <div style="font-size: 0.85rem; color: #aaa;">${new Date(p.fecha).toLocaleDateString('es-AR')} • ${p.servicio}</div>
          </div>
          <div style="font-weight: bold; color: #4CAF50;">$${p.monto.toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
        </div>
      `).join('');

    } catch (e) {
      console.error('[TERCEROS] Error cargando historial:', e);
    }
  },

  async markAsPaid(empresaName) {
    if (!confirm(`¿Confirmas que has pagado todo lo pendiente a "${empresaName}"?\n\nEsta acción marcará los servicios como pagados y desaparecerán de la lista de deudas.`)) return;

    try {
      // 1. Cargar todas las cotizaciones
      const gremioQuotes = await window.mrDataManager.getGremioCotizaciones();
      const clientQuotes = await window.mrDataManager.getClientesCotizaciones();
      
      let gremioModified = false;
      let clientModified = false;

      // 2. Actualizar cotizaciones de Gremio
      gremioQuotes.forEach(quote => {
        if (quote.terceros && Array.isArray(quote.terceros)) {
          quote.terceros.forEach(item => {
            const itemEmpresa = item.empresa || 'Sin Empresa Asignada';
            // Solo marcar si coincide la empresa, no está pagado y la cotización está aprobada
            if (itemEmpresa === empresaName && !item.pagado && (quote.estado === 'aprobada' || quote.approved === true)) {
              item.pagado = true;
              item.fechaPago = new Date().toISOString();
              gremioModified = true;
            }
          });
        }
      });

      // 3. Actualizar cotizaciones de Clientes
      clientQuotes.forEach(quote => {
        if (quote.terceros && Array.isArray(quote.terceros)) {
          quote.terceros.forEach(item => {
            const itemEmpresa = item.empresa || 'Sin Empresa Asignada';
            if (itemEmpresa === empresaName && !item.pagado && (quote.estado === 'aprobada' || quote.approved === true)) {
              item.pagado = true;
              item.fechaPago = new Date().toISOString();
              clientModified = true;
            }
          });
        }
      });

      // 4. Guardar cambios
      if (gremioModified) await window.mrDataManager.saveGremioCotizaciones(gremioQuotes);
      if (clientModified) await window.mrDataManager.saveClientesCotizaciones(clientQuotes);

      alert('✅ Pagos registrados correctamente.');
      this.loadPagosPendientes(); // Recargar la lista
      this.loadHistorialPagos(); // Recargar historial

    } catch (error) {
      console.error('[TERCEROS] Error al marcar como pagado:', error);
      alert('❌ Error al registrar el pago.');
    }
  },

  updateCategorySelect() {
    const select = document.getElementById('servicioCategoria');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccionar...</option>';
    this.categorias.forEach(categoria => {
      const option = document.createElement('option');
      option.value = categoria;
      option.textContent = categoria;
      select.appendChild(option);
    });
    console.log('[TERCEROS-SELECT-UPDATED] Selector actualizado con', this.categorias.length, 'categorías');
  },

  setupEventListeners() {
    // Empresa Modal
    const empresaModal = document.getElementById('empresaModal');
    const btnOpenEmpresa = document.getElementById('btnAddTercero');
    const btnCloseEmpresa = document.getElementById('btnCloseEmpresa');
    const btnSaveEmpresa = document.getElementById('btnSaveEmpresa');
    const btnCancelEmpresa = document.getElementById('btnCancelEmpresa');

    if (btnOpenEmpresa) btnOpenEmpresa.addEventListener('click', () => this.openEmpresaModal());
    if (btnCloseEmpresa) btnCloseEmpresa.addEventListener('click', () => this.closeEmpresaModal());
    if (btnSaveEmpresa) btnSaveEmpresa.addEventListener('click', () => this.saveEmpresa());
    if (btnCancelEmpresa) btnCancelEmpresa.addEventListener('click', () => this.closeEmpresaModal());
    if (empresaModal) empresaModal.addEventListener('click', (e) => {
      if (e.target === empresaModal) this.closeEmpresaModal();
    });

    // Servicio Modal
    const servicioModal = document.getElementById('servicioModal');
    const btnCloseServicio = document.getElementById('btnCloseServicio');
    const btnSaveServicio = document.getElementById('btnSaveServicio');
    const btnCancelServicio = document.getElementById('btnCancelServicio');
    const costInput = document.getElementById('servicioCosto');
    const precioInput = document.getElementById('servicioPrecio');
    const unidadSelect = document.getElementById('servicioUnidad');

    if (btnCloseServicio) btnCloseServicio.addEventListener('click', () => this.closeServicioModal());
    if (btnSaveServicio) btnSaveServicio.addEventListener('click', () => this.saveServicio());
    if (btnCancelServicio) btnCancelServicio.addEventListener('click', () => this.closeServicioModal());
    if (costInput) costInput.addEventListener('input', () => this.updateMarginDisplay());
    if (precioInput) precioInput.addEventListener('input', () => this.updateMarginDisplay());
    if (servicioModal) servicioModal.addEventListener('click', (e) => {
      if (e.target === servicioModal) this.closeServicioModal();
    });
    if (unidadSelect) unidadSelect.addEventListener('change', () => this.toggleMaterialInputs());
  },

  openEmpresaModal(empresaIndex = null) {
    console.log('[TERCEROS-EMPRESA-MODAL] Abriendo empresa:', empresaIndex);
    this.currentEditingEmpresa = empresaIndex;
    const modal = document.getElementById('empresaModal');
    const title = modal.querySelector('.modal-title');

    document.getElementById('empresaNombre').value = '';
    document.getElementById('empresaContacto').value = '';

    if (empresaIndex !== null && this.empresas[empresaIndex]) {
      title.textContent = '🏢 Editar Empresa';
      const empresa = this.empresas[empresaIndex];
      document.getElementById('empresaNombre').value = empresa.nombre || '';
      document.getElementById('empresaContacto').value = empresa.contacto || '';
    } else {
      title.textContent = '🏢 Agregar Empresa';
    }

    modal.classList.add('active');
  },

  closeEmpresaModal() {
    const modal = document.getElementById('empresaModal');
    if (modal) modal.classList.remove('active');
    if (modal) {
      if (window.MRModals) window.MRModals.close(modal);
      else {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }
    this.currentEditingEmpresa = null;
  },

  async saveEmpresa() {
    const nombre = document.getElementById('empresaNombre').value.trim();
    const contacto = document.getElementById('empresaContacto').value.trim();

    if (!nombre) {
      alert('Por favor ingresa el nombre de la empresa');
      return;
    }

    const empresa = {
      id: this.currentEditingEmpresa !== null ? this.empresas[this.currentEditingEmpresa].id : Date.now(),
      nombre,
      contacto,
      servicios: this.currentEditingEmpresa !== null ? this.empresas[this.currentEditingEmpresa].servicios : [],
      fecha: new Date().toISOString()
    };

    if (this.currentEditingEmpresa !== null) {
      this.empresas[this.currentEditingEmpresa] = empresa;
    } else {
      this.empresas.push(empresa);
    }

    await this.saveEmpresas();
    this.render();
    this.closeEmpresaModal();
  },

  openServicioModal(empresaIndex, servicioIndex = null) {
    console.log('[TERCEROS-SERVICIO-MODAL] Abriendo servicio:', empresaIndex, servicioIndex);
    if (empresaIndex < 0 || empresaIndex >= this.empresas.length) return;

    this.currentEditingEmpresa = empresaIndex;
    this.currentEditingServicio = servicioIndex;

    const modal = document.getElementById('servicioModal');
    const title = modal.querySelector('.modal-title');
    const subtitle = document.getElementById('empresaSubtitle');
    const empresa = this.empresas[empresaIndex];

    subtitle.innerHTML = `Empresa: <strong>${empresa.nombre}</strong>`;

    document.getElementById('servicioNombre').value = '';
    document.getElementById('servicioCategoria').value = '';
    document.getElementById('servicioUnidad').value = 'm²';
    document.getElementById('servicioCosto').value = '';
    document.getElementById('servicioPrecio').value = '';
    document.getElementById('servicioCostoMaterial').value = '';
    document.getElementById('servicioPrecioMaterial').value = '';

    this.updateCategorySelect();

    if (servicioIndex !== null && empresa.servicios && empresa.servicios[servicioIndex]) {
      title.textContent = '🔧 Editar Servicio';
      const servicio = empresa.servicios[servicioIndex];
      document.getElementById('servicioNombre').value = servicio.nombre || '';
      document.getElementById('servicioCategoria').value = servicio.categoria || '';
      document.getElementById('servicioUnidad').value = servicio.unidad || 'm²';
      document.getElementById('servicioCosto').value = servicio.costo || '';
      document.getElementById('servicioPrecio').value = servicio.precio || '';
      document.getElementById('servicioCostoMaterial').value = servicio.costoMaterial || '';
      document.getElementById('servicioPrecioMaterial').value = servicio.precioMaterial || '';
    } else {
      title.textContent = '🔧 Agregar Servicio';
    }

    this.toggleMaterialInputs();
    this.updateMarginDisplay();
    modal.classList.add('active');
  },

  toggleMaterialInputs() {
    const unidad = document.getElementById('servicioUnidad').value;
    const group = document.getElementById('materialBaseGroup');
    if (group) {
      group.style.display = (unidad === 'unidad') ? 'block' : 'none';
    }
  },

  closeServicioModal() {
    const modal = document.getElementById('servicioModal');
    if (modal) modal.classList.remove('active');
    if (modal) {
      if (window.MRModals) window.MRModals.close(modal);
      else {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }
    this.currentEditingServicio = null;
  },

  updateMarginDisplay() {
    const costo = parseFloat(document.getElementById('servicioCosto').value) || 0;
    const precio = parseFloat(document.getElementById('servicioPrecio').value) || 0;
    const margen = precio - costo;

    const display = document.getElementById('servicioMargen');
    if (display) {
      if (costo === 0 && precio === 0) {
        display.textContent = '--%';
      } else {
        const porcentaje = costo > 0 ? ((margen / costo) * 100).toFixed(1) : 0;
        display.textContent = `$${margen.toFixed(2)} (${porcentaje}%)`;
      }
    }
  },

  async saveServicio() {
    const nombre = document.getElementById('servicioNombre').value.trim();
    const categoria = document.getElementById('servicioCategoria').value;
    const unidad = document.getElementById('servicioUnidad').value;
    const costo = parseFloat(document.getElementById('servicioCosto').value) || 0;
    const precio = parseFloat(document.getElementById('servicioPrecio').value) || 0;
    const costoMaterial = parseFloat(document.getElementById('servicioCostoMaterial').value) || 0;
    const precioMaterial = parseFloat(document.getElementById('servicioPrecioMaterial').value) || 0;

    if (!nombre) {
      alert('Por favor ingresa el nombre del servicio');
      return;
    }

    if (costo <= 0 || precio <= 0) {
      alert('Los precios deben ser mayores a 0');
      return;
    }

    const servicio = {
      id: this.currentEditingServicio !== null && this.empresas[this.currentEditingEmpresa].servicios[this.currentEditingServicio]
        ? this.empresas[this.currentEditingEmpresa].servicios[this.currentEditingServicio].id
        : Date.now(),
      nombre,
      categoria,
      unidad,
      costo,
      precio,
      costoMaterial,
      precioMaterial,
      margen: precio - costo,
      fecha: new Date().toISOString()
    };

    const empresa = this.empresas[this.currentEditingEmpresa];
    if (!empresa.servicios) empresa.servicios = [];

    if (this.currentEditingServicio !== null) {
      empresa.servicios[this.currentEditingServicio] = servicio;
    } else {
      empresa.servicios.push(servicio);
    }

    await this.saveEmpresas();
    this.render();
    this.closeServicioModal();
  },

  async deleteServicio(empresaIndex, servicioIndex) {
    if (!confirm('¿Estás seguro de que quieres eliminar este servicio?')) return;

    const empresa = this.empresas[empresaIndex];
    if (empresa.servicios) {
      empresa.servicios.splice(servicioIndex, 1);
      await this.saveEmpresas();
      this.render();
    }
  },

  async deleteEmpresa(empresaIndex) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta empresa y todos sus servicios?')) return;

    this.empresas.splice(empresaIndex, 1);
    await this.saveEmpresas();
    this.render();
  },

  async saveEmpresas() {
    try {
      const response = await fetch('/api/terceros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.empresas)
      });
      const result = await response.json();
      console.log('[TERCEROS-SAVE] Guardado:', result);
    } catch (error) {
      console.error('[TERCEROS-SAVE-ERROR]', error);
      alert('Error al guardar las empresas');
    }
  },

  render() {
    const container = document.getElementById('tercerosList');
    if (!container) return;

    if (this.empresas.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: rgba(255,255,255,0.5);">
          <p>No hay empresas registradas. ¡Agrega una para empezar!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.empresas.map((empresa, empresaIndex) => `
      <div class="empresa-card">
        <div class="empresa-header">
          <div class="empresa-info">
            <h3>${empresa.nombre}</h3>
            ${empresa.contacto ? `<p class="empresa-contacto">${empresa.contacto}</p>` : ''}
          </div>
          <div class="empresa-actions">
            <button class="btn-edit" onclick="tercerosManager.openEmpresaModal(${empresaIndex})">Editar</button>
            <button class="btn-delete" onclick="tercerosManager.deleteEmpresa(${empresaIndex})">Eliminar</button>
          </div>
        </div>

        <div class="servicios-list">
          ${empresa.servicios && empresa.servicios.length > 0
            ? empresa.servicios.map((servicio, servicioIndex) => `
              <div class="servicio-bubble">
                <div class="bubble-content">
                  <div class="servicio-header-bubble">
                    <h4>${servicio.nombre}</h4>
                  </div>
                  <div class="servicio-details-bubble">
                    <p class="detail-line">
                      <span class="detail-icon">📌</span>
                      <span class="detail-text">${servicio.categoria || 'Sin categoría'} • ${servicio.unidad}</span>
                    </p>
                    <p class="detail-line prices-line">
                      <span class="detail-icon">💰</span>
                      <span class="detail-text">$${servicio.costo.toFixed(2)} • $${servicio.precio.toFixed(2)} (margen: $${servicio.margen.toFixed(2)})</span>
                    </p>
                  </div>
                </div>
                <div class="servicio-bubble-actions">
                  <button class="btn-edit" onclick="tercerosManager.openServicioModal(${empresaIndex}, ${servicioIndex})">✏️ Editar</button>
                  <button class="btn-delete" onclick="tercerosManager.deleteServicio(${empresaIndex}, ${servicioIndex})">🗑️ Borrar</button>
                </div>
              </div>
            `).join('')
            : '<p style="color: rgba(255,255,255,0.4); padding: 1rem; text-align: center;">Sin servicios</p>'
          }
        </div>

        <div class="empresa-footer">
          <button class="btn btn-secondary" onclick="tercerosManager.openServicioModal(${empresaIndex})">
            Agregar Servicio
          </button>
        </div>
      </div>
    `).join('');
  },

  generateParticles() {
    const container = document.getElementById('particles');
    if (!container) return;

    const particleCount = 50;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.animationDuration = (Math.random() * 20 + 15) + 's';
      particle.style.animationDelay = Math.random() * 2 + 's';
      container.appendChild(particle);
    }
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  tercerosManager.init();
});
