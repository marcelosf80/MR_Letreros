/**
 * Quote Editor - Sistema de Edición de Cotizaciones
 * Permite modificar cotizaciones guardadas
 * 
 * @version 1.0.0
 * @author MR Letreros Team
 */

class QuoteEditor {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentQuote = null;
        this.isEditMode = false;
        this.originalQuote = null; // Para poder cancelar cambios
    }

    /**
     * Carga una cotización para edición
     * @param {string} quoteId - ID de la cotización
     * @param {string} quoteType - 'gremio' o 'clientes'
     * @returns {Promise<Object>} - Cotización cargada
     */
    async loadQuoteForEdit(quoteId, quoteType = 'gremio') {
        try {
            let quotes;
            if (quoteType === 'gremio') {
                quotes = await this.dataManager.getGremioQuotes();
            } else {
                quotes = await this.dataManager.getClientesQuotes();
            }

            const quote = quotes.find(q => q.id === quoteId);
            if (!quote) {
                throw new Error('Cotización no encontrada');
            }

            // Guardar copia original para poder cancelar
            this.originalQuote = JSON.parse(JSON.stringify(quote));
            this.currentQuote = quote;
            this.isEditMode = true;
            this.quoteType = quoteType;

            console.log('[QUOTE-EDITOR] 📝 Cotización cargada para edición:', quoteId);
            return quote;
        } catch (error) {
            console.error('[QUOTE-EDITOR] Error cargando cotización:', error);
            throw error;
        }
    }

    /**
     * Obtiene la cotización actual en edición
     * @returns {Object|null}
     */
    getCurrentQuote() {
        return this.currentQuote;
    }

    /**
     * Verifica si está en modo edición
     * @returns {boolean}
     */
    isEditing() {
        return this.isEditMode;
    }

    /**
     * Actualiza datos del cliente
     * @param {Object} clientData
     */
    updateClientData(clientData) {
        if (!this.isEditMode) {
            throw new Error('No hay cotización en edición');
        }

        Object.assign(this.currentQuote, {
            clientName: clientData.clientName || this.currentQuote.clientName,
            clientPhone: clientData.clientPhone || this.currentQuote.clientPhone,
            clientEmail: clientData.clientEmail || this.currentQuote.clientEmail,
            clientAddress: clientData.clientAddress || this.currentQuote.clientAddress
        });

        console.log('[QUOTE-EDITOR] 👤 Datos de cliente actualizados');
    }

    /**
     * Actualiza la lista de productos
     * @param {Array} products
     */
    updateProducts(products) {
        if (!this.isEditMode) {
            throw new Error('No hay cotización en edición');
        }

        this.currentQuote.products = products;
        console.log('[QUOTE-EDITOR] 📦 Productos actualizados:', products.length);
    }

    /**
     * Agrega un producto
     * @param {Object} product
     */
    addProduct(product) {
        if (!this.isEditMode) {
            throw new Error('No hay cotización en edición');
        }

        if (!this.currentQuote.products) {
            this.currentQuote.products = [];
        }

        this.currentQuote.products.push(product);
        console.log('[QUOTE-EDITOR] ➕ Producto agregado');
    }

    /**
     * Elimina un producto
     * @param {number} index - Índice del producto
     */
    removeProduct(index) {
        if (!this.isEditMode) {
            throw new Error('No hay cotización en edición');
        }

        if (this.currentQuote.products && this.currentQuote.products[index]) {
            this.currentQuote.products.splice(index, 1);
            console.log('[QUOTE-EDITOR] ❌ Producto eliminado');
        }
    }

    /**
     * Actualiza servicios de terceros
     * @param {Array} terceros
     */
    updateTerceros(terceros) {
        if (!this.isEditMode) {
            throw new Error('No hay cotización en edición');
        }

        this.currentQuote.terceros = terceros;
        console.log('[QUOTE-EDITOR] 🔧 Servicios de terceros actualizados:', terceros.length);
    }

    /**
     * Actualiza multi-categorías
     * @param {Object} multiCategories
     */
    updateMultiCategories(multiCategories) {
        if (!this.isEditMode) {
            throw new Error('No hay cotización en edición');
        }

        this.currentQuote.multiCategories = multiCategories;
        console.log('[QUOTE-EDITOR] 📊 Multi-categorías actualizadas');
    }

    /**
     * Actualiza totales financieros
     * @param {Object} totals - { subtotal, iva, total, totalCost, ganancia }
     */
    updateTotals(totals) {
        if (!this.isEditMode) {
            throw new Error('No hay cotización en edición');
        }

        Object.assign(this.currentQuote, {
            subtotal: totals.subtotal,
            iva: totals.iva,
            total: totals.total,
            totalCost: totals.totalCost,
            ganancia: totals.ganancia
        });

        console.log('[QUOTE-EDITOR] 💰 Totales actualizados');
    }

    /**
     * Actualiza configuración de pricing
     * @param {Object} pricingConfig
     */
    updatePricingConfig(pricingConfig) {
        if (!this.isEditMode) {
            throw new Error('No hay cotización en edición');
        }

        this.currentQuote.pricingConfig = pricingConfig;
        console.log('[QUOTE-EDITOR] ⚙️ Configuración de precios actualizada');
    }

    /**
     * Actualiza estado del pedido
     * @param {Object} orderStatus
     */
    updateOrderStatus(orderStatus) {
        if (!this.isEditMode) {
            throw new Error('No hay cotización en edición');
        }

        this.currentQuote.orderStatus = orderStatus;
        console.log('[QUOTE-EDITOR] 📋 Estado del pedido actualizado');
    }

    /**
     * Agrega una nota a la cotización
     * @param {string} note
     */
    addNote(note) {
        if (!this.isEditMode) {
            throw new Error('No hay cotización en edición');
        }

        if (!this.currentQuote.notes) {
            this.currentQuote.notes = [];
        }

        this.currentQuote.notes.push({
            text: note,
            date: new Date().toISOString(),
            author: 'Usuario'
        });

        console.log('[QUOTE-EDITOR] 📝 Nota agregada');
    }

    /**
     * Guarda los cambios realizados
     * @returns {Promise<Object>} - Cotización guardada
     */
    async saveChanges() {
        if (!this.isEditMode) {
            throw new Error('No hay cotización en edición');
        }

        try {
            // Actualizar fecha de modificación
            this.currentQuote.updatedAt = new Date().toISOString();

            // Guardar según tipo
            let savedQuote;
            if (this.quoteType === 'gremio') {
                savedQuote = await this.dataManager.saveGremioQuote(this.currentQuote);
            } else {
                savedQuote = await this.dataManager.saveClientesQuote(this.currentQuote);
            }

            console.log('[QUOTE-EDITOR] ✅ Cambios guardados exitosamente');
            
            // Limpiar estado de edición pero mantener la cotización actual
            // para que pueda seguir siendo editada
            this.originalQuote = JSON.parse(JSON.stringify(this.currentQuote));
            
            return savedQuote;
        } catch (error) {
            console.error('[QUOTE-EDITOR] ❌ Error guardando cambios:', error);
            throw error;
        }
    }

    /**
     * Cancela la edición y restaura valores originales
     */
    cancelEdit() {
        if (!this.isEditMode) {
            return;
        }

        // Restaurar cotización original
        this.currentQuote = JSON.parse(JSON.stringify(this.originalQuote));
        
        console.log('[QUOTE-EDITOR] ↩️ Edición cancelada');
    }

    /**
     * Finaliza el modo de edición
     */
    endEdit() {
        this.currentQuote = null;
        this.originalQuote = null;
        this.isEditMode = false;
        this.quoteType = null;

        console.log('[QUOTE-EDITOR] 🔚 Modo de edición finalizado');
    }

    /**
     * Verifica si hay cambios sin guardar
     * @returns {boolean}
     */
    hasUnsavedChanges() {
        if (!this.isEditMode || !this.originalQuote || !this.currentQuote) {
            return false;
        }

        // Comparar JSON para detectar cambios
        const original = JSON.stringify(this.originalQuote);
        const current = JSON.stringify(this.currentQuote);

        return original !== current;
    }

    /**
     * Obtiene un resumen de los cambios realizados
     * @returns {Array} - Lista de cambios
     */
    getChangesSummary() {
        if (!this.hasUnsavedChanges()) {
            return [];
        }

        const changes = [];
        const orig = this.originalQuote;
        const curr = this.currentQuote;

        // Detectar cambios en datos del cliente
        if (orig.clientName !== curr.clientName) {
            changes.push(`Cliente: "${orig.clientName}" → "${curr.clientName}"`);
        }

        // Detectar cambios en productos
        if (orig.products?.length !== curr.products?.length) {
            changes.push(`Productos: ${orig.products?.length || 0} → ${curr.products?.length || 0}`);
        }

        // Detectar cambios en terceros
        if (orig.terceros?.length !== curr.terceros?.length) {
            changes.push(`Servicios terceros: ${orig.terceros?.length || 0} → ${curr.terceros?.length || 0}`);
        }

        // Detectar cambios en totales
        if (orig.total !== curr.total) {
            changes.push(`Total: $${orig.total} → $${curr.total}`);
        }

        // Detectar cambios en estados
        if (orig.orderStatus?.paymentStatus !== curr.orderStatus?.paymentStatus) {
            changes.push(`Estado pago: ${orig.orderStatus?.paymentStatus} → ${curr.orderStatus?.paymentStatus}`);
        }

        return changes;
    }

    /**
     * Crea una nueva versión de la cotización (duplicar)
     * @returns {Object} - Nueva cotización
     */
    duplicateQuote() {
        if (!this.currentQuote) {
            throw new Error('No hay cotización para duplicar');
        }

        const duplicate = JSON.parse(JSON.stringify(this.currentQuote));
        
        // Generar nuevo ID
        duplicate.id = this.generateQuoteId();
        
        // Actualizar fechas
        duplicate.date = new Date().toISOString();
        duplicate.createdAt = new Date().toISOString();
        duplicate.updatedAt = null;
        
        // Resetear estados
        if (duplicate.orderStatus) {
            duplicate.orderStatus = {
                paymentStatus: 'pending',
                deliveryStatus: 'pending',
                paymentDate: null,
                deliveryDate: null
            };
        }

        // Agregar nota de duplicación
        if (!duplicate.notes) {
            duplicate.notes = [];
        }
        duplicate.notes.push({
            text: `Duplicada de cotización #${this.currentQuote.id}`,
            date: new Date().toISOString(),
            author: 'Sistema'
        });

        console.log('[QUOTE-EDITOR] 📋 Cotización duplicada');
        return duplicate;
    }

    /**
     * Genera HTML para mostrar el editor
     * @returns {string}
     */
    generateEditorHTML() {
        if (!this.isEditMode || !this.currentQuote) {
            return '<p class="empty-state">No hay cotización en edición</p>';
        }

        const hasChanges = this.hasUnsavedChanges();
        const changes = this.getChangesSummary();

        return `
            <div class="quote-editor-panel">
                <div class="editor-header">
                    <h3>✏️ Editando Cotización #${this.currentQuote.id}</h3>
                    ${hasChanges ? '<span class="unsaved-badge">⚠️ Cambios sin guardar</span>' : ''}
                </div>
                
                ${hasChanges && changes.length > 0 ? `
                    <div class="changes-summary">
                        <strong>Cambios realizados:</strong>
                        <ul>
                            ${changes.map(c => `<li>${c}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <div class="editor-actions">
                    <button class="btn btn-success" onclick="quoteEditor.saveChanges()">
                        💾 Guardar Cambios
                    </button>
                    <button class="btn btn-secondary" onclick="quoteEditor.cancelEdit()">
                        ↩️ Cancelar
                    </button>
                    <button class="btn btn-warning" onclick="quoteEditor.duplicateQuote()">
                        📋 Duplicar
                    </button>
                    <button class="btn btn-danger" onclick="quoteEditor.endEdit()">
                        🔚 Terminar Edición
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Genera ID único para cotización
     * @returns {string}
     */
    generateQuoteId() {
        return `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Exportar para uso global
window.QuoteEditor = QuoteEditor;
