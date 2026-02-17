// ==================== FUNCIÓN DE FORMATO ====================

function formatCurrencyAR(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) {
    return '0,00';
  }
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

// ==================== CATEGORÍAS MANAGER ====================

let allCategorias = [];

// ==================== ACTUALIZAR SELECTOR ====================

async function actualizarSelectorCategorias() {
  console.log('[CATEGORIAS-SELECTOR] Actualizando selector de categorías...');

  const selectCat = document.getElementById('materialCategory');
  if (!selectCat) {
    console.warn('[CATEGORIAS-SELECTOR] Selector no encontrado');
    return;
  }

  try {
    // Cargar categorías desde el servidor
    const categorias = await window.mrDataManager.getCategorias();
    console.log('[CATEGORIAS-SELECTOR] Categorías obtenidas:', categorias);

    // También extraer de materiales para retrocompatibilidad
    const materiales = await window.mrDataManager.getMateriales();
    const categoriasEnMateriales = [...new Set(
      materiales
        .map(m => m.categoria || m.category || m.cat)
        .filter(Boolean)
    )];

    // Combinar y eliminar duplicados
    const categoriasFinales = [...new Set([...categorias, ...categoriasEnMateriales])].sort();
    console.log('[CATEGORIAS-SELECTOR] Categorías finales:', categoriasFinales);

    // Actualizar el select
    selectCat.innerHTML = '<option value="">Seleccionar categoría...</option>';

    categoriasFinales.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      selectCat.appendChild(option);
    });

    console.log('[CATEGORIAS-SELECTOR] ✅ Selector actualizado con', categoriasFinales.length, 'categorías');
  } catch (error) {
    console.error('[CATEGORIAS-SELECTOR] Error:', error);
    selectCat.innerHTML = '<option value="">Error al cargar categorías</option>';
  }
}

// ==================== CARGAR Y RENDERIZAR CATEGORÍAS ====================

async function loadCategorias() {
  try {
    // Definir función de fetch segura que maneja la espera de AUTH si es necesario o fallback
    const fetchWithAuth = async (url) => {
      if (window.AUTH) return window.AUTH.fetch(url);

      // Fallback manual si window.AUTH no está listo (aunque debería)
      const token = localStorage.getItem('mr_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      return fetch(url, { headers });
    };

    let categorias = [];

    // 1. Intentar cargar desde API Categorías
    try {
      const response = await fetchWithAuth('/api/categorias');
      if (response.ok) {
        categorias = await response.json();
      }
    } catch (e) {
      console.warn('[CATEGORIAS] Error fetching API:', e);
    }

    // 2. Intentar cargar desde Materiales (Retrocompatibilidad)
    try {
      const matResponse = await fetchWithAuth('/api/materiales');
      if (matResponse.ok) {
        const materiales = await matResponse.json();
        const categoriasEnMateriales = [...new Set(
          materiales
            .map(m => m.categoria || m.category || m.cat)
            .filter(Boolean)
        )];
        // Unir sin duplicados
        categorias = [...new Set([...categorias, ...categoriasEnMateriales])];
      }
    } catch (e) {
      console.warn('[CATEGORIAS] Error fetching materials:', e);
    }

    // Ordenar
    allCategorias = categorias.sort();

    console.log('[CATEGORIAS] Final:', allCategorias);
    await renderCategorias();
    await actualizarSelectorCategorias();

  } catch (error) {
    console.error('[CATEGORIAS] Critical Error:', error);
    allCategorias = [];
    await renderCategorias();
  }
}

async function renderCategorias() {
  const container = document.getElementById('categoriesList');

  if (!container) {
    console.warn('[CATEGORIAS] Container no encontrado');
    return;
  }

  if (allCategorias.length === 0) {
    container.innerHTML = '<div style="grid-column: 1 / -1; color: rgba(255,255,255,0.5); text-align: center; padding: 2rem;">No hay categorías. Crea la primera.</div>';
    return;
  }

  // Cargar materiales para contar
  let materiales = [];
  try {
    const response = await fetch('/api/materiales');
    materiales = await response.json();
  } catch (error) {
    console.error('[CATEGORIAS] Error cargando materiales:', error);
  }

  container.innerHTML = allCategorias.map(cat => {
    const count = materiales.filter(m => m.categoria === cat).length;
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
        <div onclick="toggleCategoryDetails('${cat}')" style="cursor: pointer; flex: 1; display: flex; align-items: center; gap: 0.5rem;">
            <span>📁</span>
            <span style="font-weight: 500; color: var(--text-light);">${cat}</span>
            <span style="font-size: 0.8rem; color: rgba(255,255,255,0.4);">(${count})</span>
        </div>
        <button onclick="event.stopPropagation(); deleteCategory('${cat}')" style="background: none; border: none; cursor: pointer; opacity: 0.4; padding: 4px; font-size: 0.9rem; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.4" title="Eliminar Categoría">🗑️</button>
      </div>
    `;
  }).join('');
}

async function createCategory() {
  const name = document.getElementById('newCategoryName').value.trim();

  if (!name) {
    alert('⚠️ Ingresa un nombre para la categoría');
    return;
  }

  if (allCategorias.includes(name)) {
    alert('⚠️ Esa categoría ya existe');
    return;
  }

  try {
    // Guardar la categoría en el servidor
    const response = await fetch('/api/categorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria: name })
    });

    if (!response.ok) throw new Error('Error al guardar');

    const result = await response.json();
    if (result.success) {
      allCategorias.push(name);
      allCategorias.sort();
      alert(`✅ Categoría "${name}" creada correctamente.`);
      closeCategoryModal();
      await renderCategorias();
      // Actualizar el selector del modal
      await actualizarSelectorCategorias();
    } else {
      alert('❌ Error al guardar la categoría');
    }
  } catch (error) {
    console.error('[CATEGORIAS] Error creando categoría:', error);
    alert('❌ Error al crear la categoría');
  }
}

async function deleteCategory(categoria) {
  // Verificar si hay materiales en esta categoría
  try {
    const response = await fetch('/api/materiales');
    const materiales = await response.json();
    const count = materiales.filter(m => m.categoria === categoria).length;

    if (count > 0) {
      alert(`⚠️ No puedes eliminar "${categoria}" porque tiene ${count} rollo${count !== 1 ? 's' : ''}.\n\nPrimero elimina todos los rollos de esta categoría.`);
      return;
    }

    if (!confirm(`¿Eliminar la categoría "${categoria}"?`)) return;

    // Eliminar del servidor
    const deleteResponse = await fetch(`/api/categorias/${encodeURIComponent(categoria)}`, {
      method: 'DELETE'
    });

    if (deleteResponse.ok) {
      allCategorias = allCategorias.filter(c => c !== categoria);
      alert(`✅ Categoría "${categoria}" eliminada`);
      await renderCategorias();
    } else {
      alert('❌ Error al eliminar la categoría');
    }
  } catch (error) {
    console.error('[CATEGORIAS] Error eliminando categoría:', error);
    alert('❌ Error al eliminar la categoría');
  }
}

function validateCategoryName() {
  const input = document.getElementById('newCategoryName');
  const btn = document.getElementById('btnSaveCategory');
  const help = document.getElementById('categoryNameHelp');
  const name = input.value.trim();

  if (!name) {
    btn.disabled = true;
    help.textContent = 'Ingresa un nombre único';
    help.style.color = 'rgba(255,255,255,0.5)';
    return;
  }

  if (allCategorias.includes(name)) {
    btn.disabled = true;
    help.textContent = '❌ Esa categoría ya existe';
    help.style.color = '#FF6B6B';
    return;
  }

  btn.disabled = false;
  help.textContent = '✅ Nombre disponible';
  help.style.color = '#51CF66';
}

function openCategoryModal() {
  document.getElementById('categoryModal').classList.add('active');
  document.getElementById('newCategoryName').value = '';
  document.getElementById('newCategoryName').focus();
  validateCategoryName();
}

function closeCategoryModal() {
  document.getElementById('categoryModal').classList.remove('active');
  document.getElementById('newCategoryName').value = '';
}

// Inicializar cuando el DOM carga
document.addEventListener('DOMContentLoaded', () => {
  loadCategorias();

  const btnAddCategory = document.getElementById('btnAddCategory');
  const btnCloseCategory = document.getElementById('btnCloseCategory');
  const btnCancelCategory = document.getElementById('btnCancelCategory');
  const btnSaveCategory = document.getElementById('btnSaveCategory');

  if (btnAddCategory) btnAddCategory.addEventListener('click', openCategoryModal);
  if (btnCloseCategory) btnCloseCategory.addEventListener('click', closeCategoryModal);
  if (btnCancelCategory) btnCancelCategory.addEventListener('click', closeCategoryModal);
  if (btnSaveCategory) btnSaveCategory.addEventListener('click', createCategory);

  // Validar al presionar Enter
  const input = document.getElementById('newCategoryName');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !btnSaveCategory.disabled) {
        createCategory();
      }
    });
  }
});

// Función para expandir y ver productos de una categoría
window.toggleCategoryDetails = async function (categoria) {
  // Crear modal temporal para ver productos
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'categoryDetailsModal';

  try {
    const response = await fetch('/api/materiales');
    const materiales = await response.json();
    const productosEnCategoria = materiales.filter(m => m.categoria === categoria);

    const productosHTML = productosEnCategoria.map(prod => {
      const m2 = prod.m2 || ((prod.ancho || 0) * (prod.largo || 0));
      return `
        <div style="background: rgba(255, 255, 255, 0.05); padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem; border-left: 3px solid #FF8C42; display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div style="font-weight: 600; color: var(--text-light); margin-bottom: 0.3rem;">${prod.producto || 'Sin nombre'}</div>
            <div style="font-size: 0.9rem; color: rgba(255,255,255,0.7);">
              📏 ${formatCurrencyAR(prod.ancho || 0)}m × ${formatCurrencyAR(prod.largo || 0)}m = ${formatCurrencyAR(m2)}m²
            </div>
            <div style="font-size: 0.9rem; color: #FF8C42; font-weight: 600; margin-top: 0.3rem;">
              💰 $${formatCurrencyAR(prod.costoPorM2 || 0)}/m² • $${formatCurrencyAR(prod.precioRollo || 0)} (rollo)
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem; margin-left: 1rem;">
            <button class="btn btn-primary btn-small" onclick="window.editarMaterial(${JSON.stringify(prod).replace(/"/g, '&quot;')})">✏️ Editar</button>
            <button class="btn btn-danger btn-small" onclick="window.borrarMaterial(${prod.id})">🗑️ Borrar</button>
          </div>
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 700px; max-height: 80vh; overflow-y: auto;">
        <div class="modal-header">
          <h2 class="modal-title">📁 ${categoria}</h2>
          <button class="btn-close" onclick="document.getElementById('categoryDetailsModal').remove()">×</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 1rem; padding: 1rem; background: rgba(81, 207, 102, 0.1); border-radius: 8px; border-left: 3px solid #51CF66;">
            <strong>${productosEnCategoria.length}</strong> rollo${productosEnCategoria.length !== 1 ? 's' : ''} en esta categoría
          </div>
          ${productosHTML || '<p style="color: rgba(255,255,255,0.5); text-align: center;">No hay productos en esta categoría</p>'}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('categoryDetailsModal').remove()">Cerrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  } catch (error) {
    console.error('[CATEGORIAS] Error:', error);
    alert('❌ Error al cargar los productos');
  }
};

// Función para editar un material
window.editarMaterial = function (producto) {
  console.log('[CATEGORIAS] Editando material:', producto);

  // Cerrar el modal de detalles
  const detailsModal = document.getElementById('categoryDetailsModal');
  if (detailsModal) {
    detailsModal.remove();
  }

  // Abrir el formulario de materiales con los datos del producto
  const materialModal = document.getElementById('materialModal');
  if (!materialModal) {
    alert('❌ No se pudo abrir el formulario de edición');
    return;
  }

  // Rellenar los campos con los datos del producto
  document.getElementById('materialCategory').value = producto.categoria || '';
  document.getElementById('materialProductName').value = producto.producto || producto.productoNombre || '';
  document.getElementById('materialAncho').value = (producto.ancho || 0).toFixed(2);
  document.getElementById('materialLargo').value = (producto.largo || 0).toFixed(2);
  document.getElementById('materialPrecioRollo').value = producto.precioRollo || '';

  // Marcar como edición
  const btnSaveMaterial = document.getElementById('btnSaveMaterial');
  if (btnSaveMaterial) {
    btnSaveMaterial.dataset.editingId = producto.id;
    btnSaveMaterial.textContent = '💾 Actualizar Rollo';
  }

  // Trigger calcularM2 para mostrar el costo
  // Esperar a que se renderice el DOM y luego llamar calcularM2
  setTimeout(() => {
    // Buscar la función calcularM2 en el contexto global
    const scripts = document.querySelectorAll('script');
    let calcularM2Found = false;
    for (let script of scripts) {
      if (script.textContent.includes('calcularM2')) {
        calcularM2Found = true;
        break;
      }
    }
    // Llamar la función si existe en el contexto global
    if (typeof window.calcularM2 === 'function') {
      window.calcularM2();
    }
  }, 0);

  // Abrir el modal
  materialModal.classList.add('active');
};

// Función para borrar un material
window.borrarMaterial = async function (materialId) {
  if (!confirm('¿Estás seguro de que quieres borrar este rollo?')) {
    return;
  }

  try {
    const response = await fetch('/api/materiales');
    let materiales = await response.json();

    // Filtrar el material a eliminar
    const materialOriginal = materiales.find(m => m.id === materialId);
    if (!materialOriginal) {
      alert('❌ Material no encontrado');
      return;
    }

    materiales = materiales.filter(m => m.id !== materialId);

    // Guardar los materiales actualizados
    const saveResponse = await fetch('/api/materiales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(materiales)
    });

    if (saveResponse.ok) {
      alert('✅ Rollo eliminado correctamente');

      // Cerrar el modal de detalles
      const detailsModal = document.getElementById('categoryDetailsModal');
      if (detailsModal) {
        detailsModal.remove();
      }

      // Recargar las categorías y materiales
      if (typeof loadCategorias === 'function') {
        await loadCategorias();
      }
    } else {
      alert('❌ Error al eliminar el rollo');
    }
  } catch (error) {
    console.error('[CATEGORIAS] Error borrando material:', error);
    alert('❌ Error al eliminar el rollo');
  }
};
