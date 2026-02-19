// materiales-terceros.js - VERSIÓN CON PROMEDIO PONDERADO POR ANCHO
console.log('🎨 Cargando módulo Materiales y Terceros...');

(function initMaterialesTerceros() {
  
  const btnAddMaterial = document.getElementById('btnAddMaterial');
  const btnAddTercero = document.getElementById('btnAddTercero');
  
  if (!btnAddMaterial || !btnAddTercero) {
    console.warn('⚠️ Botones no encontrados');
    setTimeout(initMaterialesTerceros, 100);
    return;
  }
  
  console.log('✅ Inicializando...');
  
  const materialModal = document.getElementById('materialModal');
  const terceroModal = document.getElementById('terceroModal');
  
  // ==================== ABRIR MODALES ====================
  
  btnAddMaterial.addEventListener('click', async () => {
    await cargarCategoriasYProductos();
    materialModal.classList.add('active');
    resetMaterialForm();
  });
  
  btnAddTercero.addEventListener('click', async () => {
    await loadCategoriasParaTerceros();
    terceroModal.classList.add('active');
    resetTerceroForm();
  });
  
  // Cerrar
  document.getElementById('btnCloseMaterial').addEventListener('click', () => materialModal.classList.remove('active'));
  document.getElementById('btnCancelMaterial').addEventListener('click', () => materialModal.classList.remove('active'));
  document.getElementById('btnCloseTercero').addEventListener('click', () => terceroModal.classList.remove('active'));
  document.getElementById('btnCancelTercero').addEventListener('click', () => terceroModal.classList.remove('active'));
  
  materialModal.addEventListener('click', (e) => { if (e.target === materialModal) materialModal.classList.remove('active'); });
  terceroModal.addEventListener('click', (e) => { if (e.target === terceroModal) terceroModal.classList.remove('active'); });
  
  // ==================== MANAGERS ====================
  
  const materialesManager = {
    async getRollos() {
      try {
        const data = await window.mrDataManager.getMateriales();
        return data || [];
      } catch (error) {
        console.error('[MATERIALES] Error:', error);
        return [];
      }
    },
    
    async saveRollos(rollos) {
      try {
        return await window.mrDataManager.saveMateriales(rollos);
      } catch (error) {
        console.error('[MATERIALES] Error guardando:', error);
        return false;
      }
    },
    
    // Calcular promedio ponderado por m² de todos los rollos del mismo producto
    calcularPromedioPoProducto(productoId, rollos) {
      const rollosDelProducto = rollos.filter(r => r.productoId === productoId);
      
      if (rollosDelProducto.length === 0) return 0;
      
      let totalMetrosCuadrados = 0;
      let totalCosto = 0;
      
      rollosDelProducto.forEach(rollo => {
        const m2 = rollo.ancho * rollo.largo;
        totalMetrosCuadrados += m2;
        totalCosto += rollo.precioRollo;
      });
      
      const costoPorM2 = totalCosto / totalMetrosCuadrados;
      
      console.log('[PROMEDIO]', {
        producto: productoId,
        rollos: rollosDelProducto.length,
        totalM2: totalMetrosCuadrados.toFixed(2),
        totalCosto: totalCosto.toFixed(2),
        costoPorM2: costoPorM2.toFixed(2)
      });
      
      return costoPorM2;
    }
  };
  
  const tercerosManager = {
    async getTerceros() {
      try {
        const data = await window.mrDataManager.getTerceros();
        console.log('[TERCEROS] Datos obtenidos:', data);
        return data || [];
      } catch (error) {
        console.error('[TERCEROS] Error:', error);
        return [];
      }
    },
    
    async saveTerceros(terceros) {
      try {
        console.log('[TERCEROS] Intentando guardar:', terceros);
        const result = await window.mrDataManager.saveTerceros(terceros);
        console.log('[TERCEROS] Resultado guardado:', result);
        return result;
      } catch (error) {
        console.error('[TERCEROS] Error guardando:', error);
        return false;
      }
    },
    
    calcularMargen(costo, precio) {
      if (precio <= 0) return { ganancia: 0, margen: 0 };
      const ganancia = precio - costo;
      return { ganancia, margen: (ganancia / precio) * 100 };
    }
  };
  
  window.editRollo = editRollo;
  window.deleteRollo = deleteRollo;
  window.editTercero = editTercero;
  window.deleteTercero = deleteTercero;
  window.loadMaterialesList = loadMaterialesList;
  window.loadTercerosList = loadTercerosList;
  
  // ==================== CARGAR CATEGORÍAS ====================
  
  async function cargarCategoriasYProductos() {
    try {
      const precios = await window.preciosManager.getPrecios();
      const categorias = [...new Set(precios.map(p => p.category).filter(Boolean))];
      
      const selectCat = document.getElementById('materialCategory');
      selectCat.innerHTML = '<option value="">Seleccionar categoría...</option>';
      
      categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        selectCat.appendChild(option);
      });
      
      selectCat.onchange = async () => {
        const categoria = selectCat.value;
        const selectProd = document.getElementById('materialProducto');
        
        if (!categoria) {
          selectProd.innerHTML = '<option value="">Primero selecciona categoría...</option>';
          selectProd.disabled = true;
          return;
        }
        
        const productosDeCategoria = precios.filter(p => p.category === categoria);
        selectProd.innerHTML = '<option value="">Seleccionar producto...</option>';
        
        productosDeCategoria.forEach(prod => {
          const option = document.createElement('option');
          option.value = prod.id;
          option.textContent = prod.name;
          selectProd.appendChild(option);
        });
        
        selectProd.disabled = false;
      };
      
      document.getElementById('materialProducto').onchange = async function() {
        await mostrarInfoProducto();
      };
      
    } catch (error) {
      console.error('[MATERIALES] Error:', error);
    }
  }
  
  async function loadCategoriasParaTerceros() {
    try {
      const precios = await window.preciosManager.getPrecios();
      const categorias = [...new Set(precios.map(p => p.category).filter(Boolean))];
      
      const select = document.getElementById('terceroCategory');
      select.innerHTML = '<option value="">Seleccionar categoría...</option>';
      
      categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
      });
    } catch (error) {
      console.error('[TERCEROS] Error:', error);
    }
  }
  
  // ==================== MOSTRAR INFO Y PROMEDIO ====================
  
  async function mostrarInfoProducto() {
    const productoSelect = document.getElementById('materialProducto');
    const productoId = productoSelect.value;
    
    if (!productoId) return;
    
    const rollos = await materialesManager.getRollos();
    const rollosDelProducto = rollos.filter(r => r.productoId === productoId);
    
    const infoDiv = document.getElementById('materialPromedioInfo');
    
    if (rollosDelProducto.length > 0) {
      const promedio = materialesManager.calcularPromedioPoProducto(productoId, rollos);
      
      infoDiv.innerHTML = `
        <strong>📊 Promedio Actual:</strong> $${promedio.toFixed(2)}/m² 
        (basado en ${rollosDelProducto.length} rollo${rollosDelProducto.length > 1 ? 's' : ''})
        <br><small>Al agregar este rollo, se recalculará el promedio automáticamente</small>
      `;
      infoDiv.style.display = 'block';
    } else {
      infoDiv.style.display = 'none';
    }
  }
  
  // ==================== CALCULAR COSTO ====================
  
  function calcularCosto() {
    const ancho = parseFloat(document.getElementById('materialAncho').value) || 0;
    const largo = parseFloat(document.getElementById('materialLargo').value) || 0;
    const precio = parseFloat(document.getElementById('materialPrecioRollo').value) || 0;
    
    const costoDiv = document.getElementById('materialCostoCalculado');
    const formulaDiv = document.getElementById('materialFormula');
    
    if (ancho > 0 && largo > 0 && precio > 0) {
      const m2 = ancho * largo;
      const costoPorM2 = precio / m2;
      const costoPorMetro = costoPorM2 * ancho; // Costo por metro lineal
      
      costoDiv.textContent = `$${costoPorMetro.toFixed(2)}`;
      formulaDiv.innerHTML = `
        ${ancho}m × ${largo}m = ${m2.toFixed(2)}m² → 
        $${precio.toFixed(0)} ÷ ${m2.toFixed(2)}m² = 
        <strong>$${costoPorM2.toFixed(2)}/m²</strong>
      `;
    } else {
      costoDiv.textContent = '$--';
      formulaDiv.textContent = 'Completa los datos';
    }
  }
  
  document.getElementById('materialAncho')?.addEventListener('input', calcularCosto);
  document.getElementById('materialLargo')?.addEventListener('input', calcularCosto);
  document.getElementById('materialPrecioRollo')?.addEventListener('input', calcularCosto);
  
  // ==================== CALCULAR TERCERO ====================
  
  function calcularTerceroMargen() {
    const costo = parseFloat(document.getElementById('terceroCosto').value) || 0;
    const precio = parseFloat(document.getElementById('terceroPrecio').value) || 0;
    const margenDiv = document.getElementById('terceroMargen');
    
    if (costo > 0 && precio > 0) {
      const { ganancia, margen } = tercerosManager.calcularMargen(costo, precio);
      const color = margen >= 40 ? '#4CAF50' : margen >= 20 ? '#FFA726' : '#FF5252';
      const emoji = margen >= 40 ? '🟢' : margen >= 20 ? '🟡' : '🔴';
      
      margenDiv.innerHTML = `
        <div style="font-size: 1.8rem; color: ${color};">
          ${emoji} ${margen.toFixed(1)}% de margen
        </div>
        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem;">
          Ganancia: $${ganancia.toFixed(2)} | Costo: $${costo.toFixed(2)} | Precio: $${precio.toFixed(2)}
        </div>
      `;
    } else {
      margenDiv.textContent = 'Completa los precios';
    }
  }
  
  document.getElementById('terceroCosto')?.addEventListener('input', calcularTerceroMargen);
  document.getElementById('terceroPrecio')?.addEventListener('input', calcularTerceroMargen);
  
  // ==================== GUARDAR ROLLO ====================
  
  async function saveRolloHandler() {
    const categoria = document.getElementById('materialCategory').value;
    const productoSelect = document.getElementById('materialProducto');
    const productoId = productoSelect.value;
    const productoNombre = productoSelect.options[productoSelect.selectedIndex]?.text || '';
    const ancho = parseFloat(document.getElementById('materialAncho').value) || 0;
    const largo = parseFloat(document.getElementById('materialLargo').value) || 0;
    const precioRollo = parseFloat(document.getElementById('materialPrecioRollo').value) || 0;
    
    if (!categoria || !productoId || ancho <= 0 || largo <= 0 || precioRollo <= 0) {
      alert('⚠️ Completá todos los campos');
      return;
    }
    
    const m2 = ancho * largo;
    const costoPorM2 = precioRollo / m2;
    
    const rollo = {
      id: 'rollo_' + Date.now(),
      productoId,
      productoNombre,
      categoria,
      ancho,
      largo,
      m2,
      precioRollo,
      costoPorM2,
      created: new Date().toISOString()
    };
    
    const rollos = await materialesManager.getRollos();
    rollos.push(rollo);
    
    // Calcular nuevo promedio
    const promedioNuevo = materialesManager.calcularPromedioPoProducto(productoId, rollos);
    
    if (await materialesManager.saveRollos(rollos)) {
      alert(`✅ Rollo guardado\n\nCosto promedio actualizado: $${promedioNuevo.toFixed(2)}/m²`);
      materialModal.classList.remove('active');
      resetMaterialForm();
      loadMaterialesList();
      
      // Actualizar costo en DB
      await actualizarCostoEnDB(productoId, promedioNuevo);
    } else {
      alert('❌ Error al guardar');
    }
  }
  
  async function actualizarCostoEnDB(productoId, nuevoCostoPorM2) {
    try {
      await window.costosManager.loadCostos();
      const productos = window.costosManager.getAllProducts();
      const productoIndex = productos.findIndex(p => p.id === productoId);
      
      if (productoIndex !== -1) {
        productos[productoIndex].costs.material = nuevoCostoPorM2;
        productos[productoIndex].costs.total = nuevoCostoPorM2 + 
          (productos[productoIndex].costs.labor || 0) + 
          (productos[productoIndex].costs.indirect || 0);
        
        await window.costosManager.saveCostos(productos);
        console.log('[COSTO] Actualizado a:', nuevoCostoPorM2);
      }
    } catch (error) {
      console.error('[COSTO] Error:', error);
    }
  }
  
  document.getElementById('btnSaveMaterial').addEventListener('click', saveRolloHandler);
  
  // ==================== GUARDAR TERCERO ====================
  
  async function saveTerceroHandler() {
    const name = document.getElementById('terceroName').value.trim();
    let category = document.getElementById('terceroCategory').value.trim();
    const categoryCustom = document.getElementById('terceroCategoryCustom')?.value.trim();
    const unit = document.getElementById('terceroUnit').value;
    const costo = parseFloat(document.getElementById('terceroCosto').value) || 0;
    const precio = parseFloat(document.getElementById('terceroPrecio').value) || 0;
    
    if (categoryCustom) category = categoryCustom;
    
    if (!name || costo <= 0 || precio <= 0) {
      alert('⚠️ Completá nombre, costo y precio');
      return;
    }
    
    const { ganancia, margen } = tercerosManager.calcularMargen(costo, precio);
    
    const tercero = {
      id: 'terc_' + Date.now(),
      name,
      category: category || 'Sin categoría',
      unit,
      costo,
      precio,
      ganancia,
      margen,
      created: new Date().toISOString()
    };
    
    console.log('[TERCEROS] Guardando:', tercero);
    
    const terceros = await tercerosManager.getTerceros();
    terceros.push(tercero);
    
    const result = await tercerosManager.saveTerceros(terceros);
    
    if (result) {
      alert('✅ Servicio guardado');
      terceroModal.classList.remove('active');
      resetTerceroForm();
      loadTercerosList();
    } else {
      alert('❌ Error al guardar');
    }
  }
  
  document.getElementById('btnSaveTercero').addEventListener('click', saveTerceroHandler);
  
  // ==================== LISTAR ====================
  
  async function loadMaterialesList() {
    const rollos = await materialesManager.getRollos();
    const container = document.getElementById('materialesList');
    
    if (!rollos.length) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay rollos</p>';
      return;
    }
    
    // Agrupar por producto
    const productoMap = {};
    rollos.forEach(r => {
      if (!productoMap[r.productoId]) {
        productoMap[r.productoId] = {
          nombre: r.productoNombre,
          categoria: r.categoria,
          rollos: []
        };
      }
      productoMap[r.productoId].rollos.push(r);
    });
    
    container.innerHTML = Object.entries(productoMap).map(([productoId, data]) => {
      const promedio = materialesManager.calcularPromedioPoProducto(productoId, rollos);
      
      return `
        <div style="border: 2px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
          <h3 style="color: var(--gremio-color); margin-bottom: 0.5rem;">${data.nombre}</h3>
          <div style="color: var(--text-secondary); margin-bottom: 1rem;">${data.categoria}</div>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 1rem; border-radius: 8px; color: white; text-align: center; margin-bottom: 1rem;">
            <div style="font-size: 0.9rem; opacity: 0.9;">COSTO PROMEDIO</div>
            <div style="font-size: 2rem; font-weight: bold;">$${promedio.toFixed(2)}/m²</div>
            <div style="font-size: 0.8rem; opacity: 0.8;">${data.rollos.length} rollo${data.rollos.length > 1 ? 's' : ''}</div>
          </div>
          
          <div style="display: grid; gap: 0.5rem;">
            ${data.rollos.map(r => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; background: var(--card-bg); border-radius: 4px;">
                <div style="font-size: 0.9rem;">
                  📦 ${r.ancho}m × ${r.largo}m = ${r.m2.toFixed(2)}m² → $${r.precioRollo.toFixed(0)} → <strong>$${r.costoPorM2.toFixed(2)}/m²</strong>
                </div>
                <div style="display: flex; gap: 0.3rem;">
                  <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;" onclick="editRollo('${r.id}')">✏️</button>
                  <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;" onclick="deleteRollo('${r.id}')">🗑️</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  }
  
  async function loadTercerosList() {
    const terceros = await tercerosManager.getTerceros();
    const container = document.getElementById('tercerosList');
    
    if (!terceros.length) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay servicios</p>';
      return;
    }
    
    container.innerHTML = terceros.map(t => {
      const color = t.margen >= 40 ? '#4CAF50' : t.margen >= 20 ? '#FFA726' : '#FF5252';
      const emoji = t.margen >= 40 ? '🟢' : t.margen >= 20 ? '🟡' : '🔴';
      
      return `
        <div class="product-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid var(--border-color);">
          <div>
            <h4>${t.name}</h4>
            <div style="color: var(--text-secondary); font-size: 0.9rem; margin: 0.5rem 0;">
              ${t.category} | Por ${t.unit}
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 0.8rem;">
              <div style="background: var(--card-bg); padding: 0.5rem 1rem; border-radius: 4px;">
                <div style="font-size: 0.8rem; color: var(--text-secondary);">Mi Costo</div>
                <div style="font-size: 1.2rem; font-weight: bold;">$${t.costo.toFixed(2)}</div>
              </div>
              <div style="background: var(--card-bg); padding: 0.5rem 1rem; border-radius: 4px;">
                <div style="font-size: 0.8rem; color: var(--text-secondary);">Precio Público</div>
                <div style="font-size: 1.2rem; font-weight: bold; color: var(--gremio-color);">$${t.precio.toFixed(2)}</div>
              </div>
              <div style="background: var(--card-bg); padding: 0.5rem 1rem; border-radius: 4px; border: 2px solid ${color};">
                <div style="font-size: 0.8rem; color: var(--text-secondary);">Margen</div>
                <div style="font-size: 1.2rem; font-weight: bold; color: ${color};">${emoji} ${t.margen.toFixed(1)}%</div>
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-primary" style="padding: 0.5rem 1rem;" onclick="editTercero('${t.id}')">✏️</button>
            <button class="btn btn-danger" style="padding: 0.5rem 1rem;" onclick="deleteTercero('${t.id}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  // ==================== EDITAR/ELIMINAR ====================
  
  async function editRollo(id) {
    const rollos = await materialesManager.getRollos();
    const rollo = rollos.find(r => r.id === id);
    if (!rollo) return alert('❌ No encontrado');
    
    await cargarCategoriasYProductos();
    
    setTimeout(() => {
      document.getElementById('materialCategory').value = rollo.categoria;
      document.getElementById('materialCategory').dispatchEvent(new Event('change'));
      
      setTimeout(() => {
        document.getElementById('materialProducto').value = rollo.productoId;
        document.getElementById('materialAncho').value = rollo.ancho;
        document.getElementById('materialLargo').value = rollo.largo;
        document.getElementById('materialPrecioRollo').value = rollo.precioRollo;
        calcularCosto();
      }, 100);
    }, 100);
    
    materialModal.classList.add('active');
    
    const btnSave = document.getElementById('btnSaveMaterial');
    btnSave.textContent = '💾 Actualizar';
    btnSave.onclick = async () => {
      const index = rollos.findIndex(r => r.id === id);
      const ancho = parseFloat(document.getElementById('materialAncho').value) || 0;
      const largo = parseFloat(document.getElementById('materialLargo').value) || 0;
      const precioRollo = parseFloat(document.getElementById('materialPrecioRollo').value) || 0;
      
      const m2 = ancho * largo;
      rollos[index] = {
        ...rollos[index],
        ancho,
        largo,
        m2,
        precioRollo,
        costoPorM2: precioRollo / m2
      };
      
      const promedio = materialesManager.calcularPromedioPoProducto(rollo.productoId, rollos);
      
      if (await materialesManager.saveRollos(rollos)) {
        alert(`✅ Actualizado\nNuevo promedio: $${promedio.toFixed(2)}/m²`);
        await actualizarCostoEnDB(rollo.productoId, promedio);
        materialModal.classList.remove('active');
        resetMaterialForm();
        loadMaterialesList();
      }
    };
  }
  
  async function deleteRollo(id) {
    if (!confirm('¿Eliminar?')) return;
    const rollos = await materialesManager.getRollos();
    const rollo = rollos.find(r => r.id === id);
    const filtered = rollos.filter(r => r.id !== id);
    
    if (await materialesManager.saveRollos(filtered)) {
      // Recalcular promedio sin este rollo
      const promedio = materialesManager.calcularPromedioPoProducto(rollo.productoId, filtered);
      await actualizarCostoEnDB(rollo.productoId, promedio);
      alert('✅ Eliminado');
      loadMaterialesList();
    }
  }
  
  async function editTercero(id) {
    const terceros = await tercerosManager.getTerceros();
    const tercero = terceros.find(t => t.id === id);
    if (!tercero) return alert('❌ No encontrado');
    
    await loadCategoriasParaTerceros();
    document.getElementById('terceroName').value = tercero.name;
    document.getElementById('terceroCategory').value = tercero.category;
    document.getElementById('terceroUnit').value = tercero.unit;
    document.getElementById('terceroCosto').value = tercero.costo;
    document.getElementById('terceroPrecio').value = tercero.precio;
    calcularTerceroMargen();
    terceroModal.classList.add('active');
    
    const btnSave = document.getElementById('btnSaveTercero');
    btnSave.textContent = '💾 Actualizar';
    btnSave.onclick = async () => {
      const index = terceros.findIndex(t => t.id === id);
      const costo = parseFloat(document.getElementById('terceroCosto').value) || 0;
      const precio = parseFloat(document.getElementById('terceroPrecio').value) || 0;
      const { ganancia, margen } = tercerosManager.calcularMargen(costo, precio);
      
      terceros[index] = {
        ...terceros[index],
        name: document.getElementById('terceroName').value.trim(),
        category: document.getElementById('terceroCategory').value.trim() || 'Sin categoría',
        unit: document.getElementById('terceroUnit').value,
        costo,
        precio,
        ganancia,
        margen
      };
      
      if (await tercerosManager.saveTerceros(terceros)) {
        alert('✅ Actualizado');
        terceroModal.classList.remove('active');
        resetTerceroForm();
        loadTercerosList();
      }
    };
  }
  
  async function deleteTercero(id) {
    if (!confirm('¿Eliminar?')) return;
    const terceros = await tercerosManager.getTerceros();
    if (await tercerosManager.saveTerceros(terceros.filter(t => t.id !== id))) {
      alert('✅ Eliminado');
      loadTercerosList();
    }
  }
  
  // ==================== RESET ====================
  
  function resetMaterialForm() {
    document.getElementById('materialCategory').value = '';
    document.getElementById('materialProducto').innerHTML = '<option value="">Primero selecciona categoría...</option>';
    document.getElementById('materialProducto').disabled = true;
    document.getElementById('materialAncho').value = '';
    document.getElementById('materialLargo').value = '';
    document.getElementById('materialPrecioRollo').value = '';
    document.getElementById('materialCostoCalculado').textContent = '$--';
    document.getElementById('materialFormula').textContent = 'Completa los datos';
    document.getElementById('materialPromedioInfo').style.display = 'none';
    
    const btnSave = document.getElementById('btnSaveMaterial');
    btnSave.textContent = '💾 Agregar Rollo';
    btnSave.onclick = saveRolloHandler;
  }
  
  function resetTerceroForm() {
    document.getElementById('terceroName').value = '';
    document.getElementById('terceroCategory').value = '';
    document.getElementById('terceroUnit').value = 'm²';
    document.getElementById('terceroCosto').value = '';
    document.getElementById('terceroPrecio').value = '';
    document.getElementById('terceroMargen').textContent = 'Completa los precios';
    
    const btnSave = document.getElementById('btnSaveTercero');
    btnSave.textContent = '💾 Guardar Servicio';
    btnSave.onclick = saveTerceroHandler;
  }
  
  console.log('✅ Módulo cargado correctamente');
  
})();
