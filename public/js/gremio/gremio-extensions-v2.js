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
    const targetList = document.getElementById('terceroServicesList');
    if (!targetList) return;

    // Buscar contenedor padre
    let container = targetList.closest('.card');
    if (!container) container = targetList.closest('.form-section');
    
    if (!container) return;

    // Evitar doble inyección
    if (document.getElementById('multiCategoryContainer')) return;

    const uiHTML = `
        <div id="multiCategoryContainer" class="card" style="margin-bottom: 2rem; border-left: 4px solid var(--primary-color);">
            <div class="card-header">
                <h2 class="card-title">📏 Categorías y Medidas</h2>
            </div>
            <div class="card-body">
                <!-- Fila 1: Selección de Material -->
                <div class="form-row" style="margin-bottom: 1rem;">
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label">Categoría</label>
                        <select id="mcCategorySelect" class="form-select" onchange="filterMcProducts()">
                            <option value="">Cargando...</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex: 1.5;">
                        <label class="form-label">Producto / Material</label>
                        <select id="mcProductSelect" class="form-select" onchange="selectMcProduct()">
                            <option value="">Selecciona categoría...</option>
                        </select>
                    </div>
                </div>

                <!-- Fila 2: Configuración de Medida y Precio (Destacada) -->
                <div class="form-row" style="background: rgba(81, 207, 102, 0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; align-items: end; border: 1px solid rgba(81, 207, 102, 0.3);">
                    <div class="form-group" style="flex: 0.8;">
                        <label class="form-label">Unidad</label>
                        <select id="mcUnitSelect" class="form-select" onchange="onMcUnitChange()" style="font-weight: bold;">
                            <option value="m2">m²</option>
                            <option value="ml">ml</option>
                            <option value="unidad">unid</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label" id="mcMeasureLabel">Medida (m²)</label>
                        <input type="number" id="mcMeasure" class="form-input" step="0.0001" placeholder="0.0000" style="font-weight: bold; font-size: 1.1rem;">
                    </div>
                    <div class="form-group" style="flex: 1.2;">
                        <label class="form-label">Precio Unit ($)</label>
                        <input type="number" id="mcPrice" class="form-input" placeholder="0.00">
                        <input type="hidden" id="mcCost">
                        <input type="hidden" id="mcName">
                    </div>
                    <div class="form-group" style="flex: 0.5;">
                        <button class="btn btn-success" onclick="addMultiCategory()" style="width: 100%; height: 42px; font-size: 1.2rem;">➕</button>
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
    // 0. Cargar precios desde /api/precios
    if (!window.preciosGremio || window.preciosGremio.length === 0) {
        try {
            if (window.mrDataManager) {
                window.preciosGremio = await window.mrDataManager.getPrecios() || [];
            } else {
                const res = await fetch('/api/precios');
                if (res.ok) window.preciosGremio = await res.json();
            }
        } catch (e) {
            console.warn('[GREMIO] Error cargando precios:', e);
        }
    }

    const sourceData = window.preciosGremio || [];

    // 1. Poblar Categorías de Materiales
    const catSelect = document.getElementById('mcCategorySelect');
    if (catSelect) {
        let categorias = [];
        
        // A. Cargar categorías guardadas del servidor
        try {
            const response = await fetch('/api/categorias');
            if (response.ok) {
                const savedCats = await response.json();
                if (Array.isArray(savedCats)) categorias = [...savedCats];
            }
        } catch (e) { console.warn('Error cargando categorías API:', e); }

        // B. Combinar con categorías de precios.html
        if (sourceData.length > 0) {
            const productCats = sourceData.map(p => p.category || p.categoria).filter(Boolean);
            categorias = [...new Set([...categorias, ...productCats])];
        }
        
        categorias.sort();
        
        catSelect.innerHTML = '<option value="">Seleccionar categoría...</option>' + 
            categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    // 2. Poblar Tintas
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
                    const precio = p.precioGremio || p.priceGremio || p.precioCliente || 0;
                    return `<option value="${idx}" data-price="${precio}">${p.producto || p.name}</option>`;
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
    const catSelect = document.getElementById('mcCategorySelect');
    if (!catSelect) return;
    const cat = catSelect.value;
    const prodSelect = document.getElementById('mcProductSelect');
    if (!prodSelect) return;
    
    if (!cat) {
        prodSelect.innerHTML = '<option value="">Selecciona categoría...</option>';
        return;
    }

    const sourceData = (window.preciosGremio && window.preciosGremio.length > 0) 
        ? window.preciosGremio 
        : (window.preciosClientes || []);

    const catLower = cat.trim().toLowerCase();
    const productos = sourceData.filter(p => {
        const pCat = (p.categoria || p.category || '').trim().toLowerCase();
        return pCat === catLower;
    });

    if (productos.length === 0) {
        prodSelect.innerHTML = '<option value="">No hay productos en esta categoría</option>';
        return;
    }

    prodSelect.innerHTML = '<option value="">Seleccionar producto...</option>' + 
        productos.map((p, idx) => {
            const priceGremio = parseFloat(p.precioGremio || p.priceGremio || p.precioCliente || p.precio || 0);
            const costo = parseFloat(p.costo || p.costoTotal || 0);
            const unidad = p.unidad || p.unit || 'm2';
            const nombre = p.producto || p.name || p.productoNombre || 'Producto';
            
            return `<option value="${p.id || idx}" data-price="${priceGremio}" data-cost="${costo}" data-unit="${unidad}">${nombre}</option>`;
        }).join('');
};

window.selectMcProduct = function() {
    const select = document.getElementById('mcProductSelect');
    if (!select) return;
    const option = select.options[select.selectedIndex];
    
    if (option && option.value) {
        document.getElementById('mcName').value = option.text;
        document.getElementById('mcPrice').value = option.dataset.price || 0;
        document.getElementById('mcCost').value = option.dataset.cost || 0;

        let detectedUnit = 'm2';
        const prodName = option.text.toLowerCase();
        
        const allMaterials = window.listaCostos || [];
        const materialData = allMaterials.find(m => (m.name || m.producto || '').toLowerCase() === prodName);
        
        if (materialData && materialData.unit) {
            const u = materialData.unit.toLowerCase();
            if (u.includes('ml') || u.includes('lineal')) detectedUnit = 'ml';
            else if (u.includes('unid') || u.includes('hoja') || u.includes('placa')) detectedUnit = 'unidad';
        } else if (prodName.includes('ml') || prodName.includes('lineal')) {
            detectedUnit = 'ml';
        } else if (prodName.includes('unidad') || prodName.includes('unid') || prodName.includes('u.')) {
            detectedUnit = 'unidad';
        }

        const unitSelect = document.getElementById('mcUnitSelect');
        if (unitSelect) {
            unitSelect.value = detectedUnit;
            onMcUnitChange();
        }
    }
};

window.onMcUnitChange = function() {
    const unit = document.getElementById('mcUnitSelect').value;
    const measureLabel = document.getElementById('mcMeasureLabel');
    const measureInput = document.getElementById('mcMeasure');
    const totalM2 = parseFloat(document.getElementById('mcTotalM2').value) || 0;

    if (unit === 'm2') {
        measureLabel.textContent = 'Medida (m²)';
        measureInput.value = totalM2.toFixed(4);
    } else if (unit === 'ml') {
        measureLabel.textContent = 'Medida (ml)';
        const w = parseFloat(document.getElementById('mcWidth').value) || 0;
        const h = parseFloat(document.getElementById('mcHeight').value) || 0;
        measureInput.value = ((w || h) / 100).toFixed(2);
    } else {
        measureLabel.textContent = 'Cantidad (unid)';
        measureInput.value = 1;
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
    const nameEl = document.getElementById('mcName');
    const prodSelect = document.getElementById('mcProductSelect');
    const priceEl = document.getElementById('mcPrice');
    const costEl = document.getElementById('mcCost');
    const unitEl = document.getElementById('mcUnitSelect');
    const measureEl = document.getElementById('mcMeasure');

    if(!priceEl || !unitEl || !measureEl) return;

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

// Función para agregar terceros usando las medidas compartidas
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
        // FIX: cobrar al cliente el PRECIO (no el costo) → antes margen cero
        total: sharedDims.totalM2 * (tercero.precio || tercero.costo),
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
    
    let html = cats.map(c => {
        const unitLabel = c.unit === 'ml' ? 'ml' : c.unit === 'unidad' ? 'unid' : 'm²';
        return `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; background: rgba(255,255,255,0.05); padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 4px; overflow: hidden; border-left: 3px solid #51CF66;">
                <span style="flex: 1; min-width: 0; word-wrap: break-word;">${c.name} <span style="font-size: 0.8rem; opacity: 0.7;">($${fmt(c.pricePerM2)}/${unitLabel} · ${c.m2} ${unitLabel})</span></span>
                <span style="white-space: nowrap; text-align: right;"><strong>$${fmt(c.totalPrice)}</strong> <button onclick="window.multiCategoryManager.removeCategory('${c.id}'); renderMultiCategories(); window.calculateTotals();" style="background:none;border:none;cursor:pointer;color:#FF6B6B; margin-left: 5px;">🗑️</button></span>
            </div>
        `;
    }).join('');

    if(window.multiCategoryManager.inkPriceEnabled) {
        html += `<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(33,150,243,0.1); padding: 0.5rem; border-radius: 4px; color: #2196F3; border-left: 3px solid #2196F3; margin-top: 5px;">
            <span>🎨 Tinta</span><span style="white-space: nowrap;"><strong>$${fmt(ink.totalPrice)}</strong></span>
        </div>`;
    }
    list.innerHTML = html;
};