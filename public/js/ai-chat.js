/**
 * AI Chat Module - Asistente Virtual para MR Letreros
 */
class AIChat {
    constructor() {
        this.messagesContainer = document.getElementById('chatMessages');
        this.input = document.getElementById('chatInput');
        this.pendingAction = null;
        this.chatHistory = [];
        
        if (!this.input || !this.messagesContainer) {
            console.error("Elementos del chat no encontrados en el DOM");
            return;
        }

        this.input.disabled = true;
        this.input.placeholder = "Iniciando cerebro...";
        
        this.init();
        this.loadChatHistory();
    }

    async init() {
        this.input.disabled = false;
        this.input.placeholder = "Escribe aquí...";
        if (this.chatHistory.length === 0) {
            this.addMessage('bot', 'Hola 👋, soy tu asistente de negocios. Escribe "ayuda" para ver qué puedo hacer.');
        }
    }

    async processMessage(text) {
        if (!text.trim()) return;
    
        this.addMessage('user', text);
        this.saveChatHistory();
        this.input.value = '';

        // Verificar confirmaciones pendientes
        if (this.pendingAction) {
            const lowerText = text.toLowerCase().trim();
            if (['sí', 'si', 'confirmar', 'dale', 'ok'].includes(lowerText)) {
                this.showTyping();
                const action = this.pendingAction;
                this.pendingAction = null;

                if (action.type === 'delete_client') {
                    const response = await this.executeDeleteClient(action.data);
                    this.removeTyping();
                    this.addMessage('bot', response);
                }
            } else {
                this.pendingAction = null;
                this.addMessage('bot', 'Acción cancelada.');
            }
            return;
        }

        this.showTyping();
    
        try {
            // CORRECCIÓN: Usar 'mr_token' en lugar de 'token'
            const token = localStorage.getItem('mr_token');
            if (!token) {
                this.removeTyping();
                this.addMessage('bot', '⚠️ No tienes sesión activa. Por favor recarga la página o inicia sesión.');
                return;
            }

            // Enviar mensaje al endpoint de IA
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    messages: [
                        // Convertir historial reciente para contexto (opcional, aquí enviamos solo el último por simplicidad o podrías enviar más)
                        { role: 'user', content: text }
                    ]
                })
            });

            if (!response.ok) throw new Error(`Error API: ${response.status}`);
            
            const data = await response.json();
            this.removeTyping();
            
            // Mostrar respuesta de la IA
            this.addMessage('bot', data.content || 'No recibí respuesta.');

            // Si la IA ejecutó una acción, mostrar resultado si no está incluido en content
            if (data.accion_ejecutada && !data.content.includes(data.accion_ejecutada.mensaje)) {
                 // A veces la IA ya incluye el mensaje de éxito en 'content', si no, lo agregamos
                 // (En tu implementación de server.js ya lo concatena, así que esto es redundante pero seguro)
            }

        } catch (error) {
            console.error("Error en processMessage:", error);
            this.removeTyping();
            this.addMessage('bot', '❌ Tuve un problema conectando con el servidor. Intenta de nuevo.');
        }
    }

    addMessage(sender, text) {
        const div = document.createElement('div');
        div.className = `chat-message ${sender}`;
        // FIX XSS: el contenido es texto plano (mensaje del usuario / respuesta del LLM)
        div.innerHTML = escapeHtml(text);
        this.messagesContainer.appendChild(div);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        
        // Guardar solo los últimos 50 mensajes para no saturar localStorage
        if (sender !== 'system') { // No guardar mensajes de sistema/typing
            this.chatHistory.push({ sender, html: text, timestamp: new Date().toISOString() });
            if (this.chatHistory.length > 50) this.chatHistory.shift();
            this.saveChatHistory();
        }
    }

    loadChatHistory() {
        try {
            const storedHistory = localStorage.getItem('aiChatHistory');
            if (storedHistory) {
                this.chatHistory = JSON.parse(storedHistory);
                this.chatHistory.forEach(msg => {
                    // Recrear visualmente sin guardar de nuevo
                    const div = document.createElement('div');
                    div.className = `chat-message ${msg.sender}`;
                    div.innerHTML = escapeHtml(msg.html);
                    this.messagesContainer.appendChild(div);
                });
                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            }
        } catch (e) {
            console.error('Error cargando historial:', e);
            this.chatHistory = [];
        }
    }

    saveChatHistory() {
        localStorage.setItem('aiChatHistory', JSON.stringify(this.chatHistory));
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
}

// Inicialización
let aiChatInstance;
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        aiChatInstance = new AIChat();
    }, 500);
});

// Funciones globales
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