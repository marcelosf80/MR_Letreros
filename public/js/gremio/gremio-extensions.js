/**
 * GREMIO Extensions - Nuevas funcionalidades para el sistema GREMIO
 * Este archivo extiende gremio-main.js con:
 * - Gestión de IVA opcional
 * - Descuentos por volumen
 * - Estados de Pagado/Entregado
 * 
 * @version 1.0.0
 * @requires gremio-main.js
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
    
    // Configurar estado inicial del IVA (por defecto activo)
    const ivaCheckbox = document.getElementById('ivaCheckbox');
    if (ivaCheckbox) {
        pricingManager.setIvaEnabled(ivaCheckbox.checked);
    }
    
    console.log('[GREMIO-EXT] ✅ Nuevos managers inicializados');
}

// FUNCION ELIMINADA: showDiscountTable ahora gestionada por PromotionsManager
// ==================== FUNCIONES DE IVA ====================

/**
 * Alterna el estado del IVA (llamada desde el checkbox)
 */
function toggleIVA() {
    const checkbox = document.getElementById('ivaCheckbox');
    const isEnabled = checkbox.checked;
    
    pricingManager.setIvaEnabled(isEnabled);
    
    console.log(`[GREMIO-EXT] IVA ${isEnabled ? 'activado' : 'desactivado'}`);
    
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

    // 2. Calcular subtotal (FIX: Se excluye subtotalTerceros)
    const subtotalProductos = currentQuoteProducts.reduce((sum, p) => sum + (p.total || 0), 0);
    const subtotalTerceros = currentQuoteTerceros.reduce((sum, t) => sum + (t.total || 0), 0);
    const subtotalBase = subtotalProductos + subtotalTerceros + ventaMulti;


    // 3. Calcular metros totales para descuentos (de productos obsoletos + multicategorias)
    const oldProductsMeters = currentQuoteProducts.reduce((sum, p) => sum + (parseFloat(p.m2Totales || p.quantity || 0)), 0);
    const multiMeters = window.multiCategoryManager ? window.multiCategoryManager.sharedDimensions.totalM2 : 0;
    const totalMeters = oldProductsMeters + multiMeters;

    // 4. Aplicar descuentos por volumen desde promotionsManager
    let discountPercent = 0;
    if (window.promotionsManager) {
        const promo = window.promotionsManager.getApplicablePromotion(totalMeters);
        if (promo) {
            discountPercent = promo.discountPercent;
        }
    }
    
    // 4.1. Aplicar Descuento Especial Manual (el que pide el usuario)
    const inputDescuentoEspecial = document.getElementById('descuentoEspecial');
    const porcDescuentoEspecial = inputDescuentoEspecial ? parseFloat(inputDescuentoEspecial.value) || 0 : 0;
    
    const promoDiscountAmount = subtotalBase * (discountPercent / 100);
    const specialDiscountAmount = subtotalBase * (porcDescuentoEspecial / 100);
    
    // El subtotal después de ajustes (Promo se resta, Ajuste manual se suma)
    const subtotalAfterDiscount = subtotalBase - promoDiscountAmount + specialDiscountAmount;

    // 4.2. Calcular IVA
    const ivaEnabled = document.getElementById('ivaCheckbox')?.checked || false;
    const iva = ivaEnabled ? subtotalAfterDiscount * 0.21 : 0;
    const total = subtotalAfterDiscount + iva;

    // 5. Actualizar información de descuentos en UI
    updateDiscountDisplay({ 
        discountPercent, 
        discountAmount: promoDiscountAmount, 
        subtotalAfterDiscount, 
        totalMeters 
    });

    // 6. Calcular ganancia
    const ganancia = total - totalCostos;

    console.log('[TOTALES-EXT]', {
        totalCostos,
        subtotalBase,
        discountPercent,
        promoDiscountAmount,
        porcDescuentoEspecial,
        specialDiscountAmount,
        subtotalAfterDiscount,
        iva,
        total,
        ganancia,
        totalMeters
    });

    // 7. Guardar totales numéricos para uso interno
    currentTotals = {
        costoTotal: totalCostos,
        subtotal: subtotalAfterDiscount,
        originalSubtotal: subtotalBase,
        discountPercent: discountPercent,
        discountAmount: promoDiscountAmount,
        descuentoEspecial: specialDiscountAmount,
        porcentajeDescuento: porcDescuentoEspecial,
        iva: iva,
        ivaEnabled: ivaEnabled,
        totalCliente: total,
        ganancia: ganancia,
        totalMeters: totalMeters
    };

    // 8. Actualizar elementos del DOM
    const elements = {
        totalCostos: formatCurrency(totalCostos),
        subtotal: formatCurrency(subtotalAfterDiscount),
        iva: formatCurrency(iva),
        total: formatCurrency(total),
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
        const cotizaciones = await window.mrDataManager.getGremioQuotes();
        const quote = cotizaciones.find(q => q.id === quoteId);
        
        if (!quote) {
            console.error('[GREMIO-EXT] Cotización no encontrada:', quoteId);
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
            console.log('[GREMIO-EXT] 💳 Pago revertido');
        } else {
            // Mostrar modal simple para método de pago
            const method = prompt('Método de pago:', 'Efectivo') || 'Efectivo';
            const notes = prompt('Notas adicionales (opcional):', '') || '';
            
            quote.orderStatus = orderStatusManager.markAsPaid(quote.orderStatus, { method, notes });
            console.log('[GREMIO-EXT] 💳 Marcado como pagado');
        }

        // Guardar cambios
        await window.mrDataManager.saveGremioQuote(quote);
        
        // Recargar lista
        if (typeof loadQuotations === 'function') {
            await loadQuotations();
        }
        
        // Actualizar estadísticas
        if (typeof updateStatistics === 'function') {
            updateStatistics();
        }
    } catch (error) {
        console.error('[GREMIO-EXT] Error al cambiar estado de pago:', error);
        alert('Error al cambiar estado de pago');
    }
}

/**
 * Alterna el estado de entrega de una cotización
 */
async function toggleDeliveryStatus(quoteId) {
    try {
        const cotizaciones = await window.mrDataManager.getGremioQuotes();
        const quote = cotizaciones.find(q => q.id === quoteId);
        
        if (!quote) {
            console.error('[GREMIO-EXT] Cotización no encontrada:', quoteId);
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
            console.log('[GREMIO-EXT] 📦 Entrega revertida');
        } else {
            const notes = prompt('Notas de entrega (opcional):', '') || '';
            quote.orderStatus = orderStatusManager.markAsDelivered(quote.orderStatus, { notes });
            console.log('[GREMIO-EXT] ✅ Marcado como entregado');
        }

        // Guardar cambios
        await window.mrDataManager.saveGremioQuote(quote);
        
        // Recargar lista
        if (typeof loadQuotations === 'function') {
            await loadQuotations();
        }
        
        // Actualizar estadísticas
        if (typeof updateStatistics === 'function') {
            updateStatistics();
        }
    } catch (error) {
        console.error('[GREMIO-EXT] Error al cambiar estado de entrega:', error);
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

/**
 * Extiende la función de guardar cotización para incluir estados
 */
const originalSaveQuote = window.saveQuote;
window.saveQuote = async function() {
    // Crear orderStatus para nueva cotización
    const newOrderStatus = orderStatusManager.createOrderStatus();
    
    // Inyectar en el flujo de guardado
    const originalCreateQuoteObject = window.createQuoteObject;
    if (originalCreateQuoteObject) {
        window.createQuoteObject = function() {
            const quote = originalCreateQuoteObject();
            quote.orderStatus = newOrderStatus;
            quote.pricingConfig = pricingManager.exportConfig();
            return quote;
        };
    }
    
    // Llamar función original
    if (originalSaveQuote) {
        await originalSaveQuote();
    }
};

// ==================== INICIALIZACIÓN AL CARGAR ====================

// Esperar a que el DOM y gremio-main.js estén listos
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Esperar un tick para que gremio-main se inicialice primero
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

console.log('[GREMIO-EXT] 📦 Módulo de extensiones cargado');
