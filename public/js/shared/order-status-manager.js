/**
 * Order Status Manager - Módulo de Gestión de Estados de Pedidos
 * Implementa Single Responsibility Principle
 * 
 * @version 1.0.0
 * @author MR Letreros Team
 */

class OrderStatusManager {
    constructor() {
        // Definición de estados posibles
        this.STATUS = {
            PENDING: 'pending',
            PAID: 'paid',
            DELIVERED: 'delivered',
            CANCELLED: 'cancelled'
        };

        // Etiquetas para mostrar en UI
        this.STATUS_LABELS = {
            pending: '⏳ Pendiente',
            paid: '💳 Pagado',
            delivered: '✅ Entregado',
            cancelled: '❌ Cancelado'
        };

        // Colores para cada estado
        this.STATUS_COLORS = {
            pending: '#FFC107',
            paid: '#2196F3',
            delivered: '#4CAF50',
            cancelled: '#F44336'
        };
    }

    /**
     * Crea un nuevo objeto de estado para un pedido
     * @returns {Object} - Estado inicial del pedido
     */
    createOrderStatus() {
        return {
            paymentStatus: this.STATUS.PENDING,
            deliveryStatus: this.STATUS.PENDING,
            paymentDate: null,
            deliveryDate: null,
            paymentMethod: null,
            paymentNotes: '',
            deliveryNotes: ''
        };
    }

    /**
     * Marca un pedido como pagado
     * @param {Object} orderStatus - Estado actual del pedido
     * @param {Object} paymentInfo - { method, notes }
     * @returns {Object} - Estado actualizado
     */
    markAsPaid(orderStatus, paymentInfo = {}) {
        return {
            ...orderStatus,
            paymentStatus: this.STATUS.PAID,
            paymentDate: new Date().toISOString(),
            paymentMethod: paymentInfo.method || 'Efectivo',
            paymentNotes: paymentInfo.notes || ''
        };
    }

    /**
     * Marca un pedido como entregado
     * @param {Object} orderStatus - Estado actual del pedido
     * @param {Object} deliveryInfo - { notes }
     * @returns {Object} - Estado actualizado
     */
    markAsDelivered(orderStatus, deliveryInfo = {}) {
        return {
            ...orderStatus,
            deliveryStatus: this.STATUS.DELIVERED,
            deliveryDate: new Date().toISOString(),
            deliveryNotes: deliveryInfo.notes || ''
        };
    }

    /**
     * Revierte el estado de pago
     * @param {Object} orderStatus - Estado actual del pedido
     * @returns {Object} - Estado actualizado
     */
    unmarkPaid(orderStatus) {
        return {
            ...orderStatus,
            paymentStatus: this.STATUS.PENDING,
            paymentDate: null,
            paymentMethod: null,
            paymentNotes: ''
        };
    }

    /**
     * Revierte el estado de entrega
     * @param {Object} orderStatus - Estado actual del pedido
     * @returns {Object} - Estado actualizado
     */
    unmarkDelivered(orderStatus) {
        return {
            ...orderStatus,
            deliveryStatus: this.STATUS.PENDING,
            deliveryDate: null,
            deliveryNotes: ''
        };
    }

    /**
     * Valida si un pedido puede ser entregado (debe estar pagado primero)
     * @param {Object} orderStatus - Estado actual del pedido
     * @returns {boolean}
     */
    canBeDelivered(orderStatus) {
        return orderStatus.paymentStatus === this.STATUS.PAID;
    }

    /**
     * Obtiene la etiqueta de visualización para un estado
     * @param {string} status - Estado a mostrar
     * @returns {string} - Etiqueta formateada
     */
    getStatusLabel(status) {
        return this.STATUS_LABELS[status] || status;
    }

    /**
     * Obtiene el color para un estado
     * @param {string} status - Estado
     * @returns {string} - Color hexadecimal
     */
    getStatusColor(status) {
        return this.STATUS_COLORS[status] || '#666';
    }

    /**
     * Genera HTML para botones de estado
     * @param {Object} orderStatus - Estado actual del pedido
     * @param {string} orderId - ID del pedido
     * @returns {string} - HTML de los botones
     */
    generateStatusButtons(orderStatus, orderId) {
        const isPaid = orderStatus.paymentStatus === this.STATUS.PAID;
        const isDelivered = orderStatus.deliveryStatus === this.STATUS.DELIVERED;

        return `
            <div class="status-buttons" style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                <button 
                    class="btn btn-small ${isPaid ? 'btn-success' : 'btn-secondary'}" 
                    onclick="togglePaymentStatus('${orderId}')"
                    style="flex: 1;">
                    ${isPaid ? '💳 Pagado' : '⏳ Marcar Pagado'}
                </button>
                <button 
                    class="btn btn-small ${isDelivered ? 'btn-success' : 'btn-secondary'}" 
                    onclick="toggleDeliveryStatus('${orderId}')"
                    ${!isPaid && !isDelivered ? 'disabled' : ''}
                    style="flex: 1;">
                    ${isDelivered ? '✅ Entregado' : '📦 Marcar Entregado'}
                </button>
            </div>
        `;
    }

    /**
     * Genera badge de estado para mostrar en listas
     * @param {Object} orderStatus - Estado del pedido
     * @returns {string} - HTML del badge
     */
    generateStatusBadge(orderStatus) {
        const isPaid = orderStatus.paymentStatus === this.STATUS.PAID;
        const isDelivered = orderStatus.deliveryStatus === this.STATUS.DELIVERED;

        let status = 'pending';
        let label = '⏳ Pendiente';

        if (isDelivered) {
            status = 'delivered';
            label = '✅ Entregado';
        } else if (isPaid) {
            status = 'paid';
            label = '💳 Pagado';
        }

        const color = this.getStatusColor(status);

        return `
            <span class="status-badge" style="
                background: ${color}20;
                color: ${color};
                padding: 0.25rem 0.75rem;
                border-radius: 12px;
                font-size: 0.85rem;
                font-weight: 600;
                border: 1px solid ${color}50;
            ">
                ${label}
            </span>
        `;
    }

    /**
     * Exporta el estado de un pedido para guardar
     * @param {Object} orderStatus - Estado actual
     * @returns {Object} - Estado serializable
     */
    exportStatus(orderStatus) {
        return {
            paymentStatus: orderStatus.paymentStatus,
            deliveryStatus: orderStatus.deliveryStatus,
            paymentDate: orderStatus.paymentDate,
            deliveryDate: orderStatus.deliveryDate,
            paymentMethod: orderStatus.paymentMethod,
            paymentNotes: orderStatus.paymentNotes,
            deliveryNotes: orderStatus.deliveryNotes
        };
    }

    /**
     * Importa un estado guardado
     * @param {Object} savedStatus - Estado guardado
     * @returns {Object} - Estado válido
     */
    importStatus(savedStatus) {
        const defaultStatus = this.createOrderStatus();
        
        return {
            ...defaultStatus,
            ...savedStatus
        };
    }
}

// Exportar para uso global
window.OrderStatusManager = OrderStatusManager;
