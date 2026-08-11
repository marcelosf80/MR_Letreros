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
window.currentClientId = null; // ID del cliente seleccionado
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

document.addEventListener('DOMContentLoaded', async function () {
  console.log('[GREMIO] 🚀 Inicializando con conexión al servidor...');

  // Esperar a que el dataManager se conecte
  if (!window.mrDataManager || !(await window.mrDataManager.checkConnection())) {
    console.error('[GREMIO] ❌ No se pudo conectar al servidor. La aplicación no funcionará.');
    // El dataManager ya muestra un error visual.
    return;
  }

  await loadAllData();
  setupEventListeners();
  await loadQuotations();
  updateStatistics();

  // Iniciar monitoreo de notificaciones
  startNotificationPolling();

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

  if (btnAddProduct) btnAddProduct.addEventListener('click', async () => {
    // Si hay nombre en el campo pero sin ID, auto-registrar cliente
    if (!window.currentClientId) {
      const name = document.getElementById('clientName')?.value.trim();
      if (!name) {
        alert('⚠️ Ingresá el nombre del cliente antes de cotizar.');
        return;
      }
      const autoClient = {
        id: 'gremio_cli_' + Date.now(),
        name, nombre: name,
        telefono: document.getElementById('clientPhone')?.value || '',
        email: document.getElementById('clientEmail')?.value || '',
        direccion: document.getElementById('clientAddress')?.value || '',
        tipo: 'gremio',
        fechaRegistro: new Date().toISOString()
      };
      try { await window.mrDataManager.saveGremioCliente(autoClient); } catch(e) {}
      window.currentClientId = autoClient.id;
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

  if (productCategory) productCategory.addEventListener('change', window.loadProductsByCategory);
  if (productName) productName.addEventListener('change', window.loadProductPrice);

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

  const terceroQuantityInput = document.getElementById('terceroQuantity');
  if (terceroQuantityInput) {
    terceroQuantityInput.addEventListener('input', window.calcularTotalTercero);
  }

  // --- CLIENTES (BUSCADOR Y GUARDADO) ---
  // 🛠️ FIX: Asegurar que existan los controles de cliente (Inyección Automática)
  ensureClientControlsExist();

  // 🛠️ FIX: Asegurar controles de medidas para terceros
  ensureTerceroInputs();

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
      // Cargar clientes (ahora unificados en el backend)
      const clients = await window.mrDataManager.getGremioClientes().catch(() => []);
      allClients = clients;
      window.allClients = clients; // exponer para override de selectClient
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

  container.innerHTML = `
    <div><label style="display:block; margin-bottom:5px; font-size:0.9rem;">Ancho (cm)</label><input type="number" id="terceroAncho" class="form-control" placeholder="0" style="width:100%; padding:8px;"></div>
    <div><label style="display:block; margin-bottom:5px; font-size:0.9rem;">Alto (cm)</label><input type="number" id="terceroAlto" class="form-control" placeholder="0" style="width:100%; padding:8px;"></div>
  `;

  quantityInput.parentNode.insertBefore(container, quantityInput);

  // Listeners para cálculo
  document.getElementById('terceroAncho').addEventListener('input', window.calcularTotalTercero);
  document.getElementById('terceroAlto').addEventListener('input', window.calcularTotalTercero);

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

  // Insertar antes de las dimensiones
  container.parentNode.insertBefore(matContainer, container);

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

  // Poblar inmediatamente
  populateTerceros();
}

// ==================== GESTIÓN DE CLIENTES ====================

function renderClientSearchList(clients) {
  const container = document.getElementById('clientSearchResults');
  if (!container) return;

  if (clients.length === 0) {
    container.innerHTML = '<p style="text-align: center; padding: 1rem;">No se encontraron clientes</p>';
    return;
  }

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
    window.currentClientId = client.id;
    // FIX: normalizar campo 'name' vs 'nombre' (gestión guarda 'nombre')
    const nombreMostrar = client.name || client.nombre || '';
    document.getElementById('clientName').value = nombreMostrar;
    if (document.getElementById('clientPhone')) document.getElementById('clientPhone').value = client.telefono || client.phone || '';
    if (document.getElementById('clientEmail')) document.getElementById('clientEmail').value = client.email || '';
    if (document.getElementById('clientAddress')) document.getElementById('clientAddress').value = client.direccion || client.address || '';

    window.MRModals.close(document.getElementById('searchClientModal'));
    
    if (window.updateClientActionButton) window.updateClientActionButton();
    if (window.onClientNameInput) window.onClientNameInput(nombreMostrar);
    
    alert(`✅ Cliente cargado: ${nombreMostrar}\nAhora puedes comenzar a cotizar.`);
  }
};

window.updateClientActionButton = function () {
  const btn = document.getElementById('btnSaveClient');
  if (btn) {
    if (window.currentClientId) {
      btn.innerHTML = '📝 Presupuestar';
      btn.className = 'btn btn-success btn-presupuestar'; 
    } else {
      btn.innerHTML = '💾 Guardar Cliente';
      btn.className = 'btn btn-primary btn-guardar-cliente';
    }
  }
};

window.saveNewClient = async function () {
  const name = document.getElementById('clientName').value.trim();
  if (!name) {
    alert('⚠️ Ingresa el nombre del cliente para guardarlo.');
    return;
  }

  const clientData = {
    name: name,       // compatibilidad con gremio-main y clientes-main
    nombre: name,     // compatibilidad con clientes-gestion-main
    telefono: document.getElementById('clientPhone')?.value || '',
    email: document.getElementById('clientEmail')?.value || '',
    direccion: document.getElementById('clientAddress')?.value || '',
    tipo: 'gremio'    // identificar origen para el gestor unificado
  };

  let result = null;

  if (window.currentClientId) {
    // ACTUALIZAR: Si ya hay un cliente cargado, actualizamos sus datos silenciosamente y presupuestamos
    result = await window.mrDataManager.updateGremioCliente(window.currentClientId, clientData);
    if (result) {
      window.updateClientActionButton();
      const productModal = document.getElementById('productModal');
      populateProductSelect();
      if (window.MRModals && productModal) window.MRModals.open(productModal);
    } else {
      alert('❌ Error al actualizar los datos del cliente.');
    }
  } else {
    // CREAR: Si no hay cliente, creamos uno nuevo
    clientData.id = 'gremio_cli_' + Date.now();
    clientData.fechaRegistro = new Date().toISOString();
    result = await window.mrDataManager.saveGremioCliente(clientData);
    if (result) {
      window.currentClientId = clientData.id;
      window.updateClientActionButton();
      alert(`✅ Cliente "${name}" guardado correctamente.\nYa puedes cotizar.`);
    } else {
      alert('❌ Error al guardar el cliente.');
    }
  }
};

// ==================== POBLAR SELECTOR DE PRODUCTOS ====================

async function populateProductSelect() {
  const selectCategoria = document.getElementById('productCategory');

  if (!selectCategoria) {
    console.error('[GREMIO] ❌ Select productCategory no encontrado');
    return;
  }

  // 1. Obtener categorías de productos existentes
  const categoriasProductos = [...new Set(window.preciosGremio.map(p => p.category || p.categoria))].filter(Boolean);

  // 2. Categorías de materiales (desde inventario/costos)
  const categoriasMateriales = [...new Set(window.listaCostos.map(m => m.category || m.categoria))].filter(Boolean);

  // 3. Obtener categorías guardadas (archivo gremio_categorias.json)
  let categoriasGuardadas = [];
  if (window.mrDataManager) {
    categoriasGuardadas = await window.mrDataManager.getCategorias();
  }

  // 4. Combinar todo y eliminar duplicados
  const categorias = [...new Set([...categoriasProductos, ...categoriasMateriales, ...categoriasGuardadas])].sort();

  selectCategoria.innerHTML = '<option value="">Seleccionar categoría...</option>' +
    categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');

  console.log('[GREMIO] ✅ Categorías sincronizadas:', categorias);
}

window.loadProductsByCategory = function () {
  const categoria = document.getElementById('productCategory').value;
  const productSelect = document.getElementById('productName');
  const priceInfo = document.getElementById('priceInfo');

  if (!categoria) {
    productSelect.innerHTML = '<option value="">Primero selecciona categoría...</option>';
    productSelect.disabled = true;
    if (priceInfo) priceInfo.style.display = 'none';
    resetCalculos();
    return;
  }

  // A. Filtrar productos por categoría (precios.json)
  const productosBase = preciosGremio.filter(p =>
    (p.category === categoria || p.categoria === categoria)
  );

  // B. Obtener materiales de listaCostos que NO estén en productosBase
  const materialesBase = window.listaCostos.filter(m => 
    (m.category === categoria || m.categoria === categoria) &&
    !productosBase.some(p => (p.name || p.nombre || p.producto) === (m.name || m.producto))
  );

  // Combinar
  const productos = [...productosBase];
  materialesBase.forEach(m => {
    productos.push({
      id: m.id,
      name: m.name || m.producto,
      category: m.category || m.categoria,
      precioGremio: m.costs?.total || 0, // Fallback: costo como precio gremio
      costo: m.costs?.total || 0,
      isFromMaterial: true,
      unit: m.unit || m.unidad || 'm²'
    });
  });

  if (productos.length === 0) {
    productSelect.innerHTML = '<option value="">No hay productos en esta categoría</option>';
    productSelect.disabled = true;
    console.warn('[GREMIO] ⚠️ No hay productos para categoría:', categoria);
    return;
  }

  productSelect.innerHTML = '<option value="">Seleccionar producto...</option>' +
    productos.map((p, index) => {
      const nombreProducto = p.name || p.nombre || p.producto || 'Sin nombre';
      const dimensiones = p.ancho && p.largo ? ` (${p.ancho}x${p.largo}m)` : '';
      const indicator = p.isFromMaterial ? ' 📦' : '';
      return `<option value="${index}">${nombreProducto}${dimensiones}${indicator}</option>`;
    }).join('');

  productSelect.disabled = false;
  window.productosFiltrados = productos;

  console.log('[GREMIO] ✅ Productos sincronizados:', productos.length);
};

window.loadProductPrice = function () {
  const productSelect = document.getElementById('productName');
  const productIndex = parseInt(productSelect.value);
  const priceInfo = document.getElementById('priceInfo');

  if (isNaN(productIndex) || !window.productosFiltrados) {
    if (priceInfo) priceInfo.style.display = 'none';
    resetCalculos();
    return;
  }

  const precioItem = window.productosFiltrados[productIndex];

  if (!precioItem) {
    console.error('[GREMIO] ❌ Producto no encontrado');
    return;
  }

  console.log('[GREMIO] 🔍 Producto seleccionado (Precio):', precioItem);
  currentProductData = precioItem;

  // 1. ESTABLECER PRECIO (Directo del objeto seleccionado)
  currentPrecioGremio = parseFloat(
    precioItem.priceGremio ||
    precioItem.precioGremio ||
    precioItem.gremio ||
    precioItem.price ||
    precioItem.precio ||
    precioItem.costo ||
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
    const unitLabel = currentProductData.unit === 'ml' ? '/ml' : currentProductData.unit === 'unidad' ? '/unidad' : '/m²';
    if (displayElement) {
      displayElement.textContent = '$' + formatCurrency(currentPrecioGremio) + unitLabel;
    }

    if (priceInfo) {
      priceInfo.style.display = 'block';
    }

    // ADAPTAR INPUTS SEGÚN UNIDAD
    const groupAncho = document.getElementById('groupAncho');
    const groupAlto = document.getElementById('groupAlto');
    const labelAncho = document.getElementById('labelAncho');
    const productDimensionsRow = document.getElementById('productDimensionsRow');

    if (groupAncho && groupAlto) {
      if (currentProductData.unit === 'ml') {
        const inputAlto = document.getElementById('productAlto');
        if (inputAlto) inputAlto.value = ''; // Limpiar alto para ml
        groupAncho.style.display = 'block';
        groupAlto.style.display = 'none';
        if (labelAncho) labelAncho.textContent = 'Largo / ML (cm) *';
        if (productDimensionsRow) productDimensionsRow.style.display = 'flex';
      } else if (currentProductData.unit === 'unidad') {
        const inputAncho = document.getElementById('productAncho');
        const inputAlto = document.getElementById('productAlto');
        if (inputAncho) inputAncho.value = '';
        if (inputAlto) inputAlto.value = '';
        groupAncho.style.display = 'none';
        groupAlto.style.display = 'none';
        if (productDimensionsRow) productDimensionsRow.style.display = 'none';
      } else {
        // m2 por defecto
        groupAncho.style.display = 'block';
        groupAlto.style.display = 'block';
        if (labelAncho) labelAncho.textContent = 'Ancho (cm) *';
        if (productDimensionsRow) productDimensionsRow.style.display = 'flex';
      }
    }

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

window.calcularTotalMaterial = function () {
  const ancho = parseFloat(document.getElementById('productAncho')?.value) || 0;
  const alto = parseFloat(document.getElementById('productAlto')?.value) || 0;
  const cantidad = parseInt(document.getElementById('productCantidad')?.value) || 0;

  console.log('[CÁLCULO] Input:', { ancho, alto, cantidad, precioGremio: currentPrecioGremio, costo: currentCostoMaterial });

  const unitData = currentProductData?.unit || 'm²';

  // Validación según unidad
  let canCalculate = true;
  if (currentPrecioGremio === 0 || cantidad === 0) canCalculate = false;
  if (unitData === 'm²' && (ancho === 0 || alto === 0)) canCalculate = false;
  if (unitData === 'ml' && (ancho === 0 && alto === 0)) canCalculate = false;

  if (!canCalculate) {
    document.getElementById('productTotal').textContent = '$0.00';
    document.getElementById('productFormula').textContent = 'Completa los datos necesarios';
    const detalle = document.getElementById('calculoDetalle');
    if (detalle) detalle.style.display = 'none';
    return;
  }
  let factorPorUnidad = 0;
  let formulaDisplay = '';
  const unitLabel = unitData === 'ml' ? 'ml' : unitData === 'unidad' ? 'unidad' : 'm²';

  if (unitData === 'ml') {
    // Para metro lineal, usamos el Ancho/Largo típicamente en cm. Asumimos el mayor como largo 
    // o simplemente la suma si es perímetro, pero lo estándar es tomar uno de los dos lados (ej. el Largo)
    // Para evitar ambigüedades, tomaremos (ancho || alto) / 100
    factorPorUnidad = (ancho || alto) / 100;
    formulaDisplay = `(${ancho || alto} cm ÷ 100) × ${cantidad} × $${formatCurrency(currentPrecioGremio)}/ml`;
  } else if (unitData === 'unidad') {
    // Para unidad (placas, cajas), solo importa la cantidad 
    factorPorUnidad = 1;
    formulaDisplay = `${cantidad} unid. × $${formatCurrency(currentPrecioGremio)}/unid.`;
  } else {
    // m2 por defecto: FÓRMULA: ((Ancho * Alto) / 10000) * Cantidad * PrecioGremio
    factorPorUnidad = (ancho * alto) / 10000;
    formulaDisplay = `((${ancho} × ${alto}) ÷ 10000) × ${cantidad} × $${formatCurrency(currentPrecioGremio)}/m²`;
  }

  const factorTotales = factorPorUnidad * cantidad;
  const precioUnitario = factorPorUnidad * currentPrecioGremio;
  const totalMaterial = factorTotales * currentPrecioGremio;

  console.log('[CÁLCULO] Resultado:', {
    factorPorUnidad,
    factorTotales,
    precioUnitario,
    totalMaterial
  });

  // Mostrar resultado
  document.getElementById('productTotal').textContent = '$' + formatCurrency(totalMaterial);

  // Mostrar fórmula
  document.getElementById('productFormula').textContent = formulaDisplay;

  // Mostrar detalle
  const detalle = document.getElementById('calculoDetalle');
  if (detalle) {
    const m2Elem = document.getElementById('m2PorUnidad');
    const m2TotElem = document.getElementById('m2Totales');
    const precioUnitElem = document.getElementById('precioUnitario');

    if (m2Elem) {
      m2Elem.textContent = formatM2(factorPorUnidad) + ' ' + unitLabel;
      m2Elem.previousElementSibling.textContent = unitLabel + ' por unidad';
    }
    if (m2TotElem) {
      m2TotElem.textContent = formatM2(factorTotales) + ' ' + unitLabel;
      m2TotElem.previousElementSibling.textContent = unitLabel + ' totales';
    }
    if (precioUnitElem) precioUnitElem.textContent = '$' + formatCurrency(precioUnitario);

    detalle.style.display = 'block';
  }
};

function resetCalculos() {
  currentPrecioGremio = 0;
  currentCostoMaterial = 0;
  currentProductData = null;

  ['productAncho', 'productAlto', 'productCantidad'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const totalElem = document.getElementById('productTotal');
  const formulaElem = document.getElementById('productFormula');
  const detalleElem = document.getElementById('calculoDetalle');

  if (totalElem) totalElem.textContent = '$0.00';
  if (formulaElem) formulaElem.textContent = 'Completa los datos';
  if (detalleElem) detalleElem.style.display = 'none';

  // Restaurar visibilidad de inputs
  const groupAncho = document.getElementById('groupAncho');
  const groupAlto = document.getElementById('groupAlto');
  const labelAncho = document.getElementById('labelAncho');
  const productDimensionsRow = document.getElementById('productDimensionsRow');
  if (groupAncho) groupAncho.style.display = 'block';
  if (groupAlto) groupAlto.style.display = 'block';
  if (labelAncho) labelAncho.textContent = 'Ancho (cm) *';
  if (productDimensionsRow) productDimensionsRow.style.display = 'flex';
}

// ==================== AGREGAR PRODUCTO ====================

function addProductToQuote() {
  // VALIDACIÓN DOBLE (Por seguridad)
  if (!window.currentClientId) {
    alert('⚠️ Debes cargar un cliente primero.');
    return;
  }

  const ancho = parseFloat(document.getElementById('productAncho').value);
  const alto = parseFloat(document.getElementById('productAlto').value);
  const cantidad = parseInt(document.getElementById('productCantidad').value);

  const unitData = currentProductData?.unit || 'm²';

  // Validación según unidad
  let isValid = true;
  if (!cantidad) isValid = false;
  if (unitData === 'm²' && (!ancho || !alto)) isValid = false;
  if (unitData === 'ml' && (!ancho && !alto)) isValid = false;

  if (!isValid) {
    alert('⚠️ Completa los datos requeridos para esta unidad (' + unitData + ')');
    return;
  }

  if (currentPrecioGremio === 0 || currentCostoMaterial === 0) {
    alert('⚠️ Sin precio de Gremio o sin costo');
    return;
  }

  let factorPorUnidad = 0;

  if (unitData === 'ml') {
    factorPorUnidad = (ancho || alto) / 100;
  } else if (unitData === 'unidad') {
    factorPorUnidad = 1;
  } else {
    factorPorUnidad = (ancho * alto) / 10000;
  }

  const factorTotales = factorPorUnidad * cantidad;
  const costoUnitario = factorPorUnidad * currentCostoMaterial;
  const precioUnitario = factorPorUnidad * currentPrecioGremio;
  const totalCosto = factorTotales * currentCostoMaterial;
  const totalPrecio = factorTotales * currentPrecioGremio;

  const nombreProducto = currentProductData.name || currentProductData.nombre || currentProductData.producto;
  const categoriaProducto = currentProductData.category || currentProductData.categoria;

  // --- LÓGICA TERCERO VINCULADO ---
  const tercSelect = document.getElementById('productModalTercero');
  if (tercSelect && tercSelect.value !== "") {
    const tIndex = parseInt(tercSelect.value);
    if (terceros[tIndex]) {
      const t = terceros[tIndex];

      let factor = cantidad;
      let detalleMedidas = '';

      if (unitData === 'ml') {
        factor = factorTotales;
        detalleMedidas = ` (${(ancho||alto)} cm × ${cantidad}u = ${factorTotales} ml)`;
      } else if (unitData === 'unidad') {
        factor = cantidad;
        detalleMedidas = ` (${cantidad} unid)`;
      } else {
        factor = factorTotales; // m²
        detalleMedidas = ` (${ancho}x${alto} cm × ${cantidad}u = ${factorTotales} m²)`;
      }

      // Verificar unidad del tercero
      const unidadT = t.unidad || 'unidad';
      if ((unidadT === 'm²' || unidadT === 'm2') && ancho > 0 && alto > 0) {
        factor = ((ancho * alto) / 10000) * cantidad; // Usar m² reales
        detalleMedidas = ` (${ancho}x${alto}cm)`;
      }

      const costoT = parseFloat(t.costo || 0);
      const precioT = parseFloat(t.precio || 0);

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
    m2PorUnidad: factorPorUnidad,
    m2Totales: factorTotales,
    costoMaterial: currentCostoMaterial,
    costoUnitario,
    costoTotal: totalCosto,
    precioGremio: currentPrecioGremio,
    precioUnitario,
    total: totalPrecio,
    unidad: unitData,
    unidadCalcFactor: factorPorUnidad
  };

  console.log('[GREMIO] ✅ Producto agregado:', quoteItem);
  currentQuoteProducts.push(quoteItem);

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

  renderQuoteProducts();
  calculateTotals();
  renderTerceros(); // Actualizar lista de terceros también

  alert('✅ Material agregado');
}

// ==================== TERCEROS ====================

function populateTerceros() {
  const select = document.getElementById('terceroService');
  if (!select) {
    console.error('[GREMIO] ❌ Select terceroService no encontrado');
    return;
  }

  if (terceros.length === 0) {
    select.innerHTML = '<option value="">No hay terceros configurados</option>';
    select.disabled = true;
    return;
  }

  select.innerHTML = '<option value="">Seleccionar servicio...</option>' +
    terceros.map((t, index) => {
      const nombreServicio = t.nombre || 'Sin nombre';
      const empresaNombre = t.empresaNombre || 'Sin empresa';
      return `<option value="${index}">${nombreServicio} (${empresaNombre})</option>`;
    }).join('');

  select.disabled = false;
  console.log('[GREMIO] ✅ Terceros poblados:', terceros.length);

  // Poblar también el selector incrustado en modal de productos
  const selectEmbedded = document.getElementById('productModalTercero');
  if (selectEmbedded) {
    if (terceros.length === 0) {
      selectEmbedded.innerHTML = '<option value="">No hay terceros configurados</option>';
    } else {
      selectEmbedded.innerHTML = '<option value="">-- Ninguno --</option>' +
        terceros.map((t, index) => {
          const nombreServicio = t.nombre || 'Sin nombre';
          const empresaNombre = t.empresaNombre || 'Sin empresa';
          return `<option value="${index}">${nombreServicio} (${empresaNombre})</option>`;
        }).join('');
    }
    // Listener para mostrar info
    selectEmbedded.onchange = function () {
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

window.loadTerceroPrice = function () {
  const select = document.getElementById('terceroService');
  const terceroIndex = parseInt(select.value);

  if (isNaN(terceroIndex) || terceroIndex < 0 || terceroIndex >= terceros.length) {
    document.getElementById('terceroCosto').value = '';
    document.getElementById('terceroPrecioCliente').value = '';
    return;
  }

  const tercero = terceros[terceroIndex];

  console.log('[TERCERO] Seleccionado:', tercero);

  const costo = parseFloat(tercero.costo || 0);
  const precioVenta = parseFloat(tercero.precio || 0);
  const costoMaterial = parseFloat(tercero.costoMaterial || 0);
  const precioMaterial = parseFloat(tercero.precioMaterial || 0);

  document.getElementById('terceroCosto').value = costo.toFixed(2);
  document.getElementById('terceroPrecioCliente').value = precioVenta.toFixed(2);

  // Mostrar/Ocultar dimensiones según unidad
  const dimsContainer = document.getElementById('terceroDimensiones');
  const unidad = tercero.unidad || 'unidad';

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

  console.log('[TERCERO] Precios cargados:', { costo, precioVenta });

  calcularTotalTercero();
};

window.calcularTotalTercero = function () {
  let cantidad = parseFloat(document.getElementById('terceroQuantity').value) || 0;
  const costo = parseFloat(document.getElementById('terceroCosto').value) || 0;
  const precioCliente = parseFloat(document.getElementById('terceroPrecioCliente').value) || 0;

  // Material extra
  const select = document.getElementById('terceroService');
  const tercero = terceros[select.value] || {};
  const costoMaterial = parseFloat(tercero.costoMaterial || 0);
  const precioMaterial = parseFloat(tercero.precioMaterial || 0);
  const cantMaterial = parseFloat(document.getElementById('terceroCantMaterial')?.value) || 0;

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

  // Sumar material si aplica
  if (costoMaterial > 0 || precioMaterial > 0) {
    totalCosto += (costoMaterial * cantMaterial);
    totalPrecio += (precioMaterial * cantMaterial);
  }

  console.log('[TERCERO] Cálculo:', { cantidad, costo, precioCliente, totalCosto, totalPrecio });

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

  if (isNaN(terceroIndex) || !cantidad) {
    alert('⚠️ Completa todos los campos');
    return;
  }

  const tercero = terceros[terceroIndex];

  const nombreTercero = tercero.nombre || 'Servicio sin nombre';
  const empresaNombre = tercero.empresaNombre || 'Sin empresa';
  const costo = parseFloat(tercero.costo || 0);
  const precioVenta = parseFloat(tercero.precio || 0);
  const unidad = tercero.unidad || tercero.unit || 'unidad';
  const costoMaterial = parseFloat(tercero.costoMaterial || 0);
  const precioMaterial = parseFloat(tercero.precioMaterial || 0);
  const cantMaterial = parseFloat(document.getElementById('terceroCantMaterial')?.value) || 0;

  // Recalcular totales finales para guardar
  const ancho = parseFloat(document.getElementById('terceroAncho')?.value) || 0;
  const alto = parseFloat(document.getElementById('terceroAlto')?.value) || 0;
  const dimsVisible = document.getElementById('terceroDimensiones')?.style.display !== 'none';

  let factor = cantidad;
  let detalleMedidas = '';

  if (dimsVisible && ancho > 0 && alto > 0) {
    const m2 = (ancho * alto) / 10000;
    factor = m2 * cantidad;
    detalleMedidas = ` (${ancho}x${alto}cm)`;
  }

  let totalCosto = factor * costo;
  let totalPrecio = factor * precioVenta;

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

  window.MRModals.close(document.getElementById('terceroServiceModal'));
  document.getElementById('terceroService').value = '';
  document.getElementById('terceroQuantity').value = '';
  document.getElementById('terceroCosto').value = '';
  document.getElementById('terceroPrecioCliente').value = '';
  if (document.getElementById('terceroAncho')) document.getElementById('terceroAncho').value = '';
  if (document.getElementById('terceroAlto')) document.getElementById('terceroAlto').value = '';
  document.getElementById('terceroTotalCosto').textContent = '$0.00';
  document.getElementById('terceroTotal').textContent = '$0.00';

  renderTerceros();
  calculateTotals();

  alert('✅ Servicio agregado');
}

// ==================== RENDERIZAR ====================

function renderQuoteProducts() {
  const container = document.getElementById('productsList');

  if (!container) return;

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
            <p style="margin: 0; font-weight: bold;">${formatM2(item.m2Totales || item.unidadCalcFactor || 0)} ${item.unidad || 'm²'}</p>
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

window.removeProduct = function (id) {
  if (!confirm('¿Eliminar?')) return;
  currentQuoteProducts = currentQuoteProducts.filter(p => p.id !== id);
  renderQuoteProducts();
  calculateTotals();
};

function renderTerceros() {
  const container = document.getElementById('terceroServicesList');

  if (!container) return;

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

window.removeTercero = function (id) {
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
  const ivaActivo = document.getElementById('ivaCheckbox')?.checked || false;
  const iva = ivaActivo ? subtotal * 0.21 : 0;
  
  const inputAjuste = document.getElementById('descuentoEspecial');
  const porcAjuste = inputAjuste ? parseFloat(inputAjuste.value) || 0 : 0;
  const montoAjuste = subtotal * (porcAjuste / 100);
  
  const total = subtotal + iva + montoAjuste;
  const ganancia = total - totalCostos;
  console.log('[TOTALES]', { costoMateriales, costoTerceros, totalCostos, subtotal, iva, total, ganancia, montoAjuste, porcAjuste });

  // Guardar totales numéricos para uso interno (guardado)
  currentTotals = {
    costoTotal: totalCostos,
    subtotal: subtotal,
    iva: iva,
    totalCliente: total,
    ganancia: ganancia,
    descuentoEspecial: montoAjuste,
    porcentajeDescuento: porcAjuste
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
    if (elem) elem.textContent = '$' + elements[id];
  });

  calcularSaldo();
}

window.calcularSaldo = function () {
  // Usar el valor numérico real almacenado en currentTotals
  const total = currentTotals.totalCliente || 0;
  const anticipo = parseFloat(document.getElementById('montoAnticipo')?.value) || 0;
  const saldo = total - anticipo;

  const saldoElem = document.getElementById('saldoPendiente');
  if (saldoElem) {
    saldoElem.textContent = '$' + formatCurrency(saldo);
  }
};

// ==================== GUARDAR/LIMPIAR ====================

window.saveQuote = async function () {
  const clientName = document.getElementById('clientName')?.value.trim();

  // Si hay nombre pero no ID, auto-guardar el cliente silenciosamente antes de cotizar
  if (!window.currentClientId) {
    if (!clientName) {
      alert('⚠️ Ingresá el nombre del cliente antes de guardar.');
      return;
    }
    const autoClient = {
      id: 'gremio_cli_' + Date.now(),
      name: clientName,
      nombre: clientName,
      telefono: document.getElementById('clientPhone')?.value || '',
      email: document.getElementById('clientEmail')?.value || '',
      direccion: document.getElementById('clientAddress')?.value || '',
      tipo: 'gremio',
      fechaRegistro: new Date().toISOString()
    };
    try {
      await window.mrDataManager.saveGremioCliente(autoClient);
    } catch (e) {
      console.warn('[GREMIO] No se pudo guardar el cliente automáticamente:', e);
    }
    window.currentClientId = autoClient.id;
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
    clientId: window.currentClientId, // Vinculamos la cotización al ID del cliente
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
    descuentoEspecial: currentTotals.descuentoEspecial || 0,
    porcentajeDescuento: currentTotals.porcentajeDescuento || 0,
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

window.createDirectWork = async function () {
  const clientName = document.getElementById('clientName')?.value.trim();

  if (!window.currentClientId) {
    if (!clientName) {
      alert('⚠️ Ingresá el nombre del cliente antes de crear el trabajo.');
      return;
    }
    const autoClient = {
      id: 'gremio_cli_' + Date.now(),
      name: clientName,
      nombre: clientName,
      telefono: document.getElementById('clientPhone')?.value || '',
      email: document.getElementById('clientEmail')?.value || '',
      direccion: document.getElementById('clientAddress')?.value || '',
      tipo: 'gremio',
      fechaRegistro: new Date().toISOString()
    };
    try {
      await window.mrDataManager.saveGremioCliente(autoClient);
      window.currentClientId = autoClient.id;
    } catch (e) {
      console.warn('[GREMIO] No se pudo guardar el cliente automáticamente:', e);
    }
  }

  const hasMulti = window.multiCategoryManager && window.multiCategoryManager.getCategories().length > 0;

  if (currentQuoteProducts.length === 0 && currentQuoteTerceros.length === 0 && !hasMulti) {
    alert('⚠️ Agregá al menos un producto o servicio antes de crear el trabajo.');
    return;
  }

  const total = currentTotals.totalCliente || 0;
  const totalCost = currentTotals.costoTotal || 0;
  const profit = currentTotals.ganancia || 0;
  const anticipo = parseFloat(document.getElementById('montoAnticipo')?.value) || 0;
  const saldo = total - anticipo;
  const deliveryDate = document.getElementById('deliveryDate')?.value || null;

  const items = [];
  if (Array.isArray(currentQuoteProducts)) {
    currentQuoteProducts.forEach(p => items.push(`${p.cantidad}x ${p.producto || p.name || 'Producto'}`));
  }
  if (Array.isArray(currentQuoteTerceros)) {
    currentQuoteTerceros.forEach(t => items.push(`${t.cantidad}x ${t.nombre || t.servicio || 'Servicio'}`));
  }
  const descripcion = items.join(', ') || 'Trabajo directo de Gremio';

  const newWork = {
    id: `work_${Date.now()}`,
    quoteId: `direct_${Date.now()}`,
    tipo_cliente: 'gremio',
    clientName: clientName,
    clientPhone: document.getElementById('clientPhone')?.value || '',
    clientEmail: document.getElementById('clientEmail')?.value || '',
    clientAddress: document.getElementById('clientAddress')?.value || '',
    descripcion: descripcion,
    products: currentQuoteProducts,
    terceros: currentQuoteTerceros,
    total: total,
    totalCost: totalCost,
    profit: profit,
    paidAmount: anticipo,
    balance: saldo,
    status: 'pending',
    paymentStatus: (anticipo >= total - 1) ? 'paid' : 'pending',
    priority: 'normal',
    deliveryDate: deliveryDate,
    createdAt: new Date().toISOString(),
    timeline: [{ type: 'created', description: 'Trabajo directo creado por Administrador (Gremio)', timestamp: new Date().toISOString() }],
    notes: []
  };

  try {
    let worksData = { works: [], notifications: [] };
    try {
      worksData = await window.mrDataManager.request('/api/trabajos');
      if (!worksData || !Array.isArray(worksData.works)) worksData = { works: [], notifications: [] };
    } catch (e) {
      worksData = { works: [], notifications: [] };
    }

    worksData.works.push(newWork);

    const result = await window.mrDataManager.request('/api/trabajos', 'POST', worksData);
    if (result?.success) {
      alert(`🔨 ✅ ¡Trabajo creado exitosamente para ${clientName}!`);
      clearQuote();
      if (window.updateStatistics) updateStatistics();
    } else {
      alert('❌ Error al guardar el trabajo en el servidor.');
    }
  } catch (error) {
    console.error('[GREMIO] Error creando trabajo directo:', error);
    alert('❌ Error al crear el trabajo: ' + error.message);
  }
};

window.clearQuote = function () {
  currentQuoteProducts = [];
  currentQuoteTerceros = [];
  window.currentClientId = null; // Resetear cliente para obligar a cargar uno nuevo

  if (window.multiCategoryManager) {
    window.multiCategoryManager.clearCategories();
  }

  const fields = ['clientName', 'clientPhone', 'clientEmail', 'clientAddress', 'montoAnticipo', 'descuentoEspecial'];
  fields.forEach(id => {
    const elem = document.getElementById(id);
    if (elem) {
      if (id === 'descuentoEspecial') elem.value = '0';
      else elem.value = '';
    }
  });

  renderQuoteProducts();
  renderTerceros();
  calculateTotals();
  
  if (window.updateClientActionButton) window.updateClientActionButton();
};

window.generatePDF = async function (cot = null) {
  if (!window.jspdf) {
    alert('⚠️ Error: La librería PDF no se ha cargado correctamente.');
    return;
  }

  // Si no se pasa una cotización, usamos la actual del estado global
  const data = typeof cot === 'object' && cot !== null ? cot : {
    cliente: {
      nombre: document.getElementById('clientName')?.value || 'Cliente Gremio',
      telefono: document.getElementById('clientPhone')?.value || '',
      email: document.getElementById('clientEmail')?.value || '',
      direccion: document.getElementById('clientAddress')?.value || ''
    },
    productos: typeof currentQuoteProducts !== 'undefined' ? currentQuoteProducts : [],
    multiCategories: window.multiCategoryManager ? window.multiCategoryManager.exportState() : null,
    totalCliente: typeof currentTotals !== 'undefined' ? currentTotals.totalCliente : 0,
    subtotal: typeof currentTotals !== 'undefined' ? (currentTotals.subtotal || 0) : 0,
    iva: typeof currentTotals !== 'undefined' ? (currentTotals.iva || 0) : 0,
    descuentoEspecial: typeof currentTotals !== 'undefined' ? (currentTotals.descuentoEspecial || 0) : 0,
    porcentajeDescuento: typeof currentTotals !== 'undefined' ? (currentTotals.porcentajeDescuento || 0) : 0,
    fecha: new Date().toISOString(),
    fechaEntrega: document.getElementById('deliveryDate')?.value || ''
  };

  try {
    const generator = new PDFGenerator();
    const doc = await generator.generateGremioQuote(data);
    const clientName = (data.cliente?.nombre || 'Presupuesto_Gremio').replace(/[^a-z0-9]/gi, '_');
    doc.save(`Presupuesto_Gremio_${clientName}.pdf`);
    alert('✅ PDF generado correctamente');
  } catch (error) {
    console.error('[GREMIO] Error al generar PDF:', error);
    alert('❌ Error al generar el PDF: ' + error.message);
  }
};


window.loadQuotations = async function () {
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
            <button class="btn btn-success btn-small" onclick="aprobarCotizacion('${cot.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">✅ Aprobar</button>
          ` : ''}
          <button class="btn btn-danger btn-small" onclick="borrarCotizacion('${cot.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

window.aprobarCotizacion = async function (id) {
  if (!confirm('¿Aprobar cotización? Esto creará un trabajo y registrará los movimientos.')) return;

  try {
    // 1. Obtener y actualizar la cotización
    const cotizaciones = await window.mrDataManager.getGremioCotizaciones();
    const cotizacion = cotizaciones.find(c => c.id === id);
    if (!cotizacion) { alert('❌ Cotización no encontrada.'); return; }

    cotizacion.estado = 'aprobada';
    cotizacion.approved = true;
    cotizacion.fechaAprobacion = new Date().toISOString();

    const successCot = await window.mrDataManager.saveGremioCotizaciones(cotizaciones);
    if (!successCot) { alert('❌ Error al guardar la cotización.'); return; }

    // 2. Registrar movimientos financieros
    const gastos = await window.mrDataManager.getGastos();
    const fechaAprobacion = new Date().toISOString();
    const cotiIdShort = cotizacion.id.slice(-6);
    const montoAnticipo = parseFloat(cotizacion.anticipo) || 0;
    const montoVentaTotal = parseFloat(cotizacion.totalCliente || cotizacion.total || 0);

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

    // ✅ Registrar Venta Total para que aparezca en la lista de Ingresos de Rendimientos
    if (montoVentaTotal > 0) {
      const descTag = cotizacion.porcentajeDescuento > 0 ? ` (Desc. ${cotizacion.porcentajeDescuento}%)` : '';
      gastos.push({
        id: `ingreso_coti_${cotizacion.id}`,
        tipo: 'ingreso',
        descripcion: `Venta Total${descTag} - Coti Gremio #${cotiIdShort} (${cotizacion.cliente.nombre})`,
        monto: montoVentaTotal,
        fecha: fechaAprobacion,
        categoria: 'venta_gremio'
      });
    }

    // 3. Crear TRABAJO — usando mrDataManager para manejo correcto de auth
    const clientName = cotizacion.cliente?.nombre || 'Cliente';
    const total = parseFloat(cotizacion.totalCliente || cotizacion.total || 0);

    // Armar descripción automática desde productos/terceros
    const items = [];
    if (Array.isArray(cotizacion.productos)) {
      cotizacion.productos.forEach(p => items.push(`${p.cantidad}x ${p.producto || 'Producto'}`));
    }
    if (Array.isArray(cotizacion.terceros)) {
      cotizacion.terceros.forEach(t => items.push(`${t.cantidad}x ${t.nombre || 'Servicio'}`));
    }
    const descripcion = items.slice(0, 5).join(', ') || 'Trabajo de gremio';

    const newWork = {
      id: `work_${Date.now()}`,
      quoteId: cotizacion.id,
      tipo_cliente: 'gremio',
      clientName: clientName,
      clientPhone: cotizacion.cliente?.telefono || '',
      clientEmail: cotizacion.cliente?.email || '',
      clientAddress: cotizacion.cliente?.direccion || '',
      descripcion: descripcion,
      total: total,
      totalCost: parseFloat(cotizacion.costoTotal || 0),
      profit: parseFloat(cotizacion.ganancia || 0),
      paidAmount: montoAnticipo,
      balance: total - montoAnticipo,
      status: 'pending',
      paymentStatus: (montoAnticipo >= total - 1) ? 'paid' : 'pending',
      priority: 'normal',
      deliveryDate: cotizacion.deliveryDate || null,
      createdAt: new Date().toISOString(),
      timeline: [{ type: 'created', description: 'Trabajo creado desde cotización Gremio', timestamp: new Date().toISOString() }],
      notes: []
    };

    // GET trabajos via mrDataManager (maneja auth correctamente)
    let worksData = { works: [], notifications: [] };
    try {
      worksData = await window.mrDataManager.request('/api/trabajos');
      if (!worksData || !Array.isArray(worksData.works)) worksData = { works: [], notifications: [] };
    } catch (e) {
      console.error('[GREMIO] Error leyendo trabajos:', e);
      alert('❌ No se pudo leer trabajos del servidor. Verificá la sesión.');
      return;
    }

    worksData.works.push(newWork);

    // POST trabajos via mrDataManager
    let saveSuccess = false;
    try {
      const result = await window.mrDataManager.request('/api/trabajos', 'POST', worksData);
      saveSuccess = result?.success === true;
    } catch (e) {
      console.error('[GREMIO] Error guardando trabajo:', e);
    }

    if (!saveSuccess) {
      alert('❌ El trabajo NO se guardó (error de servidor o sesión expirada). Recargá la página e intentá de nuevo.');
      return;
    }

    // 4. Guardar movimientos financieros
    await window.mrDataManager.saveGastos(gastos);

    // 5. Sync Google Sheets (opcional)
    if (window.mrDataManager?.syncGoogleSheets) {
      window.mrDataManager.syncGoogleSheets().catch(e => console.warn('[AUTO-SYNC]', e));
    }

    if (window.notifyWorkCreated) {
      window.notifyWorkCreated(newWork);
    } else {
      alert(`✅ Cotización aprobada y trabajo creado para ${clientName}.`);
    }
    await loadQuotations();
    updateStatistics();

  } catch (error) {
    console.error('[GREMIO] Error en aprobarCotizacion:', error);
    alert('❌ Error inesperado al aprobar: ' + error.message);
  }
};

window.borrarCotizacion = async function (id) {
  if (!confirm('⚠️ ¿Estás seguro de eliminar esta cotización? Esta acción no se puede deshacer.')) return;

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

window.updateStatistics = function () { // Esta función ahora se llama desde loadQuotations
  const aprobadas = cotizacionesGremio.filter(c => c.estado === 'aprobada');
  const pendientes = cotizacionesGremio.filter(c => c.estado === 'pendiente');

  const totalAprobado = aprobadas.reduce((sum, c) => sum + (c.totalCliente || 0), 0);
  const totalGanancia = aprobadas.reduce((sum, c) => sum + (c.ganancia || 0), 0);

  const elem1 = document.getElementById('totalApproved');
  const elem2 = document.getElementById('totalGanancia');
  const elem3 = document.getElementById('countApproved');
  const elem4 = document.getElementById('countPending');

  if (elem1) elem1.textContent = '$' + totalAprobado.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  if (elem2) elem2.textContent = '$' + totalGanancia.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  if (elem3) elem3.textContent = aprobadas.length;
  if (elem4) elem4.textContent = pendientes.length;
};

window.startNotificationPolling = function () {
  checkNotifications();
  setInterval(checkNotifications, 10000); // Revisar cada 10 segundos
};

async function checkNotifications() {
  try {
    // Usar fetch directo para evitar dependencias
    const response = await fetch('/api/trabajos', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('mr_token') || ''}` }
    });
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
}

// ==================== VER DETALLE DE COTIZACIÓN ====================

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
            <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2 class="modal-title" id="detalleModalTitle">Detalle de Cotización</h2>
                    <button class="btn-close" onclick="cerrarDetalleCotizacion()">×</button>
                </div>
                <div class="modal-body" id="detalleModalBody">
                    <!-- Contenido dinámico -->
                </div>
                <div class="modal-footer">
                    <button id="btnDownloadPDFFromHistory" class="btn btn-primary">📄 Descargar PDF</button>
                    <button class="btn btn-secondary" onclick="cerrarDetalleCotizacion()">Cerrar</button>
                </div>
            </div>
        `;
    document.body.appendChild(modal);
  }

  // Generar HTML del detalle
  const html = generarHTMLDetalleCotizacion(cotizacion);
  document.getElementById('detalleModalBody').innerHTML = html;
  document.getElementById('detalleModalTitle').textContent = `Cotización: ${cotizacion.cliente.nombre}`;

  // Configurar botón PDF
  const btnPdf = document.getElementById('btnDownloadPDFFromHistory');
  if (btnPdf) {
    btnPdf.onclick = () => generatePDF(cotizacion);
  }

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
            
            <!-- Detalle del Pedido -->
            <div>
                <h3 style="margin-bottom: 0.5rem; color: var(--primary-color);">📦 Detalle del Pedido</h3>
                <div style="background: rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead>
                            <tr style="background: rgba(81, 207, 102, 0.1); text-align: left;">
                                <th style="padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1);">#</th>
                                <th style="padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1);">Detalle</th>
                                <th style="padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">Medidas / Cant</th>
                                <th style="padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">M²</th>
                                <th style="padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(cot.productos || []).map((p, i) => `
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                    <td style="padding: 0.75rem; opacity: 0.7;">${i + 1}</td>
                                    <td style="padding: 0.75rem;">
                                        <div style="font-weight: bold; color: #51CF66;">${p.producto || p.name || 'Producto'}</div>
                                        <div style="font-size: 0.75rem; opacity: 0.6;">${p.categoria || ''}</div>
                                    </td>
                                    <td style="padding: 0.75rem; text-align: center;">
                                        ${p.ancho && p.alto ? `${p.ancho.toFixed(1)}x${p.alto.toFixed(1)} cm` : ''}
                                        ${p.cantidad ? `<div style="font-size: 0.75rem; opacity: 0.7;">Cant: ${p.cantidad}</div>` : ''}
                                    </td>
                                    <td style="padding: 0.75rem; text-align: center; opacity: 0.8;">
                                        ${p.m2Totales ? p.m2Totales.toFixed(2) : (p.ancho && p.alto ? ((p.ancho * p.alto / 10000) * (p.cantidad || 1)).toFixed(2) : '-')}
                                    </td>
                                    <td style="padding: 0.75rem; text-align: right; font-weight: bold; color: #51CF66;">
                                        $${formatCurrency(p.total || p.price || 0)}
                                    </td>
                                </tr>
                            `).join('')}
                            ${(cot.multiCategories?.categories || []).map((c, i) => `
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                    <td style="padding: 0.75rem; opacity: 0.7;">${(cot.productos?.length || 0) + i + 1}</td>
                                    <td style="padding: 0.75rem;">
                                        <div style="font-weight: bold; color: #51CF66;">${c.name}</div>
                                        <div style="font-size: 0.75rem; opacity: 0.6;">Multi-Categoría</div>
                                    </td>
                                    <td style="padding: 0.75rem; text-align: center;">
                                        ${c.width || cot.multiCategories.sharedDimensions?.width || '-'}x${c.height || cot.multiCategories.sharedDimensions?.height || '-'} cm
                                    </td>
                                    <td style="padding: 0.75rem; text-align: center; opacity: 0.8;">
                                        ${(c.m2 || c.frozenM2 || 0).toFixed(2)}
                                    </td>
                                    <td style="padding: 0.75rem; text-align: right; font-weight: bold; color: #51CF66;">
                                        $${formatCurrency(c.totalPrice || 0)}
                                    </td>
                                </tr>
                            `).join('')}
                            ${(cot.terceros || []).map((t, i) => `
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                    <td style="padding: 0.75rem; opacity: 0.7;">${(cot.productos?.length || 0) + (cot.multiCategories?.categories?.length || 0) + i + 1}</td>
                                    <td style="padding: 0.75rem;">
                                        <div style="font-weight: bold; color: #60A5FA;">${t.empresa || t.servicio || t.nombre || 'Servicio'}</div>
                                        <div style="font-size: 0.75rem; opacity: 0.6;">Terceros</div>
                                    </td>
                                    <td style="padding: 0.75rem; text-align: center;">
                                        ${t.cantidad || 1} u.
                                    </td>
                                    <td style="padding: 0.75rem; text-align: center; opacity: 0.8;">-</td>
                                    <td style="padding: 0.75rem; text-align: right; font-weight: bold; color: #60A5FA;">
                                        $${formatCurrency(t.total || t.price || 0)}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Resumen Financiero -->
            <div>
                <h3 style="margin-bottom: 0.5rem; color: var(--primary-color);">💰 Resumen Financiero</h3>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem; opacity: 0.8;">
                       <span>Costo Total:</span>
                       <span style="color: #FF6B6B;">$${formatCurrency(cot.costoTotal || 0)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                       <span>Subtotal:</span>
                       <span>$${formatCurrency(cot.subtotal || 0)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                       <span>IVA:</span>
                       <span>$${formatCurrency(cot.iva || 0)}</span>
                    </div>
                    ${(cot.descuentoEspecial > 0 || cot.porcentajeDescuento > 0) ? `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: #F87171;">
                           <span>Descuento Especial (${cot.porcentajeDescuento || 0}%):</span>
                           <span>- $${formatCurrency(cot.descuentoEspecial || 0)}</span>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.2); font-size: 1.5rem; font-weight: bold; color: #51CF66;">
                       <span>Total Cliente:</span>
                       <span>$${formatCurrency(cot.totalCliente || 0)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 1.1rem; color: #4CAF50;">
                       <span>Ganancia:</span>
                       <span>$${formatCurrency(cot.ganancia || 0)}</span>
                    </div>
                    ${cot.anticipo > 0 ? `
                        <div style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 0.5rem; padding-top: 0.5rem;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                                <span>Anticipo:</span>
                                <span>$${formatCurrency(cot.anticipo)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 0.25rem;">
                                <span>Saldo Pendiente:</span>
                                <span>$${formatCurrency(cot.saldo || 0)}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

console.log('[GREMIO] 🚀 Script de red cargado');


// Exponer para checkbox IVA
window.calculateTotals = calculateTotals;
