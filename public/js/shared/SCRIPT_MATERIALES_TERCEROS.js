// ==================== GESTIÓN DE MATERIALES ====================

const materialesManager = {
  async getMateriales() {
    try {
      const materiales = await window.mrDataManager.getMateriales();
      console.log('[MATERIALES] Obtenidos:', materiales.length);
      return materiales;
    } catch (error) {
      console.error('[MATERIALES] Error:', error);
      return [];
    }
  },

  async saveMateriales(materiales) {
    try {
      const success = await window.mrDataManager.saveMateriales(materiales);
      console.log('[MATERIALES] Guardados:', success);
      return success;
    } catch (error) {
      console.error('[MATERIALES] Error guardando:', error);
      return false;
    }
  },

  calcularCostoPorUnidad(cantidadTotal, precioTotal) {
    if (cantidadTotal <= 0) return 0;
    return precioTotal / cantidadTotal;
  }
};

const tercerosManager = {
  async getTerceros() {
    try {
      const terceros = await window.mrDataManager.getTerceros();
      console.log('[TERCEROS] Obtenidos:', terceros.length);
      return terceros;
    } catch (error) {
      console.error('[TERCEROS] Error:', error);
      return [];
    }
  },

  async saveTerceros(terceros) {
    try {
      const success = await window.mrDataManager.saveTerceros(terceros);
      console.log('[TERCEROS] Guardados:', success);
      return success;
    } catch (error) {
      console.error('[TERCEROS] Error guardando:', error);
      return false;
    }
  },

  calcularMargen(costo, precio) {
    if (precio <= 0) return 0;
    const ganancia = precio - costo;
    const margen = (ganancia / precio) * 100;
    return { ganancia, margen };
  }
};

// ==================== SETUP MODALES ====================

const materialModal = setupModal('materialModal', 'btnAddMaterial', 'btnCloseMaterial', 'btnCancelMaterial');
const terceroModal = setupModal('terceroModal', 'btnAddTercero', 'btnCloseTercero', 'btnCancelTercero');

// ==================== MATERIALES - CÁLCULO AUTOMÁTICO ====================

function calcularMaterial() {
  const total = parseFloat(document.getElementById('materialTotal').value) || 0;
  const precio = parseFloat(document.getElementById('materialPrecio').value) || 0;
  const unit = document.getElementById('materialUnit').value;
  
  const calculado = document.getElementById('materialCalculado');
  
  if (total > 0 && precio > 0) {
    const costoPorUnidad = materialesManager.calcularCostoPorUnidad(total, precio);
    calculado.innerHTML = `
      <div style="font-size: 1.8rem; color: var(--gremio-color);">
        $${costoPorUnidad.toFixed(2)} <small>por ${unit}</small>
      </div>
      <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem;">
        ${total} ${unit} ÷ $${precio.toFixed(2)} = $${costoPorUnidad.toFixed(2)}/${unit}
      </div>
    `;
  } else {
    calculado.textContent = 'Completa los datos para ver el cálculo';
  }
}

document.getElementById('materialTotal').addEventListener('input', calcularMaterial);
document.getElementById('materialPrecio').addEventListener('input', calcularMaterial);
document.getElementById('materialUnit').addEventListener('change', calcularMaterial);

// ==================== TERCEROS - CÁLCULO DE MARGEN ====================

function calcularTerceroMargen() {
  const costo = parseFloat(document.getElementById('terceroCosto').value) || 0;
  const precio = parseFloat(document.getElementById('terceroPrecio').value) || 0;
  
  const margenDiv = document.getElementById('terceroMargen');
  
  if (costo > 0 && precio > 0) {
    const { ganancia, margen } = tercerosManager.calcularMargen(costo, precio);
    
    let color = '#4CAF50'; // Verde
    let emoji = '🟢';
    
    if (margen < 20) {
      color = '#FF5252'; // Rojo
      emoji = '🔴';
    } else if (margen < 40) {
      color = '#FFA726'; // Naranja
      emoji = '🟡';
    }
    
    margenDiv.innerHTML = `
      <div style="font-size: 1.8rem; color: ${color};">
        ${emoji} ${margen.toFixed(1)}% de margen
      </div>
      <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem;">
        Ganancia: $${ganancia.toFixed(2)} | Costo: $${costo.toFixed(2)} | Precio: $${precio.toFixed(2)}
      </div>
    `;
  } else {
    margenDiv.textContent = 'Completa los precios para ver el margen';
  }
}

document.getElementById('terceroCosto').addEventListener('input', calcularTerceroMargen);
document.getElementById('terceroPrecio').addEventListener('input', calcularTerceroMargen);

// ==================== GUARDAR MATERIAL ====================

document.getElementById('btnSaveMaterial').addEventListener('click', async () => {
  const name = document.getElementById('materialName').value.trim();
  const category = document.getElementById('materialCategory').value.trim();
  const unit = document.getElementById('materialUnit').value;
  const total = parseFloat(document.getElementById('materialTotal').value) || 0;
  const precio = parseFloat(document.getElementById('materialPrecio').value) || 0;
  
  if (!name || total <= 0 || precio <= 0) {
    alert('⚠️ Completá nombre, cantidad y precio');
    return;
  }
  
  const costoPorUnidad = materialesManager.calcularCostoPorUnidad(total, precio);
  
  const material = {
    id: 'mat_' + Date.now(),
    name,
    category: category || 'Sin categoría',
    unit,
    total,
    precio,
    costoPorUnidad,
    created: new Date().toISOString()
  };
  
  const materiales = await materialesManager.getMateriales();
  materiales.push(material);
  
  const success = await materialesManager.saveMateriales(materiales);
  
  if (success) {
    alert('✅ Material guardado');
    materialModal.classList.remove('active');
    resetMaterialForm();
    loadMaterialesList();
    
    // Agregar automáticamente a costos
    await agregarMaterialACostos(material);
  } else {
    alert('❌ Error al guardar');
  }
});

// ==================== AGREGAR MATERIAL A COSTOS ====================

async function agregarMaterialACostos(material) {
  try {
    // Crear producto de costo automáticamente
    const costProduct = {
      id: 'costo_mat_' + Date.now(),
      name: material.name + ' (Material)',
      category: material.category,
      unit: material.unit,
      costs: {
        material: material.costoPorUnidad,
        labor: 0,
        indirect: 0,
        total: material.costoPorUnidad
      },
      fromMaterial: true,
      materialId: material.id
    };
    
    await window.costosManager.addProduct(costProduct);
    console.log('[MATERIALES] Agregado a costos:', costProduct.name);
  } catch (error) {
    console.error('[MATERIALES] Error agregando a costos:', error);
  }
}

// ==================== GUARDAR TERCERO ====================

document.getElementById('btnSaveTercero').addEventListener('click', async () => {
  const name = document.getElementById('terceroName').value.trim();
  const category = document.getElementById('terceroCategory').value.trim();
  const unit = document.getElementById('terceroUnit').value;
  const costo = parseFloat(document.getElementById('terceroCosto').value) || 0;
  const precio = parseFloat(document.getElementById('terceroPrecio').value) || 0;
  
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
  
  const terceros = await tercerosManager.getTerceros();
  terceros.push(tercero);
  
  const success = await tercerosManager.saveTerceros(terceros);
  
  if (success) {
    alert('✅ Servicio guardado');
    terceroModal.classList.remove('active');
    resetTerceroForm();
    loadTercerosList();
  } else {
    alert('❌ Error al guardar');
  }
});

// ==================== LISTAR MATERIALES ====================

async function loadMaterialesList() {
  const materiales = await materialesManager.getMateriales();
  const container = document.getElementById('materialesList');
  
  if (materiales.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay materiales configurados</p>';
    return;
  }
  
  container.innerHTML = materiales.map(m => `
    <div class="product-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid var(--border-color);">
      <div class="product-info">
        <h4>${m.name}</h4>
        <div class="product-details" style="color: var(--text-secondary); font-size: 0.9rem; margin: 0.5rem 0;">
          ${m.category} | ${m.unit}
        </div>
        <div style="margin-top: 0.5rem;">
          <span style="background: var(--card-bg); padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.9rem;">
            📦 Paquete: ${m.total} ${m.unit} × $${m.precio.toFixed(2)} = $${(m.total * m.precio).toFixed(2)}
          </span>
        </div>
        <div style="font-size: 1.3rem; font-weight: bold; margin-top: 0.8rem; color: var(--gremio-color);">
          💰 Costo por ${m.unit}: $${m.costoPorUnidad.toFixed(2)}
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <button class="btn btn-primary" style="padding: 0.5rem 1rem;" onclick="editMaterial('${m.id}')">✏️</button>
        <button class="btn btn-danger" style="padding: 0.5rem 1rem;" onclick="deleteMaterial('${m.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

// ==================== LISTAR TERCEROS ====================

async function loadTercerosList() {
  const terceros = await tercerosManager.getTerceros();
  const container = document.getElementById('tercerosList');
  
  if (terceros.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay servicios configurados</p>';
    return;
  }
  
  container.innerHTML = terceros.map(t => {
    let margenColor = '#4CAF50';
    let margenEmoji = '🟢';
    
    if (t.margen < 20) {
      margenColor = '#FF5252';
      margenEmoji = '🔴';
    } else if (t.margen < 40) {
      margenColor = '#FFA726';
      margenEmoji = '🟡';
    }
    
    return `
      <div class="product-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid var(--border-color);">
        <div class="product-info">
          <h4>${t.name}</h4>
          <div class="product-details" style="color: var(--text-secondary); font-size: 0.9rem; margin: 0.5rem 0;">
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
            <div style="background: var(--card-bg); padding: 0.5rem 1rem; border-radius: 4px; border: 2px solid ${margenColor};">
              <div style="font-size: 0.8rem; color: var(--text-secondary);">Margen</div>
              <div style="font-size: 1.2rem; font-weight: bold; color: ${margenColor};">${margenEmoji} ${t.margen.toFixed(1)}%</div>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="btn btn-primary" style="padding: 0.5rem 1rem;" onclick="editTercero('${t.id}')">✏️</button>
          <button class="btn btn-danger" style="padding: 0.5rem 1rem;" onclick="deleteTercero('${t.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== EDITAR/ELIMINAR MATERIAL ====================

async function editMaterial(id) {
  const materiales = await materialesManager.getMateriales();
  const material = materiales.find(m => m.id === id);
  
  if (!material) {
    alert('❌ Material no encontrado');
    return;
  }
  
  document.getElementById('materialName').value = material.name;
  document.getElementById('materialCategory').value = material.category;
  document.getElementById('materialUnit').value = material.unit;
  document.getElementById('materialTotal').value = material.total;
  document.getElementById('materialPrecio').value = material.precio;
  calcularMaterial();
  
  materialModal.classList.add('active');
  
  const btnSave = document.getElementById('btnSaveMaterial');
  btnSave.textContent = '💾 Actualizar Material';
  btnSave.onclick = async () => {
    const name = document.getElementById('materialName').value.trim();
    const category = document.getElementById('materialCategory').value.trim();
    const unit = document.getElementById('materialUnit').value;
    const total = parseFloat(document.getElementById('materialTotal').value) || 0;
    const precio = parseFloat(document.getElementById('materialPrecio').value) || 0;
    
    if (!name || total <= 0 || precio <= 0) {
      alert('⚠️ Completá todos los campos');
      return;
    }
    
    const costoPorUnidad = materialesManager.calcularCostoPorUnidad(total, precio);
    
    const index = materiales.findIndex(m => m.id === id);
    materiales[index] = {
      ...materiales[index],
      name,
      category,
      unit,
      total,
      precio,
      costoPorUnidad
    };
    
    const success = await materialesManager.saveMateriales(materiales);
    
    if (success) {
      alert('✅ Material actualizado');
      materialModal.classList.remove('active');
      resetMaterialForm();
      loadMaterialesList();
    } else {
      alert('❌ Error al actualizar');
    }
  };
}

async function deleteMaterial(id) {
  if (!confirm('¿Eliminar este material?')) return;
  
  const materiales = await materialesManager.getMateriales();
  const filtered = materiales.filter(m => m.id !== id);
  
  const success = await materialesManager.saveMateriales(filtered);
  
  if (success) {
    alert('✅ Material eliminado');
    loadMaterialesList();
  } else {
    alert('❌ Error al eliminar');
  }
}

// ==================== EDITAR/ELIMINAR TERCERO ====================

async function editTercero(id) {
  const terceros = await tercerosManager.getTerceros();
  const tercero = terceros.find(t => t.id === id);
  
  if (!tercero) {
    alert('❌ Servicio no encontrado');
    return;
  }
  
  document.getElementById('terceroName').value = tercero.name;
  document.getElementById('terceroCategory').value = tercero.category;
  document.getElementById('terceroUnit').value = tercero.unit;
  document.getElementById('terceroCosto').value = tercero.costo;
  document.getElementById('terceroPrecio').value = tercero.precio;
  calcularTerceroMargen();
  
  terceroModal.classList.add('active');
  
  const btnSave = document.getElementById('btnSaveTercero');
  btnSave.textContent = '💾 Actualizar Servicio';
  btnSave.onclick = async () => {
    const name = document.getElementById('terceroName').value.trim();
    const category = document.getElementById('terceroCategory').value.trim();
    const unit = document.getElementById('terceroUnit').value;
    const costo = parseFloat(document.getElementById('terceroCosto').value) || 0;
    const precio = parseFloat(document.getElementById('terceroPrecio').value) || 0;
    
    if (!name || costo <= 0 || precio <= 0) {
      alert('⚠️ Completá todos los campos');
      return;
    }
    
    const { ganancia, margen } = tercerosManager.calcularMargen(costo, precio);
    
    const index = terceros.findIndex(t => t.id === id);
    terceros[index] = {
      ...terceros[index],
      name,
      category,
      unit,
      costo,
      precio,
      ganancia,
      margen
    };
    
    const success = await tercerosManager.saveTerceros(terceros);
    
    if (success) {
      alert('✅ Servicio actualizado');
      terceroModal.classList.remove('active');
      resetTerceroForm();
      loadTercerosList();
    } else {
      alert('❌ Error al actualizar');
    }
  };
}

async function deleteTercero(id) {
  if (!confirm('¿Eliminar este servicio?')) return;
  
  const terceros = await tercerosManager.getTerceros();
  const filtered = terceros.filter(t => t.id !== id);
  
  const success = await tercerosManager.saveTerceros(filtered);
  
  if (success) {
    alert('✅ Servicio eliminado');
    loadTercerosList();
  } else {
    alert('❌ Error al eliminar');
  }
}

// ==================== RESET FORMS ====================

function resetMaterialForm() {
  document.getElementById('materialName').value = '';
  document.getElementById('materialCategory').value = '';
  document.getElementById('materialUnit').value = 'm';
  document.getElementById('materialTotal').value = '';
  document.getElementById('materialPrecio').value = '';
  document.getElementById('materialCalculado').textContent = 'Completa los datos para ver el cálculo';
  
  const btnSave = document.getElementById('btnSaveMaterial');
  btnSave.textContent = '💾 Guardar Material';
  btnSave.onclick = null;
}

function resetTerceroForm() {
  document.getElementById('terceroName').value = '';
  document.getElementById('terceroCategory').value = '';
  document.getElementById('terceroUnit').value = 'm²';
  document.getElementById('terceroCosto').value = '';
  document.getElementById('terceroPrecio').value = '';
  document.getElementById('terceroMargen').textContent = 'Completa los precios para ver el margen';
  
  const btnSave = document.getElementById('btnSaveTercero');
  btnSave.textContent = '💾 Guardar Servicio';
  btnSave.onclick = null;
}

// ==================== RESET AL ABRIR MODAL ====================

document.getElementById('btnAddMaterial').addEventListener('click', () => {
  resetMaterialForm();
});

document.getElementById('btnAddTercero').addEventListener('click', () => {
  resetTerceroForm();
});

// ==================== CARGAR AL CAMBIAR DE TAB ====================

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    
    if (tabName === 'materiales') loadMaterialesList();
    if (tabName === 'terceros') loadTercerosList();
  });
});
