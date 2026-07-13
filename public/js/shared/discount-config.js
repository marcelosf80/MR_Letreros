/**
 * Discount Configuration - Configuración de Descuentos por Volumen
 * Define las reglas de descuento basadas en metros cuadrados comprados
 * 
 * @version 1.0.0
 * @author MR Letreros Team
 */

const DISCOUNT_CONFIG = {
    // Reglas de descuento por volumen (en metros cuadrados)
    rules: [
        {
            minQuantity: 10,
            maxQuantity: 24.99,
            discountPercent: 5,
            label: '5% de descuento (10-24.99 m²)'
        },
        {
            minQuantity: 25,
            maxQuantity: 49.99,
            discountPercent: 10,
            label: '10% de descuento (25-49.99 m²)'
        },
        {
            minQuantity: 50,
            maxQuantity: 99.99,
            discountPercent: 15,
            label: '15% de descuento (50-99.99 m²)'
        },
        {
            minQuantity: 100,
            maxQuantity: Infinity,
            discountPercent: 20,
            label: '20% de descuento (100+ m²)'
        }
    ],

    // Configuración de visualización
    display: {
        showInQuote: true,
        showInPDF: true,
        highlightColor: '#4CAF50'
    },

    // Permite modificar reglas en tiempo real
    enabled: true
};

/**
 * Inicializa el pricing manager con las reglas de descuento
 * @param {PricingManager} pricingManager - Instancia del pricing manager
 */
function initializeDiscountRules(pricingManager) {
    if (!DISCOUNT_CONFIG.enabled) {
        console.log('[DISCOUNT] Descuentos deshabilitados');
        return;
    }

    // Limpiar reglas existentes
    pricingManager.clearDiscountRules();

    // Agregar reglas configuradas
    DISCOUNT_CONFIG.rules.forEach(rule => {
        try {
            pricingManager.addDiscountRule(rule);
            console.log(`[DISCOUNT] ✅ Regla agregada: ${rule.label}`);
        } catch (error) {
            console.error(`[DISCOUNT] ❌ Error agregando regla: ${rule.label}`, error);
        }
    });

    console.log('[DISCOUNT] Sistema de descuentos inicializado con', DISCOUNT_CONFIG.rules.length, 'reglas');
}

/**
 * Genera HTML para mostrar tabla de descuentos disponibles
 * @returns {string} - HTML de la tabla
 */
function generateDiscountTable() {
    if (!DISCOUNT_CONFIG.enabled || !DISCOUNT_CONFIG.display.showInQuote) {
        return '';
    }

    const rows = DISCOUNT_CONFIG.rules.map(rule => `
        <tr>
            <td>${rule.minQuantity} - ${rule.maxQuantity === Infinity ? '∞' : rule.maxQuantity} m²</td>
            <td style="color: ${DISCOUNT_CONFIG.display.highlightColor}; font-weight: bold;">
                ${rule.discountPercent}%
            </td>
        </tr>
    `).join('');

    return `
        <div class="discount-table-container" style="
            margin: 1rem 0;
            padding: 1rem;
            background: rgba(76, 175, 80, 0.1);
            border-radius: 8px;
            border: 1px solid rgba(76, 175, 80, 0.3);
        ">
            <h4 style="margin: 0 0 0.5rem 0; color: ${DISCOUNT_CONFIG.display.highlightColor};">
                🎁 Descuentos por Volumen Disponibles
            </h4>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid rgba(76, 175, 80, 0.3);">
                        <th style="text-align: left; padding: 0.5rem;">Cantidad (m²)</th>
                        <th style="text-align: left; padding: 0.5rem;">Descuento</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
            <small style="display: block; margin-top: 0.5rem; opacity: 0.8;">
                * Los descuentos se aplican automáticamente al alcanzar la cantidad indicada
            </small>
        </div>
    `;
}

// Exportar para uso global
window.DISCOUNT_CONFIG = DISCOUNT_CONFIG;
window.initializeDiscountRules = initializeDiscountRules;
window.generateDiscountTable = generateDiscountTable;
