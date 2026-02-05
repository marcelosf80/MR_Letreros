/**
 * CLIENTES Extensions - Nuevas funcionalidades para el sistema CLIENTES
 * Este archivo extiende clientes-main.js con:
 * - Gestión de IVA opcional
 * - Descuentos por volumen
 * - Estados de Pagado/Entregado
 * 
 * @version 1.0.0
 * @requires clientes-main.js
 * @requires pricing-manager.js
 * @requires order-status-manager.js
 * @requires discount-config.js
 */

// ==================== INSTANCIAS GLOBALES ====================
let pricingManager;
let orderStatusManager;

// ==================== INICIALIZACIÓN ====================

/**
 * Inicializa los nuevos managers al cargar la página
 */
function initializeNewManagers() {
    // Crear instancias
    pricingManager = new PricingManager();
    orderStatusManager = new OrderStatusManager();
    
    // Configurar reglas de descuento
    initializeDiscountRules(pricingManager);
    
    // Configurar estado inicial del IVA (por defecto activo)
    const ivaCheckbox = document.getElementById('ivaCheckbox');
    if (ivaCheckbox) {
        pricingManager.setIvaEnabled(ivaCheckbox.checked);
    }
    
    // Mostrar tabla de descuentos si está configurado
    showDiscountTable();
    
    console.log('[CLIENTES-EXT] ✅ Nuevos managers inicializados');
}

/**
 * Muestra la tabla de descuentos disponibles
 */
function showDiscountTable() {
    const discountTableHTML = generateDiscountTable();
    if (discountTableHTML) {
        // Insertar después de la sección de productos
        const productCard = document.querySelector('#productsList').closest('.card');
        if (productCard) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = discountTableHTML;
            productCard.after(tempDiv.firstElementChild);
        }
    }
}

// ==================== FUNCIONES DE IVA ====================

/**
 * Alterna el estado del IVA (llamada desde el checkbox)
 */
function toggleIVA() {
    const checkbox = document.getElementById('ivaCheckbox');
    const isEnabled = checkbox.checked;
    
    pricingManager.setIvaEnabled(isEnabled);
    
    console.log(`[CLIENTES-EXT] IVA ${isEnabled ? 'activado' : 'desactivado'}`);
    
    // Recalcular totales
    if (typeof calculateTotals === 'function') {
        calculateTotalsExtended();
    }
}

// ==================== CÁLCULOS EXTENDIDOS ====================

/**
 * Calcula los totales con las nuevas funcionalidades
 * Esta función reemplaza/extiende calculateTotals() original
 */
function calculateTotalsExtended() {
    // 1. Calcular costos (igual que antes)
    const costoMateriales = currentQuoteProducts.reduce((sum, p) => sum + (p.costoTotal || 0), 0);
    const costoTerceros = currentQuoteTerceros.reduce((sum, t) => sum + (t.totalCosto || 0), 0);
    
    // Obtener totales de Categorías Múltiples
    let costoMulti = 0;
    let ventaMulti = 0;
    if (window.multiCategoryManager) {
        const mcTotals = window.multiCategoryManager.calculateGrandTotals();
        costoMulti = mcTotals.grand.totalCost;
        ventaMulti = mcTotals.grand.totalPrice;
    }

    const totalCostos = costoMateriales + costoTerceros + costoMulti;

    // 2. Calcular subtotal (igual que antes)
    const subtotalProductos = currentQuoteProducts.reduce((sum, p) => sum + (p.total || 0), 0);
    const subtotalTerceros = currentQuoteTerceros.reduce((sum, t) => sum + (t.total || 0), 0);
    const subtotalBase = subtotalProductos + subtotalTerceros + ventaMulti;

    // 3. Calcular metros totales para descuentos
    const totalMeters = currentQuoteProducts.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);

    // 4. Aplicar descuentos por volumen
    const priceInfo = pricingManager.calculateFinalPrice(subtotalBase, totalMeters);

    // 5. Actualizar información de descuentos en UI
    updateDiscountDisplay(priceInfo);

    // 6. Calcular ganancia
    const ganancia = priceInfo.total - totalCostos;

    console.log('[TOTALES-EXT]', {
        costoMateriales,
        costoTerceros,
        totalCostos,
        subtotalBase,
        discountPercent: priceInfo.discountPercent,
        discountAmount: priceInfo.discountAmount,
        subtotalAfterDiscount: priceInfo.subtotalAfterDiscount,
        iva: priceInfo.iva,
        total: priceInfo.total,
        ganancia,
        totalMeters
    });

    // 7. Guardar totales numéricos para uso interno
    currentTotals = {
        costoTotal: totalCostos,
        subtotal: priceInfo.subtotalAfterDiscount,
        originalSubtotal: subtotalBase,
        discountPercent: priceInfo.discountPercent,
        discountAmount: priceInfo.discountAmount,
        iva: priceInfo.iva,
        ivaEnabled: priceInfo.ivaEnabled,
        totalCliente: priceInfo.total,
        ganancia: ganancia,
        totalMeters: totalMeters
    };

    // 8. Actualizar elementos del DOM
    const elements = {
        costoMateriales: formatCurrency(costoMateriales + costoMulti),
        costoTerceros: formatCurrency(costoTerceros),
        totalCostos: formatCurrency(totalCostos),
        subtotal: formatCurrency(priceInfo.subtotalAfterDiscount),
        iva: formatCurrency(priceInfo.iva),
        total: formatCurrency(priceInfo.total),
        gananciaNetaDisplay: formatCurrency(ganancia)
    };

    Object.keys(elements).forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.textContent = '$' + elements[id];
    });

    // 9. Recalcular saldo con anticipo
    if (typeof calcularSaldo === 'function') {
        calcularSaldo();
    }
}

/**
 * Actualiza la visualización del descuento aplicado
 */
function updateDiscountDisplay(priceInfo) {
    const discountInfoDiv = document.getElementById('discountInfo');
    const discountPercentSpan = document.getElementById('discountPercent');
    const discountAmountSpan = document.getElementById('discountAmount');
    const totalMetersSpan = document.getElementById('totalMeters');

    if (!discountInfoDiv) return;

    if (priceInfo.discountPercent > 0) {
        discountInfoDiv.style.display = 'block';
        if (discountPercentSpan) discountPercentSpan.textContent = priceInfo.discountPercent;
        if (discountAmountSpan) discountAmountSpan.textContent = '$' + formatCurrency(priceInfo.discountAmount);
        if (totalMetersSpan) totalMetersSpan.textContent = formatM2(priceInfo.totalMeters);
    } else {
        discountInfoDiv.style.display = 'none';
    }
}

// ==================== GESTIÓN DE ESTADOS ====================

/**
 * Alterna el estado de pago de una cotización
 */
async function togglePaymentStatus(quoteId) {
    try {
        const cotizaciones = await window.mrDataManager.getClientesQuotes();
        const quote = cotizaciones.find(q => q.id === quoteId);
        
        if (!quote) {
            console.error('[CLIENTES-EXT] Cotización no encontrada:', quoteId);
            return;
        }

        // Inicializar orderStatus si no existe
        if (!quote.orderStatus) {
            quote.orderStatus = orderStatusManager.createOrderStatus();
        }

        // Alternar estado de pago
        const isPaid = quote.orderStatus.paymentStatus === orderStatusManager.STATUS.PAID;
        
        if (isPaid) {
            quote.orderStatus = orderStatusManager.unmarkPaid(quote.orderStatus);
            console.log('[CLIENTES-EXT] 💳 Pago revertido');
        } else {
            // Mostrar modal simple para método de pago
            const method = prompt('Método de pago:', 'Efectivo') || 'Efectivo';
            const notes = prompt('Notas adicionales (opcional):', '') || '';
            
            quote.orderStatus = orderStatusManager.markAsPaid(quote.orderStatus, { method, notes });
            console.log('[CLIENTES-EXT] 💳 Marcado como pagado');
        }

        // Guardar cambios
        await window.mrDataManager.saveClientesQuote(quote);
        
        // Recargar lista
        if (typeof loadQuotations === 'function') {
            await loadQuotations();
        }
        
        // Actualizar estadísticas
        if (typeof updateStatistics === 'function') {
            updateStatistics();
        }
    } catch (error) {
        console.error('[CLIENTES-EXT] Error al cambiar estado de pago:', error);
        alert('Error al cambiar estado de pago');
    }
}

/**
 * Alterna el estado de entrega de una cotización
 */
async function toggleDeliveryStatus(quoteId) {
    try {
        const cotizaciones = await window.mrDataManager.getClientesQuotes();
        const quote = cotizaciones.find(q => q.id === quoteId);
        
        if (!quote) {
            console.error('[CLIENTES-EXT] Cotización no encontrada:', quoteId);
            return;
        }

        // Inicializar orderStatus si no existe
        if (!quote.orderStatus) {
            quote.orderStatus = orderStatusManager.createOrderStatus();
        }

        // Validar que esté pagado antes de entregar
        if (!orderStatusManager.canBeDelivered(quote.orderStatus)) {
            alert('El pedido debe estar pagado antes de poder marcarlo como entregado');
            return;
        }

        // Alternar estado de entrega
        const isDelivered = quote.orderStatus.deliveryStatus === orderStatusManager.STATUS.DELIVERED;
        
        if (isDelivered) {
            quote.orderStatus = orderStatusManager.unmarkDelivered(quote.orderStatus);
            console.log('[CLIENTES-EXT] 📦 Entrega revertida');
        } else {
            const notes = prompt('Notas de entrega (opcional):', '') || '';
            quote.orderStatus = orderStatusManager.markAsDelivered(quote.orderStatus, { notes });
            console.log('[CLIENTES-EXT] ✅ Marcado como entregado');
        }

        // Guardar cambios
        await window.mrDataManager.saveClientesQuote(quote);
        
        // Recargar lista
        if (typeof loadQuotations === 'function') {
            await loadQuotations();
        }
        
        // Actualizar estadísticas
        if (typeof updateStatistics === 'function') {
            updateStatistics();
        }
    } catch (error) {
        console.error('[CLIENTES-EXT] Error al cambiar estado de entrega:', error);
        alert('Error al cambiar estado de entrega');
    }
}

// ==================== OVERRIDE DE FUNCIONES ====================

/**
 * Sobrescribe la función calculateTotals original
 */
if (typeof window !== 'undefined') {
    // Guardar referencia a la función original
    const originalCalculateTotals = window.calculateTotals;
    
    // Reemplazar con versión extendida
    window.calculateTotals = function() {
        if (pricingManager) {
            calculateTotalsExtended();
        } else {
            // Fallback a función original si los managers no están listos
            if (originalCalculateTotals) {
                originalCalculateTotals();
            }
        }
    };
}

// ==================== INICIALIZACIÓN AL CARGAR ====================

// Esperar a que el DOM y clientes-main.js estén listos
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Esperar un tick para que clientes-main se inicialice primero
        setTimeout(initializeNewManagers, 100);
    });
} else {
    setTimeout(initializeNewManagers, 100);
}

// Exportar funciones globales
window.toggleIVA = toggleIVA;
window.togglePaymentStatus = togglePaymentStatus;
window.toggleDeliveryStatus = toggleDeliveryStatus;
window.calculateTotalsExtended = calculateTotalsExtended;

console.log('[CLIENTES-EXT] 📦 Módulo de extensiones cargado');
