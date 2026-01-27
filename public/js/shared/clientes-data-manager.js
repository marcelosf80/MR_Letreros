// ============================================
// DATA MANAGER PARA SISTEMA CLIENTES
// VERSIÓN CORREGIDA CON ERROR HANDLING
// ============================================

console.log('[INIT] Iniciando carga de clientes-data-manager.js...');

// ALIAS: Exportar como dataManager para compatibilidad
const dataManager = {
  // Configuración
  STORAGE_KEY: 'clientes_db_backup',
  
  // ========================================
  // GESTIÓN DE CLIENTES
  // ========================================
  
  async getClients() {
    try {
      console.log('[FETCH] Intentando GET /api/clientes/clientes...');
      
      const response = await fetch('/api/clientes/clientes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[RESPONSE] Status:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[SUCCESS] Clientes obtenidos:', data.length, 'items');
        return data;
      }
      
      console.warn('[ERROR] Respuesta no OK:', response.status);
      return [];
    } catch (error) {
      console.error('[EXCEPTION] Error en getClients:', error.message);
      // Fallback a localStorage si falla la API
      try {
        const backup = localStorage.getItem(this.STORAGE_KEY);
        if (backup) {
          console.log('[FALLBACK] Usando datos de localStorage');
          return JSON.parse(backup);
        }
      } catch (e) {
        console.error('[FALLBACK ERROR]', e.message);
      }
      return [];
    }
  },

  async saveClient(client) {
    try {
      console.log('[SAVE] Guardando cliente:', client.name);
      
      // Obtener clientes actuales
      const clients = await this.getClients();
      
      // Generar ID único si no existe
      if (!client.id) {
        client.id = 'clientes_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
      
      // Agregar o actualizar
      const existingIndex = clients.findIndex(c => c.id === client.id || c.name === client.name);
      if (existingIndex >= 0) {
        console.log('[UPDATE] Actualizando cliente existente');
        clients[existingIndex] = { ...clients[existingIndex], ...client };
      } else {
        console.log('[ADD] Agregando nuevo cliente');
        clients.push(client);
      }
      
      // Guardar en API
      try {
        const response = await fetch('/api/clientes/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clients)
        });
        
        console.log('[POST RESPONSE] Status:', response.status);
        
        if (response.ok) {
          console.log('[SUCCESS] Cliente guardado en servidor');
          // También guardar en localStorage como backup
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
          return true;
        } else {
          console.warn('[ERROR] POST devolvió:', response.status);
          // Guardar en localStorage si falla
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
          return false;
        }
      } catch (apiError) {
        console.error('[API ERROR] Error en POST:', apiError.message);
        // Guardar en localStorage como fallback
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
        return true; // Considerar como éxito si se guardó en localStorage
      }
    } catch (error) {
      console.error('[EXCEPTION] Error guardando cliente:', error.message);
      return false;
    }
  },

  async deleteClient(clientId) {
    try {
      console.log('[DELETE] Eliminando cliente:', clientId);
      
      const clients = await this.getClients();
      const filtered = clients.filter(c => c.id !== clientId);
      
      try {
        const response = await fetch('/api/clientes/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(filtered)
        });
        
        if (response.ok) {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
          console.log('[SUCCESS] Cliente eliminado');
          return true;
        }
      } catch (e) {
        console.error('[ERROR] No se pudo eliminar en servidor:', e.message);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[EXCEPTION] Error eliminando cliente:', error.message);
      return false;
    }
  },

  // ========================================
  // GESTIÓN DE COTIZACIONES
  // ========================================

  async saveQuotation(clientId, quotation) {
    try {
      const response = await fetch('/api/clientes/quotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, quotation })
      });
      return response.ok;
    } catch (error) {
      console.error('Error guardando cotización:', error);
      return false;
    }
  },

  async getClientHistory(clientId) {
    try {
      const response = await fetch(`/api/clientes/history/${clientId}`);
      if (response.ok) {
        const data = await response.json();
        return data.history || [];
      }
      return [];
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      return [];
    }
  },

  async getFullClientHistory(clientId) {
    try {
      const response = await fetch(`/api/clientes/history/${clientId}`);
      if (response.ok) {
        return await response.json();
      }
      return { history: [], stats: {} };
    } catch (error) {
      console.error('Error obteniendo historial completo:', error);
      return { history: [], stats: {} };
    }
  },

  async deleteHistoryEntry(clientId, entryIndex) {
    try {
      const response = await fetch('/api/clientes/history/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, entryIndex })
      });
      return response.ok;
    } catch (error) {
      console.error('Error eliminando entrada de historial:', error);
      return false;
    }
  },

  async updateHistoryEntry(clientId, entryIndex, updatedEntry) {
    try {
      const response = await fetch('/api/clientes/history/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, entryIndex, entry: updatedEntry })
      });
      return response.ok;
    } catch (error) {
      console.error('Error actualizando entrada de historial:', error);
      return false;
    }
  },

  // ========================================
  // ESTADÍSTICAS DE CLIENTES
  // ========================================

  async getClientStats(clientId) {
    try {
      const history = await this.getClientHistory(clientId);
      
      if (!history || history.length === 0) {
        return {
          totalQuotations: 0,
          totalRevenue: 0,
          averageQuotation: 0,
          lastQuotationDate: null,
          approvedQuotations: 0,
          pendingQuotations: 0
        };
      }

      const totalQuotations = history.length;
      const totalRevenue = history.reduce((sum, entry) => sum + (entry.total || 0), 0);
      const averageQuotation = totalRevenue / totalQuotations;
      const approvedQuotations = history.filter(entry => entry.approved).length;
      const pendingQuotations = totalQuotations - approvedQuotations;
      const lastQuotationDate = history[0]?.date || null;

      return {
        totalQuotations,
        totalRevenue,
        averageQuotation,
        lastQuotationDate,
        approvedQuotations,
        pendingQuotations
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return {
        totalQuotations: 0,
        totalRevenue: 0,
        averageQuotation: 0,
        lastQuotationDate: null,
        approvedQuotations: 0,
        pendingQuotations: 0
      };
    }
  },

  // ========================================
  // EXPORTACIÓN DE DATOS
  // ========================================

  async exportClients() {
    try {
      const clients = await this.getClients();
      const dataStr = JSON.stringify(clients, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `clientes_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      return true;
    } catch (error) {
      console.error('Error exportando clientes:', error);
      return false;
    }
  },

  async exportAllData() {
    try {
      const clients = await this.getClients();
      
      // Obtener historial de cada cliente
      const allData = [];
      for (const client of clients) {
        const history = await this.getClientHistory(client.id);
        allData.push({
          client,
          history
        });
      }
      
      const dataStr = JSON.stringify(allData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `backup_clientes_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      return true;
    } catch (error) {
      console.error('Error exportando todos los datos:', error);
      return false;
    }
  },

  // ========================================
  // IMPORTACIÓN DE DATOS
  // ========================================

  async importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      // Si es array de clientes directamente
      if (Array.isArray(data)) {
        const response = await fetch('/api/clientes/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        return response.ok;
      }
      
      // Si es backup completo con historial
      if (data.clients || data[0]?.client) {
        console.log('Importación de backup completo no implementada aún');
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('Error importando datos:', error);
      return false;
    }
  }
};

// ========================================
// ✅ EXPORTAR A WINDOW (CORRECCIÓN CRÍTICA)
// ========================================

// Exportar con nombre único a window
window.clientesDataManager = dataManager;

// También como dataManager para compatibilidad
if (!window.dataManager) {
  window.dataManager = dataManager;
}

// Log final
console.log('[SUCCESS] ✅ Data Manager CLIENTES cargado correctamente');
console.log('[INFO] window.clientesDataManager disponible:', typeof window.clientesDataManager);
console.log('[INFO] window.dataManager disponible:', typeof window.dataManager);
