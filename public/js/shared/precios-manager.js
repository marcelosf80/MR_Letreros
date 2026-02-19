// ============================================
// GESTOR DE PRECIOS
// VERSION CORREGIDA - SIN VALIDACION ESTRICTA
// ============================================

const preciosManager = {
  precios: [],
  STORAGE_KEY: 'gremio_precios_db',

  async loadPrecios() {
    try {
      // INTENTO PRIMARIO: Servidor
      if (window.mrDataManager) {
        console.log('[preciosManager] 📡 Cargando desde servidor...');
        const serverData = await window.mrDataManager.getPrecios();
        if (Array.isArray(serverData)) {
          this.precios = serverData;
          console.log(`[preciosManager] ✅ ${this.precios.length} precios cargados desde servidor`);
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.precios));
          return this.precios;
        }
      }

      // FALLBACK
      const data = localStorage.getItem(this.STORAGE_KEY);
      this.precios = data ? JSON.parse(data) : [];

      if (!Array.isArray(this.precios)) {
        this.precios = [];
      }
      console.log(`[preciosManager] ⚠️ ${this.precios.length} precios cargados desde LocalStorage (fallback)`);
      return this.precios;
    } catch (error) {
      console.error('[preciosManager] Error cargando precios:', error);
      return [];
    }
  },

  async savePrecios(precios) {
    try {
      if (!Array.isArray(precios)) {
        console.error('[preciosManager] savePrecios requiere un array');
        return false;
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(precios));
      this.precios = precios;
      console.log('[preciosManager] Precios guardados correctamente');
      return true;
    } catch (error) {
      console.error('[preciosManager] Error guardando precios:', error);
      return false;
    }
  },

  async getPrecios() {
    if (this.precios.length === 0) {
      await this.loadPrecios();
    }
    return this.precios;
  },

  getPrecioById(id) {
    return this.precios.find(p => p.id === id);
  },

  getPrecioByCategory(category) {
    return this.precios.find(p => p.category === category);
  },

  getPreciosByCategory(category) {
    return this.precios.filter(p => p.category === category);
  },

  // SIN VALIDACION - Solo guarda
  async addPrecio(precio) {
    try {
      console.log('[preciosManager.addPrecio] Guardando:', precio);
      if (!precio.id) {
        precio.id = 'price_' + Date.now();
      }

      this.precios.push(precio);
      const resultado = await this.savePrecios(this.precios);
      console.log('[preciosManager.addPrecio] Resultado:', resultado);
      return resultado;
    } catch (error) {
      console.error('[preciosManager.addPrecio] ERROR:', error);
      return false;
    }
  },

  async updatePrecio(id, updates) {
    try {
      const index = this.precios.findIndex(p => p.id === id);
      if (index === -1) {
        return false;
      }

      this.precios[index] = {
        ...this.precios[index],
        ...updates,
        id: id,
        updated: new Date().toISOString()
      };

      return await this.savePrecios(this.precios);
    } catch (error) {
      console.error('[preciosManager] Error actualizando:', error);
      return false;
    }
  },

  async deletePrecio(id) {
    try {
      const initialLength = this.precios.length;
      this.precios = this.precios.filter(p => p.id !== id);
      if (this.precios.length === initialLength) {
        return false;
      }

      return await this.savePrecios(this.precios);
    } catch (error) {
      console.error('[preciosManager] Error eliminando:', error);
      return false;
    }
  },

  getCategorias() {
    const categorias = new Set(this.precios.map(p => p.category).filter(Boolean));
    return Array.from(categorias).sort();
  },

  getUnidades() {
    const unidades = new Set(this.precios.map(p => p.unit).filter(Boolean));
    return Array.from(unidades);
  }
};

// Inicializar
console.log('[preciosManager] Iniciando...');
preciosManager.loadPrecios().then(() => {
  console.log('[preciosManager] Listo');
}).catch(error => {
  console.error('[preciosManager] Error:', error);
});

window.preciosManager = preciosManager;

console.log('[preciosManager] Cargado - addPrecio:', typeof window.preciosManager.addPrecio);
