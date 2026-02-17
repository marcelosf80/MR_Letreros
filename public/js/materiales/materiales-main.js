// ==================== MATERIALES MODULE - MAIN ==================== 

// NOTA: 'allCategorias' ya está declarada en categorias-manager.js, no redeclarar aquí.

// ==================== GLOBAL FUNCTIONS ====================

function formatCurrency(number) {
  if (number === null || number === undefined || isNaN(number)) {
    return '0,00';
  }
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
}

// Alias
window.formatCurrencyAR = formatCurrency;

<<<<<<< HEAD
window.calcularCosto = function () {
=======
window.calcularCosto = function() {
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  try {
    const largoInput = document.getElementById('materialLargo');
    const precioInput = document.getElementById('materialPrecioRollo');
    const unidadInput = document.getElementById('materialUnidad');
    const display = document.getElementById('materialCalcDisplay');
<<<<<<< HEAD

=======
    
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    if (!largoInput || !precioInput || !display) return;

    const largo = parseFloat(largoInput.value) || 0; // m
    const precio = parseFloat(precioInput.value) || 0;
    const unidad = unidadInput ? unidadInput.value : 'ml';
    const priceType = document.getElementById('priceTypeSelect')?.value;
    const isPerM2 = priceType === 'm2';
    const anchoCm = parseFloat(document.getElementById('materialAncho')?.value) || 100;
    const anchoM = anchoCm / 100;
<<<<<<< HEAD

    if (largo > 0 && precio > 0) {
      if (isPerM2) {
        // El input es Costo por m², mostramos el Total del Rollo
        const m2 = anchoM * largo;
        const total = precio * m2;
        display.innerHTML = `<div style="color: #51CF66; font-weight: bold; font-size: 1.4em; text-align: center; padding: 5px;">Costo Total del Rollo: $${formatCurrency(total)}</div>`;
      } else {
        // El input es Precio Total, mostramos costo lineal y m2
        const costoLineal = precio / largo;
        let label = 'Costo por Metro';
        if (unidad === 'unidad') label = 'Costo por Unidad';
        if (unidad === 'm²') label = 'Costo por m²';

        const m2 = anchoM * largo;
        const costoM2 = m2 > 0 ? precio / m2 : 0;

        display.innerHTML = `<div style="color: #51CF66; font-weight: bold; font-size: 1.4em; text-align: center; padding: 5px;">${label}: $${formatCurrency(costoLineal)}</div>
=======
    
    if (largo > 0 && precio > 0) {
      if (isPerM2) {
          // El input es Costo por m², mostramos el Total del Rollo
          const m2 = anchoM * largo;
          const total = precio * m2;
          display.innerHTML = `<div style="color: #51CF66; font-weight: bold; font-size: 1.4em; text-align: center; padding: 5px;">Costo Total del Rollo: $${formatCurrency(total)}</div>`;
      } else {
          // El input es Precio Total, mostramos costo lineal y m2
          const costoLineal = precio / largo;
          let label = 'Costo por Metro';
          if (unidad === 'unidad') label = 'Costo por Unidad';
          if (unidad === 'm²') label = 'Costo por m²';
          
          const m2 = anchoM * largo;
          const costoM2 = m2 > 0 ? precio / m2 : 0;

          display.innerHTML = `<div style="color: #51CF66; font-weight: bold; font-size: 1.4em; text-align: center; padding: 5px;">${label}: $${formatCurrency(costoLineal)}</div>
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
                               <div style="color: #FF8C42; font-size: 0.9em; text-align: center;">($${formatCurrency(costoM2)} / m²)</div>`;
      }
      display.style.display = 'block';
    } else {
      display.style.display = 'none';
    }
  } catch (e) {
    console.error('Error en calcularCosto:', e);
  }
};

<<<<<<< HEAD
window.updateLargoLabel = function () {
  const unidad = document.getElementById('materialUnidad')?.value || 'ml';
  const label = document.querySelector('label[for="materialLargo"]');
  const input = document.getElementById('materialLargo');

  if (label) {
    if (unidad === 'unidad') {
      label.textContent = 'Cantidad (unidades) *';
      if (input) input.placeholder = 'Ej: 100';
    } else {
      label.textContent = 'Largo (cm) *';
      if (input) input.placeholder = 'Ej: 5000';
=======
window.updateLargoLabel = function() {
  const unidad = document.getElementById('materialUnidad')?.value || 'ml';
  const label = document.querySelector('label[for="materialLargo"]');
  const input = document.getElementById('materialLargo');
  
  if (label) {
    if (unidad === 'unidad') {
      label.textContent = 'Cantidad (unidades) *';
      if(input) input.placeholder = 'Ej: 100';
    } else {
      label.textContent = 'Largo (cm) *';
      if(input) input.placeholder = 'Ej: 5000';
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    }
  }
};

<<<<<<< HEAD
document.addEventListener('DOMContentLoaded', function () {

  console.log('[MATERIALES] ✅ DOMContentLoaded - Inicializando módulo...');

  // ==================== REFERENCES ====================

=======
document.addEventListener('DOMContentLoaded', function() {
  
  console.log('[MATERIALES] ✅ DOMContentLoaded - Inicializando módulo...');

  // ==================== REFERENCES ====================
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
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

  // Ocultar campo de Ancho (se asume 1 metro por defecto)
  const inputAncho = document.getElementById('materialAncho');
  if (inputAncho) {
    inputAncho.value = '100';
  }

  // Precargar categorías al iniciar para asegurar que el selector no esté vacío
  if (typeof actualizarSelectorCategorias === 'function') {
    actualizarSelectorCategorias();
  }
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  // Inyectar el toggle de modo de precio
  injectPriceTypeSelector();

  // ==================== OPEN MODAL ====================
<<<<<<< HEAD

  btnAddMaterial.addEventListener('click', async () => {
    console.log('[MATERIALES] Abriendo modal...');

=======
  
  btnAddMaterial.addEventListener('click', async () => {
    console.log('[MATERIALES] Abriendo modal...');
    
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    try {
      // Llamar a la función centralizada para actualizar el selector
      if (typeof actualizarSelectorCategorias === 'function') {
        await actualizarSelectorCategorias();
      }
    } catch (error) {
      console.error('[MATERIALES] ❌ Error actualizando selector:', error);
      alert('⚠️ Error al cargar categorías. Intenta nuevamente.');
    }
<<<<<<< HEAD

=======
    
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    // Limpiar formulario
    limpiarFormulario();
    if (window.MRModals) {
      window.MRModals.open(materialModal);
    } else {
      materialModal.classList.add('active');
    }
  });

  // ==================== CLOSE MODAL ====================
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (btnCloseMaterial) {
    btnCloseMaterial.addEventListener('click', () => {
      console.log('[MATERIALES] Cerrando modal (X)...');
      if (window.MRModals) {
        window.MRModals.close(materialModal);
      } else {
        materialModal.classList.remove('active');
      }
    });
  }

  if (btnCancelMaterial) {
    btnCancelMaterial.addEventListener('click', () => {
      console.log('[MATERIALES] Cerrando modal (Cancelar)...');
      if (window.MRModals) {
        window.MRModals.close(materialModal);
      } else {
        materialModal.classList.remove('active');
      }
    });
  }

  // ==================== FORM UTILS & LIVE CALCULATION ====================

  function limpiarFormulario() {
<<<<<<< HEAD
    if (document.getElementById('materialCategory')) document.getElementById('materialCategory').value = '';
    if (document.getElementById('materialProductName')) document.getElementById('materialProductName').value = '';
    if (document.getElementById('materialAncho')) document.getElementById('materialAncho').value = '100'; // Por defecto 1 metro para agilizar
    if (document.getElementById('materialUnidad')) document.getElementById('materialUnidad').value = 'ml';
    if (document.getElementById('materialLargo')) document.getElementById('materialLargo').value = '';
    if (document.getElementById('materialPrecioRollo')) document.getElementById('materialPrecioRollo').value = '';

=======
    if(document.getElementById('materialCategory')) document.getElementById('materialCategory').value = '';
    if(document.getElementById('materialProductName')) document.getElementById('materialProductName').value = '';
    if(document.getElementById('materialAncho')) document.getElementById('materialAncho').value = '100'; // Por defecto 1 metro para agilizar
    if(document.getElementById('materialUnidad')) document.getElementById('materialUnidad').value = 'ml';
    if(document.getElementById('materialLargo')) document.getElementById('materialLargo').value = '';
    if(document.getElementById('materialPrecioRollo')) document.getElementById('materialPrecioRollo').value = '';
    
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    const display = document.getElementById('materialCalcDisplay');
    if (display) {
      display.innerHTML = '';
      display.style.display = 'none';
    }

    // Resetear toggle
<<<<<<< HEAD
    if (document.getElementById('priceTypeSelect')) {
      document.getElementById('priceTypeSelect').value = 'total';
      window.calcularCosto();
=======
    if(document.getElementById('priceTypeSelect')) {
        document.getElementById('priceTypeSelect').value = 'total';
        window.calcularCosto();
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    }

    // REFUERZO: Asegurar que el ancho esté oculto y en 100 cada vez que se limpia
    const inputAncho = document.getElementById('materialAncho');
    if (inputAncho) {
      inputAncho.value = '100';
    }

    // Limpiar fecha de actualización si existe
    const dateDisplay = document.getElementById('materialLastUpdate');
    if (dateDisplay) {
      dateDisplay.style.display = 'none';
    }
<<<<<<< HEAD

=======
    
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    const btnSave = document.getElementById('btnSaveMaterial');
    if (btnSave) {
      btnSave.textContent = '💾 Confirmar y Guardar';
      btnSave.dataset.editingId = '';
    }
    window.updateLargoLabel();
  }

  // Alias para compatibilidad
  window.calcularM2 = window.calcularCosto;

  // Agregar listeners
  ['materialAncho', 'materialLargo', 'materialPrecioRollo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', window.calcularCosto);
  });

  // Función para inyectar el checkbox de modo de precio
  function injectPriceTypeSelector() {
    const priceInput = document.getElementById('materialPrecioRollo');
    if (priceInput && !document.getElementById('priceTypeSelect')) {
<<<<<<< HEAD
      // Limpiar checkbox antiguo si existe
      const oldCheck = document.getElementById('priceModeToggle');
      if (oldCheck && oldCheck.parentNode) oldCheck.parentNode.remove();

      const div = document.createElement('div');
      div.style.marginBottom = '10px';
      div.innerHTML = `
=======
        // Limpiar checkbox antiguo si existe
        const oldCheck = document.getElementById('priceModeToggle');
        if (oldCheck && oldCheck.parentNode) oldCheck.parentNode.remove();

        const div = document.createElement('div');
        div.style.marginBottom = '10px';
        div.innerHTML = `
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
            <label class="form-label" style="font-size:0.9rem; color:#FF8C42;">Tipo de Precio Ingresado</label>
            <select id="priceTypeSelect" class="form-select" style="margin-bottom: 5px;">
                <option value="total">Precio Total del Rollo/Pieza</option>
                <option value="m2">Precio por m²</option>
            </select>
        `;
<<<<<<< HEAD
      priceInput.parentNode.insertBefore(div, priceInput);

      document.getElementById('priceTypeSelect').addEventListener('change', function (e) {
        window.calcularCosto();
      });
=======
        priceInput.parentNode.insertBefore(div, priceInput);
        
        document.getElementById('priceTypeSelect').addEventListener('change', function(e) {
            window.calcularCosto();
        });
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
    }
  }

  // ==================== LOAD AND DISPLAY MATERIALS ====================
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  async function cargarYMostrarRollos() {
    try {
      const rollos = await window.mrDataManager.getMateriales() || [];
      const container = document.getElementById('materialesList');
<<<<<<< HEAD

      console.log('[LISTAR] Rollos cargados:', rollos.length);

=======
      
      console.log('[LISTAR] Rollos cargados:', rollos.length);
      
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
      if (!rollos || rollos.length === 0) {
        container.innerHTML = `
          <p style="text-align: center; color: rgba(255, 255, 255, 0.5); padding: 3rem;">
            No hay rollos configurados. Agregá el primero.
          </p>
        `;
        return;
      }
<<<<<<< HEAD

      // Agrupar por Categoría -> Producto
      const productosPorCategoria = {};

      rollos.forEach(rollo => {
        const cat = rollo.categoria || 'Sin Categoría';
        if (!productosPorCategoria[cat]) {
          productosPorCategoria[cat] = {};
        }

        if (!productosPorCategoria[cat][rollo.productoId]) {
          productosPorCategoria[cat][rollo.productoId] = {
            nombre: rollo.productoNombre,
            categoria: cat,
            rollos: []
          };
        }
        productosPorCategoria[cat][rollo.productoId].rollos.push(rollo);
      });

      let html = '';

      // Ordenar categorías alfabéticamente
      const categoriasOrdenadas = Object.keys(productosPorCategoria).sort();

      categoriasOrdenadas.forEach(categoria => {
        html += `<h3 style="color: #51CF66; border-bottom: 2px solid rgba(81, 207, 102, 0.3); padding-bottom: 0.5rem; margin-top: 2rem; margin-bottom: 1rem;">📁 ${categoria}</h3>`;

        const productos = productosPorCategoria[categoria];
        Object.keys(productos).forEach(productoId => {
          const producto = productos[productoId];
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
                  <div class="product-group" style="margin-bottom: 1.5rem; background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px;">
                    <div class="product-name">${producto.nombre}</div>
                    
                    <div class="promedio-box">
                      <div class="promedio-label">PROMEDIO PONDERADO (${rollosDelProducto.length} rollo${rollosDelProducto.length > 1 ? 's' : ''})</div>
                      <div class="promedio-value">$${formatCurrency(promedioPonderado)}/m²</div>
                      <div class="promedio-info">${formatCurrency(totalM2)}m² por $${formatCurrency(totalCosto)}</div>
                    </div>
                    
                    <div class="rollos-list">
                      ${rollosDelProducto.map((rollo, idx) => `
                        <div class="rollo-item">
                          <div class="rollo-info">
                            <strong>Rollo ${idx + 1}:</strong> ${formatCurrency(rollo.ancho)}m × ${formatCurrency(rollo.largo)}m = ${formatCurrency(rollo.m2)}m²
                            <br>
                            <span style="color: #FF8C42;">Costo m²: $${formatCurrency(rollo.costoPorM2)}</span>
                            <span style="color: #51CF66; margin-left: 10px; font-weight: bold;">Costo ml: $${formatCurrency(rollo.precioRollo / rollo.largo)}</span>
                            <br>
                            <span style="color: rgba(255, 255, 255, 0.5); font-size: 0.85rem;">Pagado: $${formatCurrency(rollo.precioRollo)}</span>
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
      });

=======
      
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
              <div class="promedio-value">$${formatCurrency(promedioPonderado)}/m²</div>
              <div class="promedio-info">${formatCurrency(totalM2)}m² por $${formatCurrency(totalCosto)}</div>
            </div>
            
            <div class="rollos-list">
              ${rollosDelProducto.map((rollo, idx) => `
                <div class="rollo-item">
                  <div class="rollo-info">
                    <strong>Rollo ${idx + 1}:</strong> ${formatCurrency(rollo.ancho)}m × ${formatCurrency(rollo.largo)}m = ${formatCurrency(rollo.m2)}m²
                    <br>
                    <span style="color: #FF8C42;">Costo m²: $${formatCurrency(rollo.costoPorM2)}</span>
                    <span style="color: #51CF66; margin-left: 10px; font-weight: bold;">Costo ml: $${formatCurrency(rollo.precioRollo / rollo.largo)}</span>
                    <br>
                    <span style="color: rgba(255, 255, 255, 0.5); font-size: 0.85rem;">Pagado: $${formatCurrency(rollo.precioRollo)}</span>
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
      
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
      container.innerHTML = html;
      console.log('[LISTAR] ✅ Rollos renderizados');
    } catch (error) {
      console.error('[LISTAR] Error:', error);
    }
  }
<<<<<<< HEAD

  // ==================== EDIT MATERIAL ====================

  window.editarRollo = async function (rolloId) {
    try {
      const rollos = await window.mrDataManager.getMateriales() || [];
      const rollo = rollos.find(r => r.id == rolloId);

=======
  
  // ==================== EDIT MATERIAL ====================
  
  window.editarRollo = async function(rolloId) {
    try {
      const rollos = await window.mrDataManager.getMateriales() || [];
      const rollo = rollos.find(r => r.id == rolloId);
      
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
      if (!rollo) {
        alert('❌ Rollo no encontrado');
        return;
      }
<<<<<<< HEAD

=======
      
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
      document.getElementById('materialCategory').value = rollo.categoria;
      // FIX: Corregido ID del elemento y propiedad correcta (nombre, no ID)
      document.getElementById('materialProductName').value = rollo.productoNombre || rollo.producto || '';
      document.getElementById('materialUnidad').value = rollo.unidad || 'ml';
<<<<<<< HEAD

      // FIX: Forzar ancho a 100cm (1m) para mantener consistencia en cálculo lineal
      const inputAncho = document.getElementById('materialAncho');
      if (inputAncho) inputAncho.value = '100';

      // Convertir metros guardados a cm para el input, si no es unidad
      let largoVal = rollo.largo;
      if (rollo.unidad !== 'unidad') {
        largoVal = largoVal * 100;
      }
      document.getElementById('materialLargo').value = largoVal;
      document.getElementById('materialPrecioRollo').value = rollo.precioRollo;

=======
      
      // FIX: Forzar ancho a 100cm (1m) para mantener consistencia en cálculo lineal
      const inputAncho = document.getElementById('materialAncho');
      if (inputAncho) inputAncho.value = '100';
      
      // Convertir metros guardados a cm para el input, si no es unidad
      let largoVal = rollo.largo;
      if (rollo.unidad !== 'unidad') {
          largoVal = largoVal * 100;
      }
      document.getElementById('materialLargo').value = largoVal;
      document.getElementById('materialPrecioRollo').value = rollo.precioRollo;
      
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
      // Mostrar fecha de última actualización
      let dateDisplay = document.getElementById('materialLastUpdate');
      if (!dateDisplay) {
        dateDisplay = document.createElement('div');
        dateDisplay.id = 'materialLastUpdate';
        dateDisplay.style.fontSize = '0.8rem';
        dateDisplay.style.color = '#aaa';
        dateDisplay.style.marginTop = '15px';
        dateDisplay.style.textAlign = 'right';
        dateDisplay.style.fontStyle = 'italic';
        // Insertar en el cuerpo del modal
        const modalBody = document.querySelector('#materialModal .modal-body') || document.querySelector('#materialModal .modal-content');
        if (modalBody) modalBody.appendChild(dateDisplay);
      }

      if (rollo.fecha) {
        const date = new Date(rollo.fecha);
        dateDisplay.textContent = '📅 Última actualización: ' + date.toLocaleString('es-AR');
        dateDisplay.style.display = 'block';
      } else {
        dateDisplay.style.display = 'none';
      }

      btnSaveMaterial.textContent = '💾 Actualizar Rollo';
      btnSaveMaterial.dataset.editingId = rolloId;
<<<<<<< HEAD

      calcularCosto();
      window.updateLargoLabel();

      materialModal.classList.add('active');

=======
      
      calcularCosto();
      window.updateLargoLabel();
      
      materialModal.classList.add('active');
      
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
      console.log('[EDITAR] Rollo cargado para editar:', rolloId);
    } catch (error) {
      console.error('[EDITAR] Error:', error);
      alert('❌ Error al cargar rollo para editar');
    }
  };
<<<<<<< HEAD

  // ==================== DELETE MATERIAL ====================

  window.borrarRollo = async function (rolloId) {
    if (!confirm('⚠️ ¿Estás seguro que quieres eliminar este rollo?')) {
      return;
    }

    try {
      let rollos = await window.mrDataManager.getMateriales() || [];
      rollos = rollos.filter(r => r.id != rolloId);

      const success = await window.mrDataManager.saveMateriales(rollos);

=======
  
  // ==================== DELETE MATERIAL ====================
  
  window.borrarRollo = async function(rolloId) {
    if (!confirm('⚠️ ¿Estás seguro que quieres eliminar este rollo?')) {
      return;
    }
    
    try {
      let rollos = await window.mrDataManager.getMateriales() || [];
      rollos = rollos.filter(r => r.id != rolloId);
      
      const success = await window.mrDataManager.saveMateriales(rollos);
      
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
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
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  if (btnSaveMaterial) {
    console.log('[MATERIALES] ✅ Agregando listener al botón guardar');
    btnSaveMaterial.addEventListener('click', async () => {
      console.log('[MATERIALES] 🔵 CLICK EN GUARDAR - Iniciando proceso...');
<<<<<<< HEAD

      const categoria = document.getElementById('materialCategory')?.value;
      const productoNombre = document.getElementById('materialProductName')?.value || '';
      const unidad = document.getElementById('materialUnidad')?.value || 'ml';

=======
      
      const categoria = document.getElementById('materialCategory')?.value;
      const productoNombre = document.getElementById('materialProductName')?.value || '';
      const unidad = document.getElementById('materialUnidad')?.value || 'ml';
      
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
      let anchoCm = parseFloat(document.getElementById('materialAncho')?.value);
      if (isNaN(anchoCm) || anchoCm <= 0) anchoCm = 100; // Default: 100cm (1 metro) si está vacío

      const largoInput = parseFloat(document.getElementById('materialLargo')?.value) || 0;
      const precioInput = parseFloat(document.getElementById('materialPrecioRollo')?.value) || 0;
      const priceType = document.getElementById('priceTypeSelect')?.value;
      const isPerM2 = priceType === 'm2';
      const editingId = btnSaveMaterial.dataset.editingId;
<<<<<<< HEAD

      console.log('[MATERIALES] Valores recibidos:', { categoria, productoNombre, unidad, anchoCm, largoInput, precioInput });

=======
      
      console.log('[MATERIALES] Valores recibidos:', { categoria, productoNombre, unidad, anchoCm, largoInput, precioInput });
      
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
      // Validaciones específicas para saber qué falla
      if (!categoria) {
        alert('⚠️ Debes seleccionar una Categoría.');
        return;
      }
      if (!productoNombre.trim()) {
        alert('⚠️ Debes ingresar el Nombre del Producto.');
        return;
      }
      if (largoInput <= 0) {
        alert('⚠️ El Largo debe ser mayor a 0.');
        return;
      }
      if (precioInput <= 0) {
        console.error('[MATERIALES] ❌ Validación fallida');
        alert('⚠️ El Precio debe ser mayor a 0.');
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
<<<<<<< HEAD

      // El largo ya está en metros (input del usuario), no convertir
      let largoM = largoInput;

      const m2 = anchoM * largoM;

      let precioRollo, costoPorM2;

      if (isPerM2) {
        costoPorM2 = precioInput;
        precioRollo = costoPorM2 * m2;
      } else {
        precioRollo = precioInput;
        costoPorM2 = precioRollo / m2;
      }

      console.log('[MATERIALES] Cálculos: anchoM=', anchoM, 'm2=', m2, 'costoPorM2=', costoPorM2);

=======
      
      // El largo ya está en metros (input del usuario), no convertir
      let largoM = largoInput;
      
      const m2 = anchoM * largoM;
      
      let precioRollo, costoPorM2;
      
      if (isPerM2) {
          costoPorM2 = precioInput;
          precioRollo = costoPorM2 * m2;
      } else {
          precioRollo = precioInput;
          costoPorM2 = precioRollo / m2;
      }
      
      console.log('[MATERIALES] Cálculos: anchoM=', anchoM, 'm2=', m2, 'costoPorM2=', costoPorM2);
      
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
      try {
        console.log('[MATERIALES] Obteniendo materiales del servidor...');
        let rollos = await window.mrDataManager.getMateriales() || [];
        console.log('[MATERIALES] Rollos obtenidos:', rollos.length);
<<<<<<< HEAD

=======
        
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
        if (editingId) {
          console.log('[MATERIALES] Modo edición - ID:', editingId);
          const index = rollos.findIndex(r => r.id == editingId);
          if (index !== -1) {
            // >>> INICIO: Verificación de variación de precio
            const oldRollo = rollos[index];
            const oldPrice = oldRollo.costoPorM2;
            const newPrice = costoPorM2;

            if (oldPrice > 0) { // Evitar división por cero y comparar solo si había precio
              const variation = ((newPrice - oldPrice) / oldPrice) * 100;
              if (Math.abs(variation) > 10) {
                if (!confirm(`⚠️ ¡ATENCIÓN! El precio ha variado un ${formatCurrency(variation, 1)}%.\n\nPrecio anterior: $${formatCurrency(oldPrice)}/m²\nPrecio nuevo: $${formatCurrency(newPrice)}/m²\n\n¿Deseas continuar y guardar el cambio?`)) {
                  console.log('[MATERIALES] ❌ Guardado cancelado por el usuario debido a la variación de precio.');
                  return; // Detener el proceso de guardado
                }
              }
            }
            // <<< FIN: Verificación de variación de precio

            rollos[index] = {
              ...rollos[index],
              categoria,
              producto: productoNombre,
              productoNombre: productoNombre,
              unidad,
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
            unidad,
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
<<<<<<< HEAD

=======
        
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
        console.log('[MATERIALES] 📤 Enviando', rollos.length, 'rollos al servidor...');
        console.log('[MATERIALES] Datos JSON:', JSON.stringify(rollos));
        const success = await window.mrDataManager.saveMateriales(rollos);
        console.log('[MATERIALES] ✅ Respuesta del servidor:', success);
        console.log('[MATERIALES] Resultado del guardado:', success);
<<<<<<< HEAD

=======
        
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
        if (success) {
          const mensaje = editingId ? '✅ Rollo actualizado correctamente' : '✅ Rollo agregado correctamente';
          console.log('[MATERIALES] ✅', mensaje);
          alert(mensaje);
          if (window.MRModals) {
            window.MRModals.close(materialModal);
          } else {
            materialModal.classList.remove('active');
            document.body.style.overflow = '';
          }
          btnSaveMaterial.dataset.editingId = '';
          btnSaveMaterial.textContent = '💾 Confirmar y Guardar';
          limpiarFormulario();
          await cargarYMostrarRollos();
          if (typeof loadCategorias === 'function') await loadCategorias();
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
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
  cargarYMostrarRollos();

  console.log('[MATERIALES] ✅ Eventos configurados correctamente');
  console.log('[MATERIALES] ✅ Módulo iniciado completamente');
<<<<<<< HEAD

=======
  
>>>>>>> 81fff1edcc86c304a6630f1fa260b32ac76d354c
});
