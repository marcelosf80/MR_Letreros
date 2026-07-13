/**
 * Pricing Manager - Módulo de Gestión de Precios e IVA
 * Implementa Single Responsibility Principle - maneja solo cálculos de precios
 * 
 * @version 1.0.0
 * @author MR Letreros Team
 */

class PricingManager {
    constructor() {
        this.IVA_RATE = 0.21;
        this.ivaEnabled = true; // Por defecto el IVA está activo
        this.discountRules = [];
    }

    /**
     * Configura si el IVA debe aplicarse
     * @param {boolean} enabled - true para aplicar IVA, false para no aplicar
     */
    setIvaEnabled(enabled) {
        this.ivaEnabled = enabled;
    }

    /**
     * Obtiene el estado actual del IVA
     * @returns {boolean}
     */
    getIvaEnabled() {
        return this.ivaEnabled;
    }

    /**
     * Calcula el IVA sobre un subtotal
     * @param {number} subtotal - Monto sobre el cual calcular IVA
     * @returns {number} - Monto de IVA (0 si está deshabilitado)
     */
    calculateIva(subtotal) {
        if (!this.ivaEnabled) {
            return 0;
        }
        return subtotal * this.IVA_RATE;
    }

    /**
     * Calcula el total con IVA incluido
     * @param {number} subtotal - Subtotal sin IVA
     * @returns {Object} - { subtotal, iva, total }
     */
    calculateTotal(subtotal) {
        const iva = this.calculateIva(subtotal);
        const total = subtotal + iva;
        
        return {
            subtotal: parseFloat(subtotal.toFixed(2)),
            iva: parseFloat(iva.toFixed(2)),
            total: parseFloat(total.toFixed(2))
        };
    }

    /**
     * Agrega una regla de descuento por cantidad
     * @param {Object} rule - { minQuantity: number, maxQuantity: number, discountPercent: number }
     */
    addDiscountRule(rule) {
        // Validación de entrada
        if (!rule || typeof rule.minQuantity !== 'number' || typeof rule.discountPercent !== 'number') {
            throw new Error('Invalid discount rule format');
        }

        this.discountRules.push({
            minQuantity: rule.minQuantity,
            maxQuantity: rule.maxQuantity || Infinity,
            discountPercent: rule.discountPercent
        });

        // Ordenar reglas por cantidad mínima
        this.discountRules.sort((a, b) => a.minQuantity - b.minQuantity);
    }

    /**
     * Limpia todas las reglas de descuento
     */
    clearDiscountRules() {
        this.discountRules = [];
    }

    /**
     * Calcula el descuento aplicable según la cantidad de metros
     * @param {number} totalMeters - Total de metros cuadrados
     * @returns {Object} - { discountPercent, applicableRule }
     */
    getApplicableDiscount(totalMeters) {
        // Encontrar la regla aplicable más alta
        let applicableRule = null;
        
        for (const rule of this.discountRules) {
            if (totalMeters >= rule.minQuantity && totalMeters <= rule.maxQuantity) {
                applicableRule = rule;
            }
        }

        return {
            discountPercent: applicableRule ? applicableRule.discountPercent : 0,
            applicableRule: applicableRule
        };
    }

    /**
     * Aplica descuento a un subtotal
     * @param {number} subtotal - Subtotal antes de descuento
     * @param {number} totalMeters - Total de metros para calcular descuento
     * @returns {Object} - { originalSubtotal, discountPercent, discountAmount, discountedSubtotal }
     */
    applyVolumeDiscount(subtotal, totalMeters) {
        const { discountPercent } = this.getApplicableDiscount(totalMeters);
        const discountAmount = subtotal * (discountPercent / 100);
        const discountedSubtotal = subtotal - discountAmount;

        return {
            originalSubtotal: parseFloat(subtotal.toFixed(2)),
            discountPercent: discountPercent,
            discountAmount: parseFloat(discountAmount.toFixed(2)),
            discountedSubtotal: parseFloat(discountedSubtotal.toFixed(2))
        };
    }

    /**
     * Calcula el precio final completo con descuentos e IVA
     * @param {number} subtotal - Subtotal base
     * @param {number} totalMeters - Total de metros para descuento
     * @returns {Object} - Desglose completo del precio
     */
    calculateFinalPrice(subtotal, totalMeters) {
        // 1. Aplicar descuento por volumen
        const discountInfo = this.applyVolumeDiscount(subtotal, totalMeters);
        
        // 2. Calcular IVA sobre el monto con descuento
        const totalsInfo = this.calculateTotal(discountInfo.discountedSubtotal);

        return {
            originalSubtotal: discountInfo.originalSubtotal,
            discountPercent: discountInfo.discountPercent,
            discountAmount: discountInfo.discountAmount,
            subtotalAfterDiscount: discountInfo.discountedSubtotal,
            iva: totalsInfo.iva,
            total: totalsInfo.total,
            ivaEnabled: this.ivaEnabled,
            totalMeters: totalMeters
        };
    }

    /**
     * Exporta la configuración actual
     * @returns {Object} - Configuración serializable
     */
    exportConfig() {
        return {
            ivaEnabled: this.ivaEnabled,
            ivaRate: this.IVA_RATE,
            discountRules: [...this.discountRules]
        };
    }

    /**
     * Importa una configuración
     * @param {Object} config - Configuración a importar
     */
    importConfig(config) {
        if (config.ivaEnabled !== undefined) {
            this.ivaEnabled = config.ivaEnabled;
        }
        if (Array.isArray(config.discountRules)) {
            this.discountRules = [...config.discountRules];
        }
    }
}

// Exportar para uso global
window.PricingManager = PricingManager;
