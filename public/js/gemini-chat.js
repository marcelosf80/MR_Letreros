/**
 * GEMINI CHAT - Asistente Inteligente para MR Letreros
 * Powered by Google Gemini 1.5 Flash
 * 
 * Funcionalidades:
 * - Análisis de deudas (Estricto)
 * - Lectura de precios para cotizaciones
 * - Contexto del negocio en tiempo real
 */

class GeminiChat {
    constructor() {
        this.messagesContainer = document.getElementById('chatMessages');
        this.input = document.getElementById('chatInput');
        this.history = []; // Para mantener el hilo de la conversación

        this.init();
    }

    init() {
        console.log('🤖 Asistente IA activo...');
        if (this.input) {
            this.input.disabled = false;
            this.input.placeholder = "Pregúntale a la IA...";
            this.input.focus();
        }

        // Mensaje de bienvenida
        this.addMessage('bot', '👋 Hola, soy tu asistente administrativo. Puedo consultarte deudas, precios o incluso **crear pedidos** si me das los detalles. ¿Qué necesitás?');

        // Sobrescribir manejadores globales
        window.sendMessage = () => this.handleUserMessage();
        window.handleChatKey = (e) => {
            if (e.key === 'Enter') this.handleUserMessage();
        };
    }

    async handleUserMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        // 1. Mostrar mensaje usuario y guardar en history
        this.addMessage('user', text);
        this.history.push({ role: 'user', content: text });

        this.input.value = '';
        this.showTyping();

        try {
            // 2. Llamar al servidor (él tiene el contexto y la lógica de archivos)
            const response = await window.AUTH.fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: this.history })
            });

            if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);

            const data = await response.json();

            // 3. Mostrar respuesta y guardar en history
            this.removeTyping();
            if (data.content) {
                this.addMessage('bot', this.formatResponse(data.content));
                this.history.push({ role: 'assistant', content: data.content });

                // Si se ejecutó una acción exitosa (como crear trabajo), podemos dar feedback visual extra
                if (data.accion_ejecutada && data.accion_ejecutada.ok) {
                    console.log('✅ Acción ejecutada:', data.accion_ejecutada);
                    // Opcional: Recargar listas si estamos en una página relevante
                    if (window.loadWorks) window.loadWorks();
                }
            } else {
                this.addMessage('bot', 'No recibí una respuesta clara del servidor.');
            }

        } catch (error) {
            console.error('Error Asistente IA:', error);
            this.removeTyping();
            this.addMessage('bot', '⚠️ Tuve un problema conectando con el cerebro del sistema. Por favor intenta de nuevo.');
        }
    }

    async callGeminiAPI(payload) {
        // Mantenemos la firma por compatibilidad si algo más la usa, 
        // pero redirigimos a la nueva lógica o marcamos como obsoleta.
        console.warn('callGeminiAPI es obsoleta, usar handleUserMessage con el servidor.');
    }

    // --- Utilidades de UI ---

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
        div.innerHTML = '<span>✨</span><span>✨</span><span>✨</span>'; // Estilo Gemini
        this.messagesContainer.appendChild(div);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    removeTyping() {
        const el = document.getElementById('typingIndicator');
        if (el) el.remove();
    }

    formatResponse(text) {
        // Convertir Markdown básico a HTML para el chat
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Negritas
            .replace(/\n/g, '<br>') // Saltos de línea
            .replace(/- /g, '• '); // Listas
    }
}

// Inicialización
let geminiChatInstance;
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        geminiChatInstance = new GeminiChat();
    }, 600);
});

// Asegurar que el toggle funcione
window.toggleChat = function () {
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