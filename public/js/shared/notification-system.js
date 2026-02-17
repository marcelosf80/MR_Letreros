/**
 * Notification System - Sistema de Notificaciones
 * Se agrega al aprobar cotizaciones para mostrar notificaciones visuales
 * 
 * Agregar este script en gremio.html y clientes.html
 * @version 1.0.0
 */

(function() {
    'use strict';
    
    // ==================== ESTILOS ====================
    const styles = document.createElement('style');
    styles.textContent = `
        .notification-toast {
            position: fixed;
            top: 80px;
            right: 20px;
            min-width: 320px;
            max-width: 420px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1.25rem;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            z-index: 10000;
            animation: slideInRight 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            backdrop-filter: blur(10px);
        }
        
        .notification-toast.success {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }
        
        .notification-toast.error {
            background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
        }
        
        .notification-toast.info {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(500px);
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
                transform: translateX(500px);
                opacity: 0;
            }
        }
        
        .notification-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
        }
        
        .notification-title {
            font-size: 1.1rem;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .notification-close {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        
        .notification-close:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .notification-body {
            font-size: 0.95rem;
            line-height: 1.4;
            opacity: 0.95;
        }
        
        .notification-actions {
            margin-top: 1rem;
            display: flex;
            gap: 0.5rem;
        }
        
        .notification-btn {
            padding: 0.5rem 1rem;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.9rem;
            transition: all 0.2s;
        }
        
        .notification-btn-primary {
            background: rgba(255, 255, 255, 0.9);
            color: #333;
        }
        
        .notification-btn-primary:hover {
            background: white;
            transform: translateY(-2px);
        }
        
        .notification-btn-secondary {
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }
        
        .notification-btn-secondary:hover {
            background: rgba(255, 255, 255, 0.3);
        }
    `;
    document.head.appendChild(styles);
    
    // ==================== FUNCIONES PÚBLICAS ====================
    
    /**
     * Muestra una notificación toast
     * @param {Object} options - { title, message, type, duration, actions }
     */
    window.showNotification = function(options) {
        const {
            title = 'Notificación',
            message = '',
            type = 'info', // success, error, info
            duration = 5000,
            icon = getIconForType(type),
            actions = null
        } = options;
        
        // Crear elemento
        const toast = document.createElement('div');
        toast.className = `notification-toast ${type}`;
        
        // Header
        const header = document.createElement('div');
        header.className = 'notification-header';
        header.innerHTML = `
            <div class="notification-title">
                <span>${icon}</span>
                <span>${title}</span>
            </div>
            <button class="notification-close">×</button>
        `;
        
        // Body
        const body = document.createElement('div');
        body.className = 'notification-body';
        body.textContent = message;
        
        // Ensamblar
        toast.appendChild(header);
        toast.appendChild(body);
        
        // Acciones opcionales
        if (actions && actions.length > 0) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'notification-actions';
            
            actions.forEach(action => {
                const btn = document.createElement('button');
                btn.className = `notification-btn notification-btn-${action.type || 'secondary'}`;
                btn.textContent = action.text;
                btn.onclick = () => {
                    if (action.onClick) action.onClick();
                    removeToast(toast);
                };
                actionsDiv.appendChild(btn);
            });
            
            toast.appendChild(actionsDiv);
        }
        
        // Event listeners
        const closeBtn = header.querySelector('.notification-close');
        closeBtn.onclick = () => removeToast(toast);
        
        // Agregar al DOM
        document.body.appendChild(toast);
        
        // Reproducir sonido
        playNotificationSound();
        
        // Auto-remover
        if (duration > 0) {
            setTimeout(() => removeToast(toast), duration);
        }
        
        return toast;
    };
    
    /**
     * Muestra notificación de trabajo creado
     * @param {Object} work - Objeto de trabajo
     */
    window.notifyWorkCreated = function(work) {
        showNotification({
            title: '✅ Trabajo Creado',
            message: `Nuevo trabajo para: ${work.clientName}
Total: $${formatCurrency(work.total)}`,
            type: 'success',
            duration: 6000,
            actions: [
                {
                    text: '👁️ Ver Trabajos',
                    type: 'primary',
                    onClick: () => window.open('/trabajos.html', '_blank')
                }
            ]
        });
    };
    
    /**
     * Muestra notificación de cotización guardada
     * @param {Object} quote - Objeto de cotización
     */
    window.notifyQuoteSaved = function(quote) {
        showNotification({
            title: '💾 Cotización Guardada',
            message: `Cliente: ${quote.cliente?.nombre || 'Sin nombre'}
Total: $${formatCurrency(quote.totalCliente)}`,
            type: 'info',
            duration: 4000
        });
    };
    
    /**
     * Muestra notificación de pago registrado
     * @param {number} amount
     * @param {string} clientName
     */
    window.notifyPaymentReceived = function(amount, clientName) {
        showNotification({
            title: '💰 Pago Recibido',
            message: `De: ${clientName}
Monto: $${formatCurrency(amount)}`,
            type: 'success',
            duration: 5000
        });
    };
    
    /**
     * Muestra notificación de error
     * @param {string} message
     */
    window.notifyError = function(message) {
        showNotification({
            title: '❌ Error',
            message: message,
            type: 'error',
            duration: 6000
        });
    };
    
    // ==================== FUNCIONES PRIVADAS ====================
    
    function removeToast(toast) {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
    
    function getIconForType(type) {
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        return icons[type] || 'ℹ️';
    }
    
    function formatCurrency(num) {
        return new Intl.NumberFormat('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }
    
    function playNotificationSound() {
        try {
            // Crear contexto de audio
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            
            const audioContext = new AudioContext();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Configurar sonido
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (e) {
            console.warn('[NOTIFICATION] No se pudo reproducir sonido:', e);
        }
    }
    
    console.log('[NOTIFICATION-SYSTEM] ✅ Sistema de notificaciones cargado');
})();
