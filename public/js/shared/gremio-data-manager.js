// ============================================
// DATA MANAGER PARA SISTEMA GREMIO
// VERSIÓN CORREGIDA CON LOCALSTORAGE
// ============================================

const dataManager = {
  STORAGE_KEY: 'gremio_clientes_db',
  HISTORY_KEY: 'gremio_history_',
  
  // ========================================
  // GESTIÓN DE CLIENTES
  // ========================================
  
  async getClients() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error obteniendo clientes:', error);
      return [];
    }
  },

  async saveClient(client) {
    try {
      const clients = await this.getClients();
      
      // Generar ID único si no existe
      if (!client.id) {
        client.id = 'gremio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
      
      // Agregar o actualizar
      const existingIndex = clients.findIndex(c => c.id === client.id || c.name === client.name);
      if (existingIndex >= 0) {
        // Actualizar cliente existente
        clients[existingIndex] = { ...clients[existingIndex], ...client };
      } else {
        // Agregar nuevo cliente
        clients.push(client);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
      console.log('✅ Cliente guardado:', client.name);
      return true;
    } catch (error) {
      console.error('Error guardando cliente:', error);
      return false;
    }
  },

  async deleteClient(clientId) {
    try {
      const clients = await this.getClients();
      const filtered = clients.filter(c => c.id !== clientId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error eliminando cliente:', error);
      return false;
    }
  },

  // ========================================
  // GESTIÓN DE COTIZACIONES
  // ========================================

  async saveQuotation(clientId, quotation) {
    try {
      const historyKey = this.HISTORY_KEY + clientId;
      const history = JSON.parse(localStorage.getItem(historyKey)) || [];
      
      quotation.id = quotation.id || 'quot_' + Date.now();
      quotation.date = quotation.date || new Date().toISOString();
      
      history.push(quotation);
      localStorage.setItem(historyKey, JSON.stringify(history));
      return true;
    } catch (error) {
      console.error('Error guardando cotización:', error);
      return false;
    }
  },

  async getClientHistory(clientId) {
    try {
      const historyKey = this.HISTORY_KEY + clientId;
      const data = localStorage.getItem(historyKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      return [];
    }
  },

  async getFullClientHistory(clientId) {
    try {
      const history = await this.getClientHistory(clientId);
      return { history, stats: {} };
    } catch (error) {
      console.error('Error obteniendo historial completo:', error);
      return { history: [], stats: {} };
    }
  },

  async deleteHistoryEntry(clientId, entryIndex) {
    try {
      const historyKey = this.HISTORY_KEY + clientId;
      const history = JSON.parse(localStorage.getItem(historyKey)) || [];
      history.splice(entryIndex, 1);
      localStorage.setItem(historyKey, JSON.stringify(history));
      return true;
    } catch (error) {
      console.error('Error eliminando entrada de historial:', error);
      return false;
    }
  },

  async updateHistoryEntry(clientId, entryIndex, updatedEntry) {
    try {
      const historyKey = this.HISTORY_KEY + clientId;
      const history = JSON.parse(localStorage.getItem(historyKey)) || [];
      if (history[entryIndex]) {
        history[entryIndex] = updatedEntry;
        localStorage.setItem(historyKey, JSON.stringify(history));
        return true;
      }
      return false;
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
      
      const exportFileDefaultName = `gremio_clientes_${new Date().toISOString().split('T')[0]}.json`;
      
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
      
      const exportFileDefaultName = `gremio_backup_${new Date().toISOString().split('T')[0]}.json`;
      
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
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        return true;
      }
      
      // Si es backup completo con historial
      if (data.clients || data[0]?.client) {
        const clients = Array.isArray(data) ? data.map(d => d.client) : data.clients;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
        
        // Restaurar historiales
        if (Array.isArray(data) && data[0]?.history) {
          data.forEach(item => {
            const historyKey = this.HISTORY_KEY + item.client.id;
            localStorage.setItem(historyKey, JSON.stringify(item.history));
          });
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error importando datos:', error);
      return false;
    }
  },
  
  // ========================================
  // LIMPIEZA DE DATOS (útil para testing)
  // ========================================
  
  clearAllData() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('gremio_')) {
          localStorage.removeItem(key);
        }
      });
      console.log('✅ Todos los datos eliminados');
      return true;
    } catch (error) {
      console.error('Error limpiando datos:', error);
      return false;
    }
  }
};

// ========================================
// ✅ EXPORTAR A WINDOW (CORRECCIÓN CRÍTICA)
// ========================================

// Exportar con nombre único a window
window.gremioDataManager = dataManager;

// También como dataManager para compatibilidad
if (!window.dataManager) {
  window.dataManager = dataManager;
}

console.log('✅ Data Manager GREMIO v2.0 (localStorage) cargado correctamente');
console.log('✅ window.gremioDataManager disponible:', typeof window.gremioDataManager);
console.log('✅ window.dataManager disponible:', typeof window.dataManager);
