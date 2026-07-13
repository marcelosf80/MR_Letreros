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
    const targetList = document.getElementById('terceroServicesList');
    if (!targetList) return;

    // Buscar contenedor padre
    let container = targetList.closest('.card');
    if (!container) container = targetList.closest('.form-section');
    
    if (!container) return;

    // Evitar doble inyección
    if (document.getElementById('multiCategoryContainer')) return;

    const uiHTML = `
        <div id="multiCategoryContainer" class="form-section" style="border-left: 4px solid var(--primary-color); background: rgba(255, 140, 66, 0.05); margin-bottom: 2rem; padding: 1.5rem; border-radius: 10px; border: 1px solid var(--border-color);">
            <div class="section-header" style="margin-bottom: 1rem;">
                <h3 style="display: flex; align-items: center; gap: 8px;">📏 Categorías y Medidas</h3>
            </div>
            
            <!-- Fila 1: MATERIAL (Pasa arriba por pedido del usuario) -->
            <div class="form-row" style="margin-bottom: 0.8rem; gap: 10px;">
                <div class="form-group" style="flex: 1;">
                    <label class="form-label" style="font-weight: 600; color: var(--primary-color);">Categoría</label>
                    <select id="mcCategorySelect" class="form-select" onchange="filterMcProducts()" style="border: 1px solid var(--primary-color);">
                        <option value="">Cargando...</option>
                    </select>
                </div>
                <div class="form-group" style="flex: 1.5;">
                    <label class="form-label" style="font-weight: 600; color: var(--primary-color);">Producto / Material</label>
                    <select id="mcProductSelect" class="form-select" onchange="selectMcProduct()" style="border: 1px solid var(--primary-color);">
                        <option value="">Selecciona categoría...</option>
                    </select>
                </div>
            </div>

            <!-- Fila 2: UNIDADES Y PRECIO (Caja destacada) -->
            <div class="form-row" style="align-items: end; background: rgba(0,0,0,0.15); padding: 15px; border-radius: 8px; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.1);">
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Unidad</label>
                    <select id="mcUnitSelect" class="form-select" onchange="onMcUnitChange()">
                        <option value="m2">m²</option>
                        <option value="ml">ml</option>
                        <option value="unidad">unid</option>
                    </select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label class="form-label" id="lblMcMeasure">Medida/Cant</label>
                    <input type="number" id="mcMeasure" class="form-input" placeholder="1.00" step="0.01">
                </div>
                <div class="form-group" style="flex: 1.2;">
                    <label class="form-label">Precio Unit ($)</label>
                    <input type="number" id="mcPrice" class="form-input" placeholder="0.00">
                    <input type="hidden" id="mcCost">
                    <input type="hidden" id="mcName">
                </div>
                <div class="form-group">
                    <button class="btn btn-primary" onclick="addMultiCategory()" style="width: 100%; height: 38px; font-weight: bold; background: var(--primary-color);">➕ Agregar</button>
                </div>
            </div>

            <!-- Fila 3: DIMENSIONES COMPARTIDAS (Pasan abajo) -->
            <div class="form-row" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px dashed rgba(255,255,255,0.2);">
                <div style="width: 100%; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">📐 Dimensiones Globales (Para m² y ml)</div>
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Ancho (cm)</label>
                    <input type="number" id="mcWidth" class="form-input" step="0.01" placeholder="0.00">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Alto (cm)</label>
                    <input type="number" id="mcHeight" class="form-input" step="0.01" placeholder="0.00">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Total m²</label>
                    <input type="number" id="mcTotalM2" class="form-input" readonly style="background: rgba(0,0,0,0.2); font-weight: bold;">
                </div>
            </div>

            <!-- Lista de Materiales Agregados -->
            <div id="mcList" style="margin-bottom: 1rem; max-height: 400px; overflow-y: auto;"></div>

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
            const costo = p.costo || p.costoTotal || 0;
            const unidad = p.unidad || p.unit || 'm2';
            return `<option value="${p.id}" data-price="${precio}" data-cost="${costo}" data-unit="${unidad}">${p.name || p.producto}</option>`;
        }).join('');
};

window.selectMcProduct = function() {
    const select = document.getElementById('mcProductSelect');
    const option = select.options[select.selectedIndex];
    
    if (option && option.value) {
        document.getElementById('mcName').value = option.text;
        document.getElementById('mcPrice').value = option.dataset.price;
        document.getElementById('mcCost').value = option.dataset.cost;
        
        // Detectar unidad según fue guardada en el material
        let savedUnit = option.dataset.unit;
        
        // Refinado: Si no tiene unidad en precios, buscar en listaCostos (materiales)
        if (!savedUnit || savedUnit === 'undefined' || savedUnit === 'm2') {
            const nombreNormalizado = option.text.toLowerCase().trim();
            const mat = (window.listaCostos || []).find(m => 
                (m.name || m.producto || '').toLowerCase().trim() === nombreNormalizado
            );
            if (mat && (mat.unit || mat.unidad)) {
                savedUnit = mat.unit || mat.unidad;
            }
        }
        
        // Normalizar unidad
        if (savedUnit === 'm²') savedUnit = 'm2';
        if (!savedUnit) savedUnit = 'm2';

        const unitSelect = document.getElementById('mcUnitSelect');
        if (unitSelect) unitSelect.value = savedUnit;
        
        onMcUnitChange();
    }
};

window.onMcUnitChange = function() {
    const unit = document.getElementById('mcUnitSelect').value;
    const measureInput = document.getElementById('mcMeasure');
    const lbl = document.getElementById('lblMcMeasure');
    
    const w = parseFloat(document.getElementById('mcWidth').value) || 0;
    const h = parseFloat(document.getElementById('mcHeight').value) || 0;
    const totalM2 = (w * h) / 10000; // Estaba en CM, convertimos a M2
    
    if (unit === 'm2') {
        lbl.innerText = 'Total m²';
        measureInput.value = totalM2.toFixed(4);
    } else if (unit === 'ml') {
        lbl.innerText = 'Metros Lin.';
        measureInput.value = (w / 100).toFixed(2); // Por defecto el ancho en metros
    } else {
        lbl.innerText = 'Cantidad';
        measureInput.value = "1";
    }
};

window.selectMcTercero = function() {
    const select = document.getElementById('mcTerceroSelect');
    const option = select.options[select.selectedIndex];
    
    if (option && option.value !== "") {
        document.getElementById('mcTerceroPrice').value = option.dataset.price;
    } else {
        document.getElementById('mcTerceroPrice').value = "";
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
    
    // Sincronizar campo de medida si está en m2
    if (document.getElementById('mcUnitSelect')?.value === 'm2') {
        onMcUnitChange();
    }
    
    renderMultiCategories();
    if(window.calculateTotals) window.calculateTotals();
};

// Copiamos las funciones base de gremio-extensions-v2.js para que estén disponibles aquí también
window.addMultiCategory = function() {
    const nameEl = document.getElementById('mcName');
    const prodSelect = document.getElementById('mcProductSelect');
    const priceEl = document.getElementById('mcPrice');
    const costEl = document.getElementById('mcCost');
    const unitEl = document.getElementById('mcUnitSelect');
    const measureEl = document.getElementById('mcMeasure');

    if(!priceEl || !unitEl || !measureEl) {
        console.error('[CLIENTES] Missing UI elements for addMultiCategory');
        return;
    }

    const name = nameEl?.value || prodSelect?.options[prodSelect.selectedIndex]?.text;
    const price = parseFloat(priceEl.value);
    const cost = parseFloat(costEl?.value) || 0;
    const unit = unitEl.value;
    const measure = parseFloat(measureEl.value);

    if (name && price >= 0) {
        window.multiCategoryManager.addCategory({ 
            name, 
            pricePerM2: price, 
            costPerM2: cost,
            unit: unit,
            m2: measure 
        });
        
        renderMultiCategories();
        if(window.calculateTotals) window.calculateTotals();
        
        // Limpiar para el próximo producto
        if (prodSelect) prodSelect.value = '';
        if (nameEl) nameEl.value = '';
    } else {
        alert('Selecciona un producto y verifica el precio');
    }
};

// Se registra como GASTO (no se suma al presupuesto del cliente)
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

    // Agregar al sistema de terceros como GASTO (NO al multiCategoryManager)
    const servicioAgregado = {
        id: Date.now().toString(),
        tipo: 'tercero',
        empresa: tercero.empresaNombre,
        nombre: tercero.nombre,
        servicio: tercero.nombre,
        categoria: tercero.categoria || '',
        unidad: 'm²',
        cantidad: sharedDims.totalM2,
        m2: sharedDims.totalM2,
        costo: tercero.costo,
        precio: tercero.precio,
        totalCosto: sharedDims.totalM2 * tercero.costo,
        total: sharedDims.totalM2 * tercero.costo,
        margenPorUnidad: (tercero.precio - tercero.costo)
    };

    // SIEMPRE agregar a currentQuoteTerceros (es lo que saveQuote guarda)
    if (typeof currentQuoteTerceros !== 'undefined') {
        currentQuoteTerceros.push(servicioAgregado);
    } else if (window.currentQuoteTerceros) {
        window.currentQuoteTerceros.push(servicioAgregado);
    }

    // Renderizar en la UI de terceros
    if (typeof renderTerceros === 'function') {
        renderTerceros();
    } else if (window.tercerosTerceroService) {
        window.tercerosTerceroService.serviciosAgregados.push(servicioAgregado);
        window.tercerosTerceroService.renderServicios();
        window.tercerosTerceroService.updateTotales();
    }

    // Resetear selector
    select.value = "";
    document.getElementById('mcTerceroPrice').value = "";

    alert(`✅ Servicio "${tercero.nombre}" agregado como gasto (${sharedDims.totalM2.toFixed(2)}m² × $${tercero.costo} = $${servicioAgregado.totalCosto.toFixed(2)})`);
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
    const totalM2 = window.multiCategoryManager.sharedDimensions?.totalM2 || 0;
    
    // Cálculo de planchas: ceil(totalM2 / 12) — 12 ML por plancha
    const planchas = totalM2 > 0 ? Math.ceil(totalM2 / 12) : 0;
    const planchaLabel = planchas > 0 ? `📦 ${planchas} plancha${planchas > 1 ? 's' : ''}` : '';
    
    const fmt = (num) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    
    let html = cats.map(c => {
        const unitLabel = c.unit === 'ml' ? 'ml' : c.unit === 'unidad' ? 'unid' : 'm²';
        return `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; background: rgba(255,255,255,0.05); padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 4px; overflow: hidden;">
            <span style="flex: 1; min-width: 0; word-wrap: break-word;">${c.name} <span style="font-size: 0.8rem; opacity: 0.7;">($${fmt(c.pricePerM2)}/${unitLabel} · ${c.m2} ${unitLabel})</span>${planchaLabel ? ` <span style="font-size: 0.75rem; color: #FFA726; background: rgba(255,167,38,0.15); padding: 1px 6px; border-radius: 4px; white-space: nowrap;">${planchaLabel}</span>` : ''}</span>
            <span style="white-space: nowrap; text-align: right;"><strong>$${fmt(c.totalPrice)}</strong> <button onclick="window.multiCategoryManager.removeCategory('${c.id}'); renderMultiCategories(); window.calculateTotals();" style="background:none;border:none;cursor:pointer;color:#FF6B6B; margin-left: 5px;">🗑️</button></span>
        </div>
    `}).join('');

    if(window.multiCategoryManager.inkPriceEnabled) {
        html += `<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(33,150,243,0.1); padding: 0.5rem; border-radius: 4px; color: #2196F3;">
            <span>🎨 Tinta</span><span style="white-space: nowrap;"><strong>$${fmt(ink.totalPrice)}</strong></span>
        </div>`;
    }
    list.innerHTML = html;
};