// ============================================
// PRODUCTO DINAMICO
// Manejo de productos y servicios dinámicos
// ============================================

const productoDinamico = {
  // Cargar productos por categoría
  async cargarProductosPorCategoria(categoria) {
    try {
      if (!window.costosManager) {
        console.warn('[productoDinamico] costosManager no disponible');
        return [];
      }
      
      const costos = await costosManager.getCostos();
      const productos = costos.filter(c => c.category === categoria);
      
      console.log(`[productoDinamico] ${productos.length} productos encontrados para categoría ${categoria}`);
      return productos;
    } catch (error) {
      console.error('[productoDinamico] Error cargando productos:', error);
      return [];
    }
  },
  
  // Poblar select de productos
  async poblarSelectProductos(selectElement, categoria) {
    if (!selectElement) {
      console.error('[productoDinamico] Elemento select no encontrado');
      return;
    }
    
    try {
      const productos = await this.cargarProductosPorCategoria(categoria);
      
      selectElement.innerHTML = '<option value="">Selecciona un producto...</option>';
      
      productos.forEach(producto => {
        const option = document.createElement('option');
        option.value = producto.id;
        option.textContent = producto.name;
        selectElement.appendChild(option);
      });
      
      selectElement.disabled = productos.length === 0;
      
      console.log(`[productoDinamico] Select poblado con ${productos.length} productos`);
    } catch (error) {
      console.error('[productoDinamico] Error poblando select:', error);
    }
  },
  
  // Obtener producto por ID
  async obtenerProducto(productoId) {
    try {
      if (!window.costosManager) {
        console.warn('[productoDinamico] costosManager no disponible');
        return null;
      }
      
      const producto = await costosManager.getCostoById(productoId);
      return producto;
    } catch (error) {
      console.error('[productoDinamico] Error obteniendo producto:', error);
      return null;
    }
  }
};

// Exportar a window
window.productoDinamico = productoDinamico;

console.log('[productoDinamico] Módulo de productos dinámicos cargado');
