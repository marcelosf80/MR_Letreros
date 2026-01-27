// ==================== MATERIALES MODULE - MAIN ==================== 

let allCategorias = []; // Variable global para almacenar categorías

document.addEventListener('DOMContentLoaded', function() {
  
  console.log('[MATERIALES] ✅ DOMContentLoaded - Inicializando módulo...');

  // ==================== REFERENCES ====================
  
  const btnAddMaterial = document.getElementById('btnAddMaterial');
  const materialModal = document.getElementById('materialModal');
  const btnCloseMaterial = document.getElementById('btnCloseMaterial');
  const btnCancelMaterial = document.getElementById('btnCancelMaterial');
  const btnSaveMaterial = document.getElementById('btnSaveMaterial');

  console.log('[MATERIALES] btnAddMaterial:', btnAddMaterial?.id);
  console.log('[MATERIALES] btnSaveMaterial:', btnSaveMaterial?.id);
  console.log('[MATERIALES] materialModal:', materialModal?.id);

  if (!btnAddMaterial || !materialModal) {
    console.error('[MATERIALES] ❌ No se encontraron elementos necesarios');
    return;
  }

  console.log('[MATERIALES] ✅ Todos los elementos encontrados');

  // ==================== OPEN MODAL ====================
  
  btnAddMaterial.addEventListener('click', async () => {
    console.log('[MATERIALES] Abriendo modal...');
    
    try {
      // Llamar a la función centralizada para actualizar el selector
      await actualizarSelectorCategorias();
    } catch (error) {
      console.error('[MATERIALES] ❌ Error actualizando selector:', error);
      alert('⚠️ Error al cargar categorías. Intenta nuevamente.');
    }
    
    // Limpiar formulario
    limpiarFormulario();
    materialModal.classList.add('active');
  });

  // ==================== CLOSE MODAL ====================
  
  if (btnCloseMaterial) {
    btnCloseMaterial.addEventListener('click', () => {
      console.log('[MATERIALES] Cerrando modal (X)...');
      materialModal.classList.remove('active');
    });
  }

  if (btnCancelMaterial) {
    btnCancelMaterial.addEventListener('click', () => {
      console.log('[MATERIALES] Cerrando modal (Cancelar)...');
      materialModal.classList.remove('active');
    });
  }

  // ==================== LOAD AND DISPLAY MATERIALS ====================
  
  async function cargarYMostrarRollos() {
    try {
      const rollos = await window.mrDataManager.getMateriales() || [];
      const container = document.getElementById('materialesList');
      
      console.log('[LISTAR] Rollos cargados:', rollos.length);
      
      if (!rollos || rollos.length === 0) {
        container.innerHTML = `
          <p style="text-align: center; color: rgba(255, 255, 255, 0.5); padding: 3rem;">
            No hay rollos configurados. Agregá el primero.
          </p>
        `;
        return;
      }
      
      const rollosPorProducto = {};
      rollos.forEach(rollo => {
        if (!rollosPorProducto[rollo.productoId]) {
          rollosPorProducto[rollo.productoId] = {
            nombre: rollo.productoNombre,
            categoria: rollo.categoria,
            rollos: []
          };
        }
        rollosPorProducto[rollo.productoId].rollos.push(rollo);
      });
      
      let html = '';
      
      Object.keys(rollosPorProducto).forEach(productoId => {
        const producto = rollosPorProducto[productoId];
        const rollosDelProducto = producto.rollos;
        
        let totalM2 = 0;
        let totalCosto = 0;
        rollosDelProducto.forEach(rollo => {
          const m2 = rollo.m2 || (rollo.ancho * rollo.largo);
          totalM2 += m2;
          totalCosto += rollo.precioRollo;
        });
        const promedioPonderado = totalM2 > 0 ? totalCosto / totalM2 : 0;
        
        html += `
          <div class="product-group">
            <div class="product-name">${producto.nombre}</div>
            <div class="product-category">Categoría: ${producto.categoria}</div>
            
            <div class="promedio-box">
              <div class="promedio-label">PROMEDIO PONDERADO (${rollosDelProducto.length} rollo${rollosDelProducto.length > 1 ? 's' : ''})</div>
              <div class="promedio-value">$${promedioPonderado.toFixed(2)}/m²</div>
              <div class="promedio-info">${totalM2.toFixed(2)}m² por $${totalCosto.toLocaleString('es-AR')}</div>
            </div>
            
            <div class="rollos-list">
              ${rollosDelProducto.map((rollo, idx) => `
                <div class="rollo-item">
                  <div class="rollo-info">
                    <strong>Rollo ${idx + 1}:</strong> ${rollo.ancho}m × ${rollo.largo}m = ${rollo.m2.toFixed(2)}m²
                    <br>
                    <span style="color: #FF8C42;">Costo: $${rollo.costoPorM2.toFixed(2)}/m²</span>
                    <br>
                    <span style="color: rgba(255, 255, 255, 0.5); font-size: 0.85rem;">Pagado: $${rollo.precioRollo.toLocaleString('es-AR')}</span>
                  </div>
                  <div class="rollo-actions">
                    <button class="btn-edit" onclick="window.editarRollo('${rollo.id}')">✏️ Editar</button>
                    <button class="btn-delete" onclick="window.borrarRollo('${rollo.id}')">🗑️ Borrar</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });
      
      container.innerHTML = html;
      console.log('[LISTAR] ✅ Rollos renderizados');
    } catch (error) {
      console.error('[LISTAR] Error:', error);
    }
  }
  
  // ==================== EDIT MATERIAL ====================
  
  window.editarRollo = async function(rolloId) {
    try {
      const rollos = await window.mrDataManager.getMateriales() || [];
      const rollo = rollos.find(r => r.id == rolloId);
      
      if (!rollo) {
        alert('❌ Rollo no encontrado');
        return;
      }
      
      document.getElementById('materialCategory').value = rollo.categoria;
      document.getElementById('materialProducto').value = rollo.productoId;
      document.getElementById('materialAncho').value = rollo.ancho;
      document.getElementById('materialLargo').value = rollo.largo;
      document.getElementById('materialPrecioRollo').value = rollo.precioRollo;
      
      btnSaveMaterial.textContent = '💾 Actualizar Rollo';
      btnSaveMaterial.dataset.editingId = rolloId;
      
      calcularCosto();
      
      materialModal.classList.add('active');
      
      console.log('[EDITAR] Rollo cargado para editar:', rolloId);
    } catch (error) {
      console.error('[EDITAR] Error:', error);
      alert('❌ Error al cargar rollo para editar');
    }
  };
  
  // ==================== DELETE MATERIAL ====================
  
  window.borrarRollo = async function(rolloId) {
    if (!confirm('⚠️ ¿Estás seguro que quieres eliminar este rollo?')) {
      return;
    }
    
    try {
      let rollos = await window.mrDataManager.getMateriales() || [];
      rollos = rollos.filter(r => r.id != rolloId);
      
      const success = await window.mrDataManager.saveMateriales(rollos);
      
      if (success) {
        alert('✅ Rollo eliminado correctamente');
        await cargarYMostrarRollos();
      } else {
        alert('❌ Error al eliminar el rollo');
      }
    } catch (error) {
      console.error('[BORRAR] Error:', error);
      alert('❌ Error al eliminar: ' + error.message);
    }
  };

  // ==================== SAVE MATERIAL ====================
  
  if (btnSaveMaterial) {
    console.log('[MATERIALES] ✅ Agregando listener al botón guardar');
    btnSaveMaterial.addEventListener('click', async () => {
      console.log('[MATERIALES] 🔵 CLICK EN GUARDAR - Iniciando proceso...');
      
      const categoria = document.getElementById('materialCategory')?.value;
      const productoNombre = document.getElementById('materialProductName')?.value || '';
      const anchoCm = parseFloat(document.getElementById('materialAncho')?.value) || 0;
      const largoM = parseFloat(document.getElementById('materialLargo')?.value) || 0;
      const precioRollo = parseFloat(document.getElementById('materialPrecioRollo')?.value) || 0;
      const editingId = btnSaveMaterial.dataset.editingId;
      
      console.log('[MATERIALES] Valores recibidos:', { categoria, productoNombre, anchoCm, largoM, precioRollo });
      
      if (!categoria || !productoNombre.trim() || anchoCm <= 0 || largoM <= 0 || precioRollo <= 0) {
        console.error('[MATERIALES] ❌ Validación fallida');
        alert('⚠️ Por favor completa todos los campos del rollo');
        return;
      }

      console.log('[MATERIALES] ✅ Validación pasada');

      // Verificar que window.mrDataManager existe
      if (!window.mrDataManager) {
        console.error('[MATERIALES] ❌ window.mrDataManager no existe');
        alert('❌ Error: Data Manager no inicializado. Recarga la página.');
        return;
      }
      console.log('[MATERIALES] ✅ window.mrDataManager está disponible');

      // Convertir ancho de cm a metros
      const anchoM = anchoCm / 100;
      const m2 = anchoM * largoM;
      const costoPorM2 = precioRollo / m2;
      
      console.log('[MATERIALES] Cálculos: anchoM=', anchoM, 'm2=', m2, 'costoPorM2=', costoPorM2);
      
      try {
        console.log('[MATERIALES] Obteniendo materiales del servidor...');
        let rollos = await window.mrDataManager.getMateriales() || [];
        console.log('[MATERIALES] Rollos obtenidos:', rollos.length);
        
        if (editingId) {
          console.log('[MATERIALES] Modo edición - ID:', editingId);
          const index = rollos.findIndex(r => r.id == editingId);
          if (index !== -1) {
            rollos[index] = {
              ...rollos[index],
              categoria,
              producto: productoNombre,
              productoNombre: productoNombre,
              ancho: anchoM,
              largo: largoM,
              m2,
              precioRollo,
              costoPorM2,
              fecha: new Date().toISOString()
            };
            console.log('[MATERIALES] ✅ Rollo actualizado en índice', index);
          }
        } else {
          const newRollo = {
            id: Date.now(),
            categoria,
            productoId: Date.now().toString(),
            producto: productoNombre,
            productoNombre: productoNombre,
            ancho: anchoM,
            largo: largoM,
            m2,
            precioRollo,
            costoPorM2,
            fecha: new Date().toISOString()
          };
          console.log('[MATERIALES] ✅ Nuevo rollo creado:', newRollo);
          rollos.push(newRollo);
        }
        
        console.log('[MATERIALES] 📤 Enviando', rollos.length, 'rollos al servidor...');
        console.log('[MATERIALES] Datos JSON:', JSON.stringify(rollos));
        const success = await window.mrDataManager.saveMateriales(rollos);
        console.log('[MATERIALES] ✅ Respuesta del servidor:', success);
        console.log('[MATERIALES] Resultado del guardado:', success);
        
        if (success) {
          const mensaje = editingId ? '✅ Rollo actualizado correctamente' : '✅ Rollo agregado correctamente';
          console.log('[MATERIALES] ✅', mensaje);
          alert(mensaje);
          materialModal.classList.remove('active');
          btnSaveMaterial.dataset.editingId = '';
          btnSaveMaterial.textContent = '💾 Confirmar y Guardar';
          limpiarFormulario();
          await cargarYMostrarRollos();
          await loadCategorias();
        } else {
          console.error('[MATERIALES] ❌ Error: saveMateriales retornó false');
          alert('❌ Error al guardar el rollo');
        }
      } catch (error) {
        console.error('[MATERIALES] ❌ Error en try-catch:', error);
        alert('❌ Error al guardar: ' + error.message);
      }
    });
  }

  // ==================== INITIALIZE ====================
  
  cargarYMostrarRollos();

  console.log('[MATERIALES] ✅ Eventos configurados correctamente');
  console.log('[MATERIALES] ✅ Módulo iniciado completamente');
  
});
