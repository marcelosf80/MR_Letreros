/**
 * Work Manager - Sistema de Gestión de Trabajos
 * Gestiona el flujo completo desde cotización hasta trabajo finalizado
 * Incluye notificaciones y tracking
 * 
 * @version 1.0.0
 * @author MR Letreros Team
 */

class WorkManager {
    constructor() {
        this.works = [];
        this.notifications = [];
        this.maxNotifications = 50;
        this.notificationSound = null;
        this.initializeNotificationSound();
    }

    /**
     * Inicializa el sonido de notificación
     */
    initializeNotificationSound() {
        // Crear un tono simple usando Web Audio API
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioContext = new AudioContext();
            }
        } catch (e) {
            console.warn('[WORK-MGR] Audio no disponible');
        }
    }

    /**
     * Crea un trabajo desde una cotización
     * @param {Object} quote - Cotización aprobada
     * @returns {Object} - Trabajo creado
     */
    createWorkFromQuote(quote) {
        const work = {
            id: this.generateWorkId(),
            quoteId: quote.id,
            clientName: quote.clientName || 'Cliente sin nombre',
            clientPhone: quote.clientPhone || '',
            clientEmail: quote.clientEmail || '',
            clientAddress: quote.clientAddress || '',
            
            // Datos del trabajo
            products: quote.products || [],
            terceros: quote.terceros || [],
            multiCategories: quote.multiCategories || null,
            
            // Financiero
            subtotal: quote.subtotal || 0,
            iva: quote.iva || 0,
            total: quote.total || 0,
            totalCost: quote.totalCost || 0,
            profit: quote.ganancia || 0,
            
            // Estados
            status: 'pending', // pending, in_progress, completed, cancelled
            paymentStatus: quote.orderStatus?.paymentStatus || 'pending',
            deliveryStatus: quote.orderStatus?.deliveryStatus || 'pending',
            
            // Fechas
            createdAt: new Date().toISOString(),
            startedAt: null,
            completedAt: null,
            deliveryDate: quote.deliveryDate || null,
            
            // Notas y seguimiento
            notes: [],
            timeline: [],
            
            // Prioridad
            priority: 'normal', // low, normal, high, urgent
            
            // Metadata
            createdBy: quote.createdBy || 'Sistema',
            assignedTo: null
        };

        this.works.push(work);
        this.addToTimeline(work.id, 'created', 'Trabajo creado desde cotización');
        this.createNotification('Nuevo trabajo creado', `Cliente: ${work.clientName}`, 'success', work.id);
        
        console.log('[WORK-MGR] ✅ Trabajo creado:', work.id);
        return work;
    }

    /**
     * Obtiene un trabajo por ID
     * @param {string} workId
     * @returns {Object|null}
     */
    getWork(workId) {
        return this.works.find(w => w.id === workId) || null;
    }

    /**
     * Obtiene todos los trabajos
     * @param {Object} filters - Filtros opcionales
     * @returns {Array}
     */
    getWorks(filters = {}) {
        let filtered = [...this.works];

        if (filters.status) {
            filtered = filtered.filter(w => w.status === filters.status);
        }
        if (filters.paymentStatus) {
            filtered = filtered.filter(w => w.paymentStatus === filters.paymentStatus);
        }
        if (filters.priority) {
            filtered = filtered.filter(w => w.priority === filters.priority);
        }
        if (filters.clientName) {
            const search = filters.clientName.toLowerCase();
            filtered = filtered.filter(w => 
                w.clientName.toLowerCase().includes(search)
            );
        }

        // Ordenar por fecha de creación (más recientes primero)
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return filtered;
    }

    /**
     * Actualiza el estado de un trabajo
     * @param {string} workId
     * @param {string} newStatus - pending, in_progress, completed, cancelled
     */
    updateStatus(workId, newStatus) {
        const work = this.getWork(workId);
        if (!work) {
            throw new Error('Trabajo no encontrado');
        }

        const oldStatus = work.status;
        work.status = newStatus;

        // Actualizar fechas según estado
        if (newStatus === 'in_progress' && !work.startedAt) {
            work.startedAt = new Date().toISOString();
        }
        if (newStatus === 'completed' && !work.completedAt) {
            work.completedAt = new Date().toISOString();
        }

        this.addToTimeline(workId, 'status_changed', 
            `Estado cambiado: ${this.getStatusLabel(oldStatus)} → ${this.getStatusLabel(newStatus)}`
        );

        const notifMessage = `${work.clientName}: ${this.getStatusLabel(newStatus)}`;
        this.createNotification('Estado actualizado', notifMessage, 'info', workId);

        console.log(`[WORK-MGR] Estado actualizado: ${workId} → ${newStatus}`);
    }

    /**
     * Actualiza el estado de pago
     * @param {string} workId
     * @param {string} paymentStatus
     * @param {Object} paymentInfo
     */
    updatePaymentStatus(workId, paymentStatus, paymentInfo = {}) {
        const work = this.getWork(workId);
        if (!work) {
            throw new Error('Trabajo no encontrado');
        }

        work.paymentStatus = paymentStatus;
        work.paymentMethod = paymentInfo.method || null;
        work.paymentNotes = paymentInfo.notes || '';
        work.paymentDate = paymentStatus === 'paid' ? new Date().toISOString() : null;

        this.addToTimeline(workId, 'payment_updated', 
            `Pago: ${paymentStatus === 'paid' ? 'Pagado' : 'Pendiente'}`
        );

        if (paymentStatus === 'paid') {
            this.createNotification('¡Pago recibido!', 
                `${work.clientName} - $${this.formatCurrency(work.total)}`, 
                'success', workId
            );
        }
    }

    /**
     * Actualiza el estado de entrega
     * @param {string} workId
     * @param {string} deliveryStatus
     * @param {Object} deliveryInfo
     */
    updateDeliveryStatus(workId, deliveryStatus, deliveryInfo = {}) {
        const work = this.getWork(workId);
        if (!work) {
            throw new Error('Trabajo no encontrado');
        }

        work.deliveryStatus = deliveryStatus;
        work.deliveryNotes = deliveryInfo.notes || '';
        work.actualDeliveryDate = deliveryStatus === 'delivered' ? new Date().toISOString() : null;

        this.addToTimeline(workId, 'delivery_updated', 
            `Entrega: ${deliveryStatus === 'delivered' ? 'Entregado' : 'Pendiente'}`
        );

        if (deliveryStatus === 'delivered') {
            this.createNotification('¡Trabajo entregado!', 
                `${work.clientName}`, 
                'success', workId
            );
            
            // Si está entregado y no está completado, marcarlo como completado
            if (work.status !== 'completed') {
                this.updateStatus(workId, 'completed');
            }
        }
    }

    /**
     * Establece la prioridad de un trabajo
     * @param {string} workId
     * @param {string} priority - low, normal, high, urgent
     */
    setPriority(workId, priority) {
        const work = this.getWork(workId);
        if (!work) {
            throw new Error('Trabajo no encontrado');
        }

        work.priority = priority;
        this.addToTimeline(workId, 'priority_changed', 
            `Prioridad: ${this.getPriorityLabel(priority)}`
        );

        if (priority === 'urgent') {
            this.createNotification('Prioridad URGENTE', 
                `${work.clientName}`, 
                'warning', workId
            );
        }
    }

    /**
     * Agrega una nota a un trabajo
     * @param {string} workId
     * @param {string} noteText
     * @param {string} author
     */
    addNote(workId, noteText, author = 'Usuario') {
        const work = this.getWork(workId);
        if (!work) {
            throw new Error('Trabajo no encontrado');
        }

        const note = {
            id: this.generateNoteId(),
            text: noteText,
            author: author,
            createdAt: new Date().toISOString()
        };

        work.notes.push(note);
        this.addToTimeline(workId, 'note_added', `Nota agregada por ${author}`);

        console.log('[WORK-MGR] 📝 Nota agregada:', workId);
        return note;
    }

    /**
     * Agrega evento al timeline del trabajo
     * @param {string} workId
     * @param {string} eventType
     * @param {string} description
     */
    addToTimeline(workId, eventType, description) {
        const work = this.getWork(workId);
        if (!work) return;

        work.timeline.push({
            id: this.generateTimelineId(),
            type: eventType,
            description: description,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Crea una notificación
     * @param {string} title
     * @param {string} message
     * @param {string} type - success, info, warning, error
     * @param {string} workId
     */
    createNotification(title, message, type = 'info', workId = null) {
        const notification = {
            id: this.generateNotificationId(),
            title: title,
            message: message,
            type: type,
            workId: workId,
            read: false,
            createdAt: new Date().toISOString()
        };

        this.notifications.unshift(notification);

        // Limitar número de notificaciones
        if (this.notifications.length > this.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.maxNotifications);
        }

        // Reproducir sonido
        this.playNotificationSound();

        // Mostrar notificación en pantalla
        this.showScreenNotification(notification);

        // Emitir evento personalizado
        window.dispatchEvent(new CustomEvent('workNotification', { 
            detail: notification 
        }));

        console.log('[WORK-MGR] 🔔 Notificación:', title);
        return notification;
    }

    /**
     * Reproduce sonido de notificación
     */
    playNotificationSound() {
        if (!this.audioContext) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(
                0.01, 
                this.audioContext.currentTime + 0.2
            );

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.2);
        } catch (e) {
            console.warn('[WORK-MGR] No se pudo reproducir sonido');
        }
    }

    /**
     * Muestra notificación en pantalla
     * @param {Object} notification
     */
    showScreenNotification(notification) {
        // Crear elemento de notificación
        const notifEl = document.createElement('div');
        notifEl.className = `screen-notification notification-${notification.type}`;
        notifEl.innerHTML = `
            <div class="notification-header">
                <strong>${this.getNotificationIcon(notification.type)} ${notification.title}</strong>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="notification-body">${notification.message}</div>
        `;

        // Estilos inline
        notifEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            min-width: 300px;
            max-width: 400px;
            background: ${this.getNotificationColor(notification.type)};
            color: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;

        document.body.appendChild(notifEl);

        // Auto-remover después de 5 segundos
        setTimeout(() => {
            notifEl.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => notifEl.remove(), 300);
        }, 5000);
    }

    /**
     * Marca notificación como leída
     * @param {string} notificationId
     */
    markAsRead(notificationId) {
        const notif = this.notifications.find(n => n.id === notificationId);
        if (notif) {
            notif.read = true;
        }
    }

    /**
     * Marca todas las notificaciones como leídas
     */
    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
    }

    /**
     * Obtiene notificaciones no leídas
     * @returns {Array}
     */
    getUnreadNotifications() {
        return this.notifications.filter(n => !n.read);
    }

    /**
     * Obtiene conteo de notificaciones no leídas
     * @returns {number}
     */
    getUnreadCount() {
        return this.getUnreadNotifications().length;
    }

    // ==================== HELPERS ====================

    getStatusLabel(status) {
        const labels = {
            pending: '⏳ Pendiente',
            in_progress: '🔧 En Progreso',
            completed: '✅ Completado',
            cancelled: '❌ Cancelado'
        };
        return labels[status] || status;
    }

    getPriorityLabel(priority) {
        const labels = {
            low: '🟢 Baja',
            normal: '🟡 Normal',
            high: '🟠 Alta',
            urgent: '🔴 URGENTE'
        };
        return labels[priority] || priority;
    }

    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌'
        };
        return icons[type] || 'ℹ️';
    }

    getNotificationColor(type) {
        const colors = {
            success: '#4CAF50',
            info: '#2196F3',
            warning: '#FFC107',
            error: '#F44336'
        };
        return colors[type] || '#2196F3';
    }

    formatCurrency(num) {
        return new Intl.NumberFormat('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }

    generateWorkId() {
        return `work_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateNoteId() {
        return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateTimelineId() {
        return `tl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateNotificationId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Exporta datos para guardar
     * @returns {Object}
     */
    exportData() {
        return {
            works: this.works,
            notifications: this.notifications.slice(0, 20) // Solo últimas 20
        };
    }

    /**
     * Importa datos guardados
     * @param {Object} data
     */
    importData(data) {
        if (data.works) {
            this.works = data.works;
        }
        if (data.notifications) {
            this.notifications = data.notifications;
        }
        console.log('[WORK-MGR] 📥 Datos importados:', this.works.length, 'trabajos');
    }
}

// Agregar estilos de animación
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        opacity: 0.8;
        padding: 0;
        line-height: 1;
    }
    
    .notification-close:hover {
        opacity: 1;
    }
    
    .notification-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }
    
    .notification-body {
        opacity: 0.9;
    }
`;
document.head.appendChild(style);

// Exportar para uso global
window.WorkManager = WorkManager;
