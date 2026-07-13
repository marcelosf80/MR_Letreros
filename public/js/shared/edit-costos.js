// ============================================
// EDIT COSTOS
// Funciones para editar costos en el modal
// ============================================

const editCostos = {
  costoActualId: null,
  
  // Abrir modal de edición
  async abrirModalEdicion(costoId) {
    try {
      if (!window.costosManager) {
        console.error('[editCostos] costosManager no disponible');
        return;
      }
      
      const costo = await costosManager.getCostoById(costoId);
      
      if (!costo) {
        console.error('[editCostos] Costo no encontrado:', costoId);
        alert('❌ No se encontró el costo');
        return;
      }
      
      this.costoActualId = costoId;
      
      // Llenar formulario
      document.getElementById('editCostName').value = costo.name || '';
      document.getElementById('editCostCategory').value = costo.category || '';
      document.getElementById('editCostPrice').value = costo.price || '';
      document.getElementById('editCostUnit').value = costo.unit || '';
      
      // Abrir modal
      const modal = document.getElementById('editCostModal');
      if (modal) {
        modal.classList.add('active');
      }
      
      console.log('[editCostos] Modal abierto para editar:', costoId);
    } catch (error) {
      console.error('[editCostos] Error abriendo modal:', error);
      alert('❌ Error al abrir formulario de edición');
    }
  },
  
  // Guardar cambios
  async guardarCambios() {
    try {
      if (!this.costoActualId) {
        console.error('[editCostos] No hay costo seleccionado');
        return false;
      }
      
      const updates = {
        name: document.getElementById('editCostName').value,
        category: document.getElementById('editCostCategory').value,
        price: parseFloat(document.getElementById('editCostPrice').value),
        unit: document.getElementById('editCostUnit').value
      };
      
      const success = await costosManager.updateCosto(this.costoActualId, updates);
      
      if (success) {
        console.log('[editCostos] Costo actualizado exitosamente');
        this.cerrarModal();
        
        // Recargar lista si existe la función
        if (typeof loadCostosList === 'function') {
          loadCostosList();
        }
        
        return true;
      } else {
        console.error('[editCostos] Error actualizando costo');
        return false;
      }
    } catch (error) {
      console.error('[editCostos] Error guardando cambios:', error);
      return false;
    }
  },
  
  // Cerrar modal
  cerrarModal() {
    const modal = document.getElementById('editCostModal');
    if (modal) {
      modal.classList.remove('active');
    }
    this.costoActualId = null;
  }
};

// Exportar a window
window.editCostos = editCostos;

console.log('[editCostos] Módulo de edición de costos cargado');
