document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    let pricingData = null;

    // 1. Cargar los datos de precios al iniciar
    async function loadPricingData() {
        try {
            const response = await fetch('/api/pricing-data');
            if (!response.ok) {
                throw new Error('No se pudo conectar con el servidor de datos.');
            }
            pricingData = await response.json();
            addMessage('Hola, soy tu asistente de precios. Tengo la información de productos y categorías cargada. ¿En qué puedo ayudarte?', 'assistant');
        } catch (error) {
            console.error('Error al cargar datos de precios:', error);
            addMessage('Lo siento, no pude cargar la información de precios. Revisa la consola del servidor.', 'assistant');
        }
    }

    // 2. Añadir mensajes al chat
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.textContent = text;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll
    }

    // 3. Procesar la pregunta del usuario (IA simple)
    function processQuery(query) {
        const q = query.toLowerCase().trim();
        addMessage(query, 'user');

        if (!pricingData) {
            addMessage('Todavía estoy esperando los datos de precios. Inténtalo de nuevo en un momento.', 'assistant');
            return;
        }

        // Buscar por nombre de producto
        const productoEncontrado = pricingData.productos.find(p => q.includes(p.nombre.toLowerCase()));
        if (productoEncontrado) {
            const respuesta = `Claro, aquí tienes los datos de "${productoEncontrado.nombre}":\n` +
                              ` - Precio: $${productoEncontrado.precio}\n` +
                              ` - Costo: $${productoEncontrado.costo}\n` +
                              ` - Categoría: ${productoEncontrado.categoria}`;
            addMessage(respuesta, 'assistant');
            return;
        }

        // Buscar por nombre de categoría
        const categoriaEncontrada = pricingData.categorias.find(c => q.includes(c.nombre.toLowerCase()));
        if (categoriaEncontrada) {
            const productosEnCategoria = pricingData.productos
                .filter(p => p.categoria.toLowerCase() === categoriaEncontrada.nombre.toLowerCase())
                .map(p => p.nombre)
                .join(', ');
            const respuesta = `En la categoría "${categoriaEncontrada.nombre}" tenemos: ${productosEnCategoria || 'ningún producto asignado'}.`;
            addMessage(respuesta, 'assistant');
            return;
        }
        
        // Si no encuentra nada
        addMessage('Lo siento, no entendí tu pregunta o no encontré información sobre eso. Puedes preguntarme por el "precio de lona" o "productos en la categoría vinilos".', 'assistant');
    }

    // 4. Escuchar el input del usuario
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && userInput.value.trim() !== '') {
            processQuery(userInput.value);
            userInput.value = '';
        }
    });

    // Iniciar todo
    loadPricingData();
});