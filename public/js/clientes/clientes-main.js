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
window.currentClientId = null;
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
    if (!window.currentClientId) {
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
      window.allClients = allClients; // exponer para override de selectClient
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
    <div class="client-item" style="padding: 0.8rem; border-bottom: 1px solid #eee; cursor: pointer;" onclick="window.selectClient('${escapeHtml(c.id)}')">
      <strong>${escapeHtml(c.name)}</strong><br>
      <small style="color: #666;">${escapeHtml(c.contact || 'Sin contacto')}</small>
    </div>
  `).join('');
}

window.selectClient = function (id) {
  const client = allClients.find(c => String(c.id) === String(id));
  if (client) {
    window.currentClientId = client.id;
    document.getElementById('clientName').value = client.name;
    if (document.getElementById('clientPhone')) document.getElementById('clientPhone').value = client.telefono || '';
    if (document.getElementById('clientEmail')) document.getElementById('clientEmail').value = client.email || '';
    if (document.getElementById('clientAddress')) document.getElementById('clientAddress').value = client.direccion || '';

    window.MRModals.close(document.getElementById('searchClientModal'));
    
    if (window.updateClientActionButton) window.updateClientActionButton();
    if (window.onClientNameInput) window.onClientNameInput(client.name);
    
    alert(`✅ Cliente cargado: ${client.name}`);
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

  if (window.currentClientId) {
    // Si ya existe, es una actualización silenciosa y pasamos a presupuestar
    result = await window.mrDataManager.updateClientesCliente(window.currentClientId, clientData);
    if (result) {
      window.updateClientActionButton();
      const productModal = document.getElementById('productModal');
      populateProductSelect();
      if (window.MRModals && productModal) window.MRModals.open(productModal);
    } else {
      alert('❌ Error al actualizar el cliente.');
    }
  } else {
    clientData.id = 'cliente_cli_' + Date.now();
    clientData.fechaRegistro = new Date().toISOString();
    result = await window.mrDataManager.saveClientesCliente(clientData);
    if (result) {
      window.currentClientId = clientData.id;
      window.updateClientActionButton();
      alert(`✅ Cliente "${name}" guardado. Ya puedes presupuestar.`);
    } else {
      alert('❌ Error al guardar el cliente.');
    }
  }
};


// ==================== PRODUCTOS ====================

async function populateProductSelect() {
  const selectCategoria = document.getElementById('productCategory');
  if (!selectCategoria) return;

  // 1. Categorías de productos (desde precios.json)
  const categoriasProductos = [...new Set(window.preciosClientes.map(p => p.category || p.categoria))].filter(Boolean);

  // 2. Categorías de materiales (desde inventario/costos)
  const categoriasMateriales = [...new Set(window.listaCostos.map(m => m.category || m.categoria))].filter(Boolean);

  // 3. Categorías guardadas explicitamente (archivo gremio_categorias.json)
  let categoriasGuardadas = [];
  if (window.mrDataManager) {
    categoriasGuardadas = await window.mrDataManager.getCategorias();
  }

  // 4. Combinar todo y ordenar
  const categorias = [...new Set([...categoriasProductos, ...categoriasMateriales, ...categoriasGuardadas])].sort();

  selectCategoria.innerHTML = '<option value="">Seleccionar categoría...</option>' +
    categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');
  
  console.log('[CLIENTES] ✅ Categorías sincronizadas:', categorias);
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

  // A. Obtener productos de precios.json
  const productosBase = preciosClientes.filter(p =>
    (p.category === categoria || p.categoria === categoria)
  );

  // B. Obtener materiales de listaCostos que NO estén en productosBase
  const materialesBase = window.listaCostos.filter(m => 
    (m.category === categoria || m.categoria === categoria) &&
    !productosBase.some(p => (p.name || p.nombre || p.producto) === (m.name || m.producto))
  );

  // Combinar (convertir materiales a formato producto si es necesario)
  const productos = [...productosBase];
  materialesBase.forEach(m => {
    productos.push({
      id: m.id,
      name: m.name || m.producto,
      category: m.category || m.categoria,
      priceCliente: m.costs?.total ? m.costs.total * 2 : 0, // Fallback: costo * 2 si no hay precio
      costo: m.costs?.total || 0,
      isFromMaterial: true,
      unit: m.unit || m.unidad || 'm²'
    });
  });

  if (productos.length === 0) {
    productSelect.innerHTML = '<option value="">No hay productos en esta categoría</option>';
    productSelect.disabled = true;
    return;
  }

  productSelect.innerHTML = '<option value="">Seleccionar producto...</option>' +
    productos.map((p, index) => {
      const nombreProducto = p.name || p.nombre || p.producto || 'Sin nombre';
      const indicator = p.isFromMaterial ? ' 📦' : '';
      return `<option value="${index}">${nombreProducto}${indicator}</option>`;
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
    const unitLabel = currentProductData.unit === 'ml' ? '/ml' : currentProductData.unit === 'unidad' ? '/unidad' : '/m²';
    if (displayElement) {
      displayElement.textContent = '$' + formatCurrency(currentPrecioCliente) + unitLabel;
    }
    if (priceInfo) priceInfo.style.display = 'block';

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
        if (labelAncho) labelAncho.textContent = 'Largo / ML (cm)';
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
        if (labelAncho) labelAncho.textContent = 'Ancho (cm)';
        if (productDimensionsRow) productDimensionsRow.style.display = 'flex';
      }
    }

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

  const unitData = currentProductData?.unit || 'm²';
  
  // Validación según unidad
  let canCalculate = true;
  if (currentPrecioCliente === 0 || cantidad === 0) canCalculate = false;
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
    factorPorUnidad = (ancho || alto) / 100;
    formulaDisplay = `(${ancho || alto} cm ÷ 100) × ${cantidad} × $${formatCurrency(currentPrecioCliente)}/ml`;
  } else if (unitData === 'unidad') {
    factorPorUnidad = 1;
    formulaDisplay = `${cantidad} unid. × $${formatCurrency(currentPrecioCliente)}/unid.`;
  } else {
    factorPorUnidad = (ancho * alto) / 10000;
    formulaDisplay = `((${ancho} × ${alto}) ÷ 10000) × ${cantidad} × $${formatCurrency(currentPrecioCliente)}/m²`;
  }

  const factorTotales = factorPorUnidad * cantidad;
  const precioUnitario = factorPorUnidad * currentPrecioCliente;
  const totalMaterial = factorTotales * currentPrecioCliente;

  document.getElementById('productTotal').textContent = '$' + formatCurrency(totalMaterial);
  document.getElementById('productFormula').textContent = formulaDisplay;

  const detalle = document.getElementById('calculoDetalle');
  if (detalle) {
    document.getElementById('m2PorUnidad').textContent = formatM2(factorPorUnidad) + ' ' + unitLabel;
    document.getElementById('m2Totales').textContent = formatM2(factorTotales) + ' ' + unitLabel;
    
    // Also change the labels if they exist
    const m2Elem = document.getElementById('m2PorUnidad');
    const m2TotElem = document.getElementById('m2Totales');
    if (m2Elem && m2Elem.previousElementSibling) m2Elem.previousElementSibling.textContent = unitLabel + ' por unidad';
    if (m2TotElem && m2TotElem.previousElementSibling) m2TotElem.previousElementSibling.textContent = unitLabel + ' totales';
    
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

  // Restaurar visibilidad de inputs
  const groupAncho = document.getElementById('groupAncho');
  const groupAlto = document.getElementById('groupAlto');
  const labelAncho = document.getElementById('labelAncho');
  const productDimensionsRow = document.getElementById('productDimensionsRow');
  if (groupAncho) groupAncho.style.display = 'block';
  if (groupAlto) groupAlto.style.display = 'block';
  if (labelAncho) labelAncho.textContent = 'Ancho (cm)';
  if (productDimensionsRow) productDimensionsRow.style.display = 'flex';
}

function addProductToQuote() {
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
  const precioUnitario = factorPorUnidad * currentPrecioCliente;
  const totalCosto = factorTotales * currentCostoMaterial;
  const totalPrecio = factorTotales * currentPrecioCliente;

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
      const unidadT = t.unidad || 'unidad';
      if ((unidadT === 'm²' || unidadT === 'm2') && ancho > 0 && alto > 0) {
        factor = ((ancho * alto) / 10000) * cantidad; // Usar m² reales
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
    m2PorUnidad: factorPorUnidad,
    m2Totales: factorTotales,
    costoMaterial: currentCostoMaterial,
    costoUnitario,
    costoTotal: totalCosto,
    precioCliente: currentPrecioCliente,
    precioUnitario,
    total: totalPrecio,
    unidad: unitData,
    unidadCalcFactor: factorPorUnidad
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
          <h3 style="margin: 0 0 0.5rem 0; color: #51CF66;">${escapeHtml(item.producto)}</h3>
          <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">📁 ${escapeHtml(item.categoria)}</p>
        </div>
        <button class="btn btn-danger btn-small" onclick="removeProduct('${escapeHtml(item.id)}')">🗑️</button>
      </div>
      <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.8rem;">
          <div><span style="color: #aaa;">Medidas:</span> <strong>${item.ancho}x${item.alto} cm</strong></div>
          <div><span style="color: #aaa;">Cantidad:</span> <strong>${item.cantidad}</strong></div>
          <div><span style="color: #aaa;">${item.unidad === 'ml' ? 'ml' : item.unidad === 'unidad' ? 'unid' : 'm²'} totales:</span> <strong>${formatM2(item.m2Totales || item.unidadCalcFactor || 0)}</strong></div>
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
          <h3 style="margin: 0 0 0.5rem 0; color: #4ECDC4;">${escapeHtml(item.nombre)}</h3>
          <p style="margin: 0;">${escapeHtml(item.cantidad)} ${escapeHtml(item.unidad)} • ${escapeHtml(item.empresa)}</p>
          <p style="margin: 0; color: #FF6B6B;">Costo: $${formatCurrency(item.totalCosto)}</p>
          <p style="margin: 0; color: #51CF66;"><strong>Cobras: $${formatCurrency(item.total)}</strong></p>
        </div>
        <button class="btn btn-danger btn-small" onclick="removeTercero('${escapeHtml(item.id)}')">🗑️</button>
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
  
  // El subtotal base para el cliente incluye tanto productos como servicios de terceros
  const subtotal = subtotalProductos + subtotalTerceros;
  
  const ivaActivo = document.getElementById('ivaCheckbox')?.checked || false;
  const iva = ivaActivo ? subtotal * 0.21 : 0;
  
  const inputAjuste = document.getElementById('descuentoEspecial');
  const porcAjuste = inputAjuste ? parseFloat(inputAjuste.value) || 0 : 0;
  const montoAjuste = subtotal * (porcAjuste / 100);
  
  const total = subtotal + iva + montoAjuste;
  const ganancia = total - totalCostos;

  currentTotals = { 
    costoTotal: totalCostos, 
    subtotal, 
    iva, 
    totalCliente: total, 
    ganancia, 
    descuentoEspecial: montoAjuste, // Mantenemos el nombre del campo para compatibilidad con JSON
    porcentajeDescuento: porcAjuste
  };

  // FIX: null-guard — algunos IDs no existen en clientes.html y esto lanzaba TypeError
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('costoMateriales', '$' + formatCurrency(costoMateriales));
  setText('costoTerceros', '$' + formatCurrency(costoTerceros));
  setText('totalCostos', '$' + formatCurrency(totalCostos));
  setText('subtotal', '$' + formatCurrency(subtotal));
  setText('iva', '$' + formatCurrency(iva));
  setText('total', '$' + formatCurrency(total));
  setText('gananciaNetaDisplay', '$' + formatCurrency(ganancia));

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

  if (!clientName) {
    alert('⚠️ Error: Ingresa el nombre del cliente.');
    return;
  }

  // Si no hay cliente cargado, crearlo automáticamente
  if (!window.currentClientId) {
    const clientData = {
      id: 'cliente_cli_' + Date.now(),
      name: clientName,
      telefono: document.getElementById('clientPhone')?.value || '',
      email: document.getElementById('clientEmail')?.value || '',
      direccion: document.getElementById('clientAddress')?.value || '',
      fechaRegistro: new Date().toISOString()
    };
    const result = await window.mrDataManager.saveClientesCliente(clientData);
    if (result) {
      window.currentClientId = clientData.id;
      console.log('[CLIENTES] Cliente creado automáticamente:', clientData.id);
    } else {
      alert('❌ Error al guardar el cliente.');
      return;
    }
  }

  const hasMulti = window.multiCategoryManager && window.multiCategoryManager.getCategories().length > 0;

  if (currentQuoteProducts.length === 0 && currentQuoteTerceros.length === 0 && !hasMulti) {
    alert('⚠️ Agrega al menos un producto');
    return;
  }

  const anticipo = parseFloat(document.getElementById('montoAnticipo')?.value) || 0;

  const quote = {
    id: Date.now().toString(),
    clientId: window.currentClientId,
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
    descuentoEspecial: currentTotals.descuentoEspecial || 0,
    porcentajeDescuento: currentTotals.porcentajeDescuento || 0,
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
  window.currentClientId = null;

  if (window.multiCategoryManager) {
    window.multiCategoryManager.clearCategories();
  }

  ['clientName', 'clientPhone', 'clientEmail', 'clientAddress', 'montoAnticipo', 'descuentoEspecial'].forEach(id => {
    const elem = document.getElementById(id);
    if (elem) {
      if (id === 'descuentoEspecial') elem.value = '0';
      else elem.value = '';
    }
  });

  // deliveryDate is handled separately as it's not always present or might have a default
  const deliveryDateElem = document.getElementById('deliveryDate');
  if (deliveryDateElem) deliveryDateElem.value = '';

  renderQuoteProducts();
  renderTerceros();
  calculateTotals();
  
  if (window.updateClientActionButton) window.updateClientActionButton();
};

window.verDetalleCotizacion = async function (cotizacionId) {
  let cotizacion = cotizacionesClientes.find(c => String(c.id) === String(cotizacionId));
  if (!cotizacion) {
    // Fallback: refrescar desde el servidor y reintentar
    try {
      cotizacionesClientes = await window.mrDataManager.getClientesCotizaciones() || [];
      cotizacion = cotizacionesClientes.find(c => String(c.id) === String(cotizacionId));
    } catch (e) { /* ignorar */ }
  }
  if (!cotizacion) {
    alert('❌ Cotización no encontrada. Recargá la página e intentá de nuevo.');
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
                                        <div style="font-weight: bold; color: #60A5FA;">${t.nombre || t.empresa || 'Servicio'}</div>
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
                    ${(() => { const ajuste = Number(cot.descuentoEspecial) || 0; const porc = Number(cot.porcentajeDescuento) || 0; if (ajuste === 0 && porc === 0) return ''; const esDescuento = ajuste < 0; return `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: ${esDescuento ? '#51CF66' : '#F87171'};">
                       <span>${esDescuento ? 'Descuento Especial' : 'Recargo Especial'} (${porc}%):</span>
                       <span>${esDescuento ? '-' : '+'} $${formatCurrency(Math.abs(ajuste))}</span>
                    </div>`; })()}
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
  if (!confirm('¿Aprobar cotización? Esto creará un trabajo y registrará los movimientos.')) return;

  try {
    // 1. Obtener y actualizar la cotización
    const cotizaciones = await window.mrDataManager.getClientesCotizaciones();
    const cotizacion = cotizaciones.find(c => String(c.id) === String(id));
    if (!cotizacion) { alert('❌ Cotización no encontrada.'); return; }

    cotizacion.estado = 'aprobada';
    cotizacion.approved = true;
    cotizacion.fechaAprobacion = new Date().toISOString();

    const successCot = await window.mrDataManager.saveClientesCotizaciones(cotizaciones);
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
        descripcion: `Costo Total - Coti Cliente #${cotiIdShort} (${cotizacion.cliente.nombre})`,
        monto: cotizacion.costoTotal,
        fecha: fechaAprobacion,
        categoria: 'costo_venta_cliente'
      });
    }

    // ✅ Registrar Venta Total para que aparezca en la lista de Ingresos de Rendimientos
    // (FIX: antes se registraba además el anticipo como ingreso separado → doble conteo)
    if (montoVentaTotal > 0) {
      const descTag = cotizacion.porcentajeDescuento > 0 ? ` (Desc. ${cotizacion.porcentajeDescuento}%)` : '';
      gastos.push({
        id: `ingreso_coti_${cotizacion.id}`,
        tipo: 'ingreso',
        descripcion: `Venta Total${descTag} - Coti Cliente #${cotiIdShort} (${cotizacion.cliente.nombre})`,
        monto: montoVentaTotal,
        fecha: fechaAprobacion,
        categoria: 'venta_cliente'
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
    const descripcion = items.slice(0, 5).join(', ') || 'Trabajo de cliente';

    const newWork = {
      id: `work_${Date.now()}`,
      quoteId: cotizacion.id,
      tipo_cliente: 'cliente',
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
      deliveryDate: cotizacion.fechaEntrega || cotizacion.deliveryDate || null,
      fechaEntrega: cotizacion.fechaEntrega || cotizacion.deliveryDate || null,
      createdAt: new Date().toISOString(),
      timeline: [{ type: 'created', description: 'Trabajo creado desde cotización Clientes', timestamp: new Date().toISOString() }],
      notes: []
    };

    // GET trabajos via mrDataManager (maneja auth correctamente)
    let worksData = { works: [], notifications: [] };
    try {
      worksData = await window.mrDataManager.request('/api/trabajos');
      if (!worksData || !Array.isArray(worksData.works)) worksData = { works: [], notifications: [] };
    } catch (e) {
      console.error('[CLIENTES] Error leyendo trabajos:', e);
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
      console.error('[CLIENTES] Error guardando trabajo:', e);
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
    console.error('[CLIENTES] Error en aprobarCotizacion:', error);
    alert('❌ Error inesperado al aprobar: ' + error.message);
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

window.loadQuotations = async function () {
  try {
    cotizacionesClientes = await window.mrDataManager.getClientesCotizaciones() || [];
    cotizacionesClientes.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    renderQuotationsClientes();
    window.updateStatistics();
    console.log('[CLIENTES] Cotizaciones cargadas:', cotizacionesClientes.length);
  } catch (error) {
    console.error('[CLIENTES] Error cargando cotizaciones:', error);
    cotizacionesClientes = [];
  }
};

window._renderQuotationsFiltered = function (filterNombre, filterEstado) {
  window.filterName   = filterNombre  || '';
  window.filterEstado = filterEstado  || 'todos';
  renderQuotationsClientes();
};

function renderQuotationsClientes() {
  const container = document.getElementById('quotesList');
  if (!container) return;

  let filtered = cotizacionesClientes;

  // Filtro por nombre de cliente
  const nombre = (window.filterName || '').trim().toLowerCase();
  if (nombre) {
    filtered = filtered.filter(c => (c.cliente?.nombre || '').toLowerCase().includes(nombre));
    const msg = document.getElementById('historyFilterMsg');
    if (msg) {
      msg.style.display = 'block';
      const nameEl = document.getElementById('filterClientName');
      if (nameEl) nameEl.textContent = window.filterName;
    }
  } else {
    const msg = document.getElementById('historyFilterMsg');
    if (msg) msg.style.display = 'none';
    filtered = filtered.slice(0, 5);
  }

  // Filtro por estado
  const estado = (window.filterEstado || 'todos');
  if (estado !== 'todos') {
    filtered = filtered.filter(c => c.estado === estado);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-state">No se encontraron cotizaciones</p>';
    return;
  }

  container.innerHTML = filtered.map(cot => {
    const estadoColor = cot.estado === 'aprobada' ? '#51CF66' : '#FFC107';
    const estadoTexto = cot.estado === 'aprobada' ? '✅ APROBADA' : '⏳ PENDIENTE';

    let resumenItems = [];
    if (cot.productos) cot.productos.forEach(p => resumenItems.push(`${p.cantidad}x ${p.producto || 'Producto'}`));
    if (cot.terceros)  cot.terceros.forEach(t  => resumenItems.push(`${t.cantidad}x ${t.nombre || 'Servicio'}`));
    let resumenTexto = resumenItems.join(', ');
    if (resumenTexto.length > 80) resumenTexto = resumenTexto.substring(0, 80) + '...';
    if (!resumenTexto) resumenTexto = 'Sin items';

    return `
      <div class="product-card" style="padding: 1rem; border-left: 4px solid ${estadoColor};">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.1rem;">${cot.cliente?.nombre || 'Cliente'}</h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">${new Date(cot.fecha).toLocaleDateString()}</p>
          </div>
          <div style="text-align: right;">
            <span style="color: ${estadoColor}; font-weight: bold; font-size: 0.8rem;">${estadoTexto}</span>
            <div style="font-weight: bold; font-size: 1.1rem;">$${formatCurrency(cot.totalCliente || 0)}</div>
          </div>
        </div>
        <div style="background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px; margin-bottom: 0.8rem; font-size: 0.85rem; color: #ccc;">
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

window.updateStatistics = function () {
  const aprobadas = cotizacionesClientes.filter(c => c.estado === 'aprobada');
  const pendientes = cotizacionesClientes.filter(c => c.estado === 'pendiente');

  const totalAprobado = aprobadas.reduce((sum, c) => sum + (c.totalCliente || 0), 0);
  const totalGanancia = aprobadas.reduce((sum, c) => sum + (c.ganancia || 0), 0);

  const elApproved = document.getElementById('totalApproved');
  const elGanancia = document.getElementById('totalGanancia');
  const elCountApproved = document.getElementById('countApproved');
  const elCountPending = document.getElementById('countPending');

  if (elApproved) elApproved.textContent = '$' + totalAprobado.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  if (elGanancia) elGanancia.textContent = '$' + totalGanancia.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  if (elCountApproved) elCountApproved.textContent = aprobadas.length;
  if (elCountPending) elCountPending.textContent = pendientes.length;
};

window.generatePDF = async function (cot = null) {
  if (!window.jspdf) {
    alert('⚠️ Error: La librería PDF no se ha cargado correctamente.');
    return;
  }

  // Si no se pasa una cotización, usamos la actual del estado global
  const data = typeof cot === 'object' && cot !== null ? cot : {
    cliente: {
      nombre: document.getElementById('clientName')?.value || 'Cliente General',
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
    const doc = await generator.generateClientesQuote(data);
    const clientName = (data.cliente?.nombre || 'Presupuesto').replace(/[^a-z0-9]/gi, '_');
    doc.save(`Presupuesto_MR_${clientName}.pdf`);
    alert('✅ PDF generado correctamente');
  } catch (error) {
    console.error('[CLIENTES] Error al generar PDF:', error);
    alert('❌ Error al generar el PDF: ' + error.message);
  }
};

window.startNotificationPolling = function () {
  checkNotifications();
  setInterval(checkNotifications, 10000);
};

async function checkNotifications() {
  try {
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

// Exponer para checkbox IVA
window.calculateTotals = calculateTotals;
