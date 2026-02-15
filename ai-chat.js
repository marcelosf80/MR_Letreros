/**
 * AI Chat Module - Asistente Virtual para MR Letreros
 */
class AIChat {
    constructor() {
        this.brain = new window.BusinessAI();
        this.isOpen = false;
        this.messagesContainer = document.getElementById('chatMessages');
        this.input = document.getElementById('chatInput');
        
        // Bloquear input hasta cargar
        this.input.disabled = true;
        this.input.placeholder = "Iniciando cerebro...";
        
        this.init();
    }

    async init() {
        await this.brain.init();
        this.input.disabled = false;
        this.input.placeholder = "Escribe aquí...";
        this.addMessage('bot', 'Hola 👋, soy tu asistente de negocios. Escribe "ayuda" para ver qué puedo hacer.');
    }

    async processMessage(text) {
        if (!text.trim()) return;

        // 1. Mostrar mensaje usuario
        this.addMessage('user', text);
        this.input.value = '';
        this.showTyping();

        // 2. Cargar datos frescos
        try {
            const [trabajosRes, clientesRes, rendimientosRes] = await Promise.all([
                fetch('/api/trabajos'),
                fetch('/api/clientes'),
                fetch('/api/rendimientos')
            ]);
            
            const worksData = await trabajosRes.json();
            const clients = await clientesRes.json();
            const rendimientos = await rendimientosRes.json();
            const works = worksData.works || [];

            // 3. Analizar intención
            const lowerText = text.toLowerCase();
            let response = '';

            // INTENCIÓN: DEUDA / COBROS
            if (lowerText.includes('deuda') || lowerText.includes('debe') || lowerText.includes('cobrar')) {
                const debtors = works
                    .filter(w => w.paymentStatus === 'pending' && w.balance > 0)
                    .reduce((acc, w) => {
                        if (!acc[w.clientName]) acc[w.clientName] = 0;
                        acc[w.clientName] += w.balance;
                        return acc;
                    }, {});

                const sortedDebtors = Object.entries(debtors)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5); // Top 5

                if (sortedDebtors.length > 0) {
                    response = 'Aquí están los clientes con mayor saldo pendiente:<br><br>';
                    response += sortedDebtors.map(([name, amount]) => 
                        `• <strong>${name}</strong>: $${this.formatMoney(amount)}`
                    ).join('<br>');
                } else {
                    response = '¡Buenas noticias! No tienes deudas pendientes importantes registradas.';
                }
            }
            
            // INTENCIÓN: RESUMEN / ESTADO
            else if (lowerText.includes('resumen') || lowerText.includes('estado') || lowerText.includes('cómo vamos')) {
                const active = works.filter(w => w.status === 'in_progress').length;
                const pending = works.filter(w => w.status === 'pending').length;
                const margin = rendimientos.resumen ? rendimientos.resumen.margenTotal : 0;
                
                response = `Resumen rápido del negocio:<br>
                🔨 <strong>${active}</strong> trabajos en proceso<br>
                ⏳ <strong>${pending}</strong> pendientes de iniciar<br>
                📈 Margen actual: <strong>${margin.toFixed(1)}%</strong>`;
            }

            // INTENCIÓN: VIP / CLIENTES
            else if (lowerText.includes('vip') || lowerText.includes('mejor') || lowerText.includes('llamar')) {
                const vips = (Array.isArray(clients) ? clients : [])
                    .filter(c => c.rating >= 4 || c.categoria === 'VIP')
                    .sort((a, b) => new Date(a.ultimoTrabajo || 0) - new Date(b.ultimoTrabajo || 0)) // Los que hace más tiempo no compran primero
                    .slice(0, 3);

                if (vips.length > 0) {
                    response = 'Te sugiero contactar a estos clientes VIP que hace tiempo no vemos:<br><br>';
                    response += vips.map(c => `⭐ <strong>${c.nombre}</strong> (Última vez: ${c.ultimoTrabajo ? new Date(c.ultimoTrabajo).toLocaleDateString() : 'N/D'})`).join('<br>');
                } else {
                    response = 'No encontré clientes VIP inactivos por el momento.';
                }
            }

            // INTENCIÓN: AYUDA
            else if (lowerText.includes('ayuda') || lowerText.includes('hola')) {
                response = `Puedo ayudarte con lo siguiente:<br>
                💰 <strong>"¿Quién me debe?"</strong> - Ver deudas pendientes<br>
                📊 <strong>"Dame un resumen"</strong> - Estado actual del taller<br>
                ⭐ <strong>"Clientes VIP"</strong> - A quién contactar hoy`;
            }

            // DEFAULT
            else {
                response = 'No estoy seguro de entender. Intenta preguntarme por "deudas", "resumen" o "clientes vip".';
            }

            this.removeTyping();
            this.addMessage('bot', response);

        } catch (error) {
            console.error(error);
            this.removeTyping();
            this.addMessage('bot', 'Tuve un problema conectando con la base de datos. Intenta de nuevo.');
        }
    }

    addMessage(sender, html) {
        const div = document.createElement('div');
        div.className = `chat-message ${sender}`;
        div.innerHTML = html;
        this.messagesContainer.appendChild(div);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    showTyping() {
        const div = document.createElement('div');
        div.className = 'chat-message bot typing';
        div.id = 'typingIndicator';
        div.innerHTML = '<span>.</span><span>.</span><span>.</span>';
        this.messagesContainer.appendChild(div);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    removeTyping() {
        const el = document.getElementById('typingIndicator');
        if (el) el.remove();
    }

    formatMoney(amount) {
        const value = parseFloat(amount) || 0;
        return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(value);
    }
}

// Inicialización Global
let aiChatInstance;
document.addEventListener('DOMContentLoaded', () => {
    // Esperar un poco para asegurar que BusinessAI esté cargado
    setTimeout(() => {
        if (window.BusinessAI) {
            aiChatInstance = new AIChat();
        }
    }, 500);
});

// Funciones globales para el HTML
window.toggleChat = function() {
    const widget = document.getElementById('aiChatWidget');
    const fab = document.getElementById('chatFab');
    
    if (widget.classList.contains('active')) {
        widget.classList.remove('active');
        fab.style.display = 'flex';
    } else {
        widget.classList.add('active');
        fab.style.display = 'none';
        document.getElementById('chatInput').focus();
    }
};

window.sendMessage = function() {
    const input = document.getElementById('chatInput');
    const text = input.value;
    if (aiChatInstance && text) {
        aiChatInstance.processMessage(text);
    }
};

window.handleChatKey = function(e) {
    if (e.key === 'Enter') {
        window.sendMessage();
    }
};