/**
 * CLIENTES - Sistema de Cotizaciones (Versión de Red)
 * Conectado al servidor Node.js a través de data-manager-network.js
 * Adaptado de gremio-main.js para usar precios públicos
 */

// ==================== VARIABLES GLOBALES ====================
window.listaCostos = [];
window.preciosClientes = [];
window.terceros = [];
let currentQuoteProducts = [];
let currentQuoteTerceros = [];
let currentPrecioCliente = 0;
let currentCostoMaterial = 0;
let currentProductData = null;
let cotizacionesClientes = [];
let currentClientId = null;
let allClients = [];
let currentTotals = {
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
  console.log('[CLIENTES] 🚀 Inicializando...');

  // 1. Inyectar controles UI inmediatamente (Botones Buscar/Guardar)
  ensureClientControlsExist();
  ensureTerceroInputs();
  ensureProductModalTercerosUI();

  // 2. Verificar conexión
  if (!window.mrDataManager || !(await window.mrDataManager.checkConnection())) {
    console.error('[CLIENTES] ❌ No se pudo conectar al servidor.');
    return;
  }

  // 3. Cargar datos y configurar eventos
  await loadAllData();
  setupEventListeners();
  await loadQuotations();
  updateStatistics();

  // Iniciar monitoreo
  startNotificationPolling();

  console.log('[CLIENTES] ✅ Sistema listo y conectado.');
});

// ==================== CARGA DE DATOS ====================

async function loadAllData() {
  await Promise.all([
    loadCostosData(),
    loadPrecios(),
    loadTerceros()
  ]);
}

async function loadCostosData() {
  try {
    const costos = await window.mrDataManager.getCostos();
    const inventario = await window.mrDataManager.getMateriales();

    let listaCombinada = [...costos];
    const existentes = new Set(costos.map(c => (c.name || c.producto || '').toLowerCase().trim()));

    inventario.forEach(m => {
      const nombre = (m.producto || m.name || m.productoNombre || '').toLowerCase().trim();
      if (nombre && !existentes.has(nombre)) {
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
  } catch (error) {
    console.error('[CLIENTES] ❌ Error cargando costos:', error);
    window.listaCostos = [];
  }
}

async function loadPrecios() {
  try {
    window.preciosClientes = await window.mrDataManager.getPrecios();
    console.log('[CLIENTES] ✅ Precios cargados:', window.preciosClientes.length);
  } catch (error) {
    console.error('[CLIENTES] ❌ Error cargando precios:', error);
    window.preciosClientes = [];
  }
}

async function loadTerceros() {
  try {
    const empresas = await window.mrDataManager.getTerceros();
    window.terceros = [];
    empresas.forEach(empresa => {
      if (empresa.servicios) {
        empresa.servicios.forEach(servicio => {
          window.terceros.push({
            ...servicio,
            empresaNombre: empresa.nombre
          });
        });
      }
    });
    populateTerceros();
  } catch (error) {
    console.error('[CLIENTES] ❌ Error cargando terceros:', error);
    window.terceros = [];
  }
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
  // Modal Productos
  const btnSaveProduct = document.getElementById('btnSaveProduct');
  const btnAddProduct = document.getElementById('btnAddProduct');
  const btnCloseProduct = document.getElementById('btnCloseProduct');
  const btnCancelProduct = document.getElementById('btnCancelProduct');
  const productModal = document.getElementById('productModal');

  if (btnAddProduct) btnAddProduct.addEventListener('click', () => {
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

  const productCategory = document.getElementById('productCategory');
  const productName = document.getElementById('productName');

  if (productCategory) productCategory.addEventListener('change', window.loadProductsByCategory);
  if (productName) productName.addEventListener('change', window.loadProductPrice);

  ['productAncho', 'productAlto', 'productCantidad'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', window.calcularTotalMaterial);
  });

  // Modal Terceros
  const btnSaveTercero = document.getElementById('btnSaveTerceroService');
  const btnAddTercero = document.getElementById('btnAddTerceroService');
  const btnCloseTercero = document.getElementById('btnCloseTerceroService');
  const btnCancelTercero = document.getElementById('btnCancelTerceroService');
  const terceroModal = document.getElementById('terceroServiceModal');

  if (btnAddTercero) btnAddTercero.addEventListener('click', () => window.MRModals.open(terceroModal));
  if (btnSaveTercero) btnSaveTercero.addEventListener('click', addTerceroToQuote);
  if (btnCloseTercero) btnCloseTercero.addEventListener('click', () => window.MRModals.close(terceroModal));
  if (btnCancelTercero) btnCancelTercero.addEventListener('click', () => window.MRModals.close(terceroModal));

  const terceroServiceSelect = document.getElementById('terceroService');
  if (terceroServiceSelect) {
    terceroServiceSelect.addEventListener('change', window.loadTerceroPrice);
  }

  const terceroQuantityInput = document.getElementById('terceroQuantity');
  if (terceroQuantityInput) {
    terceroQuantityInput.addEventListener('input', window.calcularTotalTercero);
  }

  // Clientes (Buscador y Guardado)
  const btnSearchClient = document.getElementById('btnSearchClient');
  const searchClientInput = document.getElementById('searchClientInput');
  const searchClientModal = document.getElementById('searchClientModal');
  const btnCloseSearch = document.getElementById('btnCloseSearchClient');
  const btnCancelSearch = document.getElementById('btnCancelSearchClient');
  const btnSaveClient = document.getElementById('btnSaveClient');

  if (btnSearchClient) {
    btnSearchClient.addEventListener('click', async () => {
      allClients = await window.mrDataManager.getClientesClientes() || [];
      renderClientSearchList(allClients);
      window.MRModals.open(searchClientModal);
      setTimeout(() => { if (searchClientInput) searchClientInput.focus(); }, 100);
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

  if (btnSaveClient) btnSaveClient.addEventListener('click', window.saveNewClient);
}

// ==================== INYECCIONES UI ====================

function ensureClientControlsExist() {
  const clientNameInput = document.getElementById('clientName');
  if (!clientNameInput) return;
  const parent = clientNameInput.parentNode;

  if (!document.getElementById('btnSearchClient')) {
    const btn = document.createElement('button');
    btn.id = 'btnSearchClient';
    btn.innerHTML = '🔍';
    btn.className = 'btn btn-primary';
    btn.style.marginLeft = '5px';
    btn.style.padding = '0 10px';
    btn.type = 'button';
    if (clientNameInput.nextSibling) parent.insertBefore(btn, clientNameInput.nextSibling);
    else parent.appendChild(btn);
  }

  if (!document.getElementById('btnSaveClient')) {
    const btn = document.createElement('button');
    btn.id = 'btnSaveClient';
    btn.innerHTML = '💾';
    btn.className = 'btn btn-success';
    btn.style.marginLeft = '5px';
    btn.style.padding = '0 10px';
    btn.type = 'button';
    const btnSearch = document.getElementById('btnSearchClient');
    if (btnSearch && btnSearch.nextSibling) parent.insertBefore(btn, btnSearch.nextSibling);
    else parent.appendChild(btn);
  }

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
          <input type="text" id="searchClientInput" placeholder="Escribe el nombre..." class="form-control" style="width: 100%; margin-bottom: 1rem; padding: 0.5rem;">
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

function ensureTerceroInputs() {
  const quantityInput = document.getElementById('terceroQuantity');
  if (!quantityInput || document.getElementById('terceroAncho')) return;

  const container = document.createElement('div');
  container.id = 'terceroDimensiones';
  container.style.display = 'none';
  container.style.gridTemplateColumns = '1fr 1fr';
  container.style.gap = '10px';
  container.style.marginBottom = '1rem';

  container.innerHTML = `
    <div><label style="display:block; margin-bottom:5px; font-size:0.9rem;">Ancho (cm)</label><input type="number" id="terceroAncho" class="form-control" placeholder="0" style="width:100%; padding:8px;"></div>
    <div><label style="display:block; margin-bottom:5px; font-size:0.9rem;">Alto (cm)</label><input type="number" id="terceroAlto" class="form-control" placeholder="0" style="width:100%; padding:8px;"></div>
  `;

  quantityInput.parentNode.insertBefore(container, quantityInput);

  document.getElementById('terceroAncho').addEventListener('input', window.calcularTotalTercero);
  document.getElementById('terceroAlto').addEventListener('input', window.calcularTotalTercero);

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
  `;

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

  if (productNameSelect.parentNode) {
    productNameSelect.parentNode.insertBefore(wrapper, productNameSelect.nextSibling);
  }
  populateTerceros();
}

// ==================== CLIENTES ====================

function renderClientSearchList(clients) {
  const container = document.getElementById('clientSearchResults');
  if (!container) return;

  if (clients.length === 0) {
    container.innerHTML = '<p style="text-align: center; padding: 1rem;">No se encontraron clientes</p>';
    return;
  }

  container.innerHTML = clients.map(c => `
    <div class="client-item" style="padding: 0.8rem; border-bottom: 1px solid #eee; cursor: pointer;" onclick="window.selectClient('${c.id}')">
      <strong>${c.name}</strong><br>
      <small style="color: #666;">${c.contact || 'Sin contacto'}</small>
    </div>
  `).join('');
}

window.selectClient = function (id) {
  const client = allClients.find(c => c.id === id);
  if (client) {
    currentClientId = client.id;
    document.getElementById('clientName').value = client.name;
    if (document.getElementById('clientPhone')) document.getElementById('clientPhone').value = client.telefono || '';
    if (document.getElementById('clientEmail')) document.getElementById('clientEmail').value = client.email || '';
    if (document.getElementById('clientAddress')) document.getElementById('clientAddress').value = client.direccion || '';

    window.MRModals.close(document.getElementById('searchClientModal'));
    alert(`✅ Cliente cargado: ${client.name}`);
  }
};

window.saveNewClient = async function () {
  const name = document.getElementById('clientName').value.trim();
  if (!name) {
    alert('⚠️ Ingresa el nombre del cliente.');
    return;
  }

  const clientData = {
    name: name,
    telefono: document.getElementById('clientPhone')?.value || '',
    email: document.getElementById('clientEmail')?.value || '',
    direccion: document.getElementById('clientAddress')?.value || ''
  };

  let result = null;

  if (currentClientId) {
    result = await window.mrDataManager.updateClientesCliente(currentClientId, clientData);
    if (result) alert(`✅ Cliente "${name}" actualizado.`);
  } else {
    clientData.id = 'cliente_cli_' + Date.now();
    clientData.fechaRegistro = new Date().toISOString();
    result = await window.mrDataManager.saveClientesCliente(clientData);
    if (result) {
      currentClientId = clientData.id;
      alert(`✅ Cliente "${name}" guardado.`);
    }
  }

  if (!result) alert('❌ Error al guardar el cliente.');
};

// ==================== PRODUCTOS ====================

async function populateProductSelect() {
  const selectCategoria = document.getElementById('productCategory');
  if (!selectCategoria) return;

  // 1. Categorías de productos
  const categoriasProductos = [...new Set(window.preciosClientes.map(p => p.category || p.categoria))].filter(Boolean);

  // 2. Categorías guardadas (archivo gremio_categorias.json)
  let categoriasGuardadas = [];
  if (window.mrDataManager) {
    categoriasGuardadas = await window.mrDataManager.getCategorias();
  }

  // 3. Combinar
  const categorias = [...new Set([...categoriasProductos, ...categoriasGuardadas])].sort();

  selectCategoria.innerHTML = '<option value="">Seleccionar categoría...</option>' +
    categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');
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

  const productos = preciosClientes.filter(p =>
    (p.category === categoria || p.categoria === categoria)
  );

  if (productos.length === 0) {
    productSelect.innerHTML = '<option value="">No hay productos</option>';
    productSelect.disabled = true;
    return;
  }

  productSelect.innerHTML = '<option value="">Seleccionar producto...</option>' +
    productos.map((p, index) => {
      const nombreProducto = p.name || p.nombre || p.producto || 'Sin nombre';
      return `<option value="${index}">${nombreProducto}</option>`;
    }).join('');

  productSelect.disabled = false;
  window.productosFiltrados = productos;
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
  currentProductData = precioItem;

  // USAR PRECIO PÚBLICO
  currentPrecioCliente = parseFloat(
    precioItem.priceCliente ||
    precioItem.precioCliente ||
    precioItem.cliente ||
    precioItem.publico ||
    precioItem.pricePublico ||
    precioItem.pricePublic ||
    0
  );

  const nombreBuscado = (precioItem.name || precioItem.nombre || precioItem.producto || '').trim().toLowerCase();
  const categoriaBuscada = (precioItem.category || precioItem.categoria || '').trim().toLowerCase();

  const costoItem = listaCostos.find(c => {
    const cNombre = (c.name || c.producto || '').trim().toLowerCase();
    const cCat = (c.category || c.categoria || '').trim().toLowerCase();
    return cNombre === nombreBuscado && cCat === categoriaBuscada;
  });

  // CORRECCIÓN: Buscar costo en múltiples fuentes
  let costoEncontrado = 0;

  // 1. Buscar en costos.json
  if (costoItem && costoItem.costs && costoItem.costs.total) {
    costoEncontrado = parseFloat(costoItem.costs.total);
    console.log('[CLIENTES] ✅ Costo desde costos.json:', costoEncontrado);
  }
  // 2. Buscar en precios.json (campo costo)
  else if (precioItem && precioItem.costo) {
    costoEncontrado = parseFloat(precioItem.costo);
    console.log('[CLIENTES] ✅ Costo desde precios.json (campo costo):', costoEncontrado);
  }
  // 3. Buscar campo costoGremio como fallback
  else if (precioItem && precioItem.costoGremio) {
    costoEncontrado = parseFloat(precioItem.costoGremio);
    console.log('[CLIENTES] ✅ Costo desde precios.json (costoGremio):', costoEncontrado);
  }
  // 4. Calcular 60% del precio como estimación (40% de ganancia)
  else if (currentPrecioCliente > 0) {
    costoEncontrado = currentPrecioCliente * 0.6;
    console.warn('[CLIENTES] ⚠️ Usando costo estimado (60% del precio):', costoEncontrado, 'para:', nombreProducto);
  }
  // 5. Si todo falla, costo = 0
  else {
    costoEncontrado = 0;
    console.error('[CLIENTES] ❌ No se encontró costo para:', nombreProducto, categoriaBuscada);
  }

  currentCostoMaterial = costoEncontrado;

  // Log detallado para debugging
  console.log('[CLIENTES] 📊 Resumen:', {
    producto: nombreProducto,
    categoria: categoriaBuscada,
    precioCliente: currentPrecioCliente,
    costoMaterial: currentCostoMaterial,
    margen: currentPrecioCliente > 0 ? ((currentPrecioCliente - currentCostoMaterial) / currentPrecioCliente * 100).toFixed(1) + '%' : '0%'
  });

  if (currentPrecioCliente > 0) {
    const displayElement = document.getElementById('precioClienteDisplay');
    if (displayElement) {
      displayElement.textContent = '$' + formatCurrency(currentPrecioCliente) + '/m²';
    }
    if (priceInfo) priceInfo.style.display = 'block';
    calcularTotalMaterial();
  } else {
    alert('⚠️ Este producto no tiene precio Público configurado.');
    if (priceInfo) priceInfo.style.display = 'none';
    currentPrecioCliente = 0;
  }
};

window.calcularTotalMaterial = function () {
  const ancho = parseFloat(document.getElementById('productAncho')?.value) || 0;
  const alto = parseFloat(document.getElementById('productAlto')?.value) || 0;
  const cantidad = parseInt(document.getElementById('productCantidad')?.value) || 0;

  if (currentPrecioCliente === 0 || ancho === 0 || alto === 0 || cantidad === 0) {
    document.getElementById('productTotal').textContent = '$0.00';
    document.getElementById('productFormula').textContent = 'Completa todos los datos';
    const detalle = document.getElementById('calculoDetalle');
    if (detalle) detalle.style.display = 'none';
    return;
  }

  const m2PorUnidad = (ancho * alto) / 10000;
  const m2Totales = m2PorUnidad * cantidad;
  const precioUnitario = m2PorUnidad * currentPrecioCliente;
  const totalMaterial = m2Totales * currentPrecioCliente;

  document.getElementById('productTotal').textContent = '$' + formatCurrency(totalMaterial);
  document.getElementById('productFormula').textContent =
    `((${ancho} × ${alto}) ÷ 10000) × ${cantidad} × $${formatCurrency(currentPrecioCliente)}/m²`;

  const detalle = document.getElementById('calculoDetalle');
  if (detalle) {
    document.getElementById('m2PorUnidad').textContent = formatM2(m2PorUnidad) + ' m²';
    document.getElementById('m2Totales').textContent = formatM2(m2Totales) + ' m²';
    document.getElementById('precioUnitario').textContent = '$' + formatCurrency(precioUnitario);
    detalle.style.display = 'block';
  }
};

function resetCalculos() {
  currentPrecioCliente = 0;
  currentCostoMaterial = 0;
  currentProductData = null;
  ['productAncho', 'productAlto', 'productCantidad'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('productTotal').textContent = '$0.00';
  document.getElementById('productFormula').textContent = 'Completa los datos';
  document.getElementById('calculoDetalle').style.display = 'none';
}

function addProductToQuote() {
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

  const m2PorUnidad = (ancho * alto) / 10000;
  const m2Totales = m2PorUnidad * cantidad;
  const costoUnitario = m2PorUnidad * currentCostoMaterial;
  const precioUnitario = m2PorUnidad * currentPrecioCliente;
  const totalCosto = m2Totales * currentCostoMaterial;
  const totalPrecio = m2Totales * currentPrecioCliente;

  const nombreProducto = currentProductData.name || currentProductData.nombre || currentProductData.producto;
  const categoriaProducto = currentProductData.category || currentProductData.categoria;

  // Tercero vinculado
  const tercSelect = document.getElementById('productModalTercero');
  if (tercSelect && tercSelect.value !== "") {
    const tIndex = parseInt(tercSelect.value);
    if (terceros[tIndex]) {
      const t = terceros[tIndex];
      let factor = cantidad;
      let detalleMedidas = '';
      const unidadT = t.unidad || 'unidad';
      if ((unidadT === 'm²' || unidadT === 'm2') && ancho > 0 && alto > 0) {
        factor = m2Totales;
        detalleMedidas = ` (${ancho}x${alto}cm)`;
      }
      const costoT = parseFloat(t.costo || 0);
      const precioT = parseFloat(t.precio || 0);

      currentQuoteTerceros.push({
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
      });
    }
  }

  currentQuoteProducts.push({
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
    precioCliente: currentPrecioCliente,
    precioUnitario,
    total: totalPrecio
  });

  window.MRModals.close(document.getElementById('productModal'));
  resetCalculos();
  document.getElementById('productCategory').value = '';
  document.getElementById('productName').value = '';
  document.getElementById('priceInfo').style.display = 'none';
  if (document.getElementById('productModalTercero')) {
    document.getElementById('productModalTercero').value = '';
    document.getElementById('productModalTerceroInfo').style.display = 'none';
  }

  renderQuoteProducts();
  calculateTotals();
  renderTerceros();
  alert('✅ Material agregado');
}

// ==================== TERCEROS ====================

function populateTerceros() {
  const select = document.getElementById('terceroService');
  if (!select) return;

  if (terceros.length === 0) {
    select.innerHTML = '<option value="">No hay terceros configurados</option>';
    select.disabled = true;
    return;
  }

  const options = '<option value="">Seleccionar servicio...</option>' +
    terceros.map((t, index) => {
      return `<option value="${index}">${t.nombre || 'Sin nombre'} (${t.empresaNombre || 'Sin empresa'})</option>`;
    }).join('');

  select.innerHTML = options;
  select.disabled = false;

  const selectEmbedded = document.getElementById('productModalTercero');
  if (selectEmbedded) {
    selectEmbedded.innerHTML = '<option value="">-- Ninguno --</option>' +
      terceros.map((t, index) => `<option value="${index}">${t.nombre} (${t.empresaNombre})</option>`).join('');

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

  if (isNaN(terceroIndex)) {
    document.getElementById('terceroCosto').value = '';
    document.getElementById('terceroPrecioCliente').value = '';
    return;
  }

  const tercero = terceros[terceroIndex];
  document.getElementById('terceroCosto').value = parseFloat(tercero.costo || 0).toFixed(2);
  document.getElementById('terceroPrecioCliente').value = parseFloat(tercero.precio || 0).toFixed(2);

  const dimsContainer = document.getElementById('terceroDimensiones');
  const unidad = tercero.unidad || 'unidad';

  if (dimsContainer) {
    if (unidad === 'm²' || unidad === 'm2') {
      dimsContainer.style.display = 'grid';
      if (document.getElementById('productAncho')?.value) document.getElementById('terceroAncho').value = document.getElementById('productAncho').value;
      if (document.getElementById('productAlto')?.value) document.getElementById('terceroAlto').value = document.getElementById('productAlto').value;
    } else {
      dimsContainer.style.display = 'none';
      document.getElementById('terceroAncho').value = '';
      document.getElementById('terceroAlto').value = '';
    }
  }

  const matGroup = document.getElementById('terceroMaterialGroup');
  if (matGroup) {
    if ((tercero.costoMaterial || 0) > 0 || (tercero.precioMaterial || 0) > 0) {
      matGroup.style.display = 'block';
      document.getElementById('terceroCantMaterial').value = '1';
    } else {
      matGroup.style.display = 'none';
    }
  }

  calcularTotalTercero();
}

window.calcularTotalTercero = function () {
  let cantidad = parseFloat(document.getElementById('terceroQuantity').value) || 0;
  const costo = parseFloat(document.getElementById('terceroCosto').value) || 0;
  const precioCliente = parseFloat(document.getElementById('terceroPrecioCliente').value) || 0;

  const select = document.getElementById('terceroService');
  const tercero = terceros[select.value] || {};
  const costoMaterial = parseFloat(tercero.costoMaterial || 0);
  const precioMaterial = parseFloat(tercero.precioMaterial || 0);
  const cantMaterial = parseFloat(document.getElementById('terceroCantMaterial')?.value) || 0;

  const ancho = parseFloat(document.getElementById('terceroAncho')?.value) || 0;
  const alto = parseFloat(document.getElementById('terceroAlto')?.value) || 0;
  const dimsVisible = document.getElementById('terceroDimensiones')?.style.display !== 'none';

  let factor = cantidad;

  if (dimsVisible && ancho > 0 && alto > 0) {
    const m2 = (ancho * alto) / 10000;
    factor = m2 * cantidad;
  }

  let totalCosto = factor * costo;
  let totalPrecio = factor * precioCliente;

  if (costoMaterial > 0 || precioMaterial > 0) {
    totalCosto += (costoMaterial * cantMaterial);
    totalPrecio += (precioMaterial * cantMaterial);
  }

  document.getElementById('terceroTotalCosto').textContent = '$' + formatCurrency(totalCosto);
  document.getElementById('terceroTotal').textContent = '$' + formatCurrency(totalPrecio);
};

function addTerceroToQuote() {
  const select = document.getElementById('terceroService');
  const terceroIndex = parseInt(select.value);
  const cantidad = parseFloat(document.getElementById('terceroQuantity').value);

  if (isNaN(terceroIndex) || !cantidad) {
    alert('⚠️ Completa todos los campos');
    return;
  }

  const tercero = terceros[terceroIndex];
  const costo = parseFloat(tercero.costo || 0);
  const precioVenta = parseFloat(tercero.precio || 0);
  const unidad = tercero.unidad || 'unidad';
  const costoMaterial = parseFloat(tercero.costoMaterial || 0);
  const precioMaterial = parseFloat(tercero.precioMaterial || 0);
  const cantMaterial = parseFloat(document.getElementById('terceroCantMaterial')?.value) || 0;

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

  currentQuoteTerceros.push({
    id: Date.now().toString(),
    tipo: 'tercero',
    nombre: (tercero.nombre || 'Servicio') + detalleMedidas + detalleMaterial,
    empresa: tercero.empresaNombre,
    cantidad,
    ancho: dimsVisible ? ancho : 0,
    alto: dimsVisible ? alto : 0,
    factorCalculo: factor,
    costo,
    precioCliente: precioVenta,
    unidad,
    totalCosto,
    total: totalPrecio
  });

  window.MRModals.close(document.getElementById('terceroServiceModal'));
  document.getElementById('terceroService').value = '';
  document.getElementById('terceroQuantity').value = '';
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
          <div><span style="color: #aaa;">Medidas:</span> <strong>${item.ancho}x${item.alto} cm</strong></div>
          <div><span style="color: #aaa;">Cantidad:</span> <strong>${item.cantidad}</strong></div>
          <div><span style="color: #aaa;">m² totales:</span> <strong>${formatM2(item.m2Totales)}</strong></div>
          <div><span style="color: #aaa;">Tu costo:</span> <strong style="color: #FF6B6B;">$${formatCurrency(item.costoTotal)}</strong></div>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.8rem; display: flex; justify-content: space-between;">
          <strong>TOTAL CLIENTE:</strong>
          <strong style="color: #51CF66; font-size: 1.2rem;">$${formatCurrency(item.total)}</strong>
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
          <h3 style="margin: 0 0 0.5rem 0; color: #4ECDC4;">${item.nombre}</h3>
          <p style="margin: 0;">${item.cantidad} ${item.unidad} • ${item.empresa}</p>
          <p style="margin: 0; color: #FF6B6B;">Costo: $${formatCurrency(item.totalCosto)}</p>
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
  const iva = subtotal * 0.21;
  const total = subtotal + iva;
  const ganancia = total - totalCostos;

  currentTotals = { costoTotal: totalCostos, subtotal, iva, totalCliente: total, ganancia };

  document.getElementById('costoMateriales').textContent = '$' + formatCurrency(costoMateriales);
  document.getElementById('costoTerceros').textContent = '$' + formatCurrency(costoTerceros);
  document.getElementById('totalCostos').textContent = '$' + formatCurrency(totalCostos);
  document.getElementById('subtotal').textContent = '$' + formatCurrency(subtotal);
  document.getElementById('iva').textContent = '$' + formatCurrency(iva);
  document.getElementById('total').textContent = '$' + formatCurrency(total);
  document.getElementById('gananciaNetaDisplay').textContent = '$' + formatCurrency(ganancia);

  calcularSaldo();
}

window.calcularSaldo = function () {
  const total = currentTotals.totalCliente || 0;
  const anticipo = parseFloat(document.getElementById('montoAnticipo')?.value) || 0;
  const saldo = total - anticipo;
  document.getElementById('saldoPendiente').textContent = '$' + formatCurrency(saldo);
};

// ==================== GUARDAR ====================

window.saveQuote = async function () {
  const clientName = document.getElementById('clientName')?.value.trim();

  if (!currentClientId) {
    alert('⚠️ Error: No hay un cliente cargado.');
    return;
  }

  const hasMulti = window.multiCategoryManager && window.multiCategoryManager.getCategories().length > 0;

  if (currentQuoteProducts.length === 0 && currentQuoteTerceros.length === 0 && !hasMulti) {
    alert('⚠️ Agrega al menos un producto');
    return;
  }

  const anticipo = parseFloat(document.getElementById('montoAnticipo')?.value) || 0;

  const quote = {
    id: Date.now().toString(),
    clientId: currentClientId,
    cliente: {
      nombre: clientName,
      telefono: document.getElementById('clientPhone')?.value || '',
      email: document.getElementById('clientEmail')?.value || '',
      direccion: document.getElementById('clientAddress')?.value || ''
    },
    fechaEntrega: document.getElementById('deliveryDate')?.value || '',
    productos: currentQuoteProducts,
    terceros: currentQuoteTerceros,
    multiCategories: window.multiCategoryManager ? window.multiCategoryManager.exportState() : null,
    costoTotal: currentTotals.costoTotal,
    subtotal: currentTotals.subtotal,
    iva: currentTotals.iva,
    totalCliente: currentTotals.totalCliente,
    ganancia: currentTotals.ganancia,
    anticipo,
    saldo: currentTotals.totalCliente - anticipo,
    fecha: new Date().toISOString(),
    estado: 'pendiente'
  };

  try {
    const cotizaciones = await window.mrDataManager.getClientesCotizaciones();
    cotizaciones.push(quote);
    const success = await window.mrDataManager.saveClientesCotizaciones(cotizaciones);

    if (success) {
      alert('✅ Cotización guardada');
      clearQuote();
      await loadQuotations();
    } else {
      alert('❌ Error al guardar');
    }
  } catch (error) {
    console.error('[CLIENTES] Error guardando:', error);
    alert('❌ Error al guardar');
  }
};

window.clearQuote = function () {
  currentQuoteProducts = [];
  currentQuoteTerceros = [];
  currentClientId = null;

  if (window.multiCategoryManager) {
    window.multiCategoryManager.clearCategories();
  }

  ['clientName', 'clientPhone', 'clientEmail', 'clientAddress', 'montoAnticipo'].forEach(id => {
    const elem = document.getElementById(id);
    if (elem) elem.value = '';
  });

  // deliveryDate is handled separately as it's not always present or might have a default
  const deliveryDateElem = document.getElementById('deliveryDate');
  if (deliveryDateElem) deliveryDateElem.value = '';

  renderQuoteProducts();
  renderTerceros();
  calculateTotals();
};

// ==================== LISTADO Y DETALLE ====================

async function loadQuotations() {
  const container = document.getElementById('quotesList');
  if (!container) return;

  container.innerHTML = '<p class="empty-state">Cargando cotizaciones...</p>';

  try {
    cotizacionesClientes = await window.mrDataManager.getClientesCotizaciones();
    renderQuotations();
    updateStatistics(); // Call updateStatistics here after loading and rendering
  } catch (error) {
    console.error('[CLIENTES] ❌ Error cargando cotizaciones:', error);
    container.innerHTML = '<p class="empty-state">Error al cargar historial</p>';
  }
}

window.filterHistoryByClient = function (name) {
  renderQuotations(name);
};

function renderQuotations(filterName = '') {
  const container = document.getElementById('quotesList');
  if (!container) return;

  // Ordenar por fecha descendente (aplicar a la lista completa antes de filtrar/slice)
  cotizacionesClientes.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // Filtrar
  let filtered = cotizacionesClientes;

  if (filterName && filterName.trim() !== '') {
    const term = filterName.toLowerCase();
    filtered = cotizacionesClientes.filter(c => c.cliente.nombre.toLowerCase().includes(term));

    // Mostrar mensaje de filtro activo
    const msg = document.getElementById('historyFilterMsg');
    if (msg) {
      msg.style.display = 'block';
      document.getElementById('filterClientName').textContent = filterName;
    }
  } else {
    const msg = document.getElementById('historyFilterMsg');
    if (msg) msg.style.display = 'none';

    // Mostrar solo 5 recientes si no hay filtro activo
    filtered = cotizacionesClientes.slice(0, 5);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-state">No se encontraron cotizaciones para este cliente</p>';
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
        </div>
      </div>
    `;
  }).join('');
}

window.verDetalleCotizacion = function (cotizacionId) {
  const cotizacion = cotizacionesClientes.find(c => c.id === cotizacionId);
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
                    <button class="btn-close" onclick="cerrarDetalleCotizacion()">&times;</button>
                </div>
                <div class="modal-body" id="detalleModalBody">
                    <!-- Contenido dinámico -->
                </div>
                <div class="modal-footer">
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
                                    ${p.precioCliente ? `<div>Precio/m²: <strong>$${formatCurrency(p.precioCliente)}</strong></div>` : ''}
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
            
            <!-- Servicios Terceros -->
            ${cot.terceros && cot.terceros.length > 0 ? `
                <div>
                    <h3 style="margin-bottom: 0.5rem; color: var(--primary-color);">🔧 Servicios de Terceros</h3>
                    <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
                        ${cot.terceros.map((t, idx) => `
                            <div style="padding: 0.75rem; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: ${idx < cot.terceros.length - 1 ? '0.75rem' : '0'};">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                                    <div>
                                        <strong style="color: #51CF66;">${t.nombre}</strong>
                                        <div style="font-size: 0.85rem; opacity: 0.7;">${t.empresa || 'Empresa externa'}</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 1.1rem; font-weight: bold; color: #51CF66;">
                                            $${formatCurrency(t.total || 0)}
                                        </div>
                                    </div>
                                </div>
                                <div style="font-size: 0.9rem;">
                                    <div>Cantidad: <strong>${t.cantidad} ${t.unidad || 'u'}</strong></div>
                                    ${t.detalleMedidas ? `<div>Medidas: ${t.detalleMedidas}</div>` : ''}
                                </div>
                                ${t.totalCosto ? `
                                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem;">
                                        <span style="color: #FF6B6B;">Costo: $${formatCurrency(t.totalCosto)}</span>
                                        <span style="margin: 0 0.5rem;">•</span>
                                        <span style="color: #4CAF50;">Ganancia: $${formatCurrency((t.total || 0) - (t.totalCosto || 0))}</span>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Totales -->
            <div>
                <h3 style="margin-bottom: 0.5rem; color: var(--primary-color);">💰 Totales</h3>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem; opacity: 0.8;">
                       <span>Costo Total:</span>
                       <span>$${formatCurrency(cot.costoTotal || 0)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                       <span>Subtotal:</span>
                       <span>$${formatCurrency(cot.subtotal || 0)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                       <span>IVA:</span>
                       <span>$${formatCurrency(cot.iva || 0)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.2); font-size: 1.5rem; font-weight: bold; color: #51CF66;">
                       <span>Total Cliente:</span>
                       <span>$${formatCurrency(cot.totalCliente || 0)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 1rem; color: #4CAF50;">
                       <span>Ganancia Neta:</span>
                       <span>$${formatCurrency(cot.ganancia || 0)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

window.aprobarCotizacion = async function (id) {
  if (!confirm('¿Aprobar cotización? Esto registrará los movimientos de ingresos y egresos.')) return;

  try {
    const cotizaciones = await window.mrDataManager.getClientesCotizaciones();
    const cotizacion = cotizaciones.find(c => c.id === id);

    if (!cotizacion) {
      alert('❌ Cotización no encontrada.');
      return;
    }

    cotizacion.estado = 'aprobada';
    cotizacion.approved = true;
    cotizacion.fechaAprobacion = new Date().toISOString();

    const successCot = await window.mrDataManager.saveClientesCotizaciones(cotizaciones);
    if (!successCot) return;

    const gastos = await window.mrDataManager.getGastos();
    const fechaAprobacion = new Date().toISOString();
    const cotiIdShort = cotizacion.id.slice(-6);

    if (cotizacion.costoTotal > 0) {
      gastos.push({
        id: `gasto_coti_cli_${cotizacion.id}`,
        tipo: 'egreso',
        descripcion: `Costo Total - Coti Cliente #${cotiIdShort} (${cotizacion.cliente.nombre})`,
        monto: cotizacion.costoTotal,
        fecha: fechaAprobacion,
        categoria: 'costo_venta_cliente'
      });
    }

    // Ingreso por el ANTICIPO (si existe)
    const montoIngreso = parseFloat(cotizacion.anticipo) || 0;
    if (montoIngreso > 0) {
      gastos.push({
        id: `ingreso_coti_cli_${cotizacion.id}`,
        tipo: 'ingreso',
        descripcion: `Anticipo Cliente - Coti #${cotiIdShort} (${cotizacion.cliente.nombre})`,
        monto: montoIngreso,
        fecha: fechaAprobacion,
        categoria: 'venta_cliente'
      });
    }

    // 3. Crear TRABAJO automáticamente
    let worksData = { works: [], notifications: [] };
    try {
      const response = await fetch('/api/trabajos');
      if (response.ok) {
        worksData = await response.json();
      }
    } catch (e) { console.warn('Error obteniendo trabajos del servidor:', e); }

    // Asegurar estructura
    if (!worksData || typeof worksData !== 'object') worksData = { works: [], notifications: [] };
    if (!Array.isArray(worksData.works)) worksData.works = [];

    // Valores seguros
    const clientName = cotizacion.cliente?.nombre || cotizacion.clientName || 'Cliente';
    const total = parseFloat(cotizacion.totalCliente || cotizacion.total || 0);
    const cost = parseFloat(cotizacion.costoTotal || 0);
    const profit = parseFloat(cotizacion.ganancia || 0);
    const balance = total - montoIngreso;

    const newWork = {
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
      status: 'pending',
      paymentStatus: (montoIngreso >= total - 1) ? 'paid' : 'pending',
      priority: 'normal',
      createdAt: new Date().toISOString(),
      timeline: [{ type: 'created', description: 'Trabajo creado automáticamente desde Clientes', timestamp: new Date().toISOString() }],
      notes: []
    };
    worksData.works.push(newWork);

    // Guardado directo
    const res = await fetch('/api/trabajos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(worksData)
    });
    const json = await res.json();
    const saveSuccess = json.success;

    console.log('[CLIENTES] Resultado guardado trabajo:', saveSuccess);

    await window.mrDataManager.saveGastos(gastos);

    if (window.notifyWorkCreated) {
      window.notifyWorkCreated(newWork);
    } else {
      alert('✅ Cotización aprobada, Trabajo creado y movimientos registrados.');
    }
    await loadQuotations();
    updateStatistics();
  } catch (error) {
    console.error('[CLIENTES] Error:', error);
    alert('❌ Error al aprobar');
  }
};

window.borrarCotizacion = async function (id) {
  if (!confirm('⚠️ ¿Estás seguro de eliminar esta cotización?')) return;

  try {
    const cotizaciones = await window.mrDataManager.getClientesCotizaciones();
    const filtered = cotizaciones.filter(c => c.id !== id);
    await window.mrDataManager.saveClientesCotizaciones(filtered);
    alert('🗑️ Cotización eliminada.');
    await loadQuotations();
    updateStatistics();
  } catch (error) {
    console.error('[CLIENTES] Error al borrar:', error);
    alert('❌ Error al borrar');
  }
};

window.updateStatistics = function () {
  const aprobadas = cotizacionesClientes.filter(c => c.estado === 'aprobada');
  const pendientes = cotizacionesClientes.filter(c => c.estado === 'pendiente');

  const totalAprobado = aprobadas.reduce((sum, c) => sum + (c.totalCliente || 0), 0);
  const totalGanancia = aprobadas.reduce((sum, c) => sum + (c.ganancia || 0), 0);

  document.getElementById('totalApproved').textContent = '$' + totalAprobado.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  document.getElementById('totalGanancia').textContent = '$' + totalGanancia.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  document.getElementById('countApproved').textContent = aprobadas.length;
  document.getElementById('countPending').textContent = pendientes.length;
};

window.generatePDF = async function () {
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

  // Configuración básica
  const margin = 20;
  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- ENCABEZADO CON LOGO ---
  const fecha = new Date().toLocaleDateString();
  const logoUrl = 'img/logo.png';
  const logoData = await loadImage(logoUrl);

  if (logoData) {
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
    // Fallback texto
    doc.setFontSize(22);
    doc.setTextColor(0, 168, 204);
    doc.text('MR Letreros', margin, y);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Soluciones Gráficas Integrales', margin, y + 6);

    doc.setTextColor(0);
    doc.text(`Fecha: ${fecha}`, pageWidth - margin - 40, y);
    y += 20;
  }

  // Línea separadora decorativa
  doc.setDrawColor(0, 168, 204);
  doc.setLineWidth(1);
  doc.line(margin, y - 5, pageWidth - margin, y - 5);

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0);
  doc.text('PRESUPUESTO', margin, y);
  doc.setFont(undefined, 'normal');

  y += 10;

  // --- DATOS DEL CLIENTE ---
  const clientName = document.getElementById('clientName')?.value || 'Cliente General';
  const clientPhone = document.getElementById('clientPhone')?.value || '';
  const clientEmail = document.getElementById('clientEmail')?.value || '';

  doc.setFontSize(11);
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, pageWidth - (margin * 2), 25, 'F');

  doc.text(`Cliente: ${clientName}`, margin + 5, y + 7);
  if (clientPhone) doc.text(`Teléfono: ${clientPhone}`, margin + 5, y + 14);
  if (clientEmail) doc.text(`Email: ${clientEmail}`, margin + 5, y + 21);

  y += 35;

  // --- DETALLE DE PRODUCTOS ---
  doc.setFontSize(12);
  doc.text('Detalle:', margin, y);
  y += 8;

  doc.setFontSize(10);

  // Función auxiliar para agregar líneas
  const addLine = (desc, price) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(desc, margin, y);
    doc.text(price, pageWidth - margin, y, { align: 'right' });
    y += 7;
  };

  // 1. Productos Tradicionales
  if (currentQuoteProducts.length > 0) {
    currentQuoteProducts.forEach(p => {
      const desc = `• ${p.producto} (${p.ancho}x${p.alto}cm) x ${p.cantidad}u`;
      const price = `$${formatCurrency(p.total)}`;
      addLine(desc, price);
    });
  }

  // 2. Servicios de Terceros
  if (currentQuoteTerceros.length > 0) {
    currentQuoteTerceros.forEach(t => {
      const desc = `• ${t.nombre} (${t.cantidad} ${t.unidad || 'u'})`;
      const price = `$${formatCurrency(t.total)}`;
      addLine(desc, price);
    });
  }

  // 3. Categorías Múltiples
  if (window.multiCategoryManager) {
    const cats = window.multiCategoryManager.getCategories();
    if (cats.length > 0) {
      // Mostrar dimensiones compartidas si existen
      const dims = window.multiCategoryManager.getSharedDimensions();
      if (dims.totalM2 > 0) {
        doc.setFont(undefined, 'italic');
        addLine(`Medidas Generales: ${dims.width}m x ${dims.height}m (${dims.totalM2.toFixed(2)} m²)`, '');
        doc.setFont(undefined, 'normal');
      }

      cats.forEach(c => {
        const desc = `• ${c.name}`;
        const price = `$${formatCurrency(c.totalPrice)}`;
        addLine(desc, price);
      });

      const ink = window.multiCategoryManager.calculateInkTotals();
      if (window.multiCategoryManager.inkPriceEnabled && ink.totalPrice > 0) {
        addLine(`• Costo de Tinta`, `$${formatCurrency(ink.totalPrice)}`);
      }
    }
  }

  y += 5;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

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

  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('TOTAL:', xLabel, y);
  doc.text(`$${formatCurrency(currentTotals.totalCliente)}`, xValue, y, { align: 'right' });

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

  // Pie de página en todas las páginas
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFontSize(8);
    doc.setTextColor(150);

    // Línea separadora
    doc.setDrawColor(200);
    doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

    // Info izquierda
    doc.text('Presupuesto válido por 15 días.', margin, pageHeight - 20);
    doc.text('MR Letreros - Soluciones Gráficas Integrales', margin, pageHeight - 15);
    doc.text('Contacto: +54 9 11 1234-5678 | info@mrletreros.com', margin, pageHeight - 10);

    // Info derecha (Paginación)
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  // Guardar PDF
  doc.save(`Presupuesto_${clientName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
};

window.startNotificationPolling = function () {
  checkNotifications();
  setInterval(checkNotifications, 10000);
};

async function checkNotifications() {
  try {
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
        btnTrabajos.style.backgroundColor = '#FFC107';
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