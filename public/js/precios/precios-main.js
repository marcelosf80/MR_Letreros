/**
 * MÓDULO DE PRECIOS - Main
 * Gestión centralizada de precios Gremio y Cliente
 */

// Función de formateo de moneda argentina
function formatCurrencyAR(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0,00';
    }
    
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}

let preciosGremio = [];
let preciosCliente = [];

document.addEventListener('DOMContentLoaded', async function() {
  console.log('[PRECIOS] Inicializando módulo...');
  setupTabs();
  setupEventListeners();
  await loadData();
});

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const targetContent = document.querySelector(`[data-content="${targetId}"]`);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}

function setupEventListeners() {
  document.getElementById('btnSavePrecioGremio')?.addEventListener('click', savePrecioGremio);
  document.getElementById('btnSavePrecioCliente')?.addEventListener('click', savePrecioCliente);
}

async function loadData() {
  await loadPreciosGremio();
  await loadPreciosCliente();
}

async function loadPreciosGremio() {
  try {
    const response = await fetch('/api/precios/gremio');
    if (response.ok) {
      preciosGremio = await response.json();
      renderPreciosGremio();
    }
  } catch (error) {
    console.error('[PRECIOS-GREMIO] Error:', error);
    preciosGremio = [];
    renderPreciosGremio();
  }
}

function renderPreciosGremio() {
  const container = document.getElementById('preciosGremioList');
  if (!preciosGremio || preciosGremio.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay precios configurados</p>';
    return;
  }

  container.innerHTML = preciosGremio.map(precio => `
    <div class="product-card">
      <h3>${precio.nombre}</h3>
      <p><strong>Categoría:</strong> ${precio.categoria}</p>
      <p><strong>Precio Gremio:</strong> $${formatCurrencyAR(precio.precio)}</p>
      <p><strong>Unidad:</strong> ${precio.unidad}</p>
      <div class="flex gap-2 mt-2">
        <button class="btn btn-secondary btn-small" onclick="editarPrecioGremio('${precio.id}')">✏️</button>
        <button class="btn btn-danger btn-small" onclick="eliminarPrecioGremio('${precio.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function savePrecioGremio() {
  const nombre = document.getElementById('nombreGremio').value.trim();
  const categoria = document.getElementById('categoriaGremio').value.trim();
  const precio = parseFloat(document.getElementById('precioGremioInput').value);
  const unidad = document.getElementById('unidadGremio').value;

  if (!nombre || !categoria || !precio) {
    alert('⚠️ Completa todos los campos');
    return;
  }

  try {
    const response = await fetch('/api/precios/gremio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, categoria, precio, unidad })
    });

    if (response.ok) {
      alert('✅ Precio guardado correctamente');
      document.getElementById('precioGremioModal').classList.remove('active');
      document.getElementById('nombreGremio').value = '';
      document.getElementById('categoriaGremio').value = '';
      document.getElementById('precioGremioInput').value = '';
      await loadPreciosGremio();
    }
  } catch (error) {
    console.error('[PRECIOS-GREMIO] Error al guardar:', error);
    alert('❌ Error al guardar');
  }
}

async function loadPreciosCliente() {
  try {
    const response = await fetch('/api/precios/cliente');
    if (response.ok) {
      preciosCliente = await response.json();
      renderPreciosCliente();
    }
  } catch (error) {
    console.error('[PRECIOS-CLIENTE] Error:', error);
    preciosCliente = [];
    renderPreciosCliente();
  }
}

function renderPreciosCliente() {
  const container = document.getElementById('preciosClienteList');
  if (!preciosCliente || preciosCliente.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay precios configurados</p>';
    return;
  }

  container.innerHTML = preciosCliente.map(precio => `
    <div class="product-card">
      <h3>${precio.nombre}</h3>
      <p><strong>Categoría:</strong> ${precio.categoria}</p>
      <p><strong>Precio Público:</strong> $${formatCurrencyAR(precio.precio)}</p>
      <p><strong>Unidad:</strong> ${precio.unidad}</p>
      <div class="flex gap-2 mt-2">
        <button class="btn btn-secondary btn-small" onclick="editarPrecioCliente('${precio.id}')">✏️</button>
        <button class="btn btn-danger btn-small" onclick="eliminarPrecioCliente('${precio.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function savePrecioCliente() {
  const nombre = document.getElementById('nombreCliente').value.trim();
  const categoria = document.getElementById('categoriaCliente').value.trim();
  const precio = parseFloat(document.getElementById('precioClienteInput').value);
  const unidad = document.getElementById('unidadCliente').value;

  if (!nombre || !categoria || !precio) {
    alert('⚠️ Completa todos los campos');
    return;
  }

  try {
    const response = await fetch('/api/precios/cliente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, categoria, precio, unidad })
    });

    if (response.ok) {
      alert('✅ Precio guardado correctamente');
      document.getElementById('precioClienteModal').classList.remove('active');
      document.getElementById('nombreCliente').value = '';
      document.getElementById('categoriaCliente').value = '';
      document.getElementById('precioClienteInput').value = '';
      await loadPreciosCliente();
    }
  } catch (error) {
    console.error('[PRECIOS-CLIENTE] Error al guardar:', error);
    alert('❌ Error al guardar');
  }
}

window.editarPrecioGremio = function(id) {
  console.log('Editar precio gremio:', id);
};

window.eliminarPrecioGremio = async function(id) {
  if (!confirm('¿Eliminar este precio?')) return;
  try {
    const response = await fetch(`/api/precios/gremio/${id}`, { method: 'DELETE' });
    if (response.ok) {
      alert('✅ Precio eliminado');
      await loadPreciosGremio();
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

window.editarPrecioCliente = function(id) {
  console.log('Editar precio cliente:', id);
};

window.eliminarPrecioCliente = async function(id) {
  if (!confirm('¿Eliminar este precio?')) return;
  try {
    const response = await fetch(`/api/precios/cliente/${id}`, { method: 'DELETE' });
    if (response.ok) {
      alert('✅ Precio eliminado');
      await loadPreciosCliente();
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
