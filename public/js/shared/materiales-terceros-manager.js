/**
 * MATERIALES Y TERCEROS MANAGER
 * Sistema robusto de gestión para materiales y servicios de terceros
 * Con soporte para promedio ponderado y cálculo automático de márgenes
 */

'use strict';

// ========================================
// STORAGE MANAGER
// ========================================
const StorageManager = {
  STORAGE_KEY: 'mr_system_data',
  
  getData() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : { materiales: [], terceros: [] };
    } catch (error) {
      console.error('[StorageManager] Error reading:', error);
      return { materiales: [], terceros: [] };
    }
  },

  saveData(data) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('[StorageManager] Error saving:', error);
      return false;
    }
  }
};

// ========================================
// MATERIALES MANAGER
// ========================================
const MaterialesManager = {
  async getMateriales() {
    const data = StorageManager.getData();
    return data.materiales || [];
  },

  async saveMateriales(materiales) {
    const data = StorageManager.getData();
    data.materiales = materiales;
    return StorageManager.saveData(data);
  },

  async addRollo(rollo) {
    if (!rollo.id) {
      rollo.id = 'rollo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    const materiales = await this.getMateriales();
    materiales.push(rollo);
    return await this.saveMateriales(materiales);
  },

  async updateRollo(id, updates) {
    const materiales = await this.getMateriales();
    const index = materiales.findIndex(m => m.id === id);
    
    if (index === -1) return false;
    
    materiales[index] = { ...materiales[index], ...updates };
    return await this.saveMateriales(materiales);
  },

  async deleteRollo(id) {
    const materiales = await this.getMateriales();
    const filtered = materiales.filter(m => m.id !== id);
    return await this.saveMateriales(filtered);
  },

  // Calcular promedio ponderado por producto
  calculateWeightedAverage(productId, materiales) {
    const rollos = materiales.filter(m => m.productoId === productId);
    
    if (rollos.length === 0) return 0;
    
    let totalM2 = 0;
    let totalCost = 0;
    
    rollos.forEach(rollo => {
      const m2 = rollo.ancho * rollo.largo;
      totalM2 += m2;
      totalCost += rollo.precioRollo;
    });
    
    return totalM2 > 0 ? totalCost / totalM2 : 0;
  }
};

// ========================================
// TERCEROS MANAGER
// ========================================
const TercerosManager = {
  async getTerceros() {
    const data = StorageManager.getData();
    return data.terceros || [];
  },

  async saveTerceros(terceros) {
    const data = StorageManager.getData();
    data.terceros = terceros;
    return StorageManager.saveData(data);
  },

  async addServicio(servicio) {
    if (!servicio.id) {
      servicio.id = 'tercero_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Calcular margen automáticamente
    if (servicio.costo && servicio.precio) {
      servicio.margen = ((servicio.precio - servicio.costo) / servicio.precio) * 100;
    }
    
    const terceros = await this.getTerceros();
    terceros.push(servicio);
    return await this.saveTerceros(terceros);
  },

  async updateServicio(id, updates) {
    const terceros = await this.getTerceros();
    const index = terceros.findIndex(t => t.id === id);
    
    if (index === -1) return false;
    
    // Recalcular margen si cambió precio o costo
    if (updates.costo || updates.precio) {
      const costo = updates.costo || terceros[index].costo;
      const precio = updates.precio || terceros[index].precio;
      updates.margen = ((precio - costo) / precio) * 100;
    }
    
    terceros[index] = { ...terceros[index], ...updates };
    return await this.saveTerceros(terceros);
  },

  async deleteServicio(id) {
    const terceros = await this.getTerceros();
    const filtered = terceros.filter(t => t.id !== id);
    return await this.saveTerceros(filtered);
  }
};

// ========================================
// EXPORTAR A WINDOW
// ========================================
window.MaterialesManager = MaterialesManager;
window.TercerosManager = TercerosManager;
window.StorageManager = StorageManager;

console.log('✅ Materiales & Terceros Manager cargado');
console.log('Available: window.MaterialesManager, window.TercerosManager, window.StorageManager');
