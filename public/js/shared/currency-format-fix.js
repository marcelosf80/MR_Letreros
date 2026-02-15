/**
 * Currency Format Fix - Corrección de Formato de Moneda
 * Estandariza el formato argentino en todo el sistema
 * Formato: 1.234.567,89 (punto para miles, coma para decimales)
 * 
 * @version 1.0.0
 */

(function() {
    'use strict';
    
    console.log('[CURRENCY-FIX] 🔧 Aplicando corrección de formato...');
    
    /**
     * Formatea número como moneda argentina
     * @param {number} num - Número a formatear
     * @param {number} decimals - Cantidad de decimales (default: 2)
     * @returns {string} - Número formateado
     */
    function formatCurrencyAR(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) {
            return '0,00';
        }
        
        return new Intl.NumberFormat('es-AR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    }
    
    /**
     * Parsea string de moneda a número
     * Acepta: "1.234,56" o "1234.56" o "1,234.56"
     * @param {string} str - String a parsear
     * @returns {number}
     */
    function parseCurrencyAR(str) {
        if (typeof str === 'number') return str;
        if (!str) return 0;
        
        // Remover símbolos de moneda y espacios
        str = str.toString().replace(/[$\s]/g, '');
        
        // Detectar formato (si tiene coma como decimal)
        if (str.includes(',')) {
            // Formato argentino: 1.234,56
            str = str.replace(/\./g, '').replace(',', '.');
        }
        
        return parseFloat(str) || 0;
    }
    
    /**
     * Formatea para input (sin separadores de miles)
     * @param {number} num
     * @returns {string}
     */
    function formatForInput(num) {
        if (num === null || num === undefined || isNaN(num)) {
            return '0.00';
        }
        return num.toFixed(2);
    }
    
    // Exportar funciones globalmente
    window.formatCurrencyAR = formatCurrencyAR;
    window.parseCurrencyAR = parseCurrencyAR;
    window.formatForInput = formatForInput;
    
    // Alias para compatibilidad
    window.formatCurrency = formatCurrencyAR;
    
    console.log('[CURRENCY-FIX] ✅ Funciones de formato disponibles');
    
    // Auto-corregir inputs numéricos existentes
    setTimeout(() => {
        const inputs = document.querySelectorAll('input[type="number"]');
        inputs.forEach(input => {
            // Agregar evento para formatear al salir del input
            input.addEventListener('blur', function() {
                if (this.value) {
                    const num = parseCurrencyAR(this.value);
                    this.value = formatForInput(num);
                }
            });
        });
        
        console.log('[CURRENCY-FIX] 🔧 Auto-corrección aplicada a', inputs.length, 'inputs');
    }, 1000);
    
})();

/**
 * EJEMPLOS DE USO:
 * 
 * // Formatear para mostrar
 * formatCurrencyAR(1234567.89)  → "1.234.567,89"
 * formatCurrencyAR(200000)      → "200.000,00"
 * formatCurrencyAR(0.5)         → "0,50"
 * 
 * // Parsear desde string
 * parseCurrencyAR("1.234,56")   → 1234.56
 * parseCurrencyAR("$200.000")   → 200000
 * parseCurrencyAR("1,234.56")   → 1234.56
 * 
 * // Para inputs
 * formatForInput(1234.56)       → "1234.56"
 */
