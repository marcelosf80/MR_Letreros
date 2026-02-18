/**
 * CLIENTES - Sistema de Cotizaciones (Versión de Red)
 * Conectado al servidor Node.js a través de data-manager-network.js
 * Adaptado de gremio-main.js para usar precios públicos
 */

}

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', async function() {
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

