/**
 * FUNCIÓN GLOBAL DE FORMATO DE MONEDA
 * Agregar al inicio de TODOS los archivos JavaScript
 * Formato argentino: 1.234.567,89
 */

// Función de formateo de moneda argentina
function formatCurrencyAR(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0,00';
    }
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}

// Alias para compatibilidad
window.formatCurrencyAR = formatCurrencyAR;
window.formatCurrency = formatCurrencyAR;

/**
 * EJEMPLOS DE USO:
 * 
 * formatCurrencyAR(26330000)     → "26.330.000,00"
 * formatCurrencyAR(0.01)         → "0,01"
 * formatCurrencyAR(131650)       → "131.650,00"
 * 
 * // Para áreas/medidas (con decimales)
 * formatCurrencyAR(0.50, 2)      → "0,50"
 * formatCurrencyAR(10.5, 2)      → "10,50"
 */
