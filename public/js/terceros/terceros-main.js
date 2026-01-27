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

    if (btnCloseServicio) btnCloseServicio.addEventListener('click', () => this.closeServicioModal());
    if (btnSaveServicio) btnSaveServicio.addEventListener('click', () => this.saveServicio());
    if (btnCancelServicio) btnCancelServicio.addEventListener('click', () => this.closeServicioModal());
    if (costInput) costInput.addEventListener('input', () => this.updateMarginDisplay());
    if (precioInput) precioInput.addEventListener('input', () => this.updateMarginDisplay());
    if (servicioModal) servicioModal.addEventListener('click', (e) => {
      if (e.target === servicioModal) this.closeServicioModal();
    });
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

    this.updateCategorySelect();

    if (servicioIndex !== null && empresa.servicios && empresa.servicios[servicioIndex]) {
      title.textContent = '🔧 Editar Servicio';
      const servicio = empresa.servicios[servicioIndex];
      document.getElementById('servicioNombre').value = servicio.nombre || '';
      document.getElementById('servicioCategoria').value = servicio.categoria || '';
      document.getElementById('servicioUnidad').value = servicio.unidad || 'm²';
      document.getElementById('servicioCosto').value = servicio.costo || '';
      document.getElementById('servicioPrecio').value = servicio.precio || '';
    } else {
      title.textContent = '🔧 Agregar Servicio';
    }

    this.updateMarginDisplay();
    modal.classList.add('active');
  },

  closeServicioModal() {
    const modal = document.getElementById('servicioModal');
    if (modal) modal.classList.remove('active');
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
