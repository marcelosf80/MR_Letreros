/**
 * PDF & Notifications Integration
 * Integración completa de PDFs y notificaciones en gremio.html y clientes.html
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Agregar en gremio.html y clientes.html DESPUÉS de todos los scripts:
 *    <script src="js/shared/notification-system.js"></script>
 *    <script src="js/shared/pdf-generator.js"></script>
 *    <script src="js/shared/pdf-notifications-integration.js"></script>
 * 
 * @version 1.0.0
 */

(function() {
    'use strict';
    
    console.log('[PDF-NOTIF-INTEGRATION] 🚀 Inicializando...');
    
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function init() {
        // Agregar botones de PDF a las cotizaciones guardadas
        addPDFButtons();
        
        // Interceptar función de guardar cotización
        interceptSaveQuote();
        
        // Interceptar función de aprobar cotización
        interceptApproveQuote();
        
        console.log('[PDF-NOTIF-INTEGRATION] ✅ Integración completa');
    }
    
    /**
     * Agrega botones de PDF a las cotizaciones guardadas
     */
    function addPDFButtons() {
        // Observar cambios en la lista de cotizaciones
        const observer = new MutationObserver(() => {
            const quoteCards = document.querySelectorAll('.quote-card, .cotizacion-card');
            
            quoteCards.forEach(card => {
                // Verificar si ya tiene botón PDF
                if (card.querySelector('.btn-generate-pdf')) return;
                
                // Obtener ID de la cotización
                const quoteId = card.dataset.quoteId || card.getAttribute('data-quote-id');
                if (!quoteId) return;
                
                // Buscar contenedor de acciones
                const actionsDiv = card.querySelector('.quote-actions, .cotizacion-actions');
                if (!actionsDiv) return;
                
                // Crear botón PDF
                const pdfBtn = document.createElement('button');
                pdfBtn.className = 'btn btn-info btn-small btn-generate-pdf';
                pdfBtn.innerHTML = '📄 PDF';
                pdfBtn.title = 'Generar PDF del presupuesto';
                pdfBtn.onclick = (e) => {
                    e.stopPropagation();
                    generatePDFForQuote(quoteId);
                };
                
                // Agregar al inicio de las acciones
                actionsDiv.insertBefore(pdfBtn, actionsDiv.firstChild);
            });
        });
        
        // Observar el contenedor de cotizaciones
        const quotesContainer = document.getElementById('quotesList') || 
                               document.getElementById('quotationsList') ||
                               document.querySelector('.quotes-container');
        
        if (quotesContainer) {
            observer.observe(quotesContainer, {
                childList: true,
                subtree: true
            });
        }
        
        // Ejecutar una vez inmediatamente
        setTimeout(() => {
            const event = new MutationObserver(() => {});
            observer.disconnect();
            addPDFButtons();
        }, 1000);
    }
    
    /**
     * Genera PDF para una cotización específica
     * @param {string} quoteId
     */
    async function generatePDFForQuote(quoteId) {
        try {
            // Determinar si es gremio o clientes
            const isGremio = window.location.pathname.includes('gremio');
            const isClientes = window.location.pathname.includes('clientes');
            
            if (!isGremio && !isClientes) {
                alert('No se pudo determinar el tipo de cotización');
                return;
            }
            
            // Obtener datos de la cotización
            let quotes = [];
            if (isGremio && window.mrDataManager && window.mrDataManager.getGremioCotizaciones) {
                quotes = await window.mrDataManager.getGremioCotizaciones();
            } else if (isClientes && window.mrDataManager && window.mrDataManager.getClientesCotizaciones) {
                quotes = await window.mrDataManager.getClientesCotizaciones();
            }
            
            const quote = quotes.find(q => q.id === quoteId);
            if (!quote) {
                alert('Cotización no encontrada');
                return;
            }
            
            // Mostrar loading
            if (window.showNotification) {
                window.showNotification({
                    title: '📄 Generando PDF...',
                    message: 'Por favor espera',
                    type: 'info',
                    duration: 2000
                });
            }
            
            // Crear generador de PDF
            const pdfGen = new PDFGenerator();
            
            // Generar PDF según tipo
            if (isGremio) {
                await pdfGen.generateGremioQuote(quote);
            } else {
                await pdfGen.generateClientesQuote(quote);
            }
            
            // Descargar
            const clientName = quote.cliente?.nombre || quote.clientName || 'Cliente';
            const filename = `Presupuesto_${isGremio ? 'GREMIO' : 'CLIENTES'}_${clientName.replace(/\s+/g, '_')}_${quote.id}.pdf`;
            pdfGen.download(filename);
            
            // Notificación de éxito
            if (window.showNotification) {
                window.showNotification({
                    title: '✅ PDF Generado',
                    message: `Descargado: ${filename}`,
                    type: 'success',
                    duration: 4000
                });
            }
            
        } catch (error) {
            console.error('[PDF-INTEGRATION] Error:', error);
            if (window.notifyError) {
                window.notifyError('Error al generar PDF: ' + error.message);
            } else {
                alert('Error al generar PDF: ' + error.message);
            }
        }
    }
    
    /**
     * Intercepta la función de guardar cotización para agregar notificación
     */
    function interceptSaveQuote() {
        // Guardar referencia original
        const originalSaveQuote = window.saveQuote;
        
        if (!originalSaveQuote) {
            console.warn('[PDF-NOTIF] saveQuote no encontrada');
            return;
        }
        
        // Sobrescribir con versión mejorada
        window.saveQuote = async function() {
            try {
                // Ejecutar función original
                await originalSaveQuote.call(this);
                
                // Obtener datos de la cotización recién guardada
                const clientName = document.getElementById('clientName')?.value || 'Cliente';
                const total = document.getElementById('total')?.textContent?.replace(/[^0-9.,]/g, '') || '0';
                
                // Mostrar notificación moderna
                if (window.notifyQuoteSaved) {
                    window.notifyQuoteSaved({
                        cliente: { nombre: clientName },
                        totalCliente: parseFloat(total.replace(',', ''))
                    });
                }
                
            } catch (error) {
                console.error('[PDF-NOTIF] Error en saveQuote:', error);
                throw error;
            }
        };
        
        console.log('[PDF-NOTIF] ✅ saveQuote interceptada');
    }
    
    /**
     * Intercepta la función de aprobar cotización
     */
    function interceptApproveQuote() {
        // Buscar función de aprobar
        const originalApprove = window.aprobarCotizacion || window.approveQuote;
        
        if (!originalApprove) {
            console.warn('[PDF-NOTIF] Función de aprobar no encontrada');
            // Intentar interceptar más tarde
            setTimeout(interceptApproveQuote, 2000);
            return;
        }
        
        // Sobrescribir
        const functionName = window.aprobarCotizacion ? 'aprobarCotizacion' : 'approveQuote';
        window[functionName] = async function(quoteId) {
            try {
                // Ejecutar función original
                await originalApprove.call(this, quoteId);
                
                // La notificación del trabajo se maneja en gremio-main.js
                // Aquí solo nos aseguramos de que esté disponible
                
            } catch (error) {
                console.error('[PDF-NOTIF] Error en aprobar:', error);
                throw error;
            }
        };
        
        console.log('[PDF-NOTIF] ✅ Función de aprobar interceptada');
    }
    
    /**
     * Agrega botón de PDF en la vista de edición/creación de cotización
     */
    function addQuickPDFButton() {
        // Buscar el botón de guardar
        const saveBtn = document.querySelector('button[onclick*="saveQuote"]') ||
                       document.getElementById('btnSaveQuote');
        
        if (!saveBtn) return;
        
        // Verificar si ya existe
        if (document.getElementById('btnQuickPDF')) return;
        
        // Crear botón de vista previa
        const previewBtn = document.createElement('button');
        previewBtn.id = 'btnQuickPDF';
        previewBtn.className = 'btn btn-secondary';
        previewBtn.innerHTML = '👁️ Vista Previa PDF';
        previewBtn.type = 'button';
        previewBtn.onclick = async () => {
            try {
                // Obtener datos actuales del formulario
                const quoteData = {
                    cliente: {
                        nombre: document.getElementById('clientName')?.value || 'Cliente',
                        telefono: document.getElementById('clientPhone')?.value || '',
                        email: document.getElementById('clientEmail')?.value || ''
                    },
                    productos: window.currentQuoteProducts || [],
                    terceros: window.currentQuoteTerceros || [],
                    multiCategories: window.multiCategoryManager ? window.multiCategoryManager.exportState() : null,
                    subtotal: window.currentTotals?.subtotal || 0,
                    iva: window.currentTotals?.iva || 0,
                    totalCliente: window.currentTotals?.totalCliente || 0,
                    fecha: new Date().toISOString()
                };
                
                // Generar PDF
                const pdfGen = new PDFGenerator();
                const isGremio = window.location.pathname.includes('gremio');
                
                if (isGremio) {
                    await pdfGen.generateGremioQuote(quoteData);
                } else {
                    await pdfGen.generateClientesQuote(quoteData);
                }
                
                // Abrir en nueva ventana
                pdfGen.openInNewWindow();
                
            } catch (error) {
                console.error('[PDF-PREVIEW] Error:', error);
                if (window.notifyError) {
                    window.notifyError('Error generando vista previa: ' + error.message);
                } else {
                    alert('Error: ' + error.message);
                }
            }
        };
        
        // Insertar después del botón de guardar
        saveBtn.parentNode.insertBefore(previewBtn, saveBtn.nextSibling);
    }
    
    // Agregar botón de vista previa después de un delay
    setTimeout(addQuickPDFButton, 1500);
    
    // Exponer función global para generar PDF
    window.generatePDFForCurrentQuote = async function() {
        const quoteData = {
            cliente: {
                nombre: document.getElementById('clientName')?.value || 'Cliente',
                telefono: document.getElementById('clientPhone')?.value || '',
                email: document.getElementById('clientEmail')?.value || ''
            },
            productos: window.currentQuoteProducts || [],
            terceros: window.currentQuoteTerceros || [],
            multiCategories: window.multiCategoryManager ? window.multiCategoryManager.exportState() : null,
            subtotal: window.currentTotals?.subtotal || 0,
            iva: window.currentTotals?.iva || 0,
            totalCliente: window.currentTotals?.totalCliente || 0,
            fecha: new Date().toISOString()
        };
        
        const pdfGen = new PDFGenerator();
        const isGremio = window.location.pathname.includes('gremio');
        
        if (isGremio) {
            await pdfGen.generateGremioQuote(quoteData);
        } else {
            await pdfGen.generateClientesQuote(quoteData);
        }
        
        const clientName = quoteData.cliente.nombre.replace(/\s+/g, '_');
        pdfGen.download(`Presupuesto_${clientName}_${Date.now()}.pdf`);
    };
    
})();
