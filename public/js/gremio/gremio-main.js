/**
 * GREMIO - Sistema de Cotización FUSIONADO
 * Combina funcionalidad existente + nuevo sistema de cálculo con medidas
 */

// ==================== VARIABLES GLOBALES ====================
let materiales = [];
let precios = [];
let terceros = [];
let currentQuoteProducts = [];
let currentQuoteTerceros = [];
let currentPrecioGremio = 0;
let currentProductData = null;
let productsInQuotation = [];
let currentClientId = null;
let currentClientData = null;
let allClients = [];

document.addEventListener('DOMContentLoaded', async function() {
  console.log('[GREMIO] Inicializando sistema FUSIONADO...');
  
  // Cargar datos
  await loadAllData();
  
  // Setup event listeners
  setupEventListeners();
  setupModals();
  
  // Actualizar estadísticas
  updateStatistics();
  
  console.log('[GREMIO] ✅ Sistema inicializado correctamente');
});

// ==================== CARGA DE DATOS ====================

async function loadAllData() {
  await Promise.all([
    loadMateriales(),
    loadPrecios(),
    loadTerceros(),
    loadClients()
  ]);
}

async function loadMateriales() {
  try {
    const response = await fetch('/api/materiales');
    if (response.ok) {
      materiales = await response.json();
      console.log('[GREMIO] Materiales cargados:', materiales.length);
    }
  } catch (error) {
    console.error('[GREMIO] Error cargando materiales:', error);
    materiales = [];
  }
}

async function loadPrecios() {
  try {
    const response = await fetch('/api/precios');
    if (response.ok) {
      precios = await response.json();
      console.log('[GREMIO] Precios cargados:', precios.length);
    }
  } catch (error) {
    console.error('[GREMIO] Error cargando precios:', error);
    precios = [];
  }
}

async function loadTerceros() {
  try {
    const response = await fetch('/api/terceros');
    if (response.ok) {
      terceros = await response.json();
      populateTerceros();
      console.log('[GREMIO] Terceros cargados:', terceros.length);
    }
  } catch (error) {
    console.error('[GREMIO] Error cargando terceros:', error);
    terceros = [];
  }
}

async function loadClients() {
  try {
    const response = await fetch('/api/clientes');
    if (response.ok) {
      allClients = await response.json();
      console.log('[GREMIO] Clientes cargados:', allClients.length);
    }
  } catch (error) {
    console.error('[GREMIO] Error cargando clientes:', error);
    allClients = [];
  }
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
  // Botón guardar producto
  document.getElementById('btnSaveProduct')?.addEventListener('click', addProductToQuote);
  
  // Botón guardar servicio tercero
  document.getElementById('btnSaveTerceroService')?.addEventListener('click', addTerceroToQuote);
  
  // Abrir modal producto - cargar categorías
  document.getElementById('btnAddProduct')?.addEventListener('click', () => {
    loadCategoriasParaCotizacion();
  });
}

function setupModals() {
  // Modal system ya está manejado por modal-system.js
  console.log('[GREMIO] Modales configurados por modal-system.js');
}

// ==================== CATEGORÍAS Y PRODUCTOS ====================

function loadCategoriasParaCotizacion() {
  // Obtener categorías únicas desde materiales
  const categorias = [...new Set(materiales.map(m => m.categoria))].filter(Boolean);
  const select = document.getElementById('productCategory');
  
  if (!select) return;
  
  select.innerHTML = '<option value="">Seleccionar categoría...</option>' + 
    categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');
  
  console.log('[GREMIO] Categorías cargadas:', categorias.length);
}

window.loadProductsByCategory = function() {
  const categoria = document.getElementById('productCategory').value;
  const productSelect = document.getElementById('productName');
  
  if (!categoria) {
    productSelect.innerHTML = '<option value="">Primero selecciona categoría...</option>';
    productSelect.disabled = true;
    document.getElementById('priceInfo')?.style && (document.getElementById('priceInfo').style.display = 'none');
    resetCalculos();
    return;
  }

  // Filtrar productos de esa categoría
  const productos = materiales.filter(m => m.categoria === categoria);
  
  productSelect.innerHTML = '<option value="">Seleccionar producto...</option>' + 
    productos.map(p => {
      const dimensiones = p.ancho && p.largo ? ` (${p.ancho}x${p.largo}m)` : '';
      return `<option value="${p.id}">${p.producto}${dimensiones}</option>`;
    }).join('');
  
  productSelect.disabled = false;
  
  console.log('[GREMIO] Productos filtrados:', productos.length);
};

window.loadProductPrice = function() {
  const productId = document.getElementById('productName').value;
  
  if (!productId) {
    document.getElementById('priceInfo')?.style && (document.getElementById('priceInfo').style.display = 'none');
    resetCalculos();
    return;
  }

  // Buscar el producto en materiales
  const producto = materiales.find(m => m.id === productId);
  
  if (!producto) {
    console.error('[GREMIO] Producto no encontrado');
    return;
  }

  // Buscar el precio GREMIO para este producto
  const precioData = precios.find(p => 
    p.categoria === producto.categoria && 
    p.producto === producto.producto
  );

  if (precioData && precioData.precioGremio) {
    currentPrecioGremio = parseFloat(precioData.precioGremio);
    currentProductData = producto;
    
    const displayElement = document.getElementById('precioGremioDisplay');
    const priceInfoElement = document.getElementById('priceInfo');
    
    if (displayElement) {
      displayElement.textContent = '$' + currentPrecioGremio.toFixed(2) + '/m²';
    }
    
    if (priceInfoElement) {
      priceInfoElement.style.display = 'block';
    }
    
    console.log('[GREMIO] Precio Gremio encontrado:', currentPrecioGremio);
    
    // Recalcular si ya hay datos
    calcularTotalMaterial();
  } else {
    alert('⚠️ Este producto no tiene precio de Gremio configurado.\nVe a Precios para configurarlo.');
    document.getElementById('priceInfo')?.style && (document.getElementById('priceInfo').style.display = 'none');
    currentPrecioGremio = 0;
    currentProductData = null;
  }
};

// ==================== CÁLCULO DINÁMICO DE MATERIAL ====================

window.calcularTotalMaterial = function() {
  const ancho = parseFloat(document.getElementById('productAncho')?.value) || 0;
  const alto = parseFloat(document.getElementById('productAlto')?.value) || 0;
  const cantidad = parseInt(document.getElementById('productCantidad')?.value) || 0;

  // Validar que tengamos precio y datos
  if (currentPrecioGremio === 0 || ancho === 0 || alto === 0 || cantidad === 0) {
    document.getElementById('productTotal').textContent = '$0.00';
    document.getElementById('productFormula').textContent = 'Completa todos los datos';
    document.getElementById('calculoDetalle')?.style && (document.getElementById('calculoDetalle').style.display = 'none');
    return;
  }

  // FÓRMULA: (Ancho/100) * (Alto/100) * Cantidad * Precio_Gremio_m2
  const anchoMetros = ancho / 100;
  const altoMetros = alto / 100;
  const m2PorUnidad = anchoMetros * altoMetros;
  const m2Totales = m2PorUnidad * cantidad;
  const precioUnitario = m2PorUnidad * currentPrecioGremio;
  const totalMaterial = m2Totales * currentPrecioGremio;

  // Mostrar resultado
  document.getElementById('productTotal').textContent = '$' + totalMaterial.toFixed(2);
  
  // Mostrar fórmula
  document.getElementById('productFormula').textContent = 
    `(${ancho}cm ÷ 100) × (${alto}cm ÷ 100) × ${cantidad} × $${currentPrecioGremio.toFixed(2)}/m²`;

  // Mostrar detalle del cálculo
  const detalleElement = document.getElementById('calculoDetalle');
  if (detalleElement) {
    document.getElementById('m2PorUnidad').textContent = m2PorUnidad.toFixed(4) + ' m²';
    document.getElementById('m2Totales').textContent = m2Totales.toFixed(4) + ' m²';
    document.getElementById('precioUnitario').textContent = '$' + precioUnitario.toFixed(2);
    detalleElement.style.display = 'block';
  }

  console.log('[GREMIO] Cálculo:', {
    ancho: anchoMetros,
    alto: altoMetros,
    cantidad,
    m2PorUnidad,
    m2Totales,
    precioGremio: currentPrecioGremio,
    total: totalMaterial
  });
};

function resetCalculos() {
  currentPrecioGremio = 0;
  currentProductData = null;
  
  const elements = [
    'productAncho', 'productAlto', 'productCantidad',
    'productTotal', 'productFormula', 'calculoDetalle'
  ];
  
  elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      if (element.tagName === 'INPUT') {
        element.value = '';
      } else if (id === 'productTotal') {
        element.textContent = '$0.00';
      } else if (id === 'productFormula') {
        element.textContent = 'Completa los datos para ver el cálculo';
      } else if (id === 'calculoDetalle') {
        element.style.display = 'none';
      }
    }
  });
}

// ==================== AGREGAR PRODUCTO A COTIZACIÓN ====================

function addProductToQuote() {
  const productId = document.getElementById('productName').value;
  const ancho = parseFloat(document.getElementById('productAncho').value);
  const alto = parseFloat(document.getElementById('productAlto').value);
  const cantidad = parseInt(document.getElementById('productCantidad').value);

  // Validaciones
  if (!productId || !ancho || !alto || !cantidad) {
    alert('⚠️ Completa todos los campos obligatorios');
    return;
  }

  if (currentPrecioGremio === 0) {
    alert('⚠️ Este producto no tiene precio de Gremio configurado');
    return;
  }

  // Calcular valores
  const anchoMetros = ancho / 100;
  const altoMetros = alto / 100;
  const m2PorUnidad = anchoMetros * altoMetros;
  const m2Totales = m2PorUnidad * cantidad;
  const precioUnitario = m2PorUnidad * currentPrecioGremio;
  const totalMaterial = m2Totales * currentPrecioGremio;

  // Crear item de cotización
  const quoteItem = {
    id: Date.now().toString(),
    tipo: 'material',
    categoria: currentProductData.categoria,
    producto: currentProductData.producto,
    ancho,
    alto,
    cantidad,
    m2PorUnidad,
    m2Totales,
    precioGremio: currentPrecioGremio,
    precioUnitario,
    total: totalMaterial
  };

  currentQuoteProducts.push(quoteItem);
  
  console.log('[GREMIO] Producto agregado:', quoteItem);
  
  // Cerrar modal y limpiar
  document.getElementById('productModal').classList.remove('active');
  resetCalculos();
  document.getElementById('productCategory').value = '';
  document.getElementById('productName').value = '';
  document.getElementById('priceInfo')?.style && (document.getElementById('priceInfo').style.display = 'none');
  
  // Renderizar cotización
  renderQuoteProducts();
  calculateTotals();
  
  alert('✅ Material agregado a la cotización');
}

// ==================== RENDERIZAR PRODUCTOS ====================

function renderQuoteProducts() {
  const container = document.getElementById('productsList');
  
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
            <span style="color: var(--text-secondary); font-size: 0.9rem;">m² por unidad:</span>
            <p style="margin: 0; font-weight: bold;">${item.m2PorUnidad.toFixed(4)} m²</p>
          </div>
          <div>
            <span style="color: var(--text-secondary); font-size: 0.9rem;">m² totales:</span>
            <p style="margin: 0; font-weight: bold;">${item.m2Totales.toFixed(4)} m²</p>
          </div>
        </div>
        
        <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 0.8rem; margin-top: 0.8rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span style="color: var(--text-secondary);">Precio Gremio/m²:</span>
            <span style="color: #51CF66; font-weight: bold;">$${item.precioGremio.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span style="color: var(--text-secondary);">Precio unitario:</span>
            <span style="color: white; font-weight: bold;">$${item.precioUnitario.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 2px solid rgba(81, 207, 102, 0.3); padding-top: 0.5rem; margin-top: 0.5rem;">
            <span style="font-weight: bold;">TOTAL:</span>
            <span style="color: #51CF66; font-size: 1.3rem; font-weight: bold;">$${item.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

window.removeProduct = function(id) {
  if (!confirm('¿Eliminar este producto de la cotización?')) return;
  currentQuoteProducts = currentQuoteProducts.filter(p => p.id !== id);
  renderQuoteProducts();
  calculateTotals();
};

// ==================== TERCEROS ====================

function populateTerceros() {
  const select = document.getElementById('terceroService');
  if (!select) return;
  
  select.innerHTML = '<option value="">Seleccionar servicio...</option>' + 
    terceros.map(t => `<option value="${t.id}">${t.nombre} - ${t.unidad}</option>`).join('');
}

window.loadTerceroPrice = function() {
  const terceroId = document.getElementById('terceroService').value;
  if (!terceroId) {
    document.getElementById('terceroPrice').value = '';
    return;
  }

  const tercero = terceros.find(t => t.id === terceroId);
  if (tercero) {
    document.getElementById('terceroPrice').value = tercero.costo;
  }
};

window.calcularTotalTercero = function() {
  const cantidad = parseFloat(document.getElementById('terceroQuantity').value) || 0;
  const precio = parseFloat(document.getElementById('terceroPrice').value) || 0;
  const total = cantidad * precio;
  
  document.getElementById('terceroTotal').textContent = '$' + total.toFixed(2);
};

function addTerceroToQuote() {
  const terceroId = document.getElementById('terceroService').value;
  const cantidad = parseFloat(document.getElementById('terceroQuantity').value);
  
  if (!terceroId || !cantidad) {
    alert('⚠️ Completa todos los campos');
    return;
  }

  const tercero = terceros.find(t => t.id === terceroId);
  const total = cantidad * tercero.costo;

  const terceroItem = {
    id: Date.now().toString(),
    tipo: 'tercero',
    nombre: tercero.nombre,
    cantidad,
    precio: tercero.costo,
    unidad: tercero.unidad,
    total
  };

  currentQuoteTerceros.push(terceroItem);
  
  document.getElementById('terceroServiceModal').classList.remove('active');
  document.getElementById('terceroService').value = '';
  document.getElementById('terceroQuantity').value = '';
  document.getElementById('terceroPrice').value = '';
  document.getElementById('terceroTotal').textContent = '$0.00';
  
  renderTerceros();
  calculateTotals();
  
  alert('✅ Servicio agregado');
}

function renderTerceros() {
  const container = document.getElementById('terceroServicesList');
  
  if (currentQuoteTerceros.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay servicios de terceros agregados</p>';
    return;
  }

  container.innerHTML = currentQuoteTerceros.map(item => `
    <div class="product-card">
      <h3>${item.nombre}</h3>
      <p>Cantidad: ${item.cantidad} ${item.unidad}</p>
      <p>Precio: $${item.precio.toFixed(2)}</p>
      <p><strong>Total: $${item.total.toFixed(2)}</strong></p>
      <button class="btn btn-danger btn-small" onclick="removeTercero('${item.id}')">🗑️</button>
    </div>
  `).join('');
}

window.removeTercero = function(id) {
  currentQuoteTerceros = currentQuoteTerceros.filter(t => t.id !== id);
  renderTerceros();
  calculateTotals();
};

// ==================== CALCULAR TOTALES ====================

function calculateTotals() {
  const subtotalProductos = currentQuoteProducts.reduce((sum, p) => sum + p.total, 0);
  const subtotalTerceros = currentQuoteTerceros.reduce((sum, t) => sum + t.total, 0);
  const subtotal = subtotalProductos + subtotalTerceros;
  const iva = subtotal * 0.21;
  const total = subtotal + iva;

  document.getElementById('subtotal').textContent = '$' + subtotal.toFixed(2);
  document.getElementById('iva').textContent = '$' + iva.toFixed(2);
  document.getElementById('total').textContent = '$' + total.toFixed(2);
}

// ==================== GUARDAR COTIZACIÓN ====================

window.saveQuote = async function() {
  const clientName = document.getElementById('clientName').value.trim();
  
  if (!clientName) {
    alert('⚠️ Ingresa el nombre del cliente');
    return;
  }

  if (currentQuoteProducts.length === 0 && currentQuoteTerceros.length === 0) {
    alert('⚠️ Agrega al menos un producto o servicio');
    return;
  }

  const quote = {
    id: Date.now().toString(),
    cliente: {
      nombre: clientName,
      telefono: document.getElementById('clientPhone').value,
      email: document.getElementById('clientEmail').value,
      direccion: document.getElementById('clientAddress').value
    },
    productos: currentQuoteProducts,
    terceros: currentQuoteTerceros,
    subtotal: parseFloat(document.getElementById('subtotal').textContent.replace('$', '')),
    iva: parseFloat(document.getElementById('iva').textContent.replace('$', '')),
    total: parseFloat(document.getElementById('total').textContent.replace('$', '')),
    fecha: new Date().toISOString(),
    estado: 'pendiente'
  };

  try {
    const response = await fetch('/api/cotizaciones/gremio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quote)
    });

    if (response.ok) {
      alert('✅ Cotización guardada correctamente');
      clearQuote();
    }
  } catch (error) {
    console.error('[GREMIO] Error:', error);
    alert('❌ Error al guardar cotización');
  }
};

window.clearQuote = function() {
  currentQuoteProducts = [];
  currentQuoteTerceros = [];
  document.getElementById('clientName').value = '';
  document.getElementById('clientPhone').value = '';
  document.getElementById('clientEmail').value = '';
  document.getElementById('clientAddress').value = '';
  renderQuoteProducts();
  renderTerceros();
  calculateTotals();
};

window.generatePDF = function() {
  alert('📄 Función de PDF próximamente');
};

window.updateStatistics = function() {
  console.log('[GREMIO] Actualizando estadísticas...');
};
