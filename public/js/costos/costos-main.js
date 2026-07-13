// ==================== COSTOS MODULE - MAIN ==================== 

document.addEventListener('DOMContentLoaded', () => {
  
  console.log('✅ Costos module initialized');
  
  // ==================== ESTADO GLOBAL ====================
  
  let products = [];
  
  // ==================== EVENT LISTENERS ====================
  
  document.getElementById('btnAddProduct')?.addEventListener('click', openAddProductModal);
  document.getElementById('btnCloseProduct')?.addEventListener('click', closeAddProductModal);
  document.getElementById('btnCancelProduct')?.addEventListener('click', closeAddProductModal);
  document.getElementById('btnSaveProduct')?.addEventListener('click', saveNewProduct);

  document.getElementById('costoMaterial')?.addEventListener('input', updateCostoTotal);
  document.getElementById('costoManoObra')?.addEventListener('input', updateCostoTotal);
  document.getElementById('costosIndirectos')?.addEventListener('input', updateCostoTotal);

  // Cerrar modal al hacer click fuera
  document.getElementById('addProductModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'addProductModal') closeAddProductModal();
  });
  
  // ==================== MODAL FUNCTIONS ====================
  
  function openAddProductModal() {
    document.getElementById('addProductModal')?.classList.add('active');
  }

  function closeAddProductModal() {
    document.getElementById('addProductModal')?.classList.remove('active');
    resetProductForm();
  }

  function resetProductForm() {
    document.getElementById('productName').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productType').value = 'm2';
    document.getElementById('costoMaterial').value = '0';
    document.getElementById('costoManoObra').value = '0';
    document.getElementById('costosIndirectos').value = '0';
    document.getElementById('costoTotal').textContent = '$0.00';
  }
  
  // ==================== COST CALCULATION ====================
  
  function updateCostoTotal() {
    const material = parseFloat(document.getElementById('costoMaterial').value) || 0;
    const mano = parseFloat(document.getElementById('costoManoObra').value) || 0;
    const indirectos = parseFloat(document.getElementById('costosIndirectos').value) || 0;
    const total = material + mano + indirectos;
    
    document.getElementById('costoTotal').textContent = 
      '$' + total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  // ==================== SAVE PRODUCT ====================
  
  async function saveNewProduct() {
    const name = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value.trim();
    const type = document.getElementById('productType').value;
    const material = parseFloat(document.getElementById('costoMaterial').value) || 0;
    const mano = parseFloat(document.getElementById('costoManoObra').value) || 0;
    const indirectos = parseFloat(document.getElementById('costosIndirectos').value) || 0;

    if (!name || !category) {
      alert('⚠️ Por favor completa el nombre y la categoría');
      return;
    }

    const newProduct = {
      name,
      category,
      type,
      costs: {
        material,
        labor: mano,
        indirect: indirectos,
        total: material + mano + indirectos
      }
    };

    try {
      const success = await window.costosManager.addProduct(newProduct);

      if (success) {
        alert('✅ Producto agregado correctamente');
        closeAddProductModal();
        await loadProducts();
      } else {
        alert('❌ Error al guardar el producto');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      alert('❌ Error al guardar el producto: ' + error.message);
    }
  }
  
  // ==================== LOAD PRODUCTS ====================
  
  async function loadProducts() {
    try {
      await window.costosManager.loadCostos();
      products = window.costosManager.getAllProducts();
      renderProducts();
      console.log('✅ Productos cargados:', products.length);
    } catch (error) {
      console.error('❌ Error cargando productos:', error);
      products = [];
      renderProducts();
    }
  }
  
  // ==================== RENDER PRODUCTS ====================
  
  function renderProducts() {
    const container = document.getElementById('productsList');
    if (products.length === 0) {
      container.innerHTML = '<p class="empty-state" style="grid-column: 1/-1;">No hay productos. Agregá el primero.</p>';
      return;
    }

    container.innerHTML = products.map(product => `
      <div class="product-card">
        <h3>${product.name}</h3>
        <p><strong>Categoría:</strong> <span style="color: var(--text-secondary);">${product.category}</span></p>
        <p><strong>Tipo:</strong> <span style="color: var(--text-secondary);">${product.type}</span></p>
        <p style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-light);">
          <strong>Costo Total:</strong> 
          <span style="color: var(--costos-color); font-size: 1.2rem; font-weight: bold;">
            $${product.costs.total.toLocaleString('es-AR')}
          </span>
        </p>
      </div>
    `).join('');
  }
  
  // ==================== TEMA ====================
  
  const btnTheme = document.getElementById('btnTheme');
  
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
      btnTheme.textContent = isLight ? '☀️' : '🌙';
    });
  }
  
  function loadTheme() {
    if (localStorage.getItem('theme') === 'light') {
      document.body.classList.add('light-theme');
      if (btnTheme) btnTheme.textContent = '☀️';
    }
  }
  
  loadTheme();
  
  // ==================== INICIALIZAR ====================
  
  loadProducts();
  console.log('✅ Módulo Costos cargado completamente');
  
});
