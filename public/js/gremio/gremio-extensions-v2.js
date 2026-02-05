/**
 * GREMIO Extensions V2
 * Integra MultiCategoryManager, WorkManager y QuoteEditor
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Managers
    if (!window.multiCategoryManager && window.MultiCategoryManager) window.multiCategoryManager = new MultiCategoryManager();
    if (!window.workManager && window.WorkManager) window.workManager = new WorkManager();
    if (!window.quoteEditor && window.QuoteEditor) window.quoteEditor = new QuoteEditor(window.mrDataManager);
    
    // Inyectar UI
    injectMultiCategoryUI();

    // Intentar poblar selectores si los datos ya están listos, si no, esperar un poco
    setTimeout(populateMultiCategorySelectors, 1000);
    setTimeout(populateMultiCategorySelectors, 3000); // Reintento por si la carga es lenta
    
    // Cargar datos iniciales de trabajos
    window.workManager.getWorks().then(() => console.log('WorkManager listo'));
});

function injectMultiCategoryUI() {
    const productsList = document.getElementById('productsList');
    if (!productsList) return;

    // Buscar contenedor padre (card o form-section)
    let container = productsList.closest('.card');
    if (!container) container = productsList.closest('.form-section');
    
    if (!container) return;

    // Evitar doble inyección
    if (document.getElementById('multiCategoryContainer')) return;

    const uiHTML = `
        <div id="multiCategoryContainer" class="card" style="margin-bottom: 2rem; border-left: 4px solid var(--primary-color);">
            <div class="card-header">
                <h2 class="card-title">📏 Categorías y Medidas</h2>
            </div>
            <div class="card-body">
                <!-- Dimensiones Compartidas -->
                <div class="form-row" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div class="form-group">
                        <label class="form-label">Ancho (cm)</label>
                        <input type="number" id="mcWidth" class="form-input" step="0.01" placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Alto (cm)</label>
                        <input type="number" id="mcHeight" class="form-input" step="0.01" placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Total m²</label>
                        <input type="number" id="mcTotalM2" class="form-input" readonly style="font-weight: bold;">
                    </div>
                </div>

                <!-- Lista Categorías -->
                <div id="mcList" style="margin-bottom: 1rem;"></div>

                <!-- Agregar Material/Producto -->
                <h4 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">📦 Agregar Material</h4>
                <div class="form-row" style="align-items: end;">
                    <div class="form-group">
                        <label class="form-label">Categoría</label>
                        <select id="mcCategorySelect" class="form-select" onchange="filterMcProducts()">
                            <option value="">Cargando...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Producto</label>
                        <select id="mcProductSelect" class="form-select" onchange="selectMcProduct()">
                            <option value="">Selecciona categoría...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Precio/m²</label>
                        <input type="number" id="mcPrice" class="form-input" placeholder="0.00">
                        <input type="hidden" id="mcCost"> <!-- Costo oculto pero funcional -->
                        <input type="hidden" id="mcName"> <!-- Nombre oculto -->
                    </div>
                    <div class="form-group">
                        <button class="btn btn-primary" onclick="addMultiCategory()">➕ Agregar</button>
                    </div>
                </div>

                <!-- Tinta -->
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input type="checkbox" id="mcInkCheck" onchange="toggleInk()"> 
                        🎨 Costo de Tinta
                    </label>
                    <div id="mcInkContainer" style="display: none; margin-top: 0.5rem; gap: 10px; align-items: center;">
                        <select id="mcInkSelect" class="form-select" style="flex: 1;" onchange="selectInkProduct()">
                            <option value="">Seleccionar Tinta...</option>
                        </select>
                        <input type="number" id="mcInkPrice" class="form-input" placeholder="Precio/m²" oninput="updateInk()" style="width: 100px;">
                    </div>
                </div>

                <!-- Terceros con Medida Compartida -->
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                    <h4 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">🔧 Servicios Terceros (Calculado por m² compartidos)</h4>
                    <div class="form-row" style="align-items: end;">
                        <div class="form-group" style="flex: 2;">
                            <select id="mcTerceroSelect" class="form-select" onchange="selectMcTercero()">
                                <option value="">Seleccionar Servicio...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <input type="number" id="mcTerceroPrice" class="form-input" placeholder="Precio" readonly>
                        </div>
                        <div class="form-group">
                            <button class="btn btn-secondary" onclick="addSharedTercero()">➕ Agregar</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = uiHTML;
    container.parentNode.insertBefore(div, container);

    // Event Listeners para dimensiones
    ['mcWidth', 'mcHeight'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateDimensions);
    });
}

// ==================== LÓGICA DE POBLADO DE DATOS ====================

window.populateMultiCategorySelectors = async function() {
    // 1. Poblar Categorías de Materiales
    const catSelect = document.getElementById('mcCategorySelect');
    if (catSelect) {
        let categorias = [];
        
        // A. Intentar cargar categorías guardadas del servidor
        try {
            const response = await fetch('/api/categorias');
            if (response.ok) {
                const savedCats = await response.json();
                if (Array.isArray(savedCats)) categorias = [...savedCats];
            }
        } catch (e) { console.warn('Error cargando categorías API:', e); }

        // B. Combinar con categorías de productos existentes (si ya cargaron)
        const sourceData = window.preciosGremio || [];
        if (sourceData.length > 0) {
            const productCats = sourceData.map(p => p.category || p.categoria).filter(Boolean);
            categorias = [...new Set([...categorias, ...productCats])];
        }
        
        categorias.sort();
        
        catSelect.innerHTML = '<option value="">Seleccionar categoría...</option>' + 
            categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    // 2. Poblar Tintas (Buscar productos que contengan "tinta" en nombre o categoría)
    const sourceData = window.preciosGremio || [];
    if (sourceData.length > 0) {
        const inkSelect = document.getElementById('mcInkSelect');
        if (inkSelect) {
            const tintas = sourceData.filter(p => {
                const nombre = (p.name || p.nombre || p.producto || '').toLowerCase();
                const cat = (p.category || p.categoria || '').toLowerCase();
                return nombre.includes('tinta') || cat.includes('tinta') || cat.includes('impresion');
            });
            
            inkSelect.innerHTML = '<option value="">Seleccionar Tinta...</option>' + 
                tintas.map((p, idx) => {
                    const precio = p.priceGremio || p.precioGremio || 0;
                    return `<option value="${idx}" data-price="${precio}">${p.name || p.producto}</option>`;
                }).join('');
        }
    }

    // 3. Poblar Terceros
    const sourceTerceros = window.terceros || [];
    if (sourceTerceros.length > 0) {
        const tercSelect = document.getElementById('mcTerceroSelect');
        if (tercSelect) {
            tercSelect.innerHTML = '<option value="">Seleccionar Servicio...</option>' + 
                sourceTerceros.map((t, idx) => {
                    return `<option value="${idx}" data-price="${t.precio}" data-cost="${t.costo}">${t.nombre} (${t.empresaNombre})</option>`;
                }).join('');
        }
    }
};

window.filterMcProducts = function() {
    const cat = document.getElementById('mcCategorySelect').value;
    const prodSelect = document.getElementById('mcProductSelect');
    
    if (!cat) {
        prodSelect.innerHTML = '<option value="">Selecciona categoría...</option>';
        return;
    }

    const sourceData = window.preciosGremio || [];
    const productos = sourceData.filter(p => (p.category === cat || p.categoria === cat));
    prodSelect.innerHTML = '<option value="">Seleccionar producto...</option>' + 
        productos.map((p, idx) => {
            // Guardamos el índice global o pasamos el objeto stringificado (menos eficiente)
            // Mejor buscar en el array original filtrado
            return `<option value="${p.id}" data-price="${p.priceGremio || p.precioGremio || 0}" data-cost="${p.costo || 0}">${p.name || p.producto}</option>`;
        }).join('');
};

window.selectMcProduct = function() {
    const select = document.getElementById('mcProductSelect');
    const option = select.options[select.selectedIndex];
    
    if (option && option.value) {
        document.getElementById('mcName').value = option.text;
        document.getElementById('mcPrice').value = option.dataset.price;
        document.getElementById('mcCost').value = option.dataset.cost;
    }
};

window.selectInkProduct = function() {
    const select = document.getElementById('mcInkSelect');
    const option = select.options[select.selectedIndex];
    if (option && option.value) {
        document.getElementById('mcInkPrice').value = option.dataset.price;
        window.updateInk(); // Actualizar cálculo
    }
};

// ==================== LÓGICA DE NEGOCIO ====================

window.updateDimensions = () => {
    const wCm = parseFloat(document.getElementById('mcWidth').value) || 0;
    const hCm = parseFloat(document.getElementById('mcHeight').value) || 0;
    const wM = wCm / 100;
    const hM = hCm / 100;
    window.multiCategoryManager.setSharedDimensions(wM, hM);
    document.getElementById('mcTotalM2').value = window.multiCategoryManager.sharedDimensions.totalM2.toFixed(2);
    renderMultiCategories();
    if(window.calculateTotals) window.calculateTotals();
};

window.addMultiCategory = () => {
    // Usar el nombre del input oculto o el texto manual si se escribió algo
    const name = document.getElementById('mcName').value || document.getElementById('mcProductSelect').options[document.getElementById('mcProductSelect').selectedIndex]?.text;
    const price = document.getElementById('mcPrice').value;
    const cost = document.getElementById('mcCost').value;

    if(name && price) {
        window.multiCategoryManager.addCategory({ name, pricePerM2: price, costPerM2: cost });
        // No limpiamos todo para permitir agregar rápido variantes, solo feedback visual
        renderMultiCategories();
        if(window.calculateTotals) window.calculateTotals();
    } else {
        alert('Selecciona un producto o ingresa nombre y precio');
    }
};

// Función para agregar terceros usando las medidas compartidas
window.addSharedTercero = function() {
    const select = document.getElementById('mcTerceroSelect');
    const idx = select.value;
    
    if (idx === "") {
        alert('Selecciona un servicio de tercero');
        return;
    }

    const sourceTerceros = window.terceros || [];
    const tercero = sourceTerceros[idx];
    const sharedDims = window.multiCategoryManager.getSharedDimensions();
    
    if (sharedDims.totalM2 <= 0) {
        alert('Primero define las medidas (Ancho y Alto)');
        return;
    }

    // Crear un objeto de categoría "ficticio" para el tercero para que entre en el manager
    // O agregarlo directamente a la lista de terceros de la cotización principal
    
    // Opción A: Agregarlo como una categoría más en el MultiCategoryManager (más fácil visualmente aquí)
    window.multiCategoryManager.addCategory({
        id: 'tercero_' + Date.now(),
        name: `🔧 ${tercero.nombre} (${tercero.empresaNombre})`,
        pricePerM2: tercero.precio, // Asumiendo que el precio del tercero es por m² o unidad compatible
        costPerM2: tercero.costo
    });

    renderMultiCategories();
    if(window.calculateTotals) window.calculateTotals();
};

window.toggleInk = () => {
    const checked = document.getElementById('mcInkCheck').checked;
    document.getElementById('mcInkContainer').style.display = checked ? 'flex' : 'none';
    updateInk();
};

window.updateInk = () => {
    const checked = document.getElementById('mcInkCheck').checked;
    const price = document.getElementById('mcInkPrice').value;
    window.multiCategoryManager.setInkPrice(checked, price);
    renderMultiCategories();
    if(window.calculateTotals) window.calculateTotals();
};

window.renderMultiCategories = () => {
    const list = document.getElementById('mcList');
    const cats = window.multiCategoryManager.getCategories();
    const ink = window.multiCategoryManager.calculateInkTotals();
    
    const fmt = (num) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    
    let html = cats.map(c => `
        <div style="display: flex; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 4px;">
            <span>${c.name} ($${fmt(c.pricePerM2)}/m²)</span>
            <span><strong>$${fmt(c.totalPrice)}</strong> <button onclick="window.multiCategoryManager.removeCategory('${c.id}'); renderMultiCategories(); window.calculateTotals();" style="background:none;border:none;cursor:pointer;color:#FF6B6B;">🗑️</button></span>
        </div>
    `).join('');

    if(window.multiCategoryManager.inkPriceEnabled) {
        html += `<div style="display: flex; justify-content: space-between; background: rgba(33,150,243,0.1); padding: 0.5rem; border-radius: 4px; color: #2196F3;">
            <span>🎨 Tinta</span><span><strong>$${fmt(ink.totalPrice)}</strong></span>
        </div>`;
    }
    list.innerHTML = html;
};