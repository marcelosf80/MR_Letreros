/**
 * CLIENTES Extensions V2
 * Integra MultiCategoryManager y WorkManager en el sistema de Clientes
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Managers si no existen
    if (!window.multiCategoryManager && window.MultiCategoryManager) window.multiCategoryManager = new MultiCategoryManager();
    if (!window.workManager && window.WorkManager) window.workManager = new WorkManager();
    if (!window.quoteEditor && window.QuoteEditor) window.quoteEditor = new QuoteEditor(window.mrDataManager);
    
    // Inyectar UI
    injectMultiCategoryUI();

    // Poblar selectores
    setTimeout(populateMultiCategorySelectors, 1000);
    setTimeout(populateMultiCategorySelectors, 3000);
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
        <div id="multiCategoryContainer" class="form-section" style="border-left: 4px solid var(--primary-color); background: rgba(255, 140, 66, 0.05); margin-bottom: 2rem; padding: 1.5rem; border-radius: 10px; border: 1px solid var(--border-color);">
            <div class="section-header">
                <h3>📏 Categorías Múltiples y Medidas</h3>
            </div>
            
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

            <!-- Agregar Material -->
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
                    <input type="hidden" id="mcName">
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

            <!-- Terceros -->
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
    `;

    const div = document.createElement('div');
    div.innerHTML = uiHTML;
    
    // Insertar ANTES de la sección de productos
    container.parentNode.insertBefore(div, container);

    // Event Listeners
    ['mcWidth', 'mcHeight'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateDimensions);
    });
}

// ==================== LÓGICA DE POBLADO (CLIENTES) ====================

window.populateMultiCategorySelectors = async function() {
    // 1. Categorías
    const catSelect = document.getElementById('mcCategorySelect');
    if (catSelect) {
        let categorias = [];
        
        // A. Cargar desde API
        try {
            const response = await fetch('/api/categorias');
            if (response.ok) {
                const savedCats = await response.json();
                if (Array.isArray(savedCats)) categorias = [...savedCats];
            }
        } catch (e) { console.warn('Error cargando categorías API:', e); }

        // B. Cargar desde productos
        const sourceData = window.preciosClientes || [];
        if (sourceData.length > 0) {
            const productCats = sourceData.map(p => p.category || p.categoria).filter(Boolean);
            categorias = [...new Set([...categorias, ...productCats])];
        }
        
        categorias.sort();
        
        catSelect.innerHTML = '<option value="">Seleccionar categoría...</option>' + 
            categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    // 2. Tintas
    const sourceData = window.preciosClientes || [];
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
                    const precio = p.priceCliente || p.precioCliente || p.pricePublico || 0;
                    return `<option value="${idx}" data-price="${precio}">${p.name || p.producto}</option>`;
                }).join('');
        }
    }

    // 3. Terceros
    const sourceTerceros = window.terceros || [];
    if (sourceTerceros.length > 0) {
        const tercSelect = document.getElementById('mcTerceroSelect');
        if (tercSelect) {
            tercSelect.innerHTML = '<option value="">Seleccionar Servicio...</option>' + 
                sourceTerceros.map((t, idx) => {
                    return `<option value="${idx}" data-price="${t.precio}">${t.nombre} (${t.empresaNombre})</option>`;
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

    const sourceData = window.preciosClientes || [];
    const productos = sourceData.filter(p => (p.category === cat || p.categoria === cat));
    prodSelect.innerHTML = '<option value="">Seleccionar producto...</option>' + 
        productos.map((p, idx) => {
            const precio = p.priceCliente || p.precioCliente || p.pricePublico || 0;
            return `<option value="${p.id}" data-price="${precio}">${p.name || p.producto}</option>`;
        }).join('');
};

window.selectMcProduct = function() {
    const select = document.getElementById('mcProductSelect');
    const option = select.options[select.selectedIndex];
    if (option && option.value) {
        document.getElementById('mcName').value = option.text;
        document.getElementById('mcPrice').value = option.dataset.price;
    }
};

window.selectInkProduct = function() {
    const select = document.getElementById('mcInkSelect');
    const option = select.options[select.selectedIndex];
    if (option && option.value) {
        document.getElementById('mcInkPrice').value = option.dataset.price;
        window.updateInk();
    }
};

// Funciones Globales (Reutilizando lógica de Gremio pero adaptada)
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

// Copiamos las funciones base de gremio-extensions-v2.js para que estén disponibles aquí también
window.addMultiCategory = window.addMultiCategory || function() {
    // (Lógica idéntica a gremio, se cargará si gremio-extensions-v2 ya definió esto, sino lo definimos)
    // Para asegurar consistencia, mejor definimos explícitamente:
    const name = document.getElementById('mcName').value || document.getElementById('mcProductSelect').options[document.getElementById('mcProductSelect').selectedIndex]?.text;
    const price = document.getElementById('mcPrice').value;
    if(name && price) {
        window.multiCategoryManager.addCategory({ name, pricePerM2: price, costPerM2: 0 }); // Costo 0 en clientes por defecto
        renderMultiCategories();
        if(window.calculateTotals) window.calculateTotals();
    } else {
        alert('Selecciona un producto o ingresa nombre y precio');
    }
};

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

    window.multiCategoryManager.addCategory({
        id: 'tercero_' + Date.now(),
        name: `🔧 ${tercero.nombre} (${tercero.empresaNombre})`,
        pricePerM2: tercero.precio,
        costPerM2: 0 // Oculto en clientes
    });

    renderMultiCategories();
    if(window.calculateTotals) window.calculateTotals();
};

window.toggleInk = window.toggleInk || function() {
    const checked = document.getElementById('mcInkCheck').checked;
    document.getElementById('mcInkContainer').style.display = checked ? 'flex' : 'none';
    window.updateInk();
};

window.updateInk = window.updateInk || function() {
    const checked = document.getElementById('mcInkCheck').checked;
    const price = document.getElementById('mcInkPrice').value;
    window.multiCategoryManager.setInkPrice(checked, price);
    renderMultiCategories();
    if(window.calculateTotals) window.calculateTotals();
};

window.renderMultiCategories = window.renderMultiCategories || function() {
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