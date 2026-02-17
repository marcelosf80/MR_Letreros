/**
 * GREMIO - Sistema de Cotizaciones (Versión de Red)
 * Conectado al servidor Node.js a través de data-manager-network.js
 */

// ==================== VARIABLES GLOBALES ====================
window.listaCostos = []; // Antes 'materiales', ahora solo para buscar costos
window.preciosGremio = [];
window.terceros = [];
let currentQuoteProducts = [];
let currentQuoteTerceros = [];
let currentPrecioGremio = 0;
let currentCostoMaterial = 0;
let currentProductData = null;
let cotizacionesGremio = [];
let currentClientId = null; // ID del cliente seleccionado
let allClients = []; // Lista para el buscador
let currentTotals = { // Almacén para totales numéricos reales
  costoTotal: 0,
  subtotal: 0,
  iva: 0,
  totalCliente: 0,
  ganancia: 0
};

// ==================== HELPERS DE FORMATO ====================
function formatCurrency(number) {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
}

function formatM2(number) {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(number);
}

// ==================== INICIALIZACIÓN ====================

<<<<<<< HEAD
document.addEventListener('DOMContentLoaded', async function () {
  console.log('[GREMIO] 🚀 Inicializando con conexión al servidor...');

=======
document.addEventListener('DOMContentLoaded', async function() {
  console.log('[GREMIO] 🚀 Inicializando con conexión al servidor...');
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Esperar a que el dataManager se conecte
  if (!window.mrDataManager || !(await window.mrDataManager.checkConnection())) {
    console.error('[GREMIO] ❌ No se pudo conectar al servidor. La aplicación no funcionará.');
    // El dataManager ya muestra un error visual.
    return;
  }
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  await loadAllData();
  setupEventListeners();
  await loadQuotations();
  updateStatistics();
<<<<<<< HEAD

  // Iniciar monitoreo de notificaciones
  startNotificationPolling();

=======
  
  // Iniciar monitoreo de notificaciones
  startNotificationPolling();
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  console.log('[GREMIO] ✅ Sistema listo y conectado.');
});

// ==================== CARGA DE DATOS DESDE EL SERVIDOR ====================

async function loadAllData() {
  await Promise.all([
    loadCostosData(),
    loadPrecios(),
    loadTerceros()
  ]);
}

async function loadCostosData() {
  try {
    // 1. Cargar Costos (Productos definidos)
    const costos = await window.mrDataManager.getCostos();
<<<<<<< HEAD

    // 2. Cargar Materiales (Inventario físico) para asegurar que todo esté disponible
    const inventario = await window.mrDataManager.getMateriales();

    // Combinar: Usar Costos como base
    let listaCombinada = [...costos];

    // Crear un Set de nombres existentes en costos para evitar duplicados
    const existentes = new Set(costos.map(c => (c.name || c.producto || '').toLowerCase().trim()));

    inventario.forEach(m => {
      const nombre = (m.producto || m.name || m.productoNombre || '').toLowerCase().trim();
      if (nombre && !existentes.has(nombre)) {
        // Este material no está en costos, lo agregamos temporalmente para cotizar
        listaCombinada.push({
          id: m.id,
          name: m.producto || m.name || m.productoNombre,
          category: m.categoria || m.category,
          costs: { total: m.costoPorM2 || 0 },
          unit: m.unit || 'm²'
        });
        existentes.add(nombre);
      }
=======
    
    // 2. Cargar Materiales (Inventario físico) para asegurar que todo esté disponible
    const inventario = await window.mrDataManager.getMateriales();
    
    // Combinar: Usar Costos como base
    let listaCombinada = [...costos];
    
    // Crear un Set de nombres existentes en costos para evitar duplicados
    const existentes = new Set(costos.map(c => (c.name || c.producto || '').toLowerCase().trim()));
    
    inventario.forEach(m => {
        const nombre = (m.producto || m.name || m.productoNombre || '').toLowerCase().trim();
        if (nombre && !existentes.has(nombre)) {
            // Este material no está en costos, lo agregamos temporalmente para cotizar
            listaCombinada.push({
                id: m.id,
                name: m.producto || m.name || m.productoNombre,
                category: m.categoria || m.category,
                costs: { total: m.costoPorM2 || 0 },
                unit: m.unit || 'm²'
            });
            existentes.add(nombre);
        }
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    });

    window.listaCostos = listaCombinada;
    console.log('[GREMIO] ✅ Datos de Costos cargados para referencia:', window.listaCostos.length);
  } catch (error) {
    console.error('[GREMIO] ❌ Error cargando datos de costos:', error);
    window.listaCostos = [];
  }
}

async function loadPrecios() {
  try {
    window.preciosGremio = await window.mrDataManager.getPrecios();
    console.log('[GREMIO] ✅ Precios cargados:', window.preciosGremio.length);
  } catch (error) {
    console.error('[GREMIO] ❌ Error cargando precios:', error);
    window.preciosGremio = [];
  }
}

async function loadTerceros() {
  try {
    const empresas = await window.mrDataManager.getTerceros();
    // Aplanar la lista de servicios de todas las empresas para el dropdown
    window.terceros = [];
    empresas.forEach(empresa => {
      if (empresa.servicios) {
        empresa.servicios.forEach(servicio => {
          window.terceros.push({
            ...servicio,
            empresaNombre: empresa.nombre // Añadir el nombre de la empresa al servicio
          });
        });
      }
    });
    console.log('[GREMIO] ✅ Terceros cargados y aplanados:', window.terceros.length);
    populateTerceros();
  } catch (error) {
    console.error('[GREMIO] ❌ Error cargando terceros:', error);
    window.terceros = [];
  }
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
  // --- MODAL PRODUCTOS ---
  const btnSaveProduct = document.getElementById('btnSaveProduct');
  const btnAddProduct = document.getElementById('btnAddProduct');
  const btnCloseProduct = document.getElementById('btnCloseProduct');
  const btnCancelProduct = document.getElementById('btnCancelProduct');
  const productModal = document.getElementById('productModal');

  if (btnAddProduct) btnAddProduct.addEventListener('click', () => {
    // VALIDACIÓN: Obligar a cargar cliente antes de cotizar
    if (!currentClientId) {
      alert('⚠️ Para cotizar, primero debes CARGAR o GUARDAR un cliente.');
      return;
    }
    populateProductSelect();
    window.MRModals.open(productModal);
  });
  if (btnSaveProduct) btnSaveProduct.addEventListener('click', addProductToQuote);
  if (btnCloseProduct) btnCloseProduct.addEventListener('click', () => window.MRModals.close(productModal));
  if (btnCancelProduct) btnCancelProduct.addEventListener('click', () => window.MRModals.close(productModal));

  // --- LISTENERS FORMULARIO PRODUCTO ---
  const productCategory = document.getElementById('productCategory');
  const productName = document.getElementById('productName');
<<<<<<< HEAD

  if (productCategory) productCategory.addEventListener('change', window.loadProductsByCategory);
  if (productName) productName.addEventListener('change', window.loadProductPrice);

=======
  
  if (productCategory) productCategory.addEventListener('change', window.loadProductsByCategory);
  if (productName) productName.addEventListener('change', window.loadProductPrice);
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Listeners para cálculo automático al escribir
  ['productAncho', 'productAlto', 'productCantidad'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', window.calcularTotalMaterial);
  });

  // --- MODAL TERCEROS ---
  const btnSaveTercero = document.getElementById('btnSaveTerceroService');
  const btnAddTercero = document.getElementById('btnAddTerceroService');
  const btnCloseTercero = document.getElementById('btnCloseTerceroService');
  const btnCancelTercero = document.getElementById('btnCancelTerceroService');
  const terceroModal = document.getElementById('terceroServiceModal');

  if (btnAddTercero) btnAddTercero.addEventListener('click', () => window.MRModals.open(terceroModal));
  if (btnSaveTercero) btnSaveTercero.addEventListener('click', addTerceroToQuote);
  if (btnCloseTercero) btnCloseTercero.addEventListener('click', () => window.MRModals.close(terceroModal));
  if (btnCancelTercero) btnCancelTercero.addEventListener('click', () => window.MRModals.close(terceroModal));

  // 🛠️ FIX: Activar cálculo automático en Modal de Terceros
  const terceroServiceSelect = document.getElementById('terceroService');
  if (terceroServiceSelect) {
    terceroServiceSelect.addEventListener('change', window.loadTerceroPrice);
  }
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  const terceroQuantityInput = document.getElementById('terceroQuantity');
  if (terceroQuantityInput) {
    terceroQuantityInput.addEventListener('input', window.calcularTotalTercero);
  }
<<<<<<< HEAD

  // --- CLIENTES (BUSCADOR Y GUARDADO) ---
  // 🛠️ FIX: Asegurar que existan los controles de cliente (Inyección Automática)
  ensureClientControlsExist();

  // 🛠️ FIX: Asegurar controles de medidas para terceros
  ensureTerceroInputs();

=======
  
  // --- CLIENTES (BUSCADOR Y GUARDADO) ---
  // 🛠️ FIX: Asegurar que existan los controles de cliente (Inyección Automática)
  ensureClientControlsExist();
  
  // 🛠️ FIX: Asegurar controles de medidas para terceros
  ensureTerceroInputs();
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // 🛠️ FIX: Inyectar selector de terceros en modal de producto
  ensureProductModalTercerosUI();

  const btnSearchClient = document.getElementById('btnSearchClient');
  const searchClientInput = document.getElementById('searchClientInput');
  const searchClientModal = document.getElementById('searchClientModal');
  const btnCloseSearch = document.getElementById('btnCloseSearchClient');
  const btnCancelSearch = document.getElementById('btnCancelSearchClient');
  const btnSaveClient = document.getElementById('btnSaveClient');

  if (btnSearchClient) {
    btnSearchClient.addEventListener('click', async () => {
<<<<<<< HEAD
      // FIX: cargar de ambos endpoints para ver clientes del gestor
      const [gremioClients, allRegistered] = await Promise.all([
        window.mrDataManager.getGremioClientes().catch(() => []),
        fetch('/api/clientes').then(r => r.ok ? r.json() : []).catch(() => [])
      ]);

      // Combinar y deduplicar por ID
      const combined = [...gremioClients];
      allRegistered.forEach(c => {
        if (c.tipo === 'gremio' && !combined.find(x => x.id === c.id)) {
          combined.push(c);
        }
      });

      allClients = combined;
      renderClientSearchList(allClients);
      window.MRModals.open(searchClientModal);
      setTimeout(() => { if (searchClientInput) searchClientInput.focus(); }, 100);
    });
  }

  if (searchClientInput) {
    searchClientInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = allClients.filter(c => {
        // FIX: gestión guarda 'nombre', los creados desde gremio guardan 'name'
        const nombre = (c.name || c.nombre || '').toLowerCase();
        const contacto = (c.contact || c.telefono || c.email || '').toLowerCase();
        return nombre.includes(term) || contacto.includes(term);
      });
      renderClientSearchList(filtered);
    });
  }

  if (btnCloseSearch) btnCloseSearch.addEventListener('click', () => window.MRModals.close(searchClientModal));
  if (btnCancelSearch) btnCancelSearch.addEventListener('click', () => window.MRModals.close(searchClientModal));

=======
      allClients = await window.mrDataManager.getGremioClientes();
      renderClientSearchList(allClients);
      window.MRModals.open(searchClientModal);
      // Enfocar el input de búsqueda
      setTimeout(() => { if(searchClientInput) searchClientInput.focus(); }, 100);
    });
  }
  
  if (searchClientInput) {
    searchClientInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = allClients.filter(c => 
        c.name.toLowerCase().includes(term) || 
        (c.contact && c.contact.toLowerCase().includes(term))
      );
      renderClientSearchList(filtered);
    });
  }
  
  if (btnCloseSearch) btnCloseSearch.addEventListener('click', () => window.MRModals.close(searchClientModal));
  if (btnCancelSearch) btnCancelSearch.addEventListener('click', () => window.MRModals.close(searchClientModal));
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (btnSaveClient) btnSaveClient.addEventListener('click', window.saveNewClient);

  console.log('[GREMIO] ✅ Event listeners configurados');
}

// ==================== INYECCIÓN DE CONTROLES DE CLIENTE ====================

function ensureClientControlsExist() {
  const clientNameInput = document.getElementById('clientName');
  if (!clientNameInput) {
    console.warn('[GREMIO] ⚠️ No se encontró el input "clientName". No se pueden inyectar controles.');
    return;
  }

  const parent = clientNameInput.parentNode; // El contenedor del input
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Asegurar que el contenedor permita elementos en línea (flex o inline-block)
  // Si el parent es muy estricto, insertamos un wrapper, pero por ahora intentamos directo.

  // 1. Botón BUSCAR (🔍)
  if (!document.getElementById('btnSearchClient')) {
    const btn = document.createElement('button');
    btn.id = 'btnSearchClient';
    btn.innerHTML = '🔍';
    btn.className = 'btn btn-primary';
    btn.style.marginLeft = '5px';
    btn.style.padding = '0 10px';
    btn.title = 'Buscar Cliente';
    btn.type = 'button';
<<<<<<< HEAD

=======
    
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    // Insertar justo después del input de nombre
    if (clientNameInput.nextSibling) {
      parent.insertBefore(btn, clientNameInput.nextSibling);
    } else {
      parent.appendChild(btn);
    }
  }

  // 2. Botón GUARDAR (💾)
  if (!document.getElementById('btnSaveClient')) {
    const btn = document.createElement('button');
    btn.id = 'btnSaveClient';
    btn.innerHTML = '💾';
    btn.className = 'btn btn-success';
    btn.style.marginLeft = '5px';
    btn.style.padding = '0 10px';
    btn.title = 'Guardar Datos del Cliente';
    btn.type = 'button';
<<<<<<< HEAD

=======
    
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    // Insertar después del botón de buscar
    const btnSearch = document.getElementById('btnSearchClient');
    if (btnSearch && btnSearch.nextSibling) {
      parent.insertBefore(btn, btnSearch.nextSibling);
    } else {
      parent.appendChild(btn);
    }
  }

  // 3. Modal de Búsqueda (Si no existe en el HTML)
  if (!document.getElementById('searchClientModal')) {
    const modal = document.createElement('div');
    modal.id = 'searchClientModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h2 class="modal-title">🔍 Buscar Cliente</h2>
          <button class="close-modal" id="btnCloseSearchClient">&times;</button>
        </div>
        <div class="modal-body">
          <input type="text" id="searchClientInput" placeholder="Escribe el nombre del cliente..." class="form-control" style="width: 100%; margin-bottom: 1rem; padding: 0.5rem;">
          <div id="clientSearchResults" style="max-height: 300px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btnCancelSearchClient">Cerrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

// ==================== INYECCIÓN DE CONTROLES TERCEROS ====================

function ensureTerceroInputs() {
  const quantityInput = document.getElementById('terceroQuantity');
  // Si no existe el input de cantidad o ya existen los de medidas, salir
  if (!quantityInput || document.getElementById('terceroAncho')) return;

  const container = document.createElement('div');
  container.id = 'terceroDimensiones';
  container.style.display = 'none'; // Oculto por defecto
  container.style.gridTemplateColumns = '1fr 1fr';
  container.style.gap = '10px';
  container.style.marginBottom = '1rem';
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  container.innerHTML = `
    <div><label style="display:block; margin-bottom:5px; font-size:0.9rem;">Ancho (cm)</label><input type="number" id="terceroAncho" class="form-control" placeholder="0" style="width:100%; padding:8px;"></div>
    <div><label style="display:block; margin-bottom:5px; font-size:0.9rem;">Alto (cm)</label><input type="number" id="terceroAlto" class="form-control" placeholder="0" style="width:100%; padding:8px;"></div>
  `;
<<<<<<< HEAD

  quantityInput.parentNode.insertBefore(container, quantityInput);

  // Listeners para cálculo
  document.getElementById('terceroAncho').addEventListener('input', window.calcularTotalTercero);
  document.getElementById('terceroAlto').addEventListener('input', window.calcularTotalTercero);

=======
  
  quantityInput.parentNode.insertBefore(container, quantityInput);
  
  // Listeners para cálculo
  document.getElementById('terceroAncho').addEventListener('input', window.calcularTotalTercero);
  document.getElementById('terceroAlto').addEventListener('input', window.calcularTotalTercero);
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Input para cantidad de material (placas)
  const matContainer = document.createElement('div');
  matContainer.id = 'terceroMaterialGroup';
  matContainer.style.display = 'none';
  matContainer.style.marginBottom = '1rem';
  matContainer.style.background = 'rgba(255, 193, 7, 0.1)';
  matContainer.style.padding = '10px';
  matContainer.style.borderRadius = '5px';
  matContainer.innerHTML = `
    <label style="display:block; margin-bottom:5px; font-size:0.9rem; color:#FFC107;">📦 Cantidad de Material (Placas)</label>
    <input type="number" id="terceroCantMaterial" class="form-control" placeholder="1" value="1" style="width:100%; padding:8px;">
    <small style="color:#aaa; display:block; margin-top:3px;">Se sumará el costo del material multiplicado por esta cantidad.</small>
  `;
<<<<<<< HEAD

  // Insertar antes de las dimensiones
  container.parentNode.insertBefore(matContainer, container);

=======
  
  // Insertar antes de las dimensiones
  container.parentNode.insertBefore(matContainer, container);
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  document.getElementById('terceroCantMaterial').addEventListener('input', window.calcularTotalTercero);
}

function ensureProductModalTercerosUI() {
  const productNameSelect = document.getElementById('productName');
  if (!productNameSelect || document.getElementById('productModalTercero')) return;

  const wrapper = document.createElement('div');
  wrapper.style.marginTop = '15px';
  wrapper.style.marginBottom = '15px';
  wrapper.style.padding = '10px';
  wrapper.style.backgroundColor = 'rgba(78, 205, 196, 0.1)';
  wrapper.style.borderRadius = '5px';
  wrapper.style.border = '1px solid rgba(78, 205, 196, 0.3)';

  wrapper.innerHTML = `
    <label style="display:block; margin-bottom:5px; font-weight:bold; color:#2c3e50;">🛠️ Servicio Adicional (Tercero)</label>
    <select id="productModalTercero" class="form-control" style="width:100%; padding:8px;">
      <option value="">-- Ninguno --</option>
    </select>
    <div id="productModalTerceroInfo" style="font-size:0.85rem; color:#666; margin-top:5px; display:none;"></div>
  `;

  // Insertar después del selector de nombre de producto
  if (productNameSelect.parentNode) {
    productNameSelect.parentNode.insertBefore(wrapper, productNameSelect.nextSibling);
  }
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Poblar inmediatamente
  populateTerceros();
}

// ==================== GESTIÓN DE CLIENTES ====================

function renderClientSearchList(clients) {
  const container = document.getElementById('clientSearchResults');
  if (!container) return;
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (clients.length === 0) {
    container.innerHTML = '<p style="text-align: center; padding: 1rem;">No se encontraron clientes</p>';
    return;
  }
<<<<<<< HEAD

  container.innerHTML = clients.map(c => {
    // FIX: normalizar campo 'name' vs 'nombre' (gestión usa 'nombre')
    const nombre = c.name || c.nombre || 'Sin nombre';
    const contacto = c.contact || c.telefono || c.email || 'Sin contacto';
    const esTipoGremio = c.tipo === 'gremio' || !c.tipo;
    return `
    <div class="client-item" style="padding: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.08); cursor: pointer;" 
         onclick="window.selectClient('${c.id}')"
         onmouseover="this.style.background='rgba(99,102,241,0.15)'"
         onmouseout="this.style.background=''">
      <strong>${nombre}</strong>
      ${esTipoGremio ? '<span style="font-size:0.7rem; background:rgba(81,207,102,0.2); color:#51CF66; border:1px solid #51CF66; border-radius:10px; padding:1px 6px; margin-left:6px;">GREMIO</span>' : ''}
      <br>
      <small style="color: #aaa;">${contacto}</small>
    </div>
  `}).join('');
}

window.selectClient = function (id) {
  const client = allClients.find(c => c.id === id);
  if (client) {
    currentClientId = client.id;
    // FIX: normalizar campo 'name' vs 'nombre' (gestión guarda 'nombre')
    const nombreMostrar = client.name || client.nombre || '';
    document.getElementById('clientName').value = nombreMostrar;
    if (document.getElementById('clientPhone')) document.getElementById('clientPhone').value = client.telefono || client.phone || '';
    if (document.getElementById('clientEmail')) document.getElementById('clientEmail').value = client.email || '';
    if (document.getElementById('clientAddress')) document.getElementById('clientAddress').value = client.direccion || client.address || '';

    window.MRModals.close(document.getElementById('searchClientModal'));
    alert(`✅ Cliente cargado: ${nombreMostrar}\nAhora puedes comenzar a cotizar.`);
  }
};

window.saveNewClient = async function () {
=======
  
  container.innerHTML = clients.map(c => `
    <div class="client-item" style="padding: 0.8rem; border-bottom: 1px solid #eee; cursor: pointer; hover:background: #f5f5f5;" onclick="window.selectClient('${c.id}')">
      <strong>${c.name}</strong><br>
      <small style="color: #666;">${c.contact || 'Sin contacto'}</small>
    </div>
  `).join('');
}

window.selectClient = function(id) {
  const client = allClients.find(c => c.id === id);
  if (client) {
    currentClientId = client.id;
    document.getElementById('clientName').value = client.name;
    if(document.getElementById('clientPhone')) document.getElementById('clientPhone').value = client.telefono || '';
    if(document.getElementById('clientEmail')) document.getElementById('clientEmail').value = client.email || '';
    if(document.getElementById('clientAddress')) document.getElementById('clientAddress').value = client.direccion || '';
    
    window.MRModals.close(document.getElementById('searchClientModal'));
    alert(`✅ Cliente cargado: ${client.name}\nAhora puedes comenzar a cotizar.`);
  }
};

window.saveNewClient = async function() {
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  const name = document.getElementById('clientName').value.trim();
  if (!name) {
    alert('⚠️ Ingresa el nombre del cliente para guardarlo.');
    return;
  }

  const clientData = {
<<<<<<< HEAD
    name: name,       // compatibilidad con gremio-main y clientes-main
    nombre: name,     // compatibilidad con clientes-gestion-main
    telefono: document.getElementById('clientPhone')?.value || '',
    email: document.getElementById('clientEmail')?.value || '',
    direccion: document.getElementById('clientAddress')?.value || '',
    tipo: 'gremio'    // identificar origen para el gestor unificado
=======
    name: name,
    telefono: document.getElementById('clientPhone')?.value || '',
    email: document.getElementById('clientEmail')?.value || '',
    direccion: document.getElementById('clientAddress')?.value || ''
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  };

  let result = null;

  if (currentClientId) {
    // ACTUALIZAR: Si ya hay un cliente cargado, actualizamos sus datos
    result = await window.mrDataManager.updateGremioCliente(currentClientId, clientData);
    if (result) alert(`✅ Datos del cliente "${name}" actualizados correctamente.`);
  } else {
    // CREAR: Si no hay cliente, creamos uno nuevo
    clientData.id = 'gremio_cli_' + Date.now();
    clientData.fechaRegistro = new Date().toISOString();
    result = await window.mrDataManager.saveGremioCliente(clientData);
    if (result) {
      currentClientId = clientData.id;
      alert(`✅ Cliente "${name}" guardado correctamente.\nYa puedes cotizar.`);
    }
  }

  if (!result) {
    alert('❌ Error al guardar el cliente.');
  }
};

// ==================== POBLAR SELECTOR DE PRODUCTOS ====================

async function populateProductSelect() {
  const selectCategoria = document.getElementById('productCategory');
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (!selectCategoria) {
    console.error('[GREMIO] ❌ Select productCategory no encontrado');
    return;
  }
<<<<<<< HEAD

  // 1. Obtener categorías de productos existentes
  const categoriasProductos = [...new Set(window.preciosGremio.map(p => p.category || p.categoria))].filter(Boolean);

  // 2. Obtener categorías guardadas (archivo gremio_categorias.json)
  let categoriasGuardadas = [];
  if (window.mrDataManager) {
    categoriasGuardadas = await window.mrDataManager.getCategorias();
=======
  
  // 1. Obtener categorías de productos existentes
  const categoriasProductos = [...new Set(window.preciosGremio.map(p => p.category || p.categoria))].filter(Boolean);
  
  // 2. Obtener categorías guardadas (archivo gremio_categorias.json)
  let categoriasGuardadas = [];
  if (window.mrDataManager) {
      categoriasGuardadas = await window.mrDataManager.getCategorias();
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  }

  // 3. Combinar ambas listas y eliminar duplicados
  const categorias = [...new Set([...categoriasProductos, ...categoriasGuardadas])].sort();
<<<<<<< HEAD

  selectCategoria.innerHTML = '<option value="">Seleccionar categoría...</option>' +
    categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');

  console.log('[GREMIO] ✅ Categorías pobladas:', categorias.length);
}

window.loadProductsByCategory = function () {
  const categoria = document.getElementById('productCategory').value;
  const productSelect = document.getElementById('productName');
  const priceInfo = document.getElementById('priceInfo');

=======
  
  selectCategoria.innerHTML = '<option value="">Seleccionar categoría...</option>' + 
    categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');
  
  console.log('[GREMIO] ✅ Categorías pobladas:', categorias.length);
}

window.loadProductsByCategory = function() {
  const categoria = document.getElementById('productCategory').value;
  const productSelect = document.getElementById('productName');
  const priceInfo = document.getElementById('priceInfo');
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (!categoria) {
    productSelect.innerHTML = '<option value="">Primero selecciona categoría...</option>';
    productSelect.disabled = true;
    if (priceInfo) priceInfo.style.display = 'none';
    resetCalculos();
    return;
  }

  // Filtrar productos por categoría
<<<<<<< HEAD
  const productos = preciosGremio.filter(p =>
    (p.category === categoria || p.categoria === categoria)
  );

=======
  const productos = preciosGremio.filter(p => 
    (p.category === categoria || p.categoria === categoria)
  );
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (productos.length === 0) {
    productSelect.innerHTML = '<option value="">No hay productos en esta categoría</option>';
    productSelect.disabled = true;
    console.warn('[GREMIO] ⚠️ No hay productos para categoría:', categoria);
    return;
  }
<<<<<<< HEAD

  productSelect.innerHTML = '<option value="">Seleccionar producto...</option>' +
=======
  
  productSelect.innerHTML = '<option value="">Seleccionar producto...</option>' + 
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    productos.map((p, index) => {
      // Detectar nombre del producto (puede ser .nombre, .name o .producto)
      const nombreProducto = p.name || p.nombre || p.producto || 'Sin nombre';
      const dimensiones = p.ancho && p.largo ? ` (${p.ancho}x${p.largo}m)` : '';
      return `<option value="${index}">${nombreProducto}${dimensiones}</option>`;
    }).join('');
<<<<<<< HEAD

  productSelect.disabled = false;

  // Guardar productos filtrados en variable temporal
  window.productosFiltrados = productos;

  console.log('[GREMIO] ✅ Productos poblados:', productos.length);
};

window.loadProductPrice = function () {
  const productSelect = document.getElementById('productName');
  const productIndex = parseInt(productSelect.value);
  const priceInfo = document.getElementById('priceInfo');

=======
  
  productSelect.disabled = false;
  
  // Guardar productos filtrados en variable temporal
  window.productosFiltrados = productos;
  
  console.log('[GREMIO] ✅ Productos poblados:', productos.length);
};

window.loadProductPrice = function() {
  const productSelect = document.getElementById('productName');
  const productIndex = parseInt(productSelect.value);
  const priceInfo = document.getElementById('priceInfo');
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (isNaN(productIndex) || !window.productosFiltrados) {
    if (priceInfo) priceInfo.style.display = 'none';
    resetCalculos();
    return;
  }

  const precioItem = window.productosFiltrados[productIndex];
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (!precioItem) {
    console.error('[GREMIO] ❌ Producto no encontrado');
    return;
  }

  console.log('[GREMIO] 🔍 Producto seleccionado (Precio):', precioItem);
  currentProductData = precioItem;

  // 1. ESTABLECER PRECIO (Directo del objeto seleccionado)
  currentPrecioGremio = parseFloat(
<<<<<<< HEAD
    precioItem.priceGremio ||
    precioItem.precioGremio ||
    precioItem.gremio ||
    precioItem.price ||
    precioItem.precio ||
    precioItem.costo ||
=======
    precioItem.priceGremio || 
    precioItem.precioGremio || 
    precioItem.gremio || 
    precioItem.price || 
    precioItem.precio || 
    precioItem.costo || 
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    0
  );

  // 2. BUSCAR COSTO (En listaCostos)
  const nombreBuscado = (precioItem.name || precioItem.nombre || precioItem.producto || '').trim().toLowerCase();
  const categoriaBuscada = (precioItem.category || precioItem.categoria || '').trim().toLowerCase();

  const costoItem = listaCostos.find(c => {
    const cNombre = (c.name || c.producto || '').trim().toLowerCase();
    const cCat = (c.category || c.categoria || '').trim().toLowerCase();
    return cNombre === nombreBuscado && cCat === categoriaBuscada;
  });

  if (costoItem) {
    currentCostoMaterial = parseFloat(costoItem.costs?.total || 0);
    console.log('[GREMIO] ✅ Costo encontrado:', currentCostoMaterial);
  } else if (precioItem.costo) {
    currentCostoMaterial = parseFloat(precioItem.costo);
    console.log('[GREMIO] ✅ Costo encontrado en precio:', currentCostoMaterial);
  } else {
    currentCostoMaterial = 0;
    console.warn('[GREMIO] ⚠️ No se encontró costo para este producto. Se usará 0.');
  }

  // LÓGICA DE PRECIO: Si es 0, intentar usar costo
  if (currentPrecioGremio === 0 && currentCostoMaterial > 0) {
    console.log('[GREMIO] ℹ️ Usando costo promedio como precio de cotización');
    currentPrecioGremio = currentCostoMaterial;
  }

  if (currentPrecioGremio > 0) {
    const displayElement = document.getElementById('precioGremioDisplay');
    if (displayElement) {
      displayElement.textContent = '$' + formatCurrency(currentPrecioGremio) + '/m²';
    }
<<<<<<< HEAD

    if (priceInfo) {
      priceInfo.style.display = 'block';
    }

=======
    
    if (priceInfo) {
      priceInfo.style.display = 'block';
    }
    
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    console.log('[GREMIO] ✅ Precio Gremio:', currentPrecioGremio);
    console.log('[GREMIO] ✅ Costo Material:', currentCostoMaterial);

    calcularTotalMaterial();
  } else {
    console.error('[GREMIO] ❌ No se encontró precio para este producto');
    alert('⚠️ Este producto no tiene precio de Gremio ni costo promedio válido.');
    if (priceInfo) priceInfo.style.display = 'none';
    currentPrecioGremio = 0;
  }
};

// ==================== CÁLCULO MATERIAL ====================

<<<<<<< HEAD
window.calcularTotalMaterial = function () {
=======
window.calcularTotalMaterial = function() {
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  const ancho = parseFloat(document.getElementById('productAncho')?.value) || 0;
  const alto = parseFloat(document.getElementById('productAlto')?.value) || 0;
  const cantidad = parseInt(document.getElementById('productCantidad')?.value) || 0;

  console.log('[CÁLCULO] Input:', { ancho, alto, cantidad, precioGremio: currentPrecioGremio, costo: currentCostoMaterial });

  if (currentPrecioGremio === 0 || ancho === 0 || alto === 0 || cantidad === 0) {
    document.getElementById('productTotal').textContent = '$0.00';
    document.getElementById('productFormula').textContent = 'Completa todos los datos';
    const detalle = document.getElementById('calculoDetalle');
    if (detalle) detalle.style.display = 'none';
    return;
  }

  // FÓRMULA: ((Ancho * Alto) / 10000) * Cantidad * PrecioGremio
  const m2PorUnidad = (ancho * alto) / 10000;
  const m2Totales = m2PorUnidad * cantidad;
  const precioUnitario = m2PorUnidad * currentPrecioGremio;
  const totalMaterial = m2Totales * currentPrecioGremio;

  console.log('[CÁLCULO] Resultado:', {
    m2PorUnidad,
    m2Totales,
    precioUnitario,
    totalMaterial
  });

  // Mostrar resultado
  document.getElementById('productTotal').textContent = '$' + formatCurrency(totalMaterial);
<<<<<<< HEAD

  // Mostrar fórmula
  document.getElementById('productFormula').textContent =
=======
  
  // Mostrar fórmula
  document.getElementById('productFormula').textContent = 
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    `((${ancho} × ${alto}) ÷ 10000) × ${cantidad} × $${formatCurrency(currentPrecioGremio)}/m²`;

  // Mostrar detalle
  const detalle = document.getElementById('calculoDetalle');
  if (detalle) {
    const m2Elem = document.getElementById('m2PorUnidad');
    const m2TotElem = document.getElementById('m2Totales');
    const precioUnitElem = document.getElementById('precioUnitario');
<<<<<<< HEAD

    if (m2Elem) m2Elem.textContent = formatM2(m2PorUnidad) + ' m²';
    if (m2TotElem) m2TotElem.textContent = formatM2(m2Totales) + ' m²';
    if (precioUnitElem) precioUnitElem.textContent = '$' + formatCurrency(precioUnitario);

=======
    
    if (m2Elem) m2Elem.textContent = formatM2(m2PorUnidad) + ' m²';
    if (m2TotElem) m2TotElem.textContent = formatM2(m2Totales) + ' m²';
    if (precioUnitElem) precioUnitElem.textContent = '$' + formatCurrency(precioUnitario);
    
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    detalle.style.display = 'block';
  }
};

function resetCalculos() {
  currentPrecioGremio = 0;
  currentCostoMaterial = 0;
  currentProductData = null;
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  ['productAncho', 'productAlto', 'productCantidad'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
<<<<<<< HEAD

  const totalElem = document.getElementById('productTotal');
  const formulaElem = document.getElementById('productFormula');
  const detalleElem = document.getElementById('calculoDetalle');

=======
  
  const totalElem = document.getElementById('productTotal');
  const formulaElem = document.getElementById('productFormula');
  const detalleElem = document.getElementById('calculoDetalle');
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (totalElem) totalElem.textContent = '$0.00';
  if (formulaElem) formulaElem.textContent = 'Completa los datos';
  if (detalleElem) detalleElem.style.display = 'none';
}

// ==================== AGREGAR PRODUCTO ====================

function addProductToQuote() {
  // VALIDACIÓN DOBLE (Por seguridad)
  if (!currentClientId) {
    alert('⚠️ Debes cargar un cliente primero.');
    return;
  }

  const ancho = parseFloat(document.getElementById('productAncho').value);
  const alto = parseFloat(document.getElementById('productAlto').value);
  const cantidad = parseInt(document.getElementById('productCantidad').value);

  if (!ancho || !alto || !cantidad) {
    alert('⚠️ Completa todos los campos');
    return;
  }

  if (currentPrecioGremio === 0 || currentCostoMaterial === 0) {
    alert('⚠️ Sin precio de Gremio o sin costo');
    return;
  }

  const m2PorUnidad = (ancho * alto) / 10000;
  const m2Totales = m2PorUnidad * cantidad;
  const costoUnitario = m2PorUnidad * currentCostoMaterial;
  const precioUnitario = m2PorUnidad * currentPrecioGremio;
  const totalCosto = m2Totales * currentCostoMaterial;
  const totalPrecio = m2Totales * currentPrecioGremio;

  const nombreProducto = currentProductData.name || currentProductData.nombre || currentProductData.producto;
  const categoriaProducto = currentProductData.category || currentProductData.categoria;

  // --- LÓGICA TERCERO VINCULADO ---
  const tercSelect = document.getElementById('productModalTercero');
  if (tercSelect && tercSelect.value !== "") {
    const tIndex = parseInt(tercSelect.value);
    if (terceros[tIndex]) {
      const t = terceros[tIndex];
<<<<<<< HEAD

      let factor = cantidad;
      let detalleMedidas = '';

      // Verificar unidad del tercero
      const unidadT = t.unidad || 'unidad';
      if ((unidadT === 'm²' || unidadT === 'm2') && ancho > 0 && alto > 0) {
        factor = m2Totales; // Usar m² totales calculados arriba
        detalleMedidas = ` (${ancho}x${alto}cm)`;
      }

      const costoT = parseFloat(t.costo || 0);
      const precioT = parseFloat(t.precio || 0);

=======
      
      let factor = cantidad;
      let detalleMedidas = '';
      
      // Verificar unidad del tercero
      const unidadT = t.unidad || 'unidad';
      if ((unidadT === 'm²' || unidadT === 'm2') && ancho > 0 && alto > 0) {
         factor = m2Totales; // Usar m² totales calculados arriba
         detalleMedidas = ` (${ancho}x${alto}cm)`;
      }
      
      const costoT = parseFloat(t.costo || 0);
      const precioT = parseFloat(t.precio || 0);
      
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
      const terceroItem = {
        id: Date.now().toString() + '_t',
        tipo: 'tercero',
        nombre: (t.nombre || 'Servicio') + detalleMedidas + ' (Vinculado)',
        empresa: t.empresaNombre || 'Sin empresa',
        cantidad: cantidad,
        ancho: ancho,
        alto: alto,
        factorCalculo: factor,
        costo: costoT,
        precioCliente: precioT,
        unidad: unidadT,
        totalCosto: factor * costoT,
        total: factor * precioT
      };
<<<<<<< HEAD

=======
      
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
      currentQuoteTerceros.push(terceroItem);
      console.log('[GREMIO] ✅ Tercero vinculado agregado:', terceroItem);
    }
  }

  const quoteItem = {
    id: Date.now().toString(),
    tipo: 'material',
    categoria: categoriaProducto,
    producto: nombreProducto,
    ancho,
    alto,
    cantidad,
    m2PorUnidad,
    m2Totales,
    costoMaterial: currentCostoMaterial,
    costoUnitario,
    costoTotal: totalCosto,
    precioGremio: currentPrecioGremio,
    precioUnitario,
    total: totalPrecio
  };

  console.log('[GREMIO] ✅ Producto agregado:', quoteItem);
  currentQuoteProducts.push(quoteItem);
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  window.MRModals.close(document.getElementById('productModal'));
  resetCalculos();
  document.getElementById('productCategory').value = '';
  document.getElementById('productName').value = '';
  const priceInfo = document.getElementById('priceInfo');
  if (priceInfo) priceInfo.style.display = 'none';
  if (document.getElementById('productModalTercero')) {
    document.getElementById('productModalTercero').value = '';
    document.getElementById('productModalTerceroInfo').style.display = 'none';
  }
<<<<<<< HEAD

  renderQuoteProducts();
  calculateTotals();
  renderTerceros(); // Actualizar lista de terceros también

=======
  
  renderQuoteProducts();
  calculateTotals();
  renderTerceros(); // Actualizar lista de terceros también
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  alert('✅ Material agregado');
}

// ==================== TERCEROS ====================

function populateTerceros() {
  const select = document.getElementById('terceroService');
  if (!select) {
    console.error('[GREMIO] ❌ Select terceroService no encontrado');
    return;
  }
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (terceros.length === 0) {
    select.innerHTML = '<option value="">No hay terceros configurados</option>';
    select.disabled = true;
    return;
  }
<<<<<<< HEAD

  select.innerHTML = '<option value="">Seleccionar servicio...</option>' +
=======
  
  select.innerHTML = '<option value="">Seleccionar servicio...</option>' + 
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    terceros.map((t, index) => {
      const nombreServicio = t.nombre || 'Sin nombre';
      const empresaNombre = t.empresaNombre || 'Sin empresa';
      return `<option value="${index}">${nombreServicio} (${empresaNombre})</option>`;
    }).join('');
<<<<<<< HEAD

  select.disabled = false;
  console.log('[GREMIO] ✅ Terceros poblados:', terceros.length);

=======
  
  select.disabled = false;
  console.log('[GREMIO] ✅ Terceros poblados:', terceros.length);
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Poblar también el selector incrustado en modal de productos
  const selectEmbedded = document.getElementById('productModalTercero');
  if (selectEmbedded) {
    if (terceros.length === 0) {
      selectEmbedded.innerHTML = '<option value="">No hay terceros configurados</option>';
    } else {
<<<<<<< HEAD
      selectEmbedded.innerHTML = '<option value="">-- Ninguno --</option>' +
=======
      selectEmbedded.innerHTML = '<option value="">-- Ninguno --</option>' + 
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
        terceros.map((t, index) => {
          const nombreServicio = t.nombre || 'Sin nombre';
          const empresaNombre = t.empresaNombre || 'Sin empresa';
          return `<option value="${index}">${nombreServicio} (${empresaNombre})</option>`;
        }).join('');
    }
    // Listener para mostrar info
<<<<<<< HEAD
    selectEmbedded.onchange = function () {
=======
    selectEmbedded.onchange = function() {
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
      const info = document.getElementById('productModalTerceroInfo');
      if (this.value && terceros[this.value]) {
        const t = terceros[this.value];
        info.textContent = `Costo: $${formatCurrency(t.costo)} | Venta: $${formatCurrency(t.precio)} (${t.unidad || 'u'})`;
        info.style.display = 'block';
      } else {
        info.style.display = 'none';
      }
    };
  }
}

<<<<<<< HEAD
window.loadTerceroPrice = function () {
  const select = document.getElementById('terceroService');
  const terceroIndex = parseInt(select.value);

=======
window.loadTerceroPrice = function() {
  const select = document.getElementById('terceroService');
  const terceroIndex = parseInt(select.value);
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (isNaN(terceroIndex) || terceroIndex < 0 || terceroIndex >= terceros.length) {
    document.getElementById('terceroCosto').value = '';
    document.getElementById('terceroPrecioCliente').value = '';
    return;
  }

  const tercero = terceros[terceroIndex];
<<<<<<< HEAD

  console.log('[TERCERO] Seleccionado:', tercero);

=======
  
  console.log('[TERCERO] Seleccionado:', tercero);
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  const costo = parseFloat(tercero.costo || 0);
  const precioVenta = parseFloat(tercero.precio || 0);
  const costoMaterial = parseFloat(tercero.costoMaterial || 0);
  const precioMaterial = parseFloat(tercero.precioMaterial || 0);
<<<<<<< HEAD

  document.getElementById('terceroCosto').value = costo.toFixed(2);
  document.getElementById('terceroPrecioCliente').value = precioVenta.toFixed(2);

  // Mostrar/Ocultar dimensiones según unidad
  const dimsContainer = document.getElementById('terceroDimensiones');
  const unidad = tercero.unidad || 'unidad';

=======
  
  document.getElementById('terceroCosto').value = costo.toFixed(2);
  document.getElementById('terceroPrecioCliente').value = precioVenta.toFixed(2);
  
  // Mostrar/Ocultar dimensiones según unidad
  const dimsContainer = document.getElementById('terceroDimensiones');
  const unidad = tercero.unidad || 'unidad';
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (dimsContainer) {
    if (unidad === 'm²' || unidad === 'm2') {
      dimsContainer.style.display = 'grid';
      // Si hay un producto principal seleccionado, copiar sus medidas por defecto
      if (document.getElementById('productAncho')?.value) document.getElementById('terceroAncho').value = document.getElementById('productAncho').value;
      if (document.getElementById('productAlto')?.value) document.getElementById('terceroAlto').value = document.getElementById('productAlto').value;
    } else {
      dimsContainer.style.display = 'none';
      document.getElementById('terceroAncho').value = '';
      document.getElementById('terceroAlto').value = '';
    }
  }
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Mostrar/Ocultar input de material extra
  const matGroup = document.getElementById('terceroMaterialGroup');
  if (matGroup) {
    if (costoMaterial > 0 || precioMaterial > 0) {
      matGroup.style.display = 'block';
      document.getElementById('terceroCantMaterial').value = '1';
    } else {
      matGroup.style.display = 'none';
    }
  }
<<<<<<< HEAD

  console.log('[TERCERO] Precios cargados:', { costo, precioVenta });

  calcularTotalTercero();
};

window.calcularTotalTercero = function () {
  let cantidad = parseFloat(document.getElementById('terceroQuantity').value) || 0;
  const costo = parseFloat(document.getElementById('terceroCosto').value) || 0;
  const precioCliente = parseFloat(document.getElementById('terceroPrecioCliente').value) || 0;

=======
  
  console.log('[TERCERO] Precios cargados:', { costo, precioVenta });
  
  calcularTotalTercero();
};

window.calcularTotalTercero = function() {
  let cantidad = parseFloat(document.getElementById('terceroQuantity').value) || 0;
  const costo = parseFloat(document.getElementById('terceroCosto').value) || 0;
  const precioCliente = parseFloat(document.getElementById('terceroPrecioCliente').value) || 0;
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Material extra
  const select = document.getElementById('terceroService');
  const tercero = terceros[select.value] || {};
  const costoMaterial = parseFloat(tercero.costoMaterial || 0);
  const precioMaterial = parseFloat(tercero.precioMaterial || 0);
  const cantMaterial = parseFloat(document.getElementById('terceroCantMaterial')?.value) || 0;
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Verificar si usamos dimensiones
  const ancho = parseFloat(document.getElementById('terceroAncho')?.value) || 0;
  const alto = parseFloat(document.getElementById('terceroAlto')?.value) || 0;
  const dimsVisible = document.getElementById('terceroDimensiones')?.style.display !== 'none';

  let factor = cantidad; // Por defecto es la cantidad (unidades)

  if (dimsVisible && ancho > 0 && alto > 0) {
    // Si es por m², el factor es (m² * cantidad de copias)
    const m2 = (ancho * alto) / 10000;
    factor = m2 * cantidad;
    // Mostrar info visual
    const info = document.getElementById('terceroInfo') || createTerceroInfo();
    info.textContent = `${ancho}x${alto}cm = ${m2.toFixed(2)}m² x ${cantidad}u = ${factor.toFixed(2)}m² totales`;
  } else {
    const info = document.getElementById('terceroInfo');
    if (info) info.textContent = '';
  }

  let totalCosto = factor * costo;
  let totalPrecio = factor * precioCliente;
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Sumar material si aplica
  if (costoMaterial > 0 || precioMaterial > 0) {
    totalCosto += (costoMaterial * cantMaterial);
    totalPrecio += (precioMaterial * cantMaterial);
  }
<<<<<<< HEAD

  console.log('[TERCERO] Cálculo:', { cantidad, costo, precioCliente, totalCosto, totalPrecio });

=======
  
  console.log('[TERCERO] Cálculo:', { cantidad, costo, precioCliente, totalCosto, totalPrecio });
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  document.getElementById('terceroTotalCosto').textContent = '$' + formatCurrency(totalCosto);
  document.getElementById('terceroTotal').textContent = '$' + formatCurrency(totalPrecio);
};

function createTerceroInfo() {
  const div = document.createElement('div');
  div.id = 'terceroInfo';
  div.style.fontSize = '0.85rem';
  div.style.color = '#666';
  div.style.marginBottom = '10px';
  div.style.textAlign = 'right';
  const parent = document.getElementById('terceroTotal').parentNode;
  parent.insertBefore(div, document.getElementById('terceroTotal'));
  return div;
}

function addTerceroToQuote() {
  const select = document.getElementById('terceroService');
  const terceroIndex = parseInt(select.value);
  const cantidad = parseFloat(document.getElementById('terceroQuantity').value);
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (isNaN(terceroIndex) || !cantidad) {
    alert('⚠️ Completa todos los campos');
    return;
  }

  const tercero = terceros[terceroIndex];
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  const nombreTercero = tercero.nombre || 'Servicio sin nombre';
  const empresaNombre = tercero.empresaNombre || 'Sin empresa';
  const costo = parseFloat(tercero.costo || 0);
  const precioVenta = parseFloat(tercero.precio || 0);
  const unidad = tercero.unidad || tercero.unit || 'unidad';
  const costoMaterial = parseFloat(tercero.costoMaterial || 0);
  const precioMaterial = parseFloat(tercero.precioMaterial || 0);
  const cantMaterial = parseFloat(document.getElementById('terceroCantMaterial')?.value) || 0;
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Recalcular totales finales para guardar
  const ancho = parseFloat(document.getElementById('terceroAncho')?.value) || 0;
  const alto = parseFloat(document.getElementById('terceroAlto')?.value) || 0;
  const dimsVisible = document.getElementById('terceroDimensiones')?.style.display !== 'none';
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  let factor = cantidad;
  let detalleMedidas = '';

  if (dimsVisible && ancho > 0 && alto > 0) {
    const m2 = (ancho * alto) / 10000;
    factor = m2 * cantidad;
    detalleMedidas = ` (${ancho}x${alto}cm)`;
  }

  let totalCosto = factor * costo;
  let totalPrecio = factor * precioVenta;
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  let detalleMaterial = '';
  if (costoMaterial > 0 || precioMaterial > 0) {
    totalCosto += (costoMaterial * cantMaterial);
    totalPrecio += (precioMaterial * cantMaterial);
    detalleMaterial = ` + ${cantMaterial} Placa(s)`;
  }

  const terceroItem = {
    id: Date.now().toString(),
    tipo: 'tercero',
    nombre: nombreTercero + detalleMedidas + detalleMaterial,
    empresa: empresaNombre,
    cantidad,
    ancho: dimsVisible ? ancho : 0,
    alto: dimsVisible ? alto : 0,
    factorCalculo: factor, // m² totales o unidades totales
    costo,
    precioCliente: precioVenta,
    unidad,
    totalCosto,
    total: totalPrecio
  };

  console.log('[GREMIO] ✅ Tercero agregado:', terceroItem);
  currentQuoteTerceros.push(terceroItem);
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  window.MRModals.close(document.getElementById('terceroServiceModal'));
  document.getElementById('terceroService').value = '';
  document.getElementById('terceroQuantity').value = '';
  document.getElementById('terceroCosto').value = '';
  document.getElementById('terceroPrecioCliente').value = '';
<<<<<<< HEAD
  if (document.getElementById('terceroAncho')) document.getElementById('terceroAncho').value = '';
  if (document.getElementById('terceroAlto')) document.getElementById('terceroAlto').value = '';
  document.getElementById('terceroTotalCosto').textContent = '$0.00';
  document.getElementById('terceroTotal').textContent = '$0.00';

  renderTerceros();
  calculateTotals();

=======
  if(document.getElementById('terceroAncho')) document.getElementById('terceroAncho').value = '';
  if(document.getElementById('terceroAlto')) document.getElementById('terceroAlto').value = '';
  document.getElementById('terceroTotalCosto').textContent = '$0.00';
  document.getElementById('terceroTotal').textContent = '$0.00';
  
  renderTerceros();
  calculateTotals();
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  alert('✅ Servicio agregado');
}

// ==================== RENDERIZAR ====================

function renderQuoteProducts() {
  const container = document.getElementById('productsList');
<<<<<<< HEAD

  if (!container) return;

=======
  
  if (!container) return;
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (currentQuoteProducts.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay productos agregados</p>';
    return;
  }

  container.innerHTML = currentQuoteProducts.map(item => `
    <div class="product-card" style="background: rgba(81, 207, 102, 0.05); border: 1px solid rgba(81, 207, 102, 0.2);">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
        <div>
          <h3 style="margin: 0 0 0.5rem 0; color: #51CF66;">${item.producto}</h3>
          <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">📁 ${item.categoria}</p>
        </div>
        <button class="btn btn-danger btn-small" onclick="removeProduct('${item.id}')">🗑️</button>
      </div>
      
      <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.8rem;">
          <div>
            <span style="color: var(--text-secondary); font-size: 0.9rem;">Medidas:</span>
            <p style="margin: 0; font-weight: bold;">${item.ancho} cm × ${item.alto} cm</p>
          </div>
          <div>
            <span style="color: var(--text-secondary); font-size: 0.9rem;">Cantidad:</span>
            <p style="margin: 0; font-weight: bold;">${item.cantidad} unidad(es)</p>
          </div>
          <div>
            <span style="color: var(--text-secondary); font-size: 0.9rem;">m² totales:</span>
            <p style="margin: 0; font-weight: bold;">${formatM2(item.m2Totales)} m²</p>
          </div>
          <div>
            <span style="color: var(--text-secondary); font-size: 0.9rem;">Tu costo:</span>
            <p style="margin: 0; font-weight: bold; color: #FF6B6B;">$${formatCurrency(item.costoTotal)}</p>
          </div>
        </div>
        
        <div style="border-top: 2px solid rgba(81, 207, 102, 0.3); padding-top: 0.8rem; margin-top: 0.8rem;">
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: bold;">TOTAL CLIENTE:</span>
            <span style="color: #51CF66; font-size: 1.3rem; font-weight: bold;">$${formatCurrency(item.total)}</span>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

<<<<<<< HEAD
window.removeProduct = function (id) {
=======
window.removeProduct = function(id) {
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (!confirm('¿Eliminar?')) return;
  currentQuoteProducts = currentQuoteProducts.filter(p => p.id !== id);
  renderQuoteProducts();
  calculateTotals();
};

function renderTerceros() {
  const container = document.getElementById('terceroServicesList');
<<<<<<< HEAD

  if (!container) return;

=======
  
  if (!container) return;
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (currentQuoteTerceros.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay servicios agregados</p>';
    return;
  }

  container.innerHTML = currentQuoteTerceros.map(item => `
    <div class="product-card" style="background: rgba(78, 205, 196, 0.05); border: 1px solid rgba(78, 205, 196, 0.2);">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div>
          <h3 style="margin: 0 0 0.5rem 0; color: #4ECDC4;">${item.nombre} <small style="color: #aaa; font-size: 0.8em;">(${item.empresa || 'Sin empresa'})</small></h3>
          <p style="margin: 0;">Cantidad: ${item.cantidad} ${item.unidad}</p>
          <p style="margin: 0; color: #FF6B6B;">Tu costo: $${formatCurrency(item.totalCosto)}</p>
          <p style="margin: 0; color: #51CF66;"><strong>Cobras: $${formatCurrency(item.total)}</strong></p>
        </div>
        <button class="btn btn-danger btn-small" onclick="removeTercero('${item.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

<<<<<<< HEAD
window.removeTercero = function (id) {
=======
window.removeTercero = function(id) {
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (!confirm('¿Eliminar?')) return;
  currentQuoteTerceros = currentQuoteTerceros.filter(t => t.id !== id);
  renderTerceros();
  calculateTotals();
};

// ==================== TOTALES ====================

function calculateTotals() {
  const costoMateriales = currentQuoteProducts.reduce((sum, p) => sum + (p.costoTotal || 0), 0);
  const costoTerceros = currentQuoteTerceros.reduce((sum, t) => sum + (t.totalCosto || 0), 0);
  const totalCostos = costoMateriales + costoTerceros;

  const subtotalProductos = currentQuoteProducts.reduce((sum, p) => sum + (p.total || 0), 0);
  const subtotalTerceros = currentQuoteTerceros.reduce((sum, t) => sum + (t.total || 0), 0);
  const subtotal = subtotalProductos + subtotalTerceros;
  const iva = subtotal * 0.21;
  const total = subtotal + iva;

  const ganancia = total - totalCostos;

  console.log('[TOTALES]', { costoMateriales, costoTerceros, totalCostos, subtotal, iva, total, ganancia });

  // Guardar totales numéricos para uso interno (guardado)
  currentTotals = {
    costoTotal: totalCostos,
    subtotal: subtotal,
    iva: iva,
    totalCliente: total,
    ganancia: ganancia
  };

  const elements = {
    costoMateriales: formatCurrency(costoMateriales),
    costoTerceros: formatCurrency(costoTerceros),
    totalCostos: formatCurrency(totalCostos),
    subtotal: formatCurrency(subtotal),
    iva: formatCurrency(iva),
    total: formatCurrency(total),
    gananciaNetaDisplay: formatCurrency(ganancia)
  };

  Object.keys(elements).forEach(id => {
    const elem = document.getElementById(id);
    if (elem) elem.textContent = '$' + elements[id]; // formatCurrency ya devuelve el número formateado
  });

  calcularSaldo();
}

<<<<<<< HEAD
window.calcularSaldo = function () {
=======
window.calcularSaldo = function() {
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Usar el valor numérico real almacenado en currentTotals
  const total = currentTotals.totalCliente || 0;
  const anticipo = parseFloat(document.getElementById('montoAnticipo')?.value) || 0;
  const saldo = total - anticipo;
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  const saldoElem = document.getElementById('saldoPendiente');
  if (saldoElem) {
    saldoElem.textContent = '$' + formatCurrency(saldo);
  }
};

// ==================== GUARDAR/LIMPIAR ====================

<<<<<<< HEAD
window.saveQuote = async function () {
  const clientName = document.getElementById('clientName')?.value.trim();

=======
window.saveQuote = async function() {
  const clientName = document.getElementById('clientName')?.value.trim();
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (!currentClientId) {
    alert('⚠️ Error: No hay un cliente cargado. Por favor busca o guarda el cliente primero.');
    return;
  }

  const hasMulti = window.multiCategoryManager && window.multiCategoryManager.getCategories().length > 0;

  if (currentQuoteProducts.length === 0 && currentQuoteTerceros.length === 0 && !hasMulti) {
    alert('⚠️ Agrega al menos un producto');
    return;
  }

  // Usar valores numéricos de currentTotals en lugar de parsear el DOM formateado
  const costoTotal = currentTotals.costoTotal;
  const totalCliente = currentTotals.totalCliente;
  const ganancia = currentTotals.ganancia;
  const anticipo = parseFloat(document.getElementById('montoAnticipo')?.value) || 0;
  const saldo = totalCliente - anticipo;

  const quote = {
    id: Date.now().toString(),
    clientId: currentClientId, // Vinculamos la cotización al ID del cliente
    cliente: {
      nombre: clientName,
      telefono: document.getElementById('clientPhone')?.value || '',
      email: document.getElementById('clientEmail')?.value || '',
      direccion: document.getElementById('clientAddress')?.value || ''
    },
    productos: currentQuoteProducts,
    terceros: currentQuoteTerceros,
    multiCategories: window.multiCategoryManager ? window.multiCategoryManager.exportState() : null,
    costoTotal,
    subtotal: currentTotals.subtotal,
    iva: currentTotals.iva,
    totalCliente,
    ganancia,
    anticipo,
    saldo,
    fecha: new Date().toISOString(),
    estado: 'pendiente'
  };

  // Guardar en el servidor
  try {
    const cotizaciones = await window.mrDataManager.getGremioCotizaciones();
    cotizaciones.push(quote);
    const success = await window.mrDataManager.saveGremioCotizaciones(cotizaciones);
<<<<<<< HEAD

=======
    
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    if (success) {
      alert('✅ Cotización guardada en el servidor');
      clearQuote();
      await loadQuotations();
    } else {
      alert('❌ Error al guardar la cotización en el servidor.');
    }
  } catch (error) {
    console.error('[GREMIO] Error guardando:', error);
    alert('❌ Error al guardar');
  }
};

<<<<<<< HEAD
window.clearQuote = function () {
  currentQuoteProducts = [];
  currentQuoteTerceros = [];
  currentClientId = null; // Resetear cliente para obligar a cargar uno nuevo

  if (window.multiCategoryManager) {
    window.multiCategoryManager.clearCategories();
  }

=======
window.clearQuote = function() {
  currentQuoteProducts = [];
  currentQuoteTerceros = [];
  currentClientId = null; // Resetear cliente para obligar a cargar uno nuevo
  
  if (window.multiCategoryManager) {
      window.multiCategoryManager.clearCategories();
  }
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  const fields = ['clientName', 'clientPhone', 'clientEmail', 'clientAddress', 'montoAnticipo'];
  fields.forEach(id => {
    const elem = document.getElementById(id);
    if (elem) elem.value = '';
  });
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  renderQuoteProducts();
  renderTerceros();
  calculateTotals();
};

<<<<<<< HEAD
window.generatePDF = async function () {
=======
window.generatePDF = async function() {
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (!window.jspdf) {
    alert('⚠️ Error: La librería PDF no se ha cargado correctamente.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Helper para cargar imagen
  const loadImage = (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = url;
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
    });
  };
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Configuración básica
  const margin = 20;
  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // --- ENCABEZADO CON LOGO ---
  const fecha = new Date().toLocaleDateString();
  const logoUrl = 'img/logo.png';
  const logoData = await loadImage(logoUrl);

  if (logoData) {
<<<<<<< HEAD
    const imgProps = doc.getImageProperties(logoData);
    const imgWidth = 50; // 50mm de ancho
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    doc.addImage(logoData, 'PNG', margin, y, imgWidth, imgHeight);

    // Info Empresa a la derecha
    doc.setFontSize(24);
    doc.setTextColor(0, 168, 204);
    doc.text('MR Letreros', pageWidth - margin, y + 10, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Soluciones Gráficas Integrales', pageWidth - margin, y + 16, { align: 'right' });
    doc.text(`Fecha: ${fecha}`, pageWidth - margin, y + 22, { align: 'right' });

    y += Math.max(imgHeight, 25) + 10;
  } else {
    // Fallback texto si falla la imagen
    doc.setFontSize(22);
    doc.setTextColor(0, 168, 204);
    doc.text('MR Letreros', margin, y);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Soluciones Gráficas Integrales', margin, y + 6);

    doc.setTextColor(0);
    doc.text(`Fecha: ${fecha}`, pageWidth - margin - 40, y);
    y += 20;
=======
      const imgProps = doc.getImageProperties(logoData);
      const imgWidth = 50; // 50mm de ancho
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      doc.addImage(logoData, 'PNG', margin, y, imgWidth, imgHeight);
      
      // Info Empresa a la derecha
      doc.setFontSize(24);
      doc.setTextColor(0, 168, 204);
      doc.text('MR Letreros', pageWidth - margin, y + 10, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('Soluciones Gráficas Integrales', pageWidth - margin, y + 16, { align: 'right' });
      doc.text(`Fecha: ${fecha}`, pageWidth - margin, y + 22, { align: 'right' });
      
      y += Math.max(imgHeight, 25) + 10;
  } else {
      // Fallback texto si falla la imagen
      doc.setFontSize(22);
      doc.setTextColor(0, 168, 204);
      doc.text('MR Letreros', margin, y);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('Soluciones Gráficas Integrales', margin, y + 6);
      
      doc.setTextColor(0);
      doc.text(`Fecha: ${fecha}`, pageWidth - margin - 40, y);
      y += 20;
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  }

  // Línea separadora decorativa
  doc.setDrawColor(0, 168, 204);
  doc.setLineWidth(1);
  doc.line(margin, y - 5, pageWidth - margin, y - 5);
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0);
  doc.text('PRESUPUESTO', margin, y);
  doc.setFont(undefined, 'normal');
<<<<<<< HEAD

  y += 10;

=======
  
  y += 10;
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // --- DATOS DEL CLIENTE ---
  const clientName = document.getElementById('clientName')?.value || 'Cliente General';
  const clientPhone = document.getElementById('clientPhone')?.value || '';
  const clientEmail = document.getElementById('clientEmail')?.value || '';
<<<<<<< HEAD

  doc.setFontSize(11);
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, pageWidth - (margin * 2), 25, 'F');

  doc.text(`Cliente: ${clientName}`, margin + 5, y + 7);
  if (clientPhone) doc.text(`Teléfono: ${clientPhone}`, margin + 5, y + 14);
  if (clientEmail) doc.text(`Email: ${clientEmail}`, margin + 5, y + 21);

  y += 35;

=======
  
  doc.setFontSize(11);
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, pageWidth - (margin * 2), 25, 'F');
  
  doc.text(`Cliente: ${clientName}`, margin + 5, y + 7);
  if (clientPhone) doc.text(`Teléfono: ${clientPhone}`, margin + 5, y + 14);
  if (clientEmail) doc.text(`Email: ${clientEmail}`, margin + 5, y + 21);
  
  y += 35;
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // --- DETALLE DE PRODUCTOS ---
  doc.setFontSize(12);
  doc.text('Detalle:', margin, y);
  y += 8;
<<<<<<< HEAD

  doc.setFontSize(10);

=======
  
  doc.setFontSize(10);
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Función auxiliar para agregar líneas
  const addLine = (desc, price) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(desc, margin, y);
    doc.text(price, pageWidth - margin, y, { align: 'right' });
    y += 7;
  };
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // 1. Productos Tradicionales
  if (currentQuoteProducts.length > 0) {
    currentQuoteProducts.forEach(p => {
      const desc = `• ${p.producto} (${p.ancho}x${p.alto}cm) x ${p.cantidad}u`;
      const price = `$${formatCurrency(p.total)}`;
      addLine(desc, price);
    });
  }
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // 2. Servicios de Terceros
  if (currentQuoteTerceros.length > 0) {
    currentQuoteTerceros.forEach(t => {
      const desc = `• ${t.nombre} (${t.cantidad} ${t.unidad || 'u'})`;
      const price = `$${formatCurrency(t.total)}`;
      addLine(desc, price);
    });
  }
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // 3. Categorías Múltiples
  if (window.multiCategoryManager) {
    const cats = window.multiCategoryManager.getCategories();
    if (cats.length > 0) {
      // Mostrar dimensiones compartidas si existen
      const dims = window.multiCategoryManager.getSharedDimensions();
      if (dims.totalM2 > 0) {
<<<<<<< HEAD
        doc.setFont(undefined, 'italic');
        addLine(`Medidas Generales: ${dims.width}m x ${dims.height}m (${dims.totalM2.toFixed(2)} m²)`, '');
        doc.setFont(undefined, 'normal');
=======
         doc.setFont(undefined, 'italic');
         addLine(`Medidas Generales: ${dims.width}m x ${dims.height}m (${dims.totalM2.toFixed(2)} m²)`, '');
         doc.setFont(undefined, 'normal');
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
      }

      cats.forEach(c => {
        const desc = `• ${c.name}`;
        const price = `$${formatCurrency(c.totalPrice)}`;
        addLine(desc, price);
      });
<<<<<<< HEAD

=======
      
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
      const ink = window.multiCategoryManager.calculateInkTotals();
      if (window.multiCategoryManager.inkPriceEnabled && ink.totalPrice > 0) {
        addLine(`• Costo de Tinta`, `$${formatCurrency(ink.totalPrice)}`);
      }
    }
  }
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  y += 5;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;
<<<<<<< HEAD

  // --- TOTALES ---
  const xLabel = pageWidth - margin - 60;
  const xValue = pageWidth - margin;

  if (currentTotals.subtotal > 0) {
    doc.text('Subtotal:', xLabel, y);
    doc.text(`$${formatCurrency(currentTotals.subtotal)}`, xValue, y, { align: 'right' });
    y += 7;
  }

  if (currentTotals.iva > 0) {
    doc.text('IVA (21%):', xLabel, y);
    doc.text(`$${formatCurrency(currentTotals.iva)}`, xValue, y, { align: 'right' });
    y += 7;
  }

=======
  
  // --- TOTALES ---
  const xLabel = pageWidth - margin - 60;
  const xValue = pageWidth - margin;
  
  if (currentTotals.subtotal > 0) {
      doc.text('Subtotal:', xLabel, y);
      doc.text(`$${formatCurrency(currentTotals.subtotal)}`, xValue, y, { align: 'right' });
      y += 7;
  }
  
  if (currentTotals.iva > 0) {
      doc.text('IVA (21%):', xLabel, y);
      doc.text(`$${formatCurrency(currentTotals.iva)}`, xValue, y, { align: 'right' });
      y += 7;
  }
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('TOTAL:', xLabel, y);
  doc.text(`$${formatCurrency(currentTotals.totalCliente)}`, xValue, y, { align: 'right' });
<<<<<<< HEAD

  // Anticipo
  const anticipo = parseFloat(document.getElementById('montoAnticipo')?.value) || 0;
  if (anticipo > 0) {
    y += 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Anticipo:', xLabel, y);
    doc.text(`$${formatCurrency(anticipo)}`, xValue, y, { align: 'right' });

    y += 7;
    doc.setFont(undefined, 'bold');
    doc.text('RESTANTE:', xLabel, y);
    doc.text(`$${formatCurrency(currentTotals.totalCliente - anticipo)}`, xValue, y, { align: 'right' });
  }

=======
  
  // Anticipo
  const anticipo = parseFloat(document.getElementById('montoAnticipo')?.value) || 0;
  if (anticipo > 0) {
      y += 10;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text('Anticipo:', xLabel, y);
      doc.text(`$${formatCurrency(anticipo)}`, xValue, y, { align: 'right' });
      
      y += 7;
      doc.setFont(undefined, 'bold');
      doc.text('RESTANTE:', xLabel, y);
      doc.text(`$${formatCurrency(currentTotals.totalCliente - anticipo)}`, xValue, y, { align: 'right' });
  }
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Pie de página
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Presupuesto válido por 15 días.', margin, 280);
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Guardar PDF
  doc.save(`Presupuesto_${clientName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
};

<<<<<<< HEAD
window.loadQuotations = async function () {
=======
window.loadQuotations = async function() {
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  try {
    cotizacionesGremio = await window.mrDataManager.getGremioCotizaciones() || [];
    cotizacionesGremio.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // Ordenar por fecha
    renderQuotations();
    updateStatistics();
    console.log('[GREMIO] Cotizaciones cargadas:', cotizacionesGremio.length);
  } catch (error) {
    console.error('[GREMIO] Error cargando cotizaciones:', error);
    cotizacionesGremio = [];
  }
};

function renderQuotations() {
  const container = document.getElementById('quotesList');
<<<<<<< HEAD

  if (!container) return;

  // Filtrar
  let filtered = cotizacionesGremio;
  if (filterName && filterName.trim() !== '') {
    const term = filterName.toLowerCase();
    filtered = cotizacionesGremio.filter(c => c.cliente.nombre.toLowerCase().includes(term));

    // Mostrar mensaje de filtro activo
    const msg = document.getElementById('historyFilterMsg');
    if (msg) {
      msg.style.display = 'block';
      document.getElementById('filterClientName').textContent = filterName;
    }
  } else {
    // Si no hay filtro, ordenamos y cortamos a las últimas 10 para no saturar, o mostramos todas?
    // El usuario dijo "tiene que ser del cliente seleccionado no de todos".
    // Así que si NO hay selección, podríamos mostrar mensaje vacío o las últimas 5 globales.
    // Tratemos de mostrar las últimos 5 globales como "Recientes"

    const msg = document.getElementById('historyFilterMsg');
    if (msg) msg.style.display = 'none';

    // Mostrar solo 5 recientes si no hay filtro activo
    filtered = cotizacionesGremio.slice(0, 5);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-state">No se encontraron cotizaciones</p>';
    return;
  }

  container.innerHTML = filtered.map(cot => {
    const estadoColor = cot.estado === 'aprobada' ? '#51CF66' : '#FFC107';
    const estadoTexto = cot.estado === 'aprobada' ? '✅ APROBADA' : '⏳ PENDIENTE';

    // Generar resumen de items
    let resumenItems = [];
    if (cot.productos) {
      cot.productos.forEach(p => {
        resumenItems.push(`${p.cantidad}x ${p.producto || 'Producto'}`);
      });
    }
    if (cot.terceros) {
      cot.terceros.forEach(t => {
        resumenItems.push(`${t.cantidad}x ${t.nombre || 'Servicio'}`);
      });
    }

    // Cortar resumen si es muy largo
    let resumenTexto = resumenItems.join(', ');
    if (resumenTexto.length > 80) resumenTexto = resumenTexto.substring(0, 80) + '...';
    if (!resumenTexto) resumenTexto = 'Sin items';

    return `
      <div class="product-card" style="padding: 1rem; border-left: 4px solid ${estadoColor};">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.1rem;">${cot.cliente.nombre}</h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">${new Date(cot.fecha).toLocaleDateString()}</p>
          </div>
          <div style="text-align: right;">
             <span style="color: ${estadoColor}; font-weight: bold; font-size: 0.8rem;">${estadoTexto}</span>
             <div style="font-weight: bold; font-size: 1.1rem;">$${formatCurrency(cot.totalCliente || 0)}</div>
          </div>
        </div>
        
        <div style="background: rgba(0, 0, 0, 0.2); padding: 0.5rem; border-radius: 4px; margin-bottom: 0.8rem; font-size: 0.85rem; color: #ccc;">
          ${resumenTexto}
        </div>
        
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button class="btn btn-primary btn-small" onclick="verDetalleCotizacion('${cot.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">👁️ Ver</button>
          ${cot.estado === 'pendiente' ? `
            <button class="btn btn-success btn-small" onclick="aprobarCotizacion('${cot.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">✅</button>
            <button class="btn btn-danger btn-small" onclick="borrarCotizacion('${cot.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">🗑️</button>
          ` : ''}
=======
  
  if (!container) return;
  
  if (cotizacionesGremio.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay cotizaciones</p>';
    return;
  }

  container.innerHTML = cotizacionesGremio.map(cot => {
    const estadoColor = cot.estado === 'aprobada' ? '#51CF66' : '#FFC107';
    const estadoTexto = cot.estado === 'aprobada' ? '✅ APROBADA' : '⏳ PENDIENTE';
    
    return `
      <div class="product-card">
        <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
          <div>
            <h3>${cot.cliente.nombre}</h3>
            <p style="color: var(--text-secondary);">${new Date(cot.fecha).toLocaleDateString()}</p>
          </div>
          <span style="color: ${estadoColor}; font-weight: bold;">${estadoTexto}</span>
        </div>
        
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
          <p>Total Cliente: <strong>$${formatCurrency(cot.totalCliente || 0)}</strong></p>
          <p>Ganancia: <strong style="color: #51CF66;">$${formatCurrency(cot.ganancia || 0)}</strong></p>
          ${cot.anticipo > 0 ? `<p>Anticipo: $${formatCurrency(cot.anticipo)}</p>` : ''}
          ${cot.anticipo > 0 ? `<p>Saldo: $${formatCurrency(cot.saldo)}</p>` : ''}
        </div>
        
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-primary btn-small" onclick="verDetalleCotizacion('${cot.id}')">👁️ Ver Detalle</button>
          ${cot.estado === 'pendiente' ? `
            <button class="btn btn-success btn-small" onclick="aprobarCotizacion('${cot.id}')">✅ Aprobar</button>
            <button class="btn btn-danger btn-small" onclick="borrarCotizacion('${cot.id}')">🗑️ Borrar</button>
          ` : `
            <button class="btn btn-secondary btn-small" disabled>✅ Aprobada</button>
          `}
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
        </div>
      </div>
    `;
  }).join('');
}

<<<<<<< HEAD
window.aprobarCotizacion = async function (id) {
=======
window.aprobarCotizacion = async function(id) {
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (!confirm('¿Aprobar cotización? Esto registrará los movimientos de ingresos y egresos.')) return;

  try {
    // 1. Actualizar la cotización
    const cotizaciones = await window.mrDataManager.getGremioCotizaciones();
    const cotizacion = cotizaciones.find(c => c.id === id);
<<<<<<< HEAD

=======
    
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    if (!cotizacion) {
      alert('❌ Cotización no encontrada.');
      return;
    }
<<<<<<< HEAD

    cotizacion.estado = 'aprobada';
    cotizacion.approved = true; // Compatibilidad con sistema de rendimientos
    cotizacion.fechaAprobacion = new Date().toISOString();

=======
    
    cotizacion.estado = 'aprobada';
    cotizacion.approved = true; // Compatibilidad con sistema de rendimientos
    cotizacion.fechaAprobacion = new Date().toISOString();
    
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    const successCot = await window.mrDataManager.saveGremioCotizaciones(cotizaciones);
    if (!successCot) {
      alert('❌ Error al actualizar el estado de la cotización.');
      return;
    }

    // 2. Registrar movimientos en Gastos/Rendimientos
    const gastos = await window.mrDataManager.getGastos();
    const fechaAprobacion = new Date().toISOString();
    const cotiIdShort = cotizacion.id.slice(-6);

    // Egreso por el costo total
    if (cotizacion.costoTotal > 0) {
      gastos.push({
        id: `gasto_coti_${cotizacion.id}`,
        tipo: 'egreso',
        descripcion: `Costo Total - Coti Gremio #${cotiIdShort} (${cotizacion.cliente.nombre})`,
        monto: cotizacion.costoTotal,
        fecha: fechaAprobacion,
        categoria: 'costo_venta_gremio'
      });
    }

    // Ingreso por el ANTICIPO (si existe)
    const montoIngreso = parseFloat(cotizacion.anticipo) || 0;
    if (montoIngreso > 0) {
<<<<<<< HEAD
      gastos.push({
        id: `ingreso_coti_${cotizacion.id}`,
        tipo: 'ingreso',
        descripcion: `Anticipo Gremio - Coti #${cotiIdShort} (${cotizacion.cliente.nombre})`,
        monto: montoIngreso,
        fecha: fechaAprobacion,
        categoria: 'venta_gremio'
      });
=======
        gastos.push({
          id: `ingreso_coti_${cotizacion.id}`,
          tipo: 'ingreso',
          descripcion: `Anticipo Gremio - Coti #${cotiIdShort} (${cotizacion.cliente.nombre})`,
          monto: montoIngreso,
          fecha: fechaAprobacion,
          categoria: 'venta_gremio'
        });
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    }

    // 3. Crear TRABAJO automáticamente
    let worksData = { works: [], notifications: [] };
    try {
<<<<<<< HEAD
      const response = await fetch('/api/trabajos');
      if (response.ok) {
        worksData = await response.json();
      }
=======
        const response = await fetch('/api/trabajos');
        if (response.ok) {
            worksData = await response.json();
        }
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    } catch (e) { console.warn('Error obteniendo trabajos del servidor:', e); }

    // Asegurar estructura
    if (!worksData || typeof worksData !== 'object') worksData = { works: [], notifications: [] };
    if (!Array.isArray(worksData.works)) worksData.works = [];

    // Valores seguros (Fallbacks)
    const clientName = cotizacion.cliente?.nombre || cotizacion.clientName || 'Cliente';
    const total = parseFloat(cotizacion.totalCliente || cotizacion.total || 0);
    const cost = parseFloat(cotizacion.costoTotal || 0);
    const profit = parseFloat(cotizacion.ganancia || 0);
    const balance = total - montoIngreso;

    const newWork = {
<<<<<<< HEAD
      id: `work_${Date.now()}`,
      quoteId: cotizacion.id,
      clientName: clientName,
      clientPhone: cotizacion.cliente?.telefono || '',
      clientEmail: cotizacion.cliente?.email || '',
      clientAddress: cotizacion.cliente?.direccion || '',
      total: total,
      totalCost: cost,
      profit: profit,
      paidAmount: montoIngreso,
      balance: balance,
      status: 'pending', // Estado inicial del trabajo
      paymentStatus: (montoIngreso >= total - 1) ? 'paid' : 'pending',
      priority: 'normal',
      createdAt: new Date().toISOString(),
      timeline: [{ type: 'created', description: 'Trabajo creado automáticamente desde Gremio', timestamp: new Date().toISOString() }],
      notes: []
    };
    worksData.works.push(newWork);

    // Guardar directamente en el servidor
    const res = await fetch('/api/trabajos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(worksData)
=======
        id: `work_${Date.now()}`,
        quoteId: cotizacion.id,
        clientName: clientName,
        clientPhone: cotizacion.cliente?.telefono || '',
        clientEmail: cotizacion.cliente?.email || '',
        clientAddress: cotizacion.cliente?.direccion || '',
        total: total,
        totalCost: cost,
        profit: profit,
        paidAmount: montoIngreso,
        balance: balance,
        status: 'pending', // Estado inicial del trabajo
        paymentStatus: (montoIngreso >= total - 1) ? 'paid' : 'pending',
        priority: 'normal',
        createdAt: new Date().toISOString(),
        timeline: [{ type: 'created', description: 'Trabajo creado automáticamente desde Gremio', timestamp: new Date().toISOString() }],
        notes: []
    };
    worksData.works.push(newWork);
    
    // Guardar directamente en el servidor
    const res = await fetch('/api/trabajos', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify(worksData) 
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    });
    const json = await res.json();
    const saveSuccess = json.success;

    console.log('[GREMIO] Resultado guardado trabajo:', saveSuccess);

    const successGastos = await window.mrDataManager.saveGastos(gastos);
    if (!successGastos) {
      alert('⚠️ El estado de la cotización se actualizó, pero hubo un error al registrar los movimientos financieros.');
    }
<<<<<<< HEAD

    if (window.notifyWorkCreated) {
      window.notifyWorkCreated(newWork);
    } else {
      alert('✅ Cotización aprobada, Trabajo creado y movimientos registrados.');
=======
    
    if (window.notifyWorkCreated) {
        window.notifyWorkCreated(newWork);
    } else {
        alert('✅ Cotización aprobada, Trabajo creado y movimientos registrados.');
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    }
    await loadQuotations();
    updateStatistics();
  } catch (error) {
    console.error('[GREMIO] Error:', error);
    alert('❌ Error al aprobar');
  }
};

<<<<<<< HEAD
window.borrarCotizacion = async function (id) {
  if (!confirm('⚠️ ¿Estás seguro de eliminar esta cotización? Esta acción no se puede deshacer.')) return;

=======
window.borrarCotizacion = async function(id) {
  if (!confirm('⚠️ ¿Estás seguro de eliminar esta cotización? Esta acción no se puede deshacer.')) return;
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  try {
    const cotizaciones = await window.mrDataManager.getGremioCotizaciones();
    const filtered = cotizaciones.filter(c => c.id !== id);
    await window.mrDataManager.saveGremioCotizaciones(filtered);
    alert('🗑️ Cotización eliminada.');
    await loadQuotations();
    updateStatistics();
  } catch (error) {
    console.error('[GREMIO] Error al borrar:', error);
    alert('❌ Error al borrar');
  }
};

<<<<<<< HEAD
window.updateStatistics = function () { // Esta función ahora se llama desde loadQuotations
  const aprobadas = cotizacionesGremio.filter(c => c.estado === 'aprobada');
  const pendientes = cotizacionesGremio.filter(c => c.estado === 'pendiente');

  const totalAprobado = aprobadas.reduce((sum, c) => sum + (c.totalCliente || 0), 0);
  const totalGanancia = aprobadas.reduce((sum, c) => sum + (c.ganancia || 0), 0);

=======
window.updateStatistics = function() { // Esta función ahora se llama desde loadQuotations
  const aprobadas = cotizacionesGremio.filter(c => c.estado === 'aprobada');
  const pendientes = cotizacionesGremio.filter(c => c.estado === 'pendiente');
  
  const totalAprobado = aprobadas.reduce((sum, c) => sum + (c.totalCliente || 0), 0);
  const totalGanancia = aprobadas.reduce((sum, c) => sum + (c.ganancia || 0), 0);
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  const elem1 = document.getElementById('totalApproved');
  const elem2 = document.getElementById('totalGanancia');
  const elem3 = document.getElementById('countApproved');
  const elem4 = document.getElementById('countPending');
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (elem1) elem1.textContent = '$' + totalAprobado.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  if (elem2) elem2.textContent = '$' + totalGanancia.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  if (elem3) elem3.textContent = aprobadas.length;
  if (elem4) elem4.textContent = pendientes.length;
};

<<<<<<< HEAD
window.startNotificationPolling = function () {
  checkNotifications();
  setInterval(checkNotifications, 10000); // Revisar cada 10 segundos
};

async function checkNotifications() {
  try {
    // Usar fetch directo para evitar dependencias
    const response = await fetch('/api/trabajos');
    if (!response.ok) return;
    const data = await response.json();

    const unreadCount = (data.notifications || []).filter(n => !n.read).length;
    const badge = document.getElementById('notificationBadge');
    const btnTrabajos = document.getElementById('btnTrabajosNav');

    if (unreadCount > 0) {
      if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = 'block';
      }
      if (btnTrabajos) {
        btnTrabajos.style.backgroundColor = '#FFC107'; // Amarillo alerta
        btnTrabajos.style.color = '#000';
        btnTrabajos.innerHTML = `🔨 Trabajos <span style="background:red; color:white; border-radius:50%; padding:2px 6px; font-size:0.8em; margin-left:5px;">${unreadCount}</span>`;
      }
    } else {
      if (badge) badge.style.display = 'none';
      if (btnTrabajos) {
        btnTrabajos.style.backgroundColor = '';
        btnTrabajos.style.color = '';
        btnTrabajos.innerHTML = '🔨 Trabajos';
      }
    }
  } catch (e) { console.error('Error polling notifications:', e); }
=======
window.startNotificationPolling = function() {
    checkNotifications();
    setInterval(checkNotifications, 10000); // Revisar cada 10 segundos
};

async function checkNotifications() {
    try {
        // Usar fetch directo para evitar dependencias
        const response = await fetch('/api/trabajos');
        if (!response.ok) return;
        const data = await response.json();
        
        const unreadCount = (data.notifications || []).filter(n => !n.read).length;
        const badge = document.getElementById('notificationBadge');
        const btnTrabajos = document.getElementById('btnTrabajosNav');
        
        if (unreadCount > 0) {
            if (badge) {
                badge.textContent = unreadCount;
                badge.style.display = 'block';
            }
            if (btnTrabajos) {
                btnTrabajos.style.backgroundColor = '#FFC107'; // Amarillo alerta
                btnTrabajos.style.color = '#000';
                btnTrabajos.innerHTML = `🔨 Trabajos <span style="background:red; color:white; border-radius:50%; padding:2px 6px; font-size:0.8em; margin-left:5px;">${unreadCount}</span>`;
            }
        } else {
            if (badge) badge.style.display = 'none';
            if (btnTrabajos) {
                btnTrabajos.style.backgroundColor = '';
                btnTrabajos.style.color = '';
                btnTrabajos.innerHTML = '🔨 Trabajos';
            }
        }
    } catch (e) { console.error('Error polling notifications:', e); }
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
}

// ==================== VER DETALLE DE COTIZACIÓN ====================

<<<<<<< HEAD
window.verDetalleCotizacion = function (cotizacionId) {
  const cotizacion = cotizacionesGremio.find(c => c.id === cotizacionId);
  if (!cotizacion) {
    alert('❌ Cotización no encontrada');
    return;
  }

  // Crear modal si no existe
  let modal = document.getElementById('detalleCotizacionModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'detalleCotizacionModal';
    modal.className = 'modal';
    modal.innerHTML = `
=======
window.verDetalleCotizacion = function(cotizacionId) {
    const cotizacion = cotizacionesGremio.find(c => c.id === cotizacionId);
    if (!cotizacion) {
        alert('❌ Cotización no encontrada');
        return;
    }
    
    // Crear modal si no existe
    let modal = document.getElementById('detalleCotizacionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'detalleCotizacionModal';
        modal.className = 'modal';
        modal.innerHTML = `
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
            <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2 class="modal-title" id="detalleModalTitle">Detalle de Cotización</h2>
                    <button class="btn-close" onclick="cerrarDetalleCotizacion()">×</button>
                </div>
                <div class="modal-body" id="detalleModalBody">
                    <!-- Contenido dinámico -->
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="cerrarDetalleCotizacion()">Cerrar</button>
                </div>
            </div>
        `;
<<<<<<< HEAD
    document.body.appendChild(modal);
  }

  // Generar HTML del detalle
  const html = generarHTMLDetalleCotizacion(cotizacion);
  document.getElementById('detalleModalBody').innerHTML = html;
  document.getElementById('detalleModalTitle').textContent = `Cotización: ${cotizacion.cliente.nombre}`;

  // Mostrar modal
  modal.classList.add('active');
};

window.cerrarDetalleCotizacion = function () {
  const modal = document.getElementById('detalleCotizacionModal');
  if (modal) {
    modal.classList.remove('active');
  }
};

function generarHTMLDetalleCotizacion(cot) {
  const estadoColor = cot.estado === 'aprobada' ? '#51CF66' : '#FFC107';
  const estadoTexto = cot.estado === 'aprobada' ? '✅ APROBADA' : '⏳ PENDIENTE';

  return `
=======
        document.body.appendChild(modal);
    }
    
    // Generar HTML del detalle
    const html = generarHTMLDetalleCotizacion(cotizacion);
    document.getElementById('detalleModalBody').innerHTML = html;
    document.getElementById('detalleModalTitle').textContent = `Cotización: ${cotizacion.cliente.nombre}`;
    
    // Mostrar modal
    modal.classList.add('active');
};

window.cerrarDetalleCotizacion = function() {
    const modal = document.getElementById('detalleCotizacionModal');
    if (modal) {
        modal.classList.remove('active');
    }
};

function generarHTMLDetalleCotizacion(cot) {
    const estadoColor = cot.estado === 'aprobada' ? '#51CF66' : '#FFC107';
    const estadoTexto = cot.estado === 'aprobada' ? '✅ APROBADA' : '⏳ PENDIENTE';
    
    return `
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
        <div style="display: grid; gap: 1.5rem;">
            <!-- Estado y Fecha -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px;">
                <div>
                    <div style="font-size: 0.9rem; opacity: 0.7;">Estado</div>
                    <div style="font-size: 1.2rem; font-weight: bold; color: ${estadoColor};">${estadoTexto}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.9rem; opacity: 0.7;">Fecha</div>
                    <div style="font-size: 1.1rem;">${new Date(cot.fecha).toLocaleDateString('es-AR')}</div>
                </div>
            </div>
            
            <!-- Cliente -->
            <div>
                <h3 style="margin-bottom: 0.5rem; color: var(--primary-color);">👤 Información del Cliente</h3>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
                    <p><strong>Nombre:</strong> ${cot.cliente.nombre}</p>
                    ${cot.cliente.telefono ? `<p><strong>Teléfono:</strong> ${cot.cliente.telefono}</p>` : ''}
                    ${cot.cliente.email ? `<p><strong>Email:</strong> ${cot.cliente.email}</p>` : ''}
                    ${cot.cliente.direccion ? `<p><strong>Dirección:</strong> ${cot.cliente.direccion}</p>` : ''}
                    ${cot.fechaEntrega ? `<p><strong>Fecha de Entrega:</strong> ${new Date(cot.fechaEntrega).toLocaleDateString('es-AR')}</p>` : ''}
                </div>
            </div>
            
            <!-- Productos -->
            ${cot.productos && cot.productos.length > 0 ? `
                <div>
                    <h3 style="margin-bottom: 0.5rem; color: var(--primary-color);">📦 Productos</h3>
                    <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
                        ${cot.productos.map((p, idx) => `
                            <div style="padding: 0.75rem; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: ${idx < cot.productos.length - 1 ? '0.75rem' : '0'};">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                                    <div>
                                        <strong style="color: #51CF66;">${p.producto || p.categoria || 'Producto'}</strong>
                                        <div style="font-size: 0.85rem; opacity: 0.7; margin-top: 0.25rem;">
                                            ${p.categoria ? `Categoría: ${p.categoria}` : ''}
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 1.1rem; font-weight: bold; color: #51CF66;">
                                            $${formatCurrency(p.total || 0)}
                                        </div>
                                    </div>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem; font-size: 0.9rem;">
                                    ${p.cantidad ? `<div>Cantidad: <strong>${p.cantidad}</strong></div>` : ''}
                                    ${p.ancho ? `<div>Ancho: <strong>${p.ancho.toFixed(2)}m</strong></div>` : ''}
                                    ${p.alto ? `<div>Alto: <strong>${p.alto.toFixed(2)}m</strong></div>` : ''}
                                    ${p.m2PorUnidad ? `<div>m²/unidad: <strong>${p.m2PorUnidad.toFixed(2)}m²</strong></div>` : ''}
                                    ${p.m2Totales ? `<div>Total m²: <strong>${p.m2Totales.toFixed(2)}m²</strong></div>` : ''}
                                    ${p.precioGremio ? `<div>Precio/m²: <strong>$${formatCurrency(p.precioGremio)}</strong></div>` : ''}
                                </div>
                                ${p.costoTotal ? `
                                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem;">
                                        <span style="color: #FF6B6B;">Costo: $${formatCurrency(p.costoTotal)}</span>
                                        <span style="margin: 0 0.5rem;">•</span>
                                        <span style="color: #4CAF50;">Ganancia: $${formatCurrency((p.total || 0) - (p.costoTotal || 0))}</span>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Terceros -->
            ${cot.terceros && cot.terceros.length > 0 ? `
                <div>
                    <h3 style="margin-bottom: 0.5rem; color: var(--primary-color);">🔧 Servicios de Terceros</h3>
                    <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
                        ${cot.terceros.map((t, idx) => `
                            <div style="padding: 0.75rem; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: ${idx < cot.terceros.length - 1 ? '0.75rem' : '0'};">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                                    <div>
                                        <strong style="color: #51CF66;">${t.empresa || t.servicio || 'Servicio'}</strong>
                                        ${t.servicio && t.empresa !== t.servicio ? `
                                            <div style="font-size: 0.85rem; opacity: 0.7; margin-top: 0.25rem;">
                                                ${t.servicio}
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 1.1rem; font-weight: bold; color: #51CF66;">
                                            $${formatCurrency(t.total || 0)}
                                        </div>
                                    </div>
                                </div>
                                ${t.cantidad ? `<div style="font-size: 0.9rem;">Cantidad: <strong>${t.cantidad}</strong></div>` : ''}
                                ${t.costoTotal ? `
                                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem;">
                                        <span style="color: #FF6B6B;">Costo: $${formatCurrency(t.costoTotal)}</span>
                                        <span style="margin: 0 0.5rem;">•</span>
                                        <span style="color: #4CAF50;">Ganancia: $${formatCurrency((t.total || 0) - (t.costoTotal || 0))}</span>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Resumen Financiero -->
            <div>
                <h3 style="margin-bottom: 0.5rem; color: var(--primary-color);">💰 Resumen Financiero</h3>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Subtotal:</span>
                        <strong>$${formatCurrency(cot.subtotal || 0)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>IVA:</span>
                        <strong>$${formatCurrency(cot.iva || 0)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding-top: 0.5rem; border-top: 2px solid rgba(255,255,255,0.2); font-size: 1.2rem; margin-bottom: 1rem;">
                        <span style="font-weight: bold;">TOTAL CLIENTE:</span>
                        <strong style="color: #51CF66;">$${formatCurrency(cot.totalCliente || 0)}</strong>
                    </div>
                    
                    <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 0.75rem; margin-top: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span>Costo Total:</span>
                            <strong style="color: #FF6B6B;">$${formatCurrency(cot.costoTotal || 0)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 1.2rem;">
                            <span style="font-weight: bold;">GANANCIA:</span>
                            <strong style="color: #4CAF50;">$${formatCurrency(cot.ganancia || 0)}</strong>
                        </div>
                    </div>
                    
                    ${cot.anticipo > 0 ? `
                        <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 0.75rem; margin-top: 0.75rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span>Anticipo:</span>
                                <strong style="color: #FFC107;">$${formatCurrency(cot.anticipo)}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>Saldo:</span>
                                <strong>$${formatCurrency(cot.saldo || 0)}</strong>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

console.log('[GREMIO] 🚀 Script de red cargado');
