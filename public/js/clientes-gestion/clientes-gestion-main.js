/**
<<<<<<< HEAD
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
=======
 * MÓDULO DE GESTIÓN DE CLIENTES
 * Sistema completo CRUD para gestionar clientes de Gremio y Clientes Finales
 */

// ==================== VARIABLES GLOBALES ====================

let todosLosClientes = [];
let clientesFiltrados = [];
let editingClientId = null;
let currentSort = 'nombre';

// Función de formato de moneda
function formatCurrencyAR(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0,00';
    }
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
}

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', async function() {
<<<<<<< HEAD
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
      // FIX: cargar de ambos endpoints para ver clientes del gestor
      const [clientesClients, gremioClients] = await Promise.all([
        window.mrDataManager.getClientesClientes().catch(() => []),
        fetch('/api/gremio/clientes').then(r => r.ok ? r.json() : []).catch(() => [])
      ]);
      
      // Combinar: clientes finales + los de gremio que tengan tipo 'cliente' en el gestor
      const combined = [...(clientesClients || [])];
      (gremioClients || []).forEach(c => {
        if (c.tipo === 'cliente' && !combined.find(x => x.id === c.id)) {
          combined.push(c);
        }
      });
      
      allClients = combined;
      renderClientSearchList(allClients);
      window.MRModals.open(searchClientModal);
      setTimeout(() => { if(searchClientInput) searchClientInput.focus(); }, 100);
    });
  }
  
  if (searchClientInput) {
    searchClientInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = allClients.filter(c => {
        // FIX: gestión guarda 'nombre', los creados desde clientes guardan 'name'
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
  
  container.innerHTML = clients.map(c => {
    // FIX: normalizar 'name' vs 'nombre' (gestión usa 'nombre')
    const nombre = c.name || c.nombre || 'Sin nombre';
    const contacto = c.contact || c.telefono || c.email || 'Sin contacto';
    const esTipoCliente = !c.tipo || c.tipo === 'cliente';
    return `
    <div class="client-item" style="padding: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.08); cursor: pointer;"
         onclick="window.selectClient('${c.id}')"
         onmouseover="this.style.background='rgba(0,217,255,0.1)'"
         onmouseout="this.style.background=''">
      <strong>${nombre}</strong>
      ${esTipoCliente ? '<span style="font-size:0.7rem; background:rgba(0,217,255,0.2); color:#00D9FF; border:1px solid #00D9FF; border-radius:10px; padding:1px 6px; margin-left:6px;">CLIENTE</span>' : ''}
      <br>
      <small style="color: #aaa;">${contacto}</small>
    </div>
  `}).join('');
}

window.selectClient = function(id) {
  const client = allClients.find(c => c.id === id);
  if (client) {
    currentClientId = client.id;
    // FIX: normalizar 'name' vs 'nombre' (gestión guarda 'nombre')
    const nombreMostrar = client.name || client.nombre || '';
    document.getElementById('clientName').value = nombreMostrar;
    if(document.getElementById('clientPhone')) document.getElementById('clientPhone').value = client.telefono || client.phone || '';
    if(document.getElementById('clientEmail')) document.getElementById('clientEmail').value = client.email || '';
    if(document.getElementById('clientAddress')) document.getElementById('clientAddress').value = client.direccion || client.address || '';
    
    window.MRModals.close(document.getElementById('searchClientModal'));
    alert(`✅ Cliente cargado: ${nombreMostrar}`);
  }
};

window.saveNewClient = async function() {
  const name = document.getElementById('clientName').value.trim();
  if (!name) {
    alert('⚠️ Ingresa el nombre del cliente.');
    return;
  }

  const clientData = {
    name: name,       // compatibilidad con clientes-main y gremio-main
    nombre: name,     // compatibilidad con clientes-gestion-main
    telefono: document.getElementById('clientPhone')?.value || '',
    email: document.getElementById('clientEmail')?.value || '',
    direccion: document.getElementById('clientAddress')?.value || '',
    tipo: 'cliente'   // identificar origen para el gestor unificado
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

window.loadProductsByCategory = function() {
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

window.loadProductPrice = function() {
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

window.calcularTotalMaterial = function() {
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
      
    selectEmbedded.onchange = function() {
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

window.loadTerceroPrice = function() {
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

window.calcularTotalTercero = function() {
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
=======
    console.log('[CLIENTES-GESTION] 🚀 Inicializando módulo...');
    
    // Configurar eventos
    setupEventListeners();
    
    // Cargar clientes
    await loadClientes();
    
    console.log('[CLIENTES-GESTION] ✅ Módulo listo');
});

function setupEventListeners() {
    // Modal handlers
    document.getElementById('btnCloseClient').addEventListener('click', closeClientModal);
    document.getElementById('btnCancelClient').addEventListener('click', closeClientModal);
    document.getElementById('btnSaveClient').addEventListener('click', saveCliente);
    
    // Filtros
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterClientes);
    }
    
    // Click fuera del modal para cerrar
    document.getElementById('clientModal').addEventListener('click', function(e) {
        if (e.target === this) closeClientModal();
    });
    
    document.getElementById('detailsModal').addEventListener('click', function(e) {
        if (e.target === this) closeDetailsModal();
    });
    
    console.log('[CLIENTES-GESTION] ✅ Event listeners configurados');
}

// ==================== CARGAR CLIENTES ====================

async function loadClientes() {
    try {
        console.log('[CLIENTES-GESTION] Cargando clientes...');
        
        // Cargar desde API
        const response = await fetch('/api/clientes');
        if (!response.ok) {
            throw new Error('Error al cargar clientes');
        }
        
        todosLosClientes = await response.json();
        console.log('[CLIENTES-GESTION] ✅ Clientes cargados:', todosLosClientes.length);
        
        // Calcular facturación desde trabajos
        await calcularFacturacion();
        
        // Aplicar filtros
        filterClientes();
        
        // Actualizar estadísticas
        updateStatistics();
        
    } catch (error) {
        console.error('[CLIENTES-GESTION] ❌ Error cargando clientes:', error);
        todosLosClientes = [];
        renderClientes();
    }
}

async function calcularFacturacion() {
    try {
        // Obtener trabajos para calcular facturación
        const response = await fetch('/api/trabajos');
        const data = await response.json();
        const trabajos = data.works || [];
        
        todosLosClientes = todosLosClientes.map(cliente => {
            // Buscar trabajos de este cliente
            const trabajosCliente = trabajos.filter(t => {
                const nombreTrabajo = (t.clientName || t.cliente || '').toLowerCase();
                const nombreCliente = (cliente.nombre || '').toLowerCase();
                return nombreTrabajo.includes(nombreCliente) || nombreCliente.includes(nombreTrabajo);
            });
            
            // Calcular totales
            const totalFacturado = trabajosCliente.reduce((sum, t) => sum + (parseFloat(t.totalFinal || t.total || 0)), 0);
            const cantidadTrabajos = trabajosCliente.length;
            
            return {
                ...cliente,
                totalFacturado,
                cantidadTrabajos,
                ultimoTrabajo: trabajosCliente.length > 0 ? trabajosCliente[trabajosCliente.length - 1].fecha : null
            };
        });
    } catch (error) {
        console.error('[CLIENTES-GESTION] Error calculando facturación:', error);
    }
}

// ==================== FILTRAR Y ORDENAR ====================

function filterClientes() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filterType = document.getElementById('filterType').value;
    const filterStatus = document.getElementById('filterStatus').value;
    
    clientesFiltrados = todosLosClientes.filter(cliente => {
        // Filtro de búsqueda
        const matchSearch = !searchTerm || 
            (cliente.nombre || '').toLowerCase().includes(searchTerm) ||
            (cliente.telefono || '').toLowerCase().includes(searchTerm) ||
            (cliente.email || '').toLowerCase().includes(searchTerm) ||
            (cliente.direccion || '').toLowerCase().includes(searchTerm);
        
        // Filtro de tipo
        const matchType = filterType === 'todos' || cliente.tipo === filterType;
        
        // Filtro de estado
        const matchStatus = filterStatus === 'todos' || (cliente.estado || 'activo') === filterStatus;
        
        return matchSearch && matchType && matchStatus;
    });
    
    // Aplicar ordenamiento actual
    sortClientesArray(currentSort);
    
    // Renderizar
    renderClientes();
}

function sortClientes(tipo) {
    currentSort = tipo;
    sortClientesArray(tipo);
    renderClientes();
}

function sortClientesArray(tipo) {
    clientesFiltrados.sort((a, b) => {
        switch(tipo) {
            case 'nombre':
                return (a.nombre || '').localeCompare(b.nombre || '');
            case 'fecha':
                const fechaA = new Date(a.fechaCreacion || 0);
                const fechaB = new Date(b.fechaCreacion || 0);
                return fechaB - fechaA;
            case 'facturacion':
                return (b.totalFacturado || 0) - (a.totalFacturado || 0);
            default:
                return 0;
        }
    });
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
}

// ==================== RENDERIZAR ====================

<<<<<<< HEAD
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

window.removeProduct = function(id) {
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

window.removeTercero = function(id) {
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

window.calcularSaldo = function() {
  const total = currentTotals.totalCliente || 0;
  const anticipo = parseFloat(document.getElementById('montoAnticipo')?.value) || 0;
  const saldo = total - anticipo;
  document.getElementById('saldoPendiente').textContent = '$' + formatCurrency(saldo);
};

// ==================== GUARDAR ====================

window.saveQuote = async function() {
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

window.clearQuote = function() {
  currentQuoteProducts = [];
  currentQuoteTerceros = [];
  currentClientId = null;
  
  if (window.multiCategoryManager) {
      window.multiCategoryManager.clearCategories();
  }
  
  ['clientName', 'clientPhone', 'clientEmail', 'clientAddress', 'montoAnticipo', 'deliveryDate'].forEach(id => {
    const elem = document.getElementById(id);
    if (elem) elem.value = '';
  });
  
  renderQuoteProducts();
  renderTerceros();
  calculateTotals();
};

window.loadQuotations = async function() {
  try {
    cotizacionesClientes = await window.mrDataManager.getClientesCotizaciones() || [];
    cotizacionesClientes.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    renderQuotations();
    updateStatistics();
  } catch (error) {
    console.error('[CLIENTES] Error cargando cotizaciones:', error);
    cotizacionesClientes = [];
  }
};

function renderQuotations() {
  const container = document.getElementById('quotesList');
  if (!container) return;
  
  if (cotizacionesClientes.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay cotizaciones</p>';
    return;
  }

  container.innerHTML = cotizacionesClientes.map(cot => {
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
        </div>
        ${cot.estado === 'pendiente' ? `
          <button class="btn btn-success btn-small" onclick="aprobarCotizacion('${cot.id}')">✅ Aprobar</button>
          <button class="btn btn-danger btn-small" onclick="borrarCotizacion('${cot.id}')" style="margin-left: 5px;">🗑️ Borrar</button>
        ` : ''}
      </div>
    `;
  }).join('');
}

window.aprobarCotizacion = async function(id) {
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
        headers: {'Content-Type': 'application/json'}, 
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

window.borrarCotizacion = async function(id) {
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

window.updateStatistics = function() {
  const aprobadas = cotizacionesClientes.filter(c => c.estado === 'aprobada');
  const pendientes = cotizacionesClientes.filter(c => c.estado === 'pendiente');
  
  const totalAprobado = aprobadas.reduce((sum, c) => sum + (c.totalCliente || 0), 0);
  const totalGanancia = aprobadas.reduce((sum, c) => sum + (c.ganancia || 0), 0);
  
  document.getElementById('totalApproved').textContent = '$' + totalAprobado.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  document.getElementById('totalGanancia').textContent = '$' + totalGanancia.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  document.getElementById('countApproved').textContent = aprobadas.length;
  document.getElementById('countPending').textContent = pendientes.length;
};

window.generatePDF = async function() {
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

window.startNotificationPolling = function() {
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
=======
function renderClientes() {
    const container = document.getElementById('clientesList');
    const countElement = document.getElementById('clientesCount');
    
    countElement.textContent = clientesFiltrados.length;
    
    if (clientesFiltrados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p>No se encontraron clientes con los filtros aplicados</p>
                <button class="btn btn-secondary" onclick="clearFilters()">Limpiar Filtros</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = clientesFiltrados.map(cliente => `
        <div class="client-card">
            <div class="client-header">
                <div>
                    <span class="client-type ${cliente.tipo || 'cliente'}">
                        ${cliente.tipo === 'gremio' ? '🟢 GREMIO' : '🔵 CLIENTE'}
                    </span>
                    <div class="client-name">${cliente.nombre || 'Sin nombre'}</div>
                </div>
                <div style="text-align: right;">
                    ${cliente.estado === 'inactivo' ? '<span style="color: #FFC107;">⏸️ Inactivo</span>' : '<span style="color: #51CF66;">✅ Activo</span>'}
                </div>
            </div>
            
            <div class="client-info">
                ${cliente.telefono ? `
                    <div class="client-info-item">
                        <span>📱</span>
                        <span>${cliente.telefono}</span>
                    </div>
                ` : ''}
                
                ${cliente.email ? `
                    <div class="client-info-item">
                        <span>📧</span>
                        <span>${cliente.email}</span>
                    </div>
                ` : ''}
                
                ${cliente.direccion ? `
                    <div class="client-info-item">
                        <span>📍</span>
                        <span>${cliente.direccion}</span>
                    </div>
                ` : ''}
                
                ${cliente.cuit ? `
                    <div class="client-info-item">
                        <span>🆔</span>
                        <span>${cliente.cuit}</span>
                    </div>
                ` : ''}
            </div>
            
            <!-- SECCIÓN DE HISTORIAL DE TRABAJOS (NUEVO) -->
            <div class="client-works-section" style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h5 style="margin:0; color:#aaa; font-size:0.9rem;">📜 Historial de Trabajos</h5>
                    <span style="font-size:0.8rem; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">${cliente.trabajos ? cliente.trabajos.length : 0}</span>
                </div>
                
                ${cliente.trabajos && cliente.trabajos.length > 0 ? `
                    <div class="works-list-scroll" style="max-height: 150px; overflow-y: auto; padding-right: 5px;">
                        ${cliente.trabajos.map(w => {
                            const fecha = new Date(w.createdAt).toLocaleDateString('es-AR');
                            const esEntregado = w.deliveryStatus === 'delivered';
                            const estadoIcon = esEntregado ? '✅' : (w.status === 'completed' ? '🏁' : (w.status === 'in_progress' ? '🔨' : '⏳'));
                            const estadoTexto = esEntregado ? 'Entregado' : (w.status === 'completed' ? 'Listo' : (w.status === 'in_progress' ? 'En Proceso' : 'Pendiente'));
                            const color = esEntregado ? '#4CAF50' : (w.status === 'completed' ? '#2196F3' : '#FFC107');
                            
                            // Descripción de productos
                            let desc = 'Varios productos';
                            if (w.products && w.products.length > 0) {
                                desc = w.products.map(p => p.name || p.productName || p.category).join(', ');
                            } else if (w.description) {
                                desc = w.description;
                            }
                            
                            return `
                                <div style="background:rgba(0,0,0,0.2); padding:8px; border-radius:6px; margin-bottom:6px; border-left: 3px solid ${color};">
                                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
                                        <span style="color:#fff;">${fecha}</span>
                                        <span style="color:${color}; font-weight:bold;">${estadoIcon} ${estadoTexto}</span>
                                    </div>
                                    <div style="font-size:0.9rem; color:#ddd; margin-bottom:4px; line-height:1.3;">${desc}</div>
                                    <div style="text-align:right; font-weight:bold; color:#fff; font-size:0.9rem;">$${formatCurrencyAR(w.total)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : '<div style="color:#666; font-style:italic; font-size:0.9rem; padding:5px;">Sin historial registrado</div>'}
            </div>

            ${(cliente.totalFacturado > 0 || cliente.cantidadTrabajos > 0) ? `
                <div class="client-stats">
                    <div class="client-stat">
                        <div class="client-stat-value">${cliente.cantidadTrabajos || 0}</div>
                        <div class="client-stat-label">Trabajos</div>
                    </div>
                    <div class="client-stat">
                        <div class="client-stat-value">$${formatCurrencyAR(cliente.totalFacturado || 0)}</div>
                        <div class="client-stat-label">Facturado</div>
                    </div>
                    ${cliente.ultimoTrabajo ? `
                        <div class="client-stat">
                            <div class="client-stat-value" style="font-size: 1rem;">${new Date(cliente.ultimoTrabajo).toLocaleDateString('es-AR')}</div>
                            <div class="client-stat-label">Último trabajo</div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            <div class="client-actions">
                <button class="btn btn-primary btn-small" onclick="viewClientDetails('${cliente.id}')">👁️ Ver Detalles</button>
                <button class="btn btn-secondary btn-small" onclick="editCliente('${cliente.id}')">✏️ Editar</button>
                <button class="btn btn-danger btn-small" onclick="deleteCliente('${cliente.id}', '${cliente.nombre}')">🗑️ Eliminar</button>
            </div>
        </div>
    `).join('');
}

function updateStatistics() {
    const total = todosLosClientes.length;
    const gremio = todosLosClientes.filter(c => c.tipo === 'gremio').length;
    const clientes = todosLosClientes.filter(c => c.tipo === 'cliente').length;
    const totalFact = todosLosClientes.reduce((sum, c) => sum + (c.totalFacturado || 0), 0);
    
    document.getElementById('totalClientes').textContent = total;
    document.getElementById('totalGremio').textContent = gremio;
    document.getElementById('totalClientesFinales').textContent = clientes;
    document.getElementById('totalFacturacion').textContent = '$' + formatCurrencyAR(totalFact);
}

// ==================== MODAL AGREGAR/EDITAR ====================

function openAddClientModal() {
    editingClientId = null;
    document.getElementById('modalTitle').textContent = '➕ Nuevo Cliente';
    clearClientForm();
    document.getElementById('clientModal').classList.add('active');
}

function editCliente(clientId) {
    const cliente = todosLosClientes.find(c => c.id === clientId);
    if (!cliente) {
        alert('❌ Cliente no encontrado');
        return;
    }
    
    editingClientId = clientId;
    document.getElementById('modalTitle').textContent = '✏️ Editar Cliente';
    
    // Llenar formulario
    document.getElementById('clientTipo').value = cliente.tipo || 'cliente';
    document.getElementById('clientNombre').value = cliente.nombre || '';
    document.getElementById('clientTelefono').value = cliente.telefono || '';
    document.getElementById('clientEmail').value = cliente.email || '';
    document.getElementById('clientDireccion').value = cliente.direccion || '';
    document.getElementById('clientCuit').value = cliente.cuit || '';
    document.getElementById('clientCondicionIVA').value = cliente.condicionIVA || '';
    document.getElementById('clientDescuento').value = cliente.descuento || 0;
    document.getElementById('clientEstado').value = cliente.estado || 'activo';
    document.getElementById('clientNotas').value = cliente.notas || '';
    
    document.getElementById('clientModal').classList.add('active');
}

function closeClientModal() {
    document.getElementById('clientModal').classList.remove('active');
    editingClientId = null;
    clearClientForm();
}

function clearClientForm() {
    document.getElementById('clientTipo').value = 'cliente';
    document.getElementById('clientNombre').value = '';
    document.getElementById('clientTelefono').value = '';
    document.getElementById('clientEmail').value = '';
    document.getElementById('clientDireccion').value = '';
    document.getElementById('clientCuit').value = '';
    document.getElementById('clientCondicionIVA').value = '';
    document.getElementById('clientDescuento').value = 0;
    document.getElementById('clientEstado').value = 'activo';
    document.getElementById('clientNotas').value = '';
}

async function saveCliente() {
    const nombre = document.getElementById('clientNombre').value.trim();
    
    if (!nombre) {
        alert('⚠️ El nombre es obligatorio');
        return;
    }
    
    const clienteData = {
        id: editingClientId || Date.now().toString(),
        tipo: document.getElementById('clientTipo').value,
        nombre: nombre,
        telefono: document.getElementById('clientTelefono').value.trim(),
        email: document.getElementById('clientEmail').value.trim(),
        direccion: document.getElementById('clientDireccion').value.trim(),
        cuit: document.getElementById('clientCuit').value.trim(),
        condicionIVA: document.getElementById('clientCondicionIVA').value,
        descuento: parseFloat(document.getElementById('clientDescuento').value) || 0,
        estado: document.getElementById('clientEstado').value,
        notas: document.getElementById('clientNotas').value.trim(),
        fechaCreacion: editingClientId ? 
            (todosLosClientes.find(c => c.id === editingClientId)?.fechaCreacion) : 
            new Date().toISOString(),
        fechaModificacion: new Date().toISOString()
    };
    
    try {
        let response;
        const isGremio = clienteData.tipo === 'gremio';
        const endpoint = isGremio ? '/api/gremio/clientes' : '/api/clientes';
        
        if (editingClientId) {
            // UPDATE
            // Verificar si cambió de tipo (de Gremio a Cliente o viceversa)
            const originalClient = todosLosClientes.find(c => c.id === editingClientId);
            const originalTipo = originalClient ? originalClient.tipo : clienteData.tipo;

            if (originalTipo !== clienteData.tipo) {
                // Si cambió el tipo, borramos del origen anterior y creamos en el nuevo
                const deleteEndpoint = originalTipo === 'gremio' ? `/api/gremio/clientes/${editingClientId}` : `/api/clientes/${editingClientId}`;
                await fetch(deleteEndpoint, { method: 'DELETE' });
                
                // Crear en el nuevo destino (POST)
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(clienteData)
                });
            } else {
                // Actualización normal (PUT)
                response = await fetch(`${endpoint}/${editingClientId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(clienteData)
                });
            }
        } else {
            // CREATE (POST)
            // Generar ID con prefijo para identificar origen fácilmente
            clienteData.id = (isGremio ? 'gremio_cli_' : 'cliente_cli_') + Date.now();
            
            response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clienteData)
            });
        }
        
        if (!response.ok) {
            throw new Error('Error al guardar cliente');
        }
        
        alert(editingClientId ? '✅ Cliente actualizado correctamente' : '✅ Cliente creado correctamente');
        
        closeClientModal();
        await loadClientes();
        
    } catch (error) {
        console.error('[CLIENTES-GESTION] Error guardando cliente:', error);
        alert('❌ Error al guardar el cliente');
    }
}

// ==================== ELIMINAR ====================

async function deleteCliente(clientId, clientName) {
    if (!confirm(`¿Estás seguro de que quieres eliminar a "${clientName}"?\n\n⚠️ Esta acción no se puede deshacer.`)) {
        return;
    }
    
    try {
        // Identificar origen para borrar del lugar correcto
        const client = todosLosClientes.find(c => c.id === clientId);
        const isGremio = client && client.tipo === 'gremio';
        const endpoint = isGremio ? `/api/gremio/clientes/${clientId}` : `/api/clientes/${clientId}`;

        const response = await fetch(endpoint, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Error al eliminar cliente');
        }
        
        alert('✅ Cliente eliminado correctamente');
        await loadClientes();
        
    } catch (error) {
        console.error('[CLIENTES-GESTION] Error eliminando cliente:', error);
        alert('❌ Error al eliminar el cliente');
    }
}

// ==================== VER DETALLES ====================

async function viewClientDetails(clientId) {
    const cliente = todosLosClientes.find(c => c.id === clientId);
    if (!cliente) {
        alert('❌ Cliente no encontrado');
        return;
    }
    
    // Obtener trabajos del cliente
    let trabajosCliente = [];
    try {
        const todosTrabajosRes = await fetch('/api/trabajos');
        const todosTrabajosData = await todosTrabajosRes.json();
        // FIX: La API devuelve { works: [...] }, no un array directo
        const todosTrabajosArray = todosTrabajosData.works || [];
        
        trabajosCliente = todosTrabajosArray.filter(t => {
            const nombreTrabajo = (t.clientName || t.cliente || '').toLowerCase();
            const nombreCliente = (cliente.nombre || '').toLowerCase();
            return nombreTrabajo.includes(nombreCliente) || nombreCliente.includes(nombreTrabajo);
        });
    } catch (error) {
        console.error('Error cargando trabajos:', error);
    }
    
    const detailsContent = `
        <div class="highlight-box">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <h3 style="margin: 0;">${cliente.nombre}</h3>
                    <div style="display:inline-block; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold; margin-top:4px; background:${cliente.tipo === 'gremio' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(33, 150, 243, 0.2)'}; color:${cliente.tipo === 'gremio' ? '#4CAF50' : '#2196F3'}; border:1px solid ${cliente.tipo === 'gremio' ? '#4CAF50' : '#2196F3'};">
                        ${cliente.tipo === 'gremio' ? 'GREMIO' : 'CLIENTE FINAL'}
                    </div>
                </div>
                <div>
                    ${cliente.estado === 'activo' ? '<span style="color: #51CF66;">✅ Activo</span>' : '<span style="color: #FFC107;">⏸️ Inactivo</span>'}
                </div>
            </div>
        </div>
        
        <div class="highlight-box">
            <h4>📞 Información de Contacto</h4>
            <div class="form-row">
                <div><strong>Teléfono:</strong> ${cliente.telefono || 'No especificado'}</div>
                <div><strong>Email:</strong> ${cliente.email || 'No especificado'}</div>
            </div>
            <div style="margin-top: 0.5rem;">
                <strong>Dirección:</strong> ${cliente.direccion || 'No especificada'}
            </div>
        </div>
        
        <div class="highlight-box">
            <h4>💼 Información Comercial</h4>
            <div class="form-row">
                <div><strong>CUIT/DNI:</strong> ${cliente.cuit || 'No especificado'}</div>
                <div><strong>Condición IVA:</strong> ${cliente.condicionIVA || 'No especificada'}</div>
            </div>
            <div class="form-row" style="margin-top: 0.5rem;">
                <div><strong>Descuento:</strong> ${cliente.descuento || 0}%</div>
                <div><strong>Registrado:</strong> ${new Date(cliente.fechaCreacion).toLocaleDateString('es-AR')}</div>
            </div>
        </div>
        
        ${cliente.notas ? `
            <div class="highlight-box">
                <h4>📝 Notas</h4>
                <p style="color: rgba(255,255,255,0.8);">${cliente.notas}</p>
            </div>
        ` : ''}
        
        <div class="highlight-box">
            <h4>📊 Estadísticas</h4>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${cliente.cantidadTrabajos || 0}</div>
                    <div class="stat-label">Trabajos Realizados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">$${formatCurrencyAR(cliente.totalFacturado || 0)}</div>
                    <div class="stat-label">Total Facturado</div>
                </div>
                ${cliente.cantidadTrabajos > 0 ? `
                    <div class="stat-card">
                        <div class="stat-value">$${formatCurrencyAR((cliente.totalFacturado || 0) / (cliente.cantidadTrabajos || 1))}</div>
                        <div class="stat-label">Promedio por Trabajo</div>
                    </div>
                ` : ''}
            </div>
        </div>
        
        ${trabajosCliente.length > 0 ? `
            <div class="highlight-box">
                <h4>📋 Últimos Trabajos</h4>
                ${trabajosCliente.slice(-5).reverse().map(trabajo => `
                    <div style="padding: 0.75rem; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <strong>${trabajo.description || 'Trabajo sin descripción'}</strong>
                            <span style="color: #51CF66;">$${formatCurrencyAR(trabajo.totalFinal || trabajo.total || 0)}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: rgba(255,255,255,0.6);">
                            📅 ${new Date(trabajo.fecha).toLocaleDateString('es-AR')}
                            ${trabajo.estado ? ` • Estado: ${trabajo.estado}` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
    
    document.getElementById('detailsTitle').innerHTML = `👤 ${cliente.nombre}`;
    document.getElementById('detailsContent').innerHTML = detailsContent;
    document.getElementById('detailsModal').classList.add('active');
}

function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('active');
}

// ==================== UTILIDADES ====================

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterType').value = 'todos';
    document.getElementById('filterStatus').value = 'todos';
    filterClientes();
}

// Exportar funciones globales
window.openAddClientModal = openAddClientModal;
window.editCliente = editCliente;
window.deleteCliente = deleteCliente;
window.viewClientDetails = viewClientDetails;
window.closeDetailsModal = closeDetailsModal;
window.loadClientes = loadClientes;
window.filterClientes = filterClientes;
window.sortClientes = sortClientes;
window.clearFilters = clearFilters;

console.log('[CLIENTES-GESTION] 📦 Módulo cargado');

// ==================== INICIALIZACIÓN ====================

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    console.log('[CLIENTES-GESTION] 🚀 Inicializando...');
    
    // Configurar event listeners
    setupEventListeners();
    
    // Cargar clientes iniciales
    loadClientes();
    
    console.log('[CLIENTES-GESTION] ✅ Inicializado correctamente');
}
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
