// ==================== MÓDULO EDITAR PRECIOS v3.9 CORREGIDO ====================
// Archivo: js/edit-precios.js

(function() {
  'use strict';
  
  let editingPriceId = null;
  
  // Función para editar precio
  window.editPrice = async function(priceId) {
    try {
      // ✅ VALIDACIÓN: Verificar que preciosManager existe
      if (!window.preciosManager) {
        console.error('[editPrice] preciosManager no está disponible');
        alert('❌ Error: Sistema de precios no inicializado');
        return;
      }

      const precios = await window.preciosManager.getPrecios();
      const precio = precios.find(p => p.id === priceId);
      
      if (!precio) {
        alert('❌ Precio no encontrado');
        return;
      }
      
      // ✅ VALIDACIÓN: Verificar que elementos DOM existen
      const elements = {
        name: document.getElementById('priceName'),
        category: document.getElementById('priceCategory'),
        unit: document.getElementById('priceUnit'),
        gremio: document.getElementById('priceGremio'),
        publico: document.getElementById('pricePublico'),
        discount: document.getElementById('priceDiscount'),
        modal: document.getElementById('priceModal'),
        btnSave: document.getElementById('btnSavePrice')
      };
      
      // Verificar elementos faltantes
      const missing = Object.keys(elements).filter(key => !elements[key]);
      if (missing.length > 0) {
        console.error('[editPrice] Elementos faltantes:', missing);
        alert(`❌ Error: Faltan elementos del formulario (${missing.join(', ')})`);
        return;
      }
      
      editingPriceId = priceId;
      
      // Cargar datos en el formulario
      elements.name.value = precio.name || '';
      elements.category.value = precio.category || '';
      elements.unit.value = precio.unit || 'Metro cuadrado (m²)';
      elements.gremio.value = precio.priceGremio || '';
      elements.publico.value = precio.pricePublico || '';
      elements.discount.value = precio.discount || '0';
      
      // Cambiar texto del modal
      const title = elements.modal.querySelector('.modal-title');
      if (title) {
        title.textContent = '✏️ Editar Precio';
      }
      elements.btnSave.textContent = '💾 Actualizar Precio';
      
      // Abrir modal
      elements.modal.classList.add('active');
      
      console.log(`[editPrice] Precio ${priceId} cargado para edición`);
      
    } catch (error) {
      console.error('[editPrice] Error:', error);
      alert('❌ Error al cargar precio para edición');
    }
  };
  
  // Función para resetear el modo edición
  window.resetPriceForm = function() {
    try {
      editingPriceId = null;
      
      // ✅ VALIDACIÓN: Verificar elementos antes de usarlos
      const modal = document.getElementById('priceModal');
      const btnSave = document.getElementById('btnSavePrice');
      
      if (modal) {
        const title = modal.querySelector('.modal-title');
        if (title) {
          title.textContent = '➕ Agregar Producto con Precio';
        }
      }
      
      if (btnSave) {
        btnSave.textContent = '💾 Guardar Precio';
      }
      
      // Limpiar formulario
      const fields = [
        'priceName',
        'priceCategory',
        'priceUnit',
        'priceGremio',
        'pricePublico',
        'priceDiscount'
      ];
      
      fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
          if (fieldId === 'priceUnit') {
            field.value = 'Metro cuadrado (m²)';
          } else if (fieldId === 'priceDiscount') {
            field.value = '0';
          } else {
            field.value = '';
          }
        }
      });
      
      console.log('[resetPriceForm] Formulario reseteado');
      
    } catch (error) {
      console.error('[resetPriceForm] Error:', error);
    }
  };
  
  // Obtener ID en edición
  window.getEditingPriceId = function() {
    return editingPriceId;
  };
  
  // Verificar si estamos en modo edición
  window.isEditingPrice = function() {
    return editingPriceId !== null;
  };
  
  // Limpiar ID de edición (usar después de guardar)
  window.clearEditingPriceId = function() {
    editingPriceId = null;
  };
  
  console.log('✅ Módulo edit-precios.js cargado (v3.9 corregido)');
})();
