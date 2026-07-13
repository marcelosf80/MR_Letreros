/**
 * Multi-Category Manager - Gestión de Múltiples Categorías con Medida Compartida
 * Permite agregar múltiples categorías que comparten la misma medida (ancho x alto)
 * pero tienen costos independientes por categoría
 * 
 * @version 1.0.0
 * @author MR Letreros Team
 */

class MultiCategoryManager {
    constructor() {
        this.categories = [];
        this.sharedDimensions = {
            width: 0,
            height: 0,
            totalM2: 0
        };
        this.inkPriceEnabled = true; // Por defecto activo
        this.inkPricePerM2 = 0;
    }

    /**
     * Establece las dimensiones compartidas para todas las categorías
     * @param {number} width - Ancho en metros
     * @param {number} height - Alto en metros
     */
    setSharedDimensions(width, height) {
        this.sharedDimensions.width = parseFloat(width) || 0;
        this.sharedDimensions.height = parseFloat(height) || 0;
        this.sharedDimensions.totalM2 = this.sharedDimensions.width * this.sharedDimensions.height;

        console.log('[MULTI-CAT] Dimensiones actuales en panel:', this.sharedDimensions);
    }

    /**
     * Obtiene las dimensiones compartidas
     * @returns {Object}
     */
    getSharedDimensions() {
        return { ...this.sharedDimensions };
    }

    /**
     * Agrega una nueva categoría
     * @param {Object} categoryData - { id, name, costPerM2, pricePerM2 }
     * @returns {Object} - Categoría agregada con cálculos
     */
    addCategory(categoryData) {
        const category = {
            id: categoryData.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: categoryData.name || 'Sin nombre',
            costPerM2: parseFloat(categoryData.costPerM2) || 0,
            pricePerM2: parseFloat(categoryData.pricePerM2) || 0,
            width: categoryData.width || this.sharedDimensions.width,
            height: categoryData.height || this.sharedDimensions.height,
            frozenM2: categoryData.m2 !== undefined ? parseFloat(categoryData.m2) : this.sharedDimensions.totalM2,
            unit: categoryData.unit || 'm2'
        };
        Object.assign(category, this.calculateCategoryTotals(document.getElementById('mcWidth')?.value, category));

        this.categories.push(category);
        console.log('[MULTI-CAT] Categoría agregada:', category.name);
        return category;
    }

    /**
     * Calcula totales para una categoría
     * @param {number} costPerM2
     * @param {number} pricePerM2
     * @returns {Object} - { totalCost, totalPrice, margin }
     */
    calculateCategoryTotals(dummy, catObj) {
        // Soporte de compatibilidad para llamadas antiguas
        let cost = catObj.costPerM2;
        let price = catObj.pricePerM2;
        let m2 = catObj.frozenM2 || this.sharedDimensions.totalM2;

        if (arguments.length === 2 && typeof catObj === 'number') {
            cost = arguments[0];
            price = arguments[1];
            m2 = this.sharedDimensions.totalM2;
        }

        const totalCost = cost * m2;
        const totalPrice = price * m2;
        const margin = totalPrice - totalCost;

        return {
            totalCost: parseFloat(totalCost.toFixed(2)),
            totalPrice: parseFloat(totalPrice.toFixed(2)),
            margin: parseFloat(margin.toFixed(2)),
            m2: parseFloat(m2.toFixed(4)),
            unit: catObj.unit || 'm2'
        };
    }

    /**
     * Recalcula todas las categorías (Deprecado, las dimensiones ya no son compartidas reactivamente)
     */
    recalculateAllCategories() {
        // No hacemos nada para que los productos agregados mantengan sus medidas iniciales
    }

    /**
     * Elimina una categoría por ID
     * @param {string} categoryId
     * @returns {boolean}
     */
    removeCategory(categoryId) {
        const initialLength = this.categories.length;
        this.categories = this.categories.filter(cat => cat.id !== categoryId);
        const removed = this.categories.length < initialLength;

        if (removed) {
            console.log('[MULTI-CAT] Categoría eliminada:', categoryId);
        }

        return removed;
    }

    /**
     * Actualiza una categoría existente
     * @param {string} categoryId
     * @param {Object} updates
     * @returns {Object|null}
     */
    updateCategory(categoryId, updates) {
        const index = this.categories.findIndex(cat => cat.id === categoryId);

        if (index === -1) return null;

        const cat = this.categories[index];
        const updatedCat = {
            ...cat,
            name: updates.name !== undefined ? updates.name : cat.name,
            costPerM2: updates.costPerM2 !== undefined ? parseFloat(updates.costPerM2) : cat.costPerM2,
            pricePerM2: updates.pricePerM2 !== undefined ? parseFloat(updates.pricePerM2) : cat.pricePerM2,
            unit: updates.unit !== undefined ? updates.unit : cat.unit,
            frozenM2: updates.m2 !== undefined ? parseFloat(updates.m2) : cat.frozenM2
        };

        // Recalcular totales con su M2 preservado
        Object.assign(updatedCat, this.calculateCategoryTotals(null, updatedCat));

        this.categories[index] = updatedCat;
        console.log('[MULTI-CAT] Categoría actualizada:', updatedCat.name);

        return updatedCat;
    }

    /**
     * Obtiene todas las categorías
     * @returns {Array}
     */
    getCategories() {
        return [...this.categories];
    }

    /**
     * Limpia todas las categorías
     */
    clearCategories() {
        this.categories = [];
        console.log('[MULTI-CAT] Categorías limpiadas');
    }

    /**
     * Configura el precio de la tinta
     * @param {boolean} enabled
     * @param {number} pricePerM2
     */
    setInkPrice(enabled, pricePerM2 = 0) {
        this.inkPriceEnabled = enabled;
        this.inkPricePerM2 = parseFloat(pricePerM2) || 0;
        console.log('[MULTI-CAT] Precio tinta:', enabled ? `$${this.inkPricePerM2}/m²` : 'Desactivado');
    }

    /**
     * Calcula el costo/precio total de la tinta
     * @returns {Object} - { totalCost, totalPrice }
     */
    calculateInkTotals() {
        if (!this.inkPriceEnabled) {
            return { totalCost: 0, totalPrice: 0 };
        }

        const m2 = this.sharedDimensions.totalM2;
        const totalPrice = this.inkPricePerM2 * m2;

        return {
            totalCost: 0, // La tinta generalmente no tiene costo para nosotros en este contexto
            totalPrice: parseFloat(totalPrice.toFixed(2))
        };
    }

    /**
     * Calcula totales generales de todas las categorías
     * @returns {Object}
     */
    calculateGrandTotals() {
        const categoryTotals = this.categories.reduce((acc, cat) => ({
            totalCost: acc.totalCost + cat.totalCost,
            totalPrice: acc.totalPrice + cat.totalPrice
        }), { totalCost: 0, totalPrice: 0 });

        const inkTotals = this.calculateInkTotals();

        const grandTotalCost = categoryTotals.totalCost + inkTotals.totalCost;
        const grandTotalPrice = categoryTotals.totalPrice + inkTotals.totalPrice;
        const grandMargin = grandTotalPrice - grandTotalCost;

        return {
            categories: {
                count: this.categories.length,
                totalCost: parseFloat(categoryTotals.totalCost.toFixed(2)),
                totalPrice: parseFloat(categoryTotals.totalPrice.toFixed(2))
            },
            ink: {
                enabled: this.inkPriceEnabled,
                totalPrice: inkTotals.totalPrice
            },
            grand: {
                totalCost: parseFloat(grandTotalCost.toFixed(2)),
                totalPrice: parseFloat(grandTotalPrice.toFixed(2)),
                margin: parseFloat(grandMargin.toFixed(2))
            },
            dimensions: this.sharedDimensions
        };
    }

    /**
     * Genera HTML para mostrar el resumen de categorías
     * @returns {string}
     */
    generateSummaryHTML() {
        if (this.categories.length === 0) {
            return '<p class="empty-state">No hay categorías agregadas</p>';
        }

        const categoriesHTML = this.categories.map(cat => `
            <div class="category-item" style="
                padding: 1rem;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                margin-bottom: 0.5rem;
                border: 1px solid rgba(255, 255, 255, 0.1);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <strong style="color: #51CF66;">${cat.name}</strong>
                    <button class="btn btn-small btn-secondary" onclick="removeCategory('${cat.id}')" style="padding: 0.25rem 0.5rem;">
                        🗑️
                    </button>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; font-size: 0.9rem;">
                    <div>
                        <span style="color: var(--text-secondary);">Costo/m²:</span>
                        <strong style="color: #FF6B6B;">$${cat.costPerM2.toFixed(2)}</strong>
                    </div>
                    <div>
                        <span style="color: var(--text-secondary);">Precio/m²:</span>
                        <strong style="color: #51CF66;">$${cat.pricePerM2.toFixed(2)}</strong>
                    </div>
                    <div>
                        <span style="color: var(--text-secondary);">Medida:</span>
                        <strong style="color: #fff;">${cat.m2} ${cat.unit || 'm2'}</strong>
                    </div>
                    <div>
                        <span style="color: var(--text-secondary);">Costo Total:</span>
                        <strong style="color: #FF6B6B;">$${cat.totalCost.toFixed(2)}</strong>
                    </div>
                    <div>
                        <span style="color: var(--text-secondary);">Precio Total:</span>
                        <strong style="color: #51CF66;">$${cat.totalPrice.toFixed(2)}</strong>
                    </div>
                </div>
            </div>
        `).join('');

        const inkHTML = this.inkPriceEnabled ? `
            <div class="category-item" style="
                padding: 1rem;
                background: rgba(33, 150, 243, 0.1);
                border-radius: 8px;
                margin-bottom: 0.5rem;
                border: 1px solid rgba(33, 150, 243, 0.3);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color: #2196F3;">🎨 Tinta</strong>
                    <div>
                        <span style="color: var(--text-secondary);">Precio Total:</span>
                        <strong style="color: #2196F3;">$${this.calculateInkTotals().totalPrice.toFixed(2)}</strong>
                    </div>
                </div>
            </div>
        ` : '';

        return categoriesHTML + inkHTML;
    }

    /**
     * Exporta el estado actual para guardar
     * @returns {Object}
     */
    exportState() {
        return {
            categories: this.categories,
            sharedDimensions: this.sharedDimensions,
            inkPriceEnabled: this.inkPriceEnabled,
            inkPricePerM2: this.inkPricePerM2
        };
    }

    /**
     * Importa un estado guardado
     * @param {Object} state
     */
    importState(state) {
        if (!state) return;

        this.categories = state.categories || [];
        this.sharedDimensions = state.sharedDimensions || { width: 0, height: 0, totalM2: 0 };
        this.inkPriceEnabled = state.inkPriceEnabled !== undefined ? state.inkPriceEnabled : true;
        this.inkPricePerM2 = state.inkPricePerM2 || 0;

        console.log('[MULTI-CAT] Estado importado:', {
            categories: this.categories.length,
            dimensions: this.sharedDimensions,
            ink: this.inkPriceEnabled
        });
    }

    /**
     * Valida que haya al menos una categoría y dimensiones válidas
     * @returns {Object} - { valid, errors }
     */
    validate() {
        const errors = [];

        if (this.categories.length === 0) {
            errors.push('Debe agregar al menos una categoría');
        }

        if (this.sharedDimensions.totalM2 <= 0) {
            errors.push('Las dimensiones deben ser mayores a 0');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// Exportar para uso global
window.MultiCategoryManager = MultiCategoryManager;

console.log('[MULTI-CAT] 📦 Módulo cargado');
