// ==================== TERCEROS INTEGRATION FOR GREMIO ====================
// Maneja los servicios de terceros dentro de las cotizaciones

const tercerosTerceroService = {
  empresas: [],
  serviciosAgregados: [],

  async init() {
    console.log('[TERCEROS-GREMIO-INIT] Inicializando...');
    await this.loadEmpresas();
    this.setupEventListeners();
  },

  async loadEmpresas() {
    try {
      const response = await fetch('/api/terceros');
      if (response.ok) {
        const data = await response.json();
        this.empresas = Array.isArray(data) ? data : [];
        console.log('[TERCEROS-GREMIO-LOAD] Empresas cargadas:', this.empresas.length);
        this.populateCompanySelect();
      }
    } catch (error) {
      console.error('[TERCEROS-GREMIO-LOAD-ERROR]', error);
      this.empresas = [];
    }
  },

  populateCompanySelect() {
    const select = document.getElementById('terceroCompany');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccionar empresa...</option>';
    this.empresas.forEach((empresa, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = empresa.nombre;
      select.appendChild(option);
    });
  },

  setupEventListeners() {
    const btnAddTercero = document.getElementById('btnAddTerceroService');
    const btnCloseTercero = document.getElementById('btnCloseTerceroService');
    const btnSaveTercero = document.getElementById('btnSaveTerceroService');
    const btnCancelTercero = document.getElementById('btnCancelTerceroService');
    const selectCompany = document.getElementById('terceroCompany');
    const selectService = document.getElementById('terceroService');
    const inputQuantity = document.getElementById('terceroQuantity');
    const inputPrice = document.getElementById('terceroPrice');
    const modal = document.getElementById('terceroServiceModal');

    if (btnAddTercero) {
      btnAddTercero.addEventListener('click', () => this.openModal());
    }

    if (btnCloseTercero) {
      btnCloseTercero.addEventListener('click', () => this.closeModal());
    }

    if (btnSaveTercero) {
      btnSaveTercero.addEventListener('click', () => this.addService());
    }

    if (btnCancelTercero) {
      btnCancelTercero.addEventListener('click', () => this.closeModal());
    }

    if (selectCompany) {
      selectCompany.addEventListener('change', () => this.updateServiceSelect());
    }

    if (inputQuantity) {
      inputQuantity.addEventListener('input', () => this.updateTotalDisplay());
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });
    }
  },

  openModal() {
    const modal = document.getElementById('terceroServiceModal');
    if (modal) {
      modal.classList.add('active');
      document.getElementById('terceroCompany').value = '';
      document.getElementById('terceroService').value = '';
      document.getElementById('terceroQuantity').value = '1';
      document.getElementById('terceroPrice').value = '';
      this.updateServiceSelect();
      this.updateTotalDisplay();
    }
  },

  closeModal() {
    const modal = document.getElementById('terceroServiceModal');
    if (modal) modal.classList.remove('active');
  },

  updateServiceSelect() {
    const selectCompany = document.getElementById('terceroCompany');
    const selectService = document.getElementById('terceroService');
    const inputPrice = document.getElementById('terceroPrice');

    if (!selectService) return;

    const companyIndex = parseInt(selectCompany.value);

    if (companyIndex < 0 || companyIndex >= this.empresas.length) {
      selectService.disabled = true;
      selectService.innerHTML = '<option value="">Selecciona empresa primero...</option>';
      inputPrice.value = '';
      return;
    }

    const empresa = this.empresas[companyIndex];
    selectService.disabled = false;
    selectService.innerHTML = '<option value="">Seleccionar servicio...</option>';

    if (empresa.servicios) {
      empresa.servicios.forEach((servicio, index) => {
        const option = document.createElement('option');
        option.value = JSON.stringify({ empresaIndex: companyIndex, servicioIndex: index });
        option.textContent = `${servicio.nombre} (${servicio.unidad})`;
        selectService.appendChild(option);
      });
    }

    selectService.addEventListener('change', () => {
      if (selectService.value) {
        const datos = JSON.parse(selectService.value);
        const servicio = this.empresas[datos.empresaIndex].servicios[datos.servicioIndex];
        inputPrice.value = servicio.costo.toFixed(2);
        this.updateTotalDisplay();
      }
    });
  },

  updateTotalDisplay() {
    const quantity = parseFloat(document.getElementById('terceroQuantity').value) || 0;
    const price = parseFloat(document.getElementById('terceroPrice').value) || 0;
    const total = quantity * price;

    const display = document.getElementById('terceroTotal');
    if (display) {
      display.textContent = `$${total.toFixed(2)}`;
    }
  },

  addService() {
    const selectCompany = document.getElementById('terceroCompany');
    const selectService = document.getElementById('terceroService');
    const quantity = parseFloat(document.getElementById('terceroQuantity').value) || 0;
    const price = parseFloat(document.getElementById('terceroPrice').value) || 0;

    if (!selectCompany.value || !selectService.value) {
      alert('Por favor selecciona empresa y servicio');
      return;
    }

    if (quantity <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    const datos = JSON.parse(selectService.value);
    const empresa = this.empresas[datos.empresaIndex];
    const servicio = empresa.servicios[datos.servicioIndex];

    const servicioAgregado = {
      id: Date.now(),
      empresa: empresa.nombre,
      servicio: servicio.nombre,
      categoria: servicio.categoria,
      unidad: servicio.unidad,
      cantidad: quantity,
      costo: price,
      total: quantity * price,
      margenPorUnidad: servicio.precio - servicio.costo // Esto es lo que ganas por unidad
    };

    this.serviciosAgregados.push(servicioAgregado);
    console.log('[TERCEROS-GREMIO-ADD] Servicio agregado:', servicioAgregado);

    this.renderServicios();
    this.updateTotales();
    this.closeModal();
  },

  deleteService(id) {
    this.serviciosAgregados = this.serviciosAgregados.filter(s => s.id !== id);
    console.log('[TERCEROS-GREMIO-DELETE] Servicio eliminado');
    this.renderServicios();
    this.updateTotales();
  },

  renderServicios() {
    const container = document.getElementById('terceroServicesList');
    if (!container) return;

    if (this.serviciosAgregados.length === 0) {
      container.innerHTML = '<p class="empty-state">No hay servicios de terceros agregados</p>';
      return;
    }

    container.innerHTML = this.serviciosAgregados.map(servicio => `
      <div class="servicio-card-gremio">
        <div class="servicio-header-gremio">
          <div class="servicio-info-gremio">
            <h4>${servicio.servicio}</h4>
            <p class="servicio-meta-gremio">
              <span class="tag-empresa">${servicio.empresa}</span>
              ${servicio.categoria ? `<span class="tag-categoria">${servicio.categoria}</span>` : ''}
              <span class="tag-unidad">${servicio.unidad}</span>
            </p>
          </div>
          <button class="btn-delete-service" onclick="tercerosTerceroService.deleteService(${servicio.id})">🗑️</button>
        </div>
        <div class="servicio-details-gremio">
          <div class="detail-box">
            <span class="detail-label">Cantidad</span>
            <span class="detail-value">${servicio.cantidad.toFixed(2)}</span>
          </div>
          <div class="detail-box">
            <span class="detail-label">Precio Unit. (Costo)</span>
            <span class="detail-value">$${servicio.costo.toFixed(2)}</span>
          </div>
          <div class="detail-box">
            <span class="detail-label">Total Costo</span>
            <span class="detail-value">$${servicio.total.toFixed(2)}</span>
          </div>
          <div class="detail-box">
            <span class="detail-label">Ganancia por unidad</span>
            <span class="detail-value ganancia">$${servicio.margenPorUnidad.toFixed(2)}</span>
          </div>
        </div>
      </div>
    `).join('');
  },

  updateTotales() {
    // Calcular totales de servicios
    const totalCostoServicios = this.serviciosAgregados.reduce((sum, s) => sum + s.total, 0);
    const totalGananciaServicios = this.serviciosAgregados.reduce((sum, s) => sum + (s.margenPorUnidad * s.cantidad), 0);

    console.log('[TERCEROS-GREMIO-TOTALES]', {
      costServicios: totalCostoServicios,
      gananciaServicios: totalGananciaServicios
    });

    // Aquí se integraría con el cálculo de totales de gremio
    // Por ahora, exponemos los valores globalmente
    window.tercerosCostoTotal = totalCostoServicios;
    window.tercerosGananciaTotal = totalGananciaServicios;

    // Trigger event para que gremio-main.js recalcule
    document.dispatchEvent(new Event('terceros-updated'));
  },

  getTotalCosto() {
    return this.serviciosAgregados.reduce((sum, s) => sum + s.total, 0);
  },

  getTotalGanancia() {
    return this.serviciosAgregados.reduce((sum, s) => sum + (s.margenPorUnidad * s.cantidad), 0);
  },

  getServicios() {
    return this.serviciosAgregados;
  },

  clearServices() {
    this.serviciosAgregados = [];
    this.renderServicios();
    this.updateTotales();
  }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  tercerosTerceroService.init();
});
