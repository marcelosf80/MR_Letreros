// ==================== DATA MANAGER - MR LETREROS ====================
// Gestor de datos centralizado que se conecta al servidor en red local
// Versión: 4.0 - Compatible con Gremio + Clientes + Precios + Costos

class MRLetrerosDataManager {
  constructor() {
    this.serverUrl = this.detectServerUrl();
    this.connected = false;
    this.checkConnection();
  }

  // ==================== DETECCIÓN DE SERVIDOR ====================

  detectServerUrl() {
    const hostname = window.location.hostname;
    const port = 3000;

    // Si estamos en localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
      return `http://localhost:${port}`;
    } else {
      // Si estamos en otra PC de la red
      return `http://${hostname}:${port}`;
    }
  }

  async checkConnection() {
    try {
      const response = await fetch(`${this.serverUrl}/api/health`);
      const result = await response.json();
      if (result.status === 'ok') {
        this.connected = true;
        console.log('✅ Conectado al servidor:', this.serverUrl);
        console.log('📡 Timestamp:', result.timestamp);
        return true;
      }
    } catch (error) {
      this.connected = false;
      console.error('❌ No se pudo conectar al servidor:', error);
      this.showConnectionError();
      return false;
    }
  }

  showConnectionError() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    modal.innerHTML = `
      <div style="background: white; padding: 2rem; border-radius: 8px; max-width: 500px; text-align: center;">
        <h2 style="color: #e74c3c; margin-bottom: 1rem;">⚠️ No se puede conectar al servidor</h2>
        <p style="margin-bottom: 1rem;">No se detectó el servidor en: <strong>${this.serverUrl}</strong></p>
        <p style="margin-bottom: 1rem;">Verifica que:</p>
        <ul style="text-align: left; margin: 1rem 0;">
          <li>El servidor esté corriendo (INICIAR_SERVIDOR.bat)</li>
          <li>Estés en la misma red WiFi</li>
          <li>La IP del servidor sea correcta</li>
        </ul>
        <button onclick="window.location.reload()" style="padding: 0.5rem 2rem; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
          🔄 Reintentar
        </button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // ==================== HELPER METHODS ====================

  async request(endpoint, method = 'GET', data = null) {
    try {
      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // ADD AUTH TOKEN
      const token = localStorage.getItem('mr_token');
      if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }

      if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(`${this.serverUrl}${endpoint}`, options);

      // Si el token es inválido o el rol no tiene permiso, cerrar sesión
      if (response.status === 401 || response.status === 403) {
        window.AUTH.logout(); // Asumiendo que AUTH está disponible globalmente
        throw new Error(`Authentication error: ${response.statusText}`); // Lanzar error para que el catch lo maneje
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error en ${method} ${endpoint}:`, error);
      throw error;
    }
  }

  // ==================== GREMIO - CLIENTES ====================

  async getGremioClientes() {
    try {
      const clientes = await this.request('/api/gremio/clientes');
      console.log('[GREMIO] Clientes obtenidos:', clientes.length);
      return clientes;
    } catch (error) {
      console.error('[GREMIO] Error obteniendo clientes:', error);
      return [];
    }
  }

  async saveGremioCliente(cliente) {
    try {
      const result = await this.request('/api/gremio/clientes', 'POST', cliente);
      console.log('[GREMIO] Cliente guardado:', result.data);
      return result.data;
    } catch (error) {
      console.error('[GREMIO] Error guardando cliente:', error);
      alert('❌ Error al guardar cliente: ' + error.message);
      return null;
    }
  }

  async updateGremioCliente(id, cliente) {
    try {
      const result = await this.request(`/api/gremio/clientes/${id}`, 'PUT', cliente);
      console.log('[GREMIO] Cliente actualizado:', result.data);
      return result.data;
    } catch (error) {
      console.error('[GREMIO] Error actualizando cliente:', error);
      return null;
    }
  }

  async deleteGremioCliente(id) {
    try {
      await this.request(`/api/gremio/clientes/${id}`, 'DELETE');
      console.log('[GREMIO] Cliente eliminado:', id);
      return true;
    } catch (error) {
      console.error('[GREMIO] Error eliminando cliente:', error);
      return false;
    }
  }

  // ==================== GREMIO - COTIZACIONES ====================

  async getGremioCotizaciones() {
    try {
      const cotizaciones = await this.request('/api/gremio/data');
      console.log('[GREMIO] Cotizaciones obtenidas:', cotizaciones.length);
      return cotizaciones;
    } catch (error) {
      console.error('[GREMIO] Error obteniendo cotizaciones:', error);
      return [];
    }
  }

  async saveGremioCotizaciones(cotizaciones) {
    try {
      const result = await this.request('/api/gremio/data', 'POST', cotizaciones);
      console.log('[GREMIO] Cotizaciones guardadas:', cotizaciones.length);
      return result.success;
    } catch (error) {
      console.error('[GREMIO] Error guardando cotizaciones:', error);
      return false;
    }
  }

  // ==================== CLIENTES - CLIENTES ====================

  async getClientesClientes() {
    try {
      const clientes = await this.request('/api/clientes');
      console.log('[CLIENTES] Clientes obtenidos:', clientes.length);
      return clientes;
    } catch (error) {
      console.error('[CLIENTES] Error obteniendo clientes:', error);
      return [];
    }
  }

  async saveClientesCliente(cliente) {
    try {
      const result = await this.request('/api/clientes', 'POST', cliente);
      console.log('[CLIENTES] Cliente guardado:', result.data);
      return result.data;
    } catch (error) {
      console.error('[CLIENTES] Error guardando cliente:', error);
      return null;
    }
  }

  async updateClientesCliente(id, cliente) {
    try {
      const result = await this.request(`/api/clientes/${id}`, 'PUT', cliente);
      console.log('[CLIENTES] Cliente actualizado:', result.data);
      return result.data;
    } catch (error) {
      console.error('[CLIENTES] Error actualizando cliente:', error);
      return null;
    }
  }

  async deleteClientesCliente(id) {
    try {
      await this.request(`/api/clientes/${id}`, 'DELETE');
      console.log('[CLIENTES] Cliente eliminado:', id);
      return true;
    } catch (error) {
      console.error('[CLIENTES] Error eliminando cliente:', error);
      return false;
    }
  }

  // ==================== CLIENTES - COTIZACIONES ====================

  async getClientesCotizaciones() {
    try {
      const cotizaciones = await this.request('/api/clientes/data');
      console.log('[CLIENTES] Cotizaciones obtenidas:', cotizaciones.length);
      return cotizaciones;
    } catch (error) {
      console.error('[CLIENTES] Error obteniendo cotizaciones:', error);
      return [];
    }
  }

  async saveClientesCotizaciones(cotizaciones) {
    try {
      const result = await this.request('/api/clientes/data', 'POST', cotizaciones);
      console.log('[CLIENTES] Cotizaciones guardadas:', cotizaciones.length);
      return result.success;
    } catch (error) {
      console.error('[CLIENTES] Error guardando cotizaciones:', error);
      return false;
    }
  }

  // ==================== PRECIOS ====================

  async getPrecios() {
    try {
      const precios = await this.request('/api/precios');
      console.log('[PRECIOS] Precios obtenidos:', precios.length);
      return precios;
    } catch (error) {
      console.error('[PRECIOS] Error obteniendo precios:', error);
      return [];
    }
  }

  async savePrecios(precios) {
    try {
      const result = await this.request('/api/precios', 'POST', precios);
      console.log('[PRECIOS] Precios guardados:', precios.length);
      return result.success;
    } catch (error) {
      console.error('[PRECIOS] Error guardando precios:', error);
      return false;
    }
  }

  // ==================== COSTOS ====================

  async getCostos() {
    try {
      const costos = await this.request('/api/costos');
      console.log('[COSTOS] Costos obtenidos:', costos.length);
      return costos;
    } catch (error) {
      console.error('[COSTOS] Error obteniendo costos:', error);
      return [];
    }
  }

  async saveCostos(costos) {
    try {
      const result = await this.request('/api/costos', 'POST', costos);
      console.log('[COSTOS] Costos guardados:', costos.length);
      return result.success;
    } catch (error) {
      console.error('[COSTOS] Error guardando costos:', error);
      return false;
    }
  }

  // ==================== GASTOS ====================

  async getGastos() {
    try {
      const gastos = await this.request('/api/gastos');
      console.log('[GASTOS] Gastos obtenidos:', gastos.length);
      return gastos;
    } catch (error) {
      console.error('[GASTOS] Error obteniendo gastos:', error);
      return [];
    }
  }

  async saveGastos(gastos) {
    try {
      const result = await this.request('/api/gastos', 'POST', gastos);
      console.log('[GASTOS] Gastos guardados:', gastos.length);
      return result.success;
    } catch (error) {
      console.error('[GASTOS] Error guardando gastos:', error);
      return false;
    }
  }

  // ==================== MATERIALES ====================

  async getMateriales() {
    try {
      const materiales = await this.request('/api/materiales');
      console.log('[MATERIALES] Materiales obtenidos:', materiales.length);
      return materiales;
    } catch (error) {
      console.error('[MATERIALES] Error obteniendo materiales:', error);
      return [];
    }
  }

  async saveMateriales(materiales) {
    try {
      const result = await this.request('/api/materiales', 'POST', materiales);
      console.log('[MATERIALES] Materiales guardados:', materiales.length);
      return result.success;
    } catch (error) {
      console.error('[MATERIALES] Error guardando materiales:', error);
      return false;
    }
  }

  // ==================== TERCEROS ====================

  async getTerceros() {
    try {
      const terceros = await this.request('/api/terceros');
      console.log('[TERCEROS] Terceros obtenidos:', terceros.length);
      return terceros;
    } catch (error) {
      console.error('[TERCEROS] Error obteniendo terceros:', error);
      return [];
    }
  }

  async saveTerceros(terceros) {
    try {
      const result = await this.request('/api/terceros', 'POST', terceros);
      console.log('[TERCEROS] Terceros guardados:', terceros.length);
      return result.success;
    } catch (error) {
      console.error('[TERCEROS] Error guardando terceros:', error);
      return false;
    }
  }

  // ==================== ESTADÍSTICAS ====================

  async getStatsToday() {
    try {
      const stats = await this.request('/api/statistics/today');
      console.log('[STATS] Estadísticas de hoy obtenidas:', stats);
      return stats;
    } catch (error) {
      console.error('[STATS] Error obteniendo estadísticas:', error);
      return { total: 0, gremio: 0, clientes: 0, facturado: 0 };
    }
  }

  async getRendimientos() {
    try {
      const rendimientos = await this.request('/api/rendimientos');
      console.log('[RENDIMIENTOS] Datos obtenidos:', rendimientos);
      return rendimientos;
    } catch (error) {
      console.error('[RENDIMIENTOS] Error obteniendo rendimientos:', error);
      return { ingresos: 0, gastos: 0, ganancia: 0, margen: 0 };
    }
  }

  // ==================== BACKUP ====================

  async createBackup() {
    try {
      // Obtener todos los datos
      const [
        gremioClientes,
        gremioCotizaciones,
        clientesClientes,
        clientesCotizaciones,
        precios,
        costos,
        gastos
      ] = await Promise.all([
        this.getGremioClientes(),
        this.getGremioCotizaciones(),
        this.getClientesClientes(),
        this.getClientesCotizaciones(),
        this.getPrecios(),
        this.getCostos(),
        this.getGastos()
      ]);

      const backup = {
        fecha: new Date().toISOString(),
        version: '4.0',
        datos: {
          gremio_clientes: gremioClientes,
          gremio_cotizaciones: gremioCotizaciones,
          clientes_clientes: clientesClientes,
          clientes_cotizaciones: clientesCotizaciones,
          precios: precios,
          costos: costos,
          gastos: gastos
        }
      };

      // Descargar como archivo
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_mr_letreros_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      console.log('✅ Backup creado exitosamente');
      alert('✅ Backup descargado correctamente');
      return true;
    } catch (error) {
      console.error('Error al crear backup:', error);
      alert('❌ Error al crear backup: ' + error.message);
      return false;
    }
  }

  // ==================== CATEGORÍAS ====================

  async getCategorias() {
    try {
      const categorias = await this.request('/api/categorias');
      console.log('[CATEGORIAS] Categorías obtenidas:', categorias);
      return Array.isArray(categorias) ? categorias : [];
    } catch (error) {
      console.error('[CATEGORIAS] Error obteniendo categorías:', error);
      return [];
    }
  }

  async saveCategorias(categorias) {
    try {
      const result = await this.request('/api/categorias', 'POST', categorias);
      console.log('[CATEGORIAS] Categorías guardadas:', categorias.length);
      return result.success;
    } catch (error) {
      console.error('[CATEGORIAS] Error guardando categorías:', error);
      return false;
    }
  }

  async addCategoria(nombre) {
    try {
      const result = await this.request('/api/categorias', 'POST', { categoria: nombre });
      console.log('[CATEGORIAS] Categoría agregada:', nombre);
      return result.success;
    } catch (error) {
      console.error('[CATEGORIAS] Error agregando categoría:', error);
      return false;
    }
  }

  async deleteCategoria(nombre) {
    try {
      const result = await this.request(`/api/categorias/${encodeURIComponent(nombre)}`, 'DELETE');
      console.log('[CATEGORIAS] Categoría eliminada:', nombre);
      return result.success;
    } catch (error) {
      console.error('[CATEGORIAS] Error eliminando categoría:', error);
      return false;
    }
  }
}

// ==================== MANAGERS COMPATIBLES CON LOCALSTORAGE ====================

// Estos managers mantienen la misma interfaz que los antiguos basados en localStorage
// pero ahora se conectan al servidor

class PreciosManagerNetwork {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  async getPrecios() {
    return await this.dataManager.getPrecios();
  }

  async savePrecios(precios) {
    return await this.dataManager.savePrecios(precios);
  }

  async addPrecio(precioData) {
    const precios = await this.getPrecios();
    precios.push({
      id: Date.now(),
      ...precioData,
      created: new Date().toISOString()
    });
    return await this.savePrecios(precios);
  }
}

class CostosManagerNetwork {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.products = [];
  }

  async loadCostos() {
    this.products = await this.dataManager.getCostos();
    return this.products;
  }

  getAllProducts() {
    return this.products;
  }

  async saveCostos(costos) {
    this.products = costos;
    return await this.dataManager.saveCostos(costos);
  }

  async addProduct(product) {
    try {
      this.products.push(product);
      const success = await this.dataManager.saveCostos(this.products);
      console.log('[COSTOS] Producto agregado:', product.name);
      return success;
    } catch (error) {
      console.error('[COSTOS] Error agregando producto:', error);
      return false;
    }
  }

  async updateProduct(id, updatedProduct) {
    try {
      const index = this.products.findIndex(p => p.id === id);
      if (index !== -1) {
        this.products[index] = { ...this.products[index], ...updatedProduct };
        const success = await this.dataManager.saveCostos(this.products);
        console.log('[COSTOS] Producto actualizado:', id);
        return success;
      }
      return false;
    } catch (error) {
      console.error('[COSTOS] Error actualizando producto:', error);
      return false;
    }
  }

  async deleteProduct(id) {
    try {
      this.products = this.products.filter(p => p.id !== id);
      const success = await this.dataManager.saveCostos(this.products);
      console.log('[COSTOS] Producto eliminado:', id);
      return success;
    } catch (error) {
      console.error('[COSTOS] Error eliminando producto:', error);
      return false;
    }
  }
}

// ==================== INICIALIZACIÓN GLOBAL ====================

console.log('🚀 Inicializando MR Letreros Data Manager...');

// Crear instancia global del data manager
window.mrDataManager = new MRLetrerosDataManager();

// Crear managers compatibles con el código existente
window.preciosManager = new PreciosManagerNetwork(window.mrDataManager);
window.costosManager = new CostosManagerNetwork(window.mrDataManager);

// COMPATIBILIDAD: Alias para window.dataManager (usado en gremio.html y clientes.html)
window.dataManager = {
  // ==================== MÉTODOS PARA GREMIO ====================
  async getClients() {
    // Para gremio.html - usa clientes del gremio
    if (window.location.pathname.includes('gremio')) {
      return await window.mrDataManager.getGremioClientes();
    }
    // Para clientes.html - usa clientes públicos
    return await window.mrDataManager.getClientesClientes();
  },

  async saveClient(client) {
    const isGremio = window.location.pathname.includes('gremio');
    if (client.id) {
      // Actualizar
      if (isGremio) {
        return await window.mrDataManager.updateGremioCliente(client.id, client);
      } else {
        return await window.mrDataManager.updateClientesCliente(client.id, client);
      }
    } else {
      // Crear nuevo
      if (isGremio) {
        return await window.mrDataManager.saveGremioCliente(client);
      } else {
        return await window.mrDataManager.saveClientesCliente(client);
      }
    }
  },

  async getClientHistory(clientId) {
    const isGremio = window.location.pathname.includes('gremio');
    if (isGremio) {
      const cotizaciones = await window.mrDataManager.getGremioCotizaciones();
      return cotizaciones.filter(c => c.clientId === clientId);
    } else {
      const cotizaciones = await window.mrDataManager.getClientesCotizaciones();
      return cotizaciones.filter(c => c.clientId === clientId);
    }
  },

  async saveQuotation(clientId, quotation) {
    const isGremio = window.location.pathname.includes('gremio');
    if (isGremio) {
      const cotizaciones = await window.mrDataManager.getGremioCotizaciones();
      cotizaciones.push({
        ...quotation,
        clientId: clientId,
        id: quotation.id || Date.now(),
        date: quotation.date || new Date().toISOString()
      });
      return await window.mrDataManager.saveGremioCotizaciones(cotizaciones);
    } else {
      const cotizaciones = await window.mrDataManager.getClientesCotizaciones();
      cotizaciones.push({
        ...quotation,
        clientId: clientId,
        id: quotation.id || Date.now(),
        date: quotation.date || new Date().toISOString()
      });
      return await window.mrDataManager.saveClientesCotizaciones(cotizaciones);
    }
  },

  async updateHistoryEntry(clientId, index, quotation) {
    const isGremio = window.location.pathname.includes('gremio');
    if (isGremio) {
      const cotizaciones = await window.mrDataManager.getGremioCotizaciones();
      const clientQuotations = cotizaciones.filter(c => c.clientId === clientId);
      if (clientQuotations[index]) {
        const globalIndex = cotizaciones.indexOf(clientQuotations[index]);
        if (globalIndex !== -1) {
          cotizaciones[globalIndex] = { ...quotation, clientId: clientId };
          return await window.mrDataManager.saveGremioCotizaciones(cotizaciones);
        }
      }
    } else {
      const cotizaciones = await window.mrDataManager.getClientesCotizaciones();
      const clientQuotations = cotizaciones.filter(c => c.clientId === clientId);
      if (clientQuotations[index]) {
        const globalIndex = cotizaciones.indexOf(clientQuotations[index]);
        if (globalIndex !== -1) {
          cotizaciones[globalIndex] = { ...quotation, clientId: clientId };
          return await window.mrDataManager.saveClientesCotizaciones(cotizaciones);
        }
      }
    }
    return false;
  },

  // ==================== MÉTODOS DE EXPORTACIÓN ====================
  
  async exportClients() {
    return await window.mrDataManager.createBackup();
  },
  async exportAllData() {
    return await window.mrDataManager.createBackup();
  }
};

// Inicializar costos
window.costosManager.loadCostos();

console.log('✅ Data Manager inicializado');
console.log('📡 Servidor:', window.mrDataManager.serverUrl);
